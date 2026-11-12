#!/usr/bin/env node
// The one CLI for the certification desk. Human tables by default, --json for machines.
//   npm run certify -- help
//   npm run certify -- lodgements-due
//   npm run certify -- record-inspection INS-0007 --result=passed --on=2026-11-10 --findings="..." --actor="Jo"
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, truncate } from './lib/format.mjs';

// ------------------------------------------------------------------ reads

export const reads = {
  jobs: `select code, jurisdiction, approval_type, class, site_address, client, certifier, status, received_on, decided_on
         from job_register order by code`,
  quotes: `select q.code, cl.name client, q.site_address, q.approval_type, q.fee_cents, q.sent_on, q.status
           from quotes q join clients cl on cl.id = q.client_id order by q.sent_on desc, q.code`,
  'quotes-waiting': 'select code, client, site_address, approval_type, fee_cents, sent_on, days_waiting from quotes_waiting order by sent_on',
  'lodgements-due': 'select code, jurisdiction, council, decided_on, due_on, days_left from lodgements_due order by due_on, code',
  'inspections-due': `select code, job, stage, booked_for, inspector, site_address, state from inspections_due
                      where booked_for <= current_date + 7 order by booked_for, code`,
  reinspections: 'select code, job, stage, inspected_on, findings from reinspections_needed order by inspected_on, code',
  'info-requests': 'select code, job, request, sent_on, due_on, days_left from info_requests_open order by due_on, code',
  'fees-owing': 'select code, client, fee_cents, uninvoiced_cents, owing_cents from fees_owing order by owing_cents desc, uninvoiced_cents desc, code',
  'quiet-jobs': 'select code, site_address, client, status, last_activity from quiet_jobs order by last_activity, code',
  'finals-ready': 'select code, site_address, required_stages, passed_stages from finals_ready order by code',
  retention: 'select code, jurisdiction, site_address, closed_on, keep_until, basis from retention_register order by keep_until, code',
  'approvals-by-month': 'select month, approval_type, approvals from approvals_by_month order by month desc, approval_type',
  certifiers: 'select code, name, jurisdiction, registration_no, registration_class, registration_expires, days_left from certifier_watch order by registration_expires',
  'certifier-workload': `select ce.code certifier, count(*) filter (where a.status in ('assessing','information requested'))::int assessing,
           count(*) filter (where a.status in ('approved','under construction'))::int on_site,
           (select count(*)::int from inspections i where i.inspector_id = ce.id and i.result = 'booked' and i.booked_for <= current_date + 7) inspections_7_days
         from certifiers ce left join applications a on a.certifier_id = ce.id where ce.active group by ce.id, ce.code order by ce.code`,
  compliance: 'select code, rule, jurisdiction, finding from record_checks order by rule, code',
  attention: 'select code, issue, due from attention order by due, code',
  rules: `select 'clock' kind, code, jurisdiction, description, days, day_kind from rules
          union all select 'stage', stage, jurisdiction, 'class ' || class_pattern || ' stage ' || sequence, null, null from stage_rules
          order by kind, jurisdiction, code`,
  notes: 'select a.code job, n.actor, n.body, n.created_at from notes n join applications a on a.id = n.application_id order by n.created_at',
  audit: 'select entity, entity_id, operation, actor, created_at from audit_log order by id',
  imports: 'select source, filename, sha256, row_count, actor, created_at from import_batches order by created_at',
};

