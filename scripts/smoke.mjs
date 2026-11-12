#!/usr/bin/env node
// npm test: a temporary database, every migration, the seed twice, every command, the rules and
// the refusals, an import, an export, the drafts, and the HTML views and documents. Prints PASS.
// CERTIFY_TEST_DATABASE_URL (or TEST_DATABASE_URL in CI) runs it on a disposable Postgres instead.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, resolve, isoDate, cents } from './certify.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'certify-test-'));
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
process.env.DATABASE_URL = process.env.CERTIFY_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL || '';

let db;
let checks = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const bad = async (f, re) => { await assert.rejects(f, re); checks++; };
const call = (...a) => run(db, a);
const write = (cmd, ref, o = {}) => call(cmd, ...(ref ? [ref] : []), ...Object.entries({ actor: 'Test Operator', ...o }).map(([k, v]) => `--${k}=${v}`));
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const codes = (rows) => rows.map((r) => r.code);

try {
  // Input parsing
  assert.throws(() => isoDate('2026-02-30'), /real date/); checks++;
  assert.throws(() => cents('12.345'), /dollar amount/); checks++;
  eq(cents('$1,850.50'), 185050);

  // Schema and seed
  db = await getDb();
  eq((await migrate(db)).ran.length, 2);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  const before = (await db.query('select count(*)::int n from applications'))[0].n;
  await seed(db);
  eq((await db.query('select count(*)::int n from applications'))[0].n, before, 'seed runs once');

  // Business-day clock skips weekends and recorded holidays
  eq((await db.query("select add_business_days('2026-11-13', 5)::text d"))[0].d, '2026-11-20');
  await db.query("insert into public_holidays (holiday, jurisdiction, name) values ('2026-11-16', 'QLD', 'Test holiday')");
  eq((await db.query("select add_business_days('2026-11-13', 5)::text d"))[0].d, '2026-11-23');
  await db.query("delete from public_holidays where holiday = '2026-11-16'");

  // Every read runs
  for (const cmd of Object.keys(reads)) ok(Array.isArray(await call(cmd)), cmd);
  ok((await call('help'))[0].commands.includes('record-inspection'));

  // The demo findings, one per rule
  const rules = Object.fromEntries((await call('compliance')).map((r) => [r.rule, r.code]));
  eq(rules, {
    COMMENCEMENT: 'J-0009', CONFLICT: 'J-0006', 'INFO-OVERDUE': 'RFI-0001', LODGE: 'J-0001', 'LODGE-LATE': 'J-0003',
    REGISTRATION: 'J-0010', 'STAGE-BEFORE-FINAL': 'J-0005', 'STAGE-SKIPPED': 'J-0002',
  });
  eq(codes(await call('lodgements-due')), ['J-0001', 'J-0012']);
  eq(codes(await call('reinspections')), ['INS-0007']);
  eq(codes(await call('finals-ready')), ['J-0009']);
  eq(codes(await call('quiet-jobs')), ['J-0007']);
  eq(codes(await call('quotes-waiting')), ['Q-0001', 'Q-0002']);
  eq((await call('retention'))[0].keep_until, (await db.query("select ((current_date - 690) + interval '5 years')::date::text d"))[0].d);
  const attention = await call('attention');
  ok(attention.some((r) => r.code === 'CE-SL' && r.issue === 'registration expired'));
  ok(attention.some((r) => r.code === 'INS-0008' && r.issue === 'inspection result not recorded'));
  const j4 = await call('job-stages', 'J-0004');
  ok(!j4.some((s) => s.stage === 'Reinforced masonry'), 'exempt stage is not required');
  eq((await call('fees-owing')).find((r) => r.code === 'J-0009').owing_cents, 480000);

  // References: code, prefix, name, ambiguity
  eq(await resolve(db, 'applications', 'j-0004'), await resolve(db, 'applications', '21 Jacaranda St, Riverbend'));
  await bad(() => resolve(db, 'applications', 'J-00'), /Ambiguous.*J-0001/);
  await bad(() => resolve(db, 'clients', 'nobody here'), /Unknown.*Candidates/);

  // Flag hygiene
  await bad(() => call('add-client', '--name=X'), /Missing --actor/);
  await bad(() => call('nope'), /Unknown command/);
  await bad(() => write('add-client', null, { name: 'X', colour: 'red' }), /Unknown flag --colour/);
  await bad(() => call('add-client', '--name', '--actor=T'), /needs a value/);

  // A whole job, QLD class 1a, quote to closed file
  const [client] = await write('add-client', null, { name: 'Test <script>alert(1)</script> Builders', kind: 'builder' });
  await write('add-quote', null, { client: client.added, site: '1 Test St, Riverbend', jurisdiction: 'QLD', type: 'Building approval', class: '1a', fee: '5000', inspections: '6' });
  const quote = (await call('quotes')).find((q) => q.site_address === '1 Test St, Riverbend').code;
  await bad(() => write('add-job', null, { quote, council: 'CO-RBC', certifier: 'CE-RK' }), /Record the acceptance first/);
  await write('answer-quote', quote, { status: 'accepted' });
  const [opened] = await write('add-job', null, { quote, council: 'CO-RBC', certifier: 'CE-RK', 'received-on': day(-30) });
  const J = opened.added;
  await bad(() => write('add-job', null, { quote, council: 'CO-RBC', certifier: 'CE-RK' }), /already has a job/);

  const [rfi] = await write('request-info', J, { request: 'Soil report', 'sent-on': day(-25), 'due-on': day(-20) });
  eq((await call('jobs')).find((r) => r.code === J).status, 'information requested');
  await bad(() => write('decide', J, { decision: 'approved' }), /open information requests/);
  await write('receive-info', rfi.added, { on: day(-19) });
  eq((await call('jobs')).find((r) => r.code === J).status, 'assessing');

  // A Friday between 18 and 12 days ago: five business days later is the next Friday.
  let fri = -18; while (new Date(day(fri) + 'T00:00:00Z').getUTCDay() !== 5) fri++;
  const [decided] = await write('decide', J, { decision: 'approved', on: day(fri) });
  eq(decided.council_due_on, day(fri + 7), 'QLD: five business days');
  await bad(() => write('decide', J, { decision: 'approved' }), /already has a decision/);
  const [lodged] = await write('lodge', J, { on: day(fri + 10) });
  eq(lodged.late, 'yes');
  ok((await call('compliance')).some((r) => r.code === J && r.rule === 'LODGE-LATE'));

  await bad(() => write('book-inspection', 'J-0011', { stage: 'Footings', date: day(1) }), /inspections are booked on approved jobs/);
  await write('commence', J, { 'work-on': day(-10) });
  const [b1] = await write('book-inspection', J, { stage: 'Excavation', date: day(-9) });
  eq(b1.mandatory_stage, 'yes');
  await bad(() => write('record-inspection', b1.booked, { result: 'passed' }), /Missing --findings/);
  await write('record-inspection', b1.booked, { result: 'failed', findings: 'Soft spot at north-east corner', on: day(-9) });
  ok(codes(await call('reinspections')).includes(b1.booked));
  const [b2] = await write('book-inspection', J, { stage: 'excavation', date: day(-8) });
  ok(!codes(await call('reinspections')).includes(b1.booked), 'a booked reinspection clears the list');
  await write('record-inspection', b2.booked, { result: 'passed', findings: 'Rectified and checked', on: day(-8) });
  await bad(() => write('issue-final', J, { type: 'Final inspection certificate' }), /no passed inspection for: Footings/);
  await bad(() => write('stage-not-required', J, { stage: 'Roof', reason: 'x' }), /not a required stage/);
  await write('stage-not-required', J, { stage: 'reinforced masonry', reason: 'No masonry in the design' });
  for (const stage of ['Footings', 'Slab', 'Frame bracing', 'Cladding bracing', 'Final']) {
    const [b] = await write('book-inspection', J, { stage, date: day(-5) });
    await write('record-inspection', b.booked, { result: 'passed', findings: `${stage} checked`, on: day(-5) });
  }
  ok(codes(await call('finals-ready')).includes(J));
  await write('issue-final', J, { type: 'Final inspection certificate', on: day(-4) });
  await bad(() => write('invoice', J, { amount: '6000' }), /past its agreed fee/);
  await write('invoice', J, { amount: '5000' });
  await bad(() => write('payment', J, { amount: '5000.01' }), /more than/);
  await write('payment', J, { amount: '5000' });
  ok(!codes(await call('fees-owing')).includes(J));
  const [closed] = await write('close', J, { on: day(-1) });
  eq(closed.keep_file_until, (await db.query("select ((current_date - 1) + interval '5 years')::date::text d"))[0].d);
  await write('log', J, { body: 'File closed and archived' });
  ok((await call('notes')).some((n) => n.job === J));
  const detail = await call('job', J);
  eq(detail.inspections.length, 7);
  ok(detail.stages.every((s) => s.passed_on));

  // Registration and conflict guards
  await bad(() => write('add-job', null, { client: client.added, council: 'CO-BAY', certifier: 'CE-SL', site: '2 Test St', jurisdiction: 'VIC', type: 'Building permit', class: '10a' }).then(([r]) => write('decide', r.added, { decision: 'approved' })), /registration expired/);
  await write('renew-registration', 'CE-SL', { expires: day(365) });
  ok(!(await call('attention')).some((r) => r.code === 'CE-SL'));
  const [conf] = await write('add-job', null, { client: client.added, council: 'CO-HBR', certifier: 'CE-AM', site: '3 Test St', jurisdiction: 'NSW', type: 'Construction certificate', class: '1a', 'financial-interest': 'yes' });
  ok(conf.warning.includes('conflict'));
  ok((await call('compliance')).some((r) => r.code === conf.added && r.rule === 'CONFLICT'));
  await write('withdraw', conf.added);
  ok(!(await call('compliance')).some((r) => r.code === conf.added));

  // NSW commencement notice: fewer than 2 days is flagged
  const [n] = await write('add-job', null, { client: client.added, council: 'CO-HBR', certifier: 'CE-AM', site: '4 Test St', jurisdiction: 'NSW', type: 'Construction certificate', class: '1a', 'received-on': day(-20) });
  await write('decide', n.added, { decision: 'approved', on: day(-15) });
  await write('commence', n.added, { 'notice-on': day(-6), 'work-on': day(-5) });
  ok((await call('compliance')).some((r) => r.code === n.added && r.rule === 'COMMENCEMENT-SHORT'));

  // Import from a Visual Approvals register report saved as CSV (fictional rows; no vendor file is included)
  const csv = path.join(temp, 'register.csv');
  fs.writeFileSync(csv, '﻿Application No,Approval Type,Building Class,Site Address,State,Council,Client,Certifier,Received,Decision Date,Fee\r\n' +
    'VA-1001,Building Approval,1a,"8 Import Rd, Riverbend",QLD,Riverbend City Council (demo),Import Homes,Raj Kumar,02/09/2026,20/09/2026,"$5,100.00"\r\n' +
    'VA-1002,Construction Certificate,1a,"9 Import Rd, Harbourview",NSW,New Council,New Owner,Pat Example,15/10/2026,,3200\r\n');
  const [dry] = await call('import', 'visual-approvals', `--file=${csv}`, '--dry-run', '--actor=T');
  eq(dry.new_jobs, 2);
  eq((await db.query("select count(*)::int n from applications where code like 'VA-%'"))[0].n, 0, 'dry run writes nothing');
  const [imp] = await call('import', 'visual-approvals', `--file=${csv}`, '--actor=Test Operator');
  eq(imp.new_jobs, 2);
  const va = (await call('jobs')).find((r) => r.code === 'VA-1001');
  eq([va.status, va.decided_on, va.received_on], ['approved', '2026-09-20', '2026-09-02']);
  eq((await db.query("select fee_cents from applications where code = 'VA-1001'"))[0].fee_cents, 510000);
  ok((await db.query("select source from applications where code = 'VA-1002'"))[0].source.Certifier === 'Pat Example', 'source row kept');
  eq((await call('jobs')).find((r) => r.code === 'VA-1001').certifier, 'CE-RK', 'matched an existing certifier by name');
  ok((await call('certifiers')).some((r) => r.name === 'Pat Example' && r.registration_no === 'enter registration' && r.days_left < 0), 'a new certifier is flagged until registered');
  await bad(() => call('import', 'visual-approvals', `--file=${csv}`, '--actor=T'), /already been imported/);
  const csv2 = path.join(temp, 'odd.csv');
  fs.writeFileSync(csv2, 'Ref No,Where\nX1,Somewhere\n');
  await bad(() => call('import', 'visual-approvals', `--file=${csv2}`, '--actor=T'), /No column found for/);
  const map = path.join(temp, 'map.json');
  fs.writeFileSync(map, JSON.stringify({ code: 'Ref No', site_address: 'Where', council: 'LGA Name', client: 'Who', certifier: 'Surveyor' }));
  fs.writeFileSync(csv2, 'Ref No,Where,LGA Name,Who,Surveyor\nX1,Somewhere,Baywater Shire Council (demo),Owner X,Tom Nguyen\n');
  await bad(() => call('import', 'visual-approvals', `--file=${csv2}`, `--mapping=${map}`, '--actor=T'), /no NSW, QLD or VIC state/);
  fs.writeFileSync(csv2, 'Ref No,Where,LGA Name,Who,Surveyor,State\nX1,Somewhere,Baywater Shire Council (demo),Owner X,Tom Nguyen,vic\n');
  eq((await call('import', 'visual-approvals', `--file=${csv2}`, `--mapping=${map}`, '--actor=T'))[0].new_jobs, 1);
  ok((await call('imports')).length === 2);

  // Export and drafts
  const [ex] = await call('export', `--out=${path.join(temp, 'export.json')}`);
  const dump = JSON.parse(fs.readFileSync(path.join(temp, 'export.json'), 'utf8'));
  eq(dump.applications.length, ex.applications);
  ok(dump.audit_log.length > 10 && dump.rules.length === 5);
  const draft = async (...a) => fs.readFileSync(path.resolve((await call(...a, `--out=${path.join(temp, a[0] + '.md')}`))[0].draft), 'utf8');
  ok((await draft('weekly-review')).includes('J-0001'));
  ok((await draft('draft-inspection-report', 'INS-0007')).includes('Tie-downs missing'));
  await bad(() => call('draft-inspection-report', 'INS-0003'), /no recorded result/);
  ok((await draft('draft-fee-proposal', 'Q-0001')).includes('$3,850.00'));
  ok((await draft('draft-info-request', 'RFI-0001')).includes('Engineer'));
  ok((await db.query('select count(*)::int n from audit_log'))[0].n > 30, 'every write is audited');
  await db.close();
  db = null;

  // Views and documents render, escaped (PGlite only: they open their own connection)
  if (!process.env.DATABASE_URL) {
    for (const script of ['view.mjs', 'docs.mjs']) {
      const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { env: process.env, encoding: 'utf8' });
      eq(r.status, 0, `${script}: ${r.stderr}`);
    }
    const week = fs.readFileSync(path.join(temp, 'views', 'week.html'), 'utf8');
    ok(week.includes('J-0001') && week.includes('STAGE-SKIPPED'));
    const files = fs.readdirSync(path.join(temp, 'docs-out', 'job-file'));
    ok(files.length > 10);
    const all = files.map((f) => fs.readFileSync(path.join(temp, 'docs-out', 'job-file', f), 'utf8')).join('');
    ok(!all.includes('<script>alert(1)</script>') && all.includes('&lt;script&gt;'), 'HTML is escaped');
    ok(fs.readdirSync(path.join(temp, 'docs-out', 'inspection-record')).length >= 20);
  }
  console.log(`PASS: ${checks} checks (${process.env.DATABASE_URL ? 'postgres' : 'pglite'})`);
} catch (e) {
  console.error('FAIL:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  await db?.close();
  if (!process.env.DATABASE_URL) fs.rmSync(temp, { recursive: true, force: true });
}