const money = (c) => (c == null ? '' : '$' + (Number(c) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// ------------------------------------------------------------------ helpers

const ENTITIES = {
  applications: 'site_address', quotes: 'site_address', inspections: 'stage', info_requests: 'request',
  clients: 'name', councils: 'name', certifiers: 'name',
};

export async function resolve(db, entity, ref) {
  if (!ENTITIES[entity]) throw Error(`Unsupported entity ${entity}`);
  if (!ref) throw Error(`Missing ${entity.replace(/_/g, ' ').replace(/s$/, '')} reference`);
  const rows = await db.query(`select id::text id, code, ${ENTITIES[entity]} as label from ${entity} order by code`);
  const s = String(ref).toLowerCase();
  let found = rows.filter((r) => r.id === s || r.code.toLowerCase() === s);
  if (!found.length) found = rows.filter((r) => r.id.startsWith(s) || r.code.toLowerCase().startsWith(s) || r.label.toLowerCase() === s);
  if (!found.length) found = rows.filter((r) => r.label.toLowerCase().includes(s));
  if (found.length !== 1) {
    const list = (found.length ? found : rows).slice(0, 20).map((r) => `${r.code} (${truncate(r.label, 40)})`).join(', ');
    throw Error(`${found.length ? 'Ambiguous' : 'Unknown'} reference '${ref}'. Candidates: ${list}`);
  }
  return found[0].id;
}

function need(o, k) {
  if (o[k] == null || String(o[k]).trim() === '') throw Error(`Missing --${k}`);
  return String(o[k]).trim();
}
export function isoDate(v, k = 'date') {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw Error(`--${k} must be a real date as YYYY-MM-DD, got '${s}'`);
  return s;
}
const optDate = (o, k) => (o[k] == null || o[k] === '' ? null : isoDate(o[k], k));
const today = () => new Date().toISOString().slice(0, 10);
export function cents(v, k = 'amount') {
  const s = String(v ?? '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error(`--${k} must be a dollar amount like 1850 or 1850.50, got '${v}'`);
  return Math.round(Number(s) * 100);
}
const flag = (v) => ['yes', 'true', 'y', '1'].includes(String(v ?? '').toLowerCase());
const JUR = ['NSW', 'QLD', 'VIC'];
const jurisdiction = (v) => {
  const j = String(v || '').toUpperCase();
  if (!JUR.includes(j)) throw Error(`--jurisdiction must be one of ${JUR.join(', ')}`);
  return j;
};

async function insert(db, entity, o) {
  const keys = Object.keys(o);
  const rows = await db.query(`insert into ${entity} (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(o));
  return rows[0];
}
async function update(db, entity, id, o) {
  const keys = Object.keys(o);
  const rows = await db.query(`update ${entity} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning *`, [id, ...Object.values(o)]);
  return rows[0];
}
async function audit(db, entity, id, operation, actor, detail = null) {
  await db.query('insert into audit_log (entity, entity_id, operation, actor, detail) values ($1,$2,$3,$4,$5)', [entity, id, operation, actor, detail ? JSON.stringify(detail) : null]);
}
async function nextCode(db, entity, prefix) {
  const rows = await db.query(`select code from ${entity} where code like $1`, [prefix + '-%']);
  const n = rows.map((r) => parseInt(r.code.slice(prefix.length + 1), 10)).filter(Number.isFinite);
  return `${prefix}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0')}`;
}
const job = async (db, ref) => (await db.query('select * from applications where id = $1', [await resolve(db, 'applications', ref)]))[0];

// ------------------------------------------------------------------ writes

const FLAGS = {
  'add-client': 'code name kind email phone actor',
  'add-council': 'code name jurisdiction route actor',
  'add-certifier': 'code name jurisdiction registration-no registration-class registration-expires actor',
  'renew-registration': 'expires actor',
  'add-quote': 'code client site jurisdiction type class description fee inspections sent-on actor',
  'answer-quote': 'status on actor',
  'add-job': 'code quote client council certifier site jurisdiction type class description received-on fee design-role financial-interest conflict-note actor',
  'request-info': 'code request sent-on due-on actor',
  'receive-info': 'on actor',
  decide: 'decision on actor',
  lodge: 'on actor',
  commence: 'notice-on work-on actor',
  'stage-not-required': 'stage reason actor',
  'book-inspection': 'code stage date inspector actor',
  'record-inspection': 'result on findings evidence actor',
  'issue-final': 'type on actor',
  invoice: 'amount actor',
  payment: 'amount actor',
  close: 'on actor',
  withdraw: 'on actor',
  log: 'body actor',
  import: 'file mapping dry-run actor',
  export: 'out',
  job: '', 'job-stages': '',
  'weekly-review': 'out', 'draft-inspection-report': 'out', 'draft-fee-proposal': 'out', 'draft-info-request': 'out',
};
export const writes = ['add-client', 'add-council', 'add-certifier', 'renew-registration', 'add-quote', 'answer-quote', 'add-job', 'request-info', 'receive-info', 'decide', 'lodge', 'commence', 'stage-not-required', 'book-inspection', 'record-inspection', 'issue-final', 'invoice', 'payment', 'close', 'withdraw', 'log', 'import'];

const handlers = {
  async 'add-client'(db, _ref, o, actor) {
    const kind = o.kind ? String(o.kind).toLowerCase() : 'builder';
    const r = await insert(db, 'clients', { code: o.code || (await nextCode(db, 'clients', 'CL')), name: need(o, 'name'), kind, email: o.email || null, phone: o.phone || null });
    await audit(db, 'clients', r.id, 'add', actor);
    return [{ added: r.code, name: r.name }];
  },
  async 'add-council'(db, _ref, o, actor) {
    const r = await insert(db, 'councils', { code: need(o, 'code'), name: need(o, 'name'), jurisdiction: jurisdiction(o.jurisdiction), lodgement_route: o.route || 'email' });
    await audit(db, 'councils', r.id, 'add', actor);
    return [{ added: r.code, name: r.name }];
  },
  async 'add-certifier'(db, _ref, o, actor) {
    const r = await insert(db, 'certifiers', {
      code: need(o, 'code'), name: need(o, 'name'), jurisdiction: jurisdiction(o.jurisdiction),
      registration_no: need(o, 'registration-no'), registration_class: need(o, 'registration-class'),
      registration_expires: isoDate(need(o, 'registration-expires'), 'registration-expires'),
    });
    await audit(db, 'certifiers', r.id, 'add', actor);
    return [{ added: r.code, name: r.name, registration_expires: r.registration_expires }];
  },
  async 'renew-registration'(db, ref, o, actor) {
    const id = await resolve(db, 'certifiers', ref);
    const r = await update(db, 'certifiers', id, { registration_expires: isoDate(need(o, 'expires'), 'expires') });
    await audit(db, 'certifiers', id, 'renew registration', actor, { expires: r.registration_expires });
    return [{ certifier: r.code, registration_expires: r.registration_expires }];
  },
  async 'add-quote'(db, _ref, o, actor) {
    const r = await insert(db, 'quotes', {
      code: o.code || (await nextCode(db, 'quotes', 'Q')),
      client_id: await resolve(db, 'clients', need(o, 'client')),
      site_address: need(o, 'site'), jurisdiction: jurisdiction(o.jurisdiction), approval_type: need(o, 'type'),
      building_class: need(o, 'class'), description: o.description || '', fee_cents: cents(need(o, 'fee'), 'fee'),
      inspections_included: o.inspections ? parseInt(o.inspections, 10) : 0, sent_on: o['sent-on'] ? isoDate(o['sent-on'], 'sent-on') : today(),
    });
    await audit(db, 'quotes', r.id, 'add', actor);
    return [{ added: r.code, site: r.site_address, fee: money(r.fee_cents) }];
  },
  async 'answer-quote'(db, ref, o, actor) {
    const id = await resolve(db, 'quotes', ref);
    const status = need(o, 'status').toLowerCase();
    if (!['accepted', 'declined', 'expired'].includes(status)) throw Error('--status must be accepted, declined or expired');
    const r = await update(db, 'quotes', id, { status, answered_on: o.on ? isoDate(o.on, 'on') : today() });
    await audit(db, 'quotes', id, 'answer ' + status, actor);
    return [{ quote: r.code, status: r.status, answered_on: r.answered_on }];
  },
  async 'add-job'(db, _ref, o, actor) {
    let q = null;
    if (o.quote) {
      q = (await db.query('select * from quotes where id = $1', [await resolve(db, 'quotes', o.quote)]))[0];
      if (q.status !== 'accepted') throw Error(`Quote ${q.code} is ${q.status}. Record the acceptance first with answer-quote.`);
      if ((await db.query('select 1 from applications where quote_id = $1', [q.id])).length) throw Error(`Quote ${q.code} already has a job`);
    }
    const r = await insert(db, 'applications', {
      code: o.code || (await nextCode(db, 'applications', 'J')),
      quote_id: q?.id ?? null,
      client_id: q ? q.client_id : await resolve(db, 'clients', need(o, 'client')),
      council_id: await resolve(db, 'councils', need(o, 'council')),
      certifier_id: await resolve(db, 'certifiers', need(o, 'certifier')),
      jurisdiction: q ? q.jurisdiction : jurisdiction(o.jurisdiction),
      approval_type: q ? q.approval_type : need(o, 'type'),
      building_class: q ? q.building_class : need(o, 'class'),
      site_address: q ? q.site_address : need(o, 'site'),
      description: o.description || q?.description || '',
      received_on: o['received-on'] ? isoDate(o['received-on'], 'received-on') : today(),
      fee_cents: q ? q.fee_cents : o.fee ? cents(o.fee, 'fee') : 0,
      certifier_design_role: flag(o['design-role']), certifier_financial_interest: flag(o['financial-interest']),
      conflict_note: o['conflict-note'] || null,
    });
    await audit(db, 'applications', r.id, 'add', actor, q ? { quote: q.code } : null);
    const warn = r.certifier_design_role || r.certifier_financial_interest ? 'conflict recorded: see compliance before assessing' : '';
    return [{ added: r.code, site: r.site_address, status: r.status, warning: warn }];
  },
  async 'request-info'(db, ref, o, actor) {
    const a = await job(db, ref);
    const sent = o['sent-on'] ? isoDate(o['sent-on'], 'sent-on') : today();
    const due = isoDate(need(o, 'due-on'), 'due-on');
    if (due < sent) throw Error('--due-on is before --sent-on');
    const r = await insert(db, 'info_requests', { code: o.code || (await nextCode(db, 'info_requests', 'RFI')), application_id: a.id, request: need(o, 'request'), sent_on: sent, due_on: due });
    if (a.status === 'assessing') await update(db, 'applications', a.id, { status: 'information requested' });
    await audit(db, 'info_requests', r.id, 'add', actor, { job: a.code });
    return [{ added: r.code, job: a.code, due_on: r.due_on }];
  },
  async 'receive-info'(db, ref, o, actor) {
    const id = await resolve(db, 'info_requests', ref);
    const r = await update(db, 'info_requests', id, { received_on: o.on ? isoDate(o.on, 'on') : today() });
    const open = await db.query('select 1 from info_requests where application_id = $1 and received_on is null', [r.application_id]);
    if (!open.length) await db.query("update applications set status = 'assessing' where id = $1 and status = 'information requested'", [r.application_id]);
    await audit(db, 'info_requests', id, 'received', actor);
    return [{ request: r.code, received_on: r.received_on, open_requests_left: open.length }];
  },
  async decide(db, ref, o, actor) {
    const a = await job(db, ref);
    if (a.decided_on) throw Error(`${a.code} already has a decision (${a.decision} on ${a.decided_on})`);
    const decision = need(o, 'decision').toLowerCase();
    if (!['approved', 'refused'].includes(decision)) throw Error('--decision must be approved or refused');
    const open = await db.query('select code from info_requests where application_id = $1 and received_on is null', [a.id]);
    if (open.length) throw Error(`${a.code} has open information requests (${open.map((r) => r.code).join(', ')}). Receive them first.`);
    const on = o.on ? isoDate(o.on, 'on') : today();
    const cert = (await db.query('select code, registration_expires from certifiers where id = $1', [a.certifier_id]))[0];
    if (cert.registration_expires < on) throw Error(`${cert.code}'s registration expired ${cert.registration_expires}. A decision cannot be recorded under it.`);
    const r = await update(db, 'applications', a.id, { decision, decided_on: on, status: decision === 'approved' ? 'approved' : 'closed', closed_on: decision === 'refused' ? on : null });
    await audit(db, 'applications', a.id, 'decide ' + decision, actor, { on });
    const due = decision === 'approved' ? (await db.query('select due_on from lodgement_clock where id = $1', [a.id]))[0]?.due_on : null;
    return [{ job: r.code, decision, decided_on: on, council_due_on: due || '' }];
  },
  async lodge(db, ref, o, actor) {
    const a = await job(db, ref);
    if (a.decision !== 'approved') throw Error(`${a.code} has no approval to give to council`);
    const on = o.on ? isoDate(o.on, 'on') : today();
    if (on < a.decided_on) throw Error('--on is before the decision date');
    await update(db, 'applications', a.id, { council_lodged_on: on });
    await audit(db, 'applications', a.id, 'lodged with council', actor, { on });
    const c = (await db.query('select due_on, council_lodged_on > due_on late from lodgement_clock where id = $1', [a.id]))[0];
    return [{ job: a.code, council_lodged_on: on, due_on: c?.due_on, late: c?.late ? 'yes' : 'no' }];
  },
  async commence(db, ref, o, actor) {
    const a = await job(db, ref);
    if (a.decision !== 'approved') throw Error(`${a.code} is not approved`);
    const patch = {};
    if (o['notice-on']) patch.commencement_notice_on = isoDate(o['notice-on'], 'notice-on');
    if (o['work-on']) { patch.work_commenced_on = isoDate(o['work-on'], 'work-on'); patch.status = 'under construction'; }
    if (!Object.keys(patch).length) throw Error('Give --notice-on, --work-on or both');
    const r = await update(db, 'applications', a.id, patch);
    await audit(db, 'applications', a.id, 'commencement', actor, patch);
    return [{ job: r.code, notice_on: r.commencement_notice_on || '', work_on: r.work_commenced_on || '', status: r.status }];
  },
  async 'stage-not-required'(db, ref, o, actor) {
    const a = await job(db, ref);
    const stage = need(o, 'stage');
    const listed = await db.query('select stage from stage_status where application_id = $1 and lower(stage) = lower($2)', [a.id, stage]);
    if (!listed.length) throw Error(`'${stage}' is not a required stage on ${a.code}. Run job-stages ${a.code} for the list.`);
    const passed = await db.query("select 1 from inspections where application_id = $1 and lower(stage) = lower($2) and result = 'passed'", [a.id, stage]);
    if (passed.length) throw Error(`${a.code} already has a passed ${stage} inspection`);
    await insert(db, 'stage_exemptions', { application_id: a.id, stage: listed[0].stage, reason: need(o, 'reason'), actor });
    await audit(db, 'applications', a.id, 'stage not required', actor, { stage: listed[0].stage, reason: o.reason });
    return [{ job: a.code, stage: listed[0].stage, not_required: o.reason }];
  },
  async 'book-inspection'(db, ref, o, actor) {
    const a = await job(db, ref);
    if (!['approved', 'under construction'].includes(a.status)) throw Error(`${a.code} is ${a.status}: inspections are booked on approved jobs`);
    const r = await insert(db, 'inspections', {
      code: o.code || (await nextCode(db, 'inspections', 'INS')), application_id: a.id, stage: need(o, 'stage'),
      booked_for: isoDate(need(o, 'date'), 'date'), inspector_id: o.inspector ? await resolve(db, 'certifiers', o.inspector) : a.certifier_id,
    });
    await audit(db, 'inspections', r.id, 'book', actor, { job: a.code });
    const known = await db.query('select 1 from stage_status where application_id = $1 and lower(stage) = lower($2)', [a.id, r.stage]);
    return [{ booked: r.code, job: a.code, stage: r.stage, date: r.booked_for, mandatory_stage: known.length ? 'yes' : 'no' }];
  },
  async 'record-inspection'(db, ref, o, actor) {
    const id = await resolve(db, 'inspections', ref);
    const result = need(o, 'result').toLowerCase();
    if (!['passed', 'failed', 'not ready', 'cancelled'].includes(result)) throw Error('--result must be passed, failed, not ready or cancelled');
    if (result !== 'cancelled' && !String(o.findings || '').trim()) throw Error('Missing --findings: record what was seen, even "Inspected to approved plans, no defects"');
    const r = await update(db, 'inspections', id, { result, inspected_on: result === 'cancelled' ? null : o.on ? isoDate(o.on, 'on') : today(), findings: o.findings || '', evidence_ref: o.evidence || null });
    await audit(db, 'inspections', id, 'result ' + result, actor);
    return [{ inspection: r.code, stage: r.stage, result: r.result, inspected_on: r.inspected_on || '' }];
  },
  async 'issue-final'(db, ref, o, actor) {
    const a = await job(db, ref);
    if (a.status !== 'under construction') throw Error(`${a.code} is ${a.status}: a final is issued on a job under construction`);
    const missing = await db.query('select stage from stage_status where application_id = $1 and passed_on is null order by sequence', [a.id]);
    if (missing.length) throw Error(`${a.code} has no passed inspection for: ${missing.map((m) => m.stage).join(', ')}. Record them before the final.`);
    const on = o.on ? isoDate(o.on, 'on') : today();
    const r = await update(db, 'applications', a.id, { final_issued_on: on, final_type: need(o, 'type'), status: 'final issued' });
    await audit(db, 'applications', a.id, 'final issued', actor, { type: r.final_type, on });
    return [{ job: r.code, final: r.final_type, issued_on: on, next: 'lodge the final with council and record it with log' }];
  },
  async invoice(db, ref, o, actor) {
    const a = await job(db, ref);
    const amt = cents(need(o, 'amount'));
    if (a.invoiced_cents + amt > a.fee_cents) throw Error(`Invoicing ${money(amt)} would take ${a.code} past its agreed fee of ${money(a.fee_cents)}`);
    const r = await update(db, 'applications', a.id, { invoiced_cents: a.invoiced_cents + amt });
    await audit(db, 'applications', a.id, 'invoice', actor, { cents: amt });
    return [{ job: r.code, invoiced: money(r.invoiced_cents), fee: money(r.fee_cents) }];
  },
  async payment(db, ref, o, actor) {
    const a = await job(db, ref);
    const amt = cents(need(o, 'amount'));
    if (a.paid_cents + amt > a.invoiced_cents) throw Error(`A payment of ${money(amt)} is more than ${a.code} has invoiced and unpaid (${money(a.invoiced_cents - a.paid_cents)})`);
    const r = await update(db, 'applications', a.id, { paid_cents: a.paid_cents + amt });
    await audit(db, 'applications', a.id, 'payment', actor, { cents: amt });
    return [{ job: r.code, paid: money(r.paid_cents), owing: money(r.invoiced_cents - r.paid_cents) }];
  },
  async close(db, ref, o, actor) {
    const a = await job(db, ref);
    if (a.status !== 'final issued') throw Error(`${a.code} is ${a.status}: close a job after its final is issued (or use withdraw)`);
    const on = o.on ? isoDate(o.on, 'on') : today();
    const r = await update(db, 'applications', a.id, { status: 'closed', closed_on: on });
    await audit(db, 'applications', a.id, 'close', actor);
    const keep = (await db.query('select keep_until from retention_register where code = $1', [r.code]))[0]?.keep_until;
    return [{ job: r.code, closed_on: on, keep_file_until: keep || '' }];
  },
  async withdraw(db, ref, o, actor) {
    const a = await job(db, ref);
    if (['final issued', 'closed'].includes(a.status)) throw Error(`${a.code} is ${a.status} and cannot be withdrawn`);
    const on = o.on ? isoDate(o.on, 'on') : today();
    await update(db, 'applications', a.id, { status: 'withdrawn', closed_on: on });
    await audit(db, 'applications', a.id, 'withdraw', actor);
    return [{ job: a.code, status: 'withdrawn' }];
  },
  async log(db, ref, o, actor) {
    const a = await job(db, ref);
    await db.query('insert into notes (application_id, actor, body) values ($1,$2,$3)', [a.id, actor, need(o, 'body')]);
    return [{ job: a.code, logged: truncate(o.body, 60) }];
  },
  import: importVisualApprovals,
};

// ------------------------------------------------------------------ import

// Visual Approvals publishes no export format. It lists standard and custom reports; save the
// one that lists your applications as CSV. The default mapping below covers the usual
// labels; pass --mapping=<file.json> ({ "code": "Your Column", ... }) when your report differs.
export const DEFAULT_MAPPING = {
  code: ['Application No', 'Application Number', 'Job No', 'Job Number', 'Reference'],
  approval_type: ['Approval Type', 'Application Type', 'Type'],
  building_class: ['Building Class', 'BCA Class', 'Class'],
  site_address: ['Site Address', 'Property Address', 'Address'],
  jurisdiction: ['State', 'Jurisdiction'],
  council: ['Council', 'Local Government', 'LGA'],
  client: ['Client', 'Applicant', 'Client Name'],
  certifier: ['Certifier', 'Building Surveyor', 'Assessing Officer'],
  received_on: ['Received', 'Date Received', 'Lodged'],
  decided_on: ['Decision Date', 'Approved', 'Date Approved', 'Issued'],
  fee: ['Fee', 'Total Fee', 'Quoted Fee'],
  description: ['Description', 'Description of Work', 'Works'],
};

function parseDay(v, field, line) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isoDate(s, field);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // Australian day/month/year
  if (m) return isoDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, field);
  throw Error(`Row ${line}: ${field} '${s}' is not a date (use DD/MM/YYYY or YYYY-MM-DD)`);
}

async function importVisualApprovals(db, ref, o, actor) {
  if (ref && ref.toLowerCase() !== 'visual-approvals') throw Error("Usage: import visual-approvals --file=register.csv [--mapping=map.json] [--dry-run] --actor=...");
  const file = path.resolve(need(o, 'file'));
  const bytes = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  let mapping = DEFAULT_MAPPING;
  if (o.mapping) {
    const custom = JSON.parse(fs.readFileSync(path.resolve(o.mapping), 'utf8'));
    mapping = { ...DEFAULT_MAPPING, ...Object.fromEntries(Object.entries(custom).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])) };
  }
  const rows = parseCsv(bytes.toString('utf8'));
  if (!rows.length) throw Error('The file has no rows');
  const headers = Object.keys(rows[0]);
  const missing = ['code', 'site_address', 'council', 'client', 'certifier'].filter((k) => !mapping[k].some((h) => headers.some((x) => x.toLowerCase() === h.toLowerCase())));
  if (missing.length) throw Error(`No column found for: ${missing.join(', ')}. Columns in the file: ${headers.join(', ')}. Write a mapping file.`);
  if (!o['dry-run'] && (await db.query('select 1 from import_batches where sha256 = $1', [sha])).length) throw Error('This exact file has already been imported');

  const plan = [];
  const existing = new Set((await db.query('select code from applications')).map((r) => r.code.toLowerCase()));
  rows.forEach((row, i) => {
    const line = i + 2;
    const get = (k) => pick(row, ...mapping[k]).trim();
    const code = get('code');
    if (!code) throw Error(`Row ${line}: no application number`);
    const j = (get('jurisdiction') || o.jurisdiction || '').toUpperCase();
    plan.push({
      line, code, skip: existing.has(code.toLowerCase()), jurisdiction: JUR.includes(j) ? j : null,
      approval_type: get('approval_type') || 'Unknown', building_class: get('building_class') || 'unknown',
      site_address: get('site_address'), council: get('council'), client: get('client'), certifier: get('certifier'),
      received_on: parseDay(get('received_on'), 'received', line), decided_on: parseDay(get('decided_on'), 'decision date', line),
      fee_cents: get('fee') ? cents(get('fee'), `fee on row ${line}`) : 0, description: get('description'), source: row,
    });
  });
  const unknownState = plan.filter((p) => !p.skip && !p.jurisdiction);
  if (unknownState.length) throw Error(`Rows ${unknownState.map((p) => p.line).join(', ')} have no NSW, QLD or VIC state. Add a State column to the mapping.`);
  const summary = { file: path.basename(file), rows: rows.length, new_jobs: plan.filter((p) => !p.skip).length, already_there: plan.filter((p) => p.skip).length };
  if (o['dry-run']) return [{ ...summary, dry_run: 'yes, nothing written' }];

  const batch = await insert(db, 'import_batches', { source: 'visual-approvals', filename: path.basename(file), sha256: sha, row_count: rows.length, actor });
  const lookup = async (entity, name, make) => {
    const hit = await db.query(`select id from ${entity} where lower(name) = lower($1) or lower(code) = lower($1)`, [name]);
    if (hit.length) return hit[0].id;
    return (await insert(db, entity, await make())).id;
  };
  for (const p of plan.filter((x) => !x.skip)) {
    const client = await lookup('clients', p.client, async () => ({ code: await nextCode(db, 'clients', 'CL'), name: p.client, kind: 'other' }));
    const council = await lookup('councils', p.council, async () => ({ code: await nextCode(db, 'councils', 'CO'), name: p.council, jurisdiction: p.jurisdiction }));
    // Imported certifiers carry a placeholder registration that has already lapsed, so compliance flags them until it is entered.
    const certifier = await lookup('certifiers', p.certifier, async () => ({ code: await nextCode(db, 'certifiers', 'CE'), name: p.certifier, jurisdiction: p.jurisdiction, registration_no: 'enter registration', registration_class: 'enter class', registration_expires: '2000-01-01' }));
    const status = p.decided_on ? 'approved' : 'assessing';
    const r = await insert(db, 'applications', {
      code: p.code, client_id: client, council_id: council, certifier_id: certifier, jurisdiction: p.jurisdiction,
      approval_type: p.approval_type, building_class: p.building_class, site_address: p.site_address, description: p.description,
      status, received_on: p.received_on || p.decided_on || today(), decided_on: p.decided_on, decision: p.decided_on ? 'approved' : null,
      fee_cents: p.fee_cents, source: JSON.stringify(p.source), import_batch_id: batch.id,
    });
    await audit(db, 'applications', r.id, 'import', actor, { batch: batch.id, line: p.line });
  }
  return [{ ...summary, batch: batch.id.slice(0, 8), next: 'set each imported job status, lodgement date and inspections; enter certifier registrations' }];
}

// ------------------------------------------------------------------ detail, export, drafts

async function jobDetail(db, ref) {
  const id = await resolve(db, 'applications', ref);
  const [a] = await db.query('select * from job_register where id = $1', [id]);
  const stages = await db.query('select stage, passed_on, booked_for, failed_attempts from stage_status where application_id = $1 order by sequence', [id]);
  const inspections = await db.query('select code, stage, booked_for, result, inspected_on, findings from inspections where application_id = $1 order by booked_for, code', [id]);
  const requests = await db.query('select code, request, sent_on, due_on, received_on from info_requests where application_id = $1 order by sent_on', [id]);
  const checks = await db.query('select rule, finding from record_checks where code = $1 or code in (select code from info_requests where application_id = $2)', [a.code, id]);
  const notes = await db.query('select actor, body, created_at from notes where application_id = $1 order by created_at', [id]);
  return { job: a, stages, inspections, requests, checks, notes };
}

async function exportAll(db, o) {
  const out = path.resolve(o.out || path.join(REPO_ROOT, 'exports', `certification-export-${today()}.json`));
  const data = {};
  for (const t of ['certifiers', 'councils', 'clients', 'quotes', 'applications', 'inspections', 'info_requests', 'stage_exemptions', 'notes', 'import_batches', 'audit_log', 'rules', 'stage_rules', 'public_holidays']) {
    data[t] = await db.query(`select * from ${t}`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2), { mode: 0o600 });
  return [{ exported: path.relative(process.cwd(), out) || out, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) }];
}

function writeDraft(o, name, body) {
  const out = path.resolve(o.out || path.join(REPO_ROOT, 'drafts', `${name}.md`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body, { mode: 0o600 });
  return [{ draft: path.relative(process.cwd(), out) || out, note: 'draft only: read, edit and send it yourself' }];
}
const brandName = () => {
  try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name || 'Your Business'; } catch { return 'Your Business'; }
};
const mdTable = (rows) => {
  if (!rows.length) return '_None._\n';
  const cols = Object.keys(rows[0]);
  const cell = (v, k) => String(k.endsWith('_cents') ? money(v) : v ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ');
  return `| ${cols.join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |\n` + rows.map((r) => `| ${cols.map((c) => cell(r[c], c)).join(' | ')} |`).join('\n') + '\n';
};

async function weeklyReview(db, o) {
  const sec = async (title, sql) => `## ${title}\n\n${mdTable(await db.query(sql))}`;
  const body = [
    `# Weekly certification review, ${today()}\n\n${brandName()}. Prepared from the job file. Check each line before acting.\n`,
    await sec('Needs attention', reads.attention),
    await sec('Decisions still to reach council', reads['lodgements-due']),
    await sec('Inspections in the next seven days', reads['inspections-due']),
    await sec('Failed inspections waiting for a reinspection', reads.reinspections),
    await sec('Rule checks', reads.compliance),
    await sec('Fee proposals waiting for an answer', reads['quotes-waiting']),
    await sec('Fees owing', reads['fees-owing']),
  ].join('\n');
  return writeDraft(o, `weekly-review-${today()}`, body);
}

async function draftInspectionReport(db, ref, o) {
  const id = await resolve(db, 'inspections', ref);
  const [i] = await db.query(`select i.*, a.code job, a.site_address, a.approval_type, a.building_class, a.jurisdiction, ce.name inspector, ce.registration_no
    from inspections i join applications a on a.id = i.application_id left join certifiers ce on ce.id = i.inspector_id where i.id = $1`, [id]);
  if (!i.inspected_on) throw Error(`${i.code} has no recorded result yet. Run record-inspection first.`);
  const body = `# Inspection record ${i.code}\n\n${brandName()}\n\n| | |\n|---|---|\n| Job | ${i.job} |\n| Site | ${i.site_address} |\n| Approval | ${i.approval_type}, class ${i.building_class}, ${i.jurisdiction} |\n| Stage | ${i.stage} |\n| Inspected on | ${i.inspected_on} |\n| Inspector | ${i.inspector || ''} (registration ${i.registration_no || ''}) |\n| Result | ${i.result} |\n| Evidence reference | ${i.evidence_ref || 'none recorded'} |\n\n## Findings\n\n${i.findings}\n\n${i.result === 'passed' ? '' : '## What happens next\n\nThe work at this stage is to be corrected and a reinspection booked before work proceeds past it.\n\n'}_Draft from the job file. The inspecting certifier checks and signs the issued record._\n`;
  return writeDraft(o, `inspection-${i.code}`, body);
}

async function draftFeeProposal(db, ref, o) {
  const id = await resolve(db, 'quotes', ref);
  const [q] = await db.query('select q.*, cl.name client from quotes q join clients cl on cl.id = q.client_id where q.id = $1', [id]);
  const body = `# Fee proposal ${q.code}\n\n${brandName()}\n\nTo: ${q.client}\nSite: ${q.site_address}\nDate: ${q.sent_on}\n\n## Scope\n\n${q.approval_type} for a class ${q.building_class} building in ${q.jurisdiction}. ${q.description}\n\n| Item | Amount |\n|---|---|\n| Assessment, approval and ${q.inspections_included} inspection(s) | ${money(q.fee_cents)} |\n\nAdditional or repeat inspections are quoted separately. Fees exclude GST unless stated.\n\n_Draft from the job file. Check the scope and fee before sending._\n`;
  return writeDraft(o, `fee-proposal-${q.code}`, body);
}

async function draftInfoRequest(db, ref, o) {
  const id = await resolve(db, 'info_requests', ref);
  const [r] = await db.query('select r.*, a.code job, a.site_address, cl.name client from info_requests r join applications a on a.id = r.application_id join clients cl on cl.id = a.client_id where r.id = $1', [id]);
  const body = `# Request for further information ${r.code}\n\n${brandName()}\n\nTo: ${r.client}\nJob: ${r.job}, ${r.site_address}\nDate: ${r.sent_on}\n\nTo continue the assessment we need:\n\n${r.request}\n\nPlease provide this by ${r.due_on}. The assessment is on hold until it arrives.\n\n_Draft from the job file. Check it before sending._\n`;
  return writeDraft(o, `info-request-${r.code}`, body);
}

// ------------------------------------------------------------------ run

export function parseArgs(args) {
  const positional = [], o = {};
  for (const a of args) {
    if (a.startsWith('--')) { const i = a.indexOf('='); o[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1); }
    else positional.push(a);
  }
  return { positional, o };
}

export async function run(db, args) {
  const { positional, o } = parseArgs(args);
  const [cmd = 'help', ref] = positional;
  if (cmd === 'help') return [{ commands: [...Object.keys(reads), 'job', 'job-stages', ...writes, 'export', 'weekly-review', 'draft-inspection-report', 'draft-fee-proposal', 'draft-info-request'].join(', ') }];
  const allowed = new Set(['json', ...(reads[cmd] ? [] : (FLAGS[cmd] ?? '').split(' ').filter(Boolean))]);
  if (!reads[cmd] && FLAGS[cmd] === undefined) throw Error(`Unknown command '${cmd}'. Run help.`);
  for (const k of Object.keys(o)) if (!allowed.has(k)) throw Error(`Unknown flag --${k} for ${cmd}`);
  for (const [k, v] of Object.entries(o)) if (v === true && !['json', 'dry-run'].includes(k)) throw Error(`--${k} needs a value: --${k}=...`);
  if (reads[cmd]) return db.query(reads[cmd]);
  if (cmd === 'job') return jobDetail(db, ref);
  if (cmd === 'job-stages') return db.query('select stage, passed_on, booked_for, failed_attempts from stage_status where application_id = $1 order by sequence', [await resolve(db, 'applications', ref)]);
  if (cmd === 'export') return exportAll(db, o);
  if (cmd === 'weekly-review') return weeklyReview(db, o);
  if (cmd === 'draft-inspection-report') return draftInspectionReport(db, ref, o);
  if (cmd === 'draft-fee-proposal') return draftFeeProposal(db, ref, o);
  if (cmd === 'draft-info-request') return draftInfoRequest(db, ref, o);
  const actor = need(o, 'actor');
  if (o['dry-run'] && cmd === 'import') return handlers.import(db, ref, o, actor);
  await db.exec('BEGIN');
  try {
    const res = await handlers[cmd](db, ref, o, actor);
    await db.exec('COMMIT');
    return res;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

function show(res) {
  if (!Array.isArray(res)) {
    for (const [k, v] of Object.entries(res)) {
      console.log(`\n${k.replace(/_/g, ' ')}`);
      show(Array.isArray(v) ? v : [v]);
    }
    return;
  }
  if (!res.length) return console.log('  (none)');
  const cols = Object.keys(res[0]).filter((k) => k !== 'id');
  console.log(table(res, cols.map((k) => ({
    key: k, label: k.replace(/_cents$/, '').replace(/_/g, ' '), align: k.endsWith('_cents') || k.startsWith('days') ? 'right' : 'left', width: 70,
    format: (v) => (k.endsWith('_cents') ? money(v) : v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : v),
  }))));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  let db;
  try {
    db = await getDb();
    const res = await run(db, args);
    if (args.includes('--json')) console.log(JSON.stringify(res, null, 2));
    else show(res);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
