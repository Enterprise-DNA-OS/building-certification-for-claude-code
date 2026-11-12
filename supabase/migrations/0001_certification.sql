-- Building Certification for Claude Code: the certifier's job file.
-- Runs on Postgres and PGlite. Money is integer cents. Dates are calendar dates.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Monday to Friday counting. Public holidays are not known to the base: add them to
-- public_holidays and the clock skips them.
create table public_holidays (
  holiday date primary key,
  jurisdiction text not null default 'ALL',
  name text not null
);

create or replace function add_business_days(start_on date, n integer) returns date language plpgsql stable as $$
declare d date := start_on; left_to_add integer := n;
begin
  while left_to_add > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 and not exists (select 1 from public_holidays h where h.holiday = d) then
      left_to_add := left_to_add - 1;
    end if;
  end loop;
  return d;
end $$;

-- The statutory clocks and stage lists the checks use. Each row cites its source in docs/compliance.md.
create table rules (
  code text not null,
  jurisdiction text not null check (jurisdiction in ('NSW','QLD','VIC')),
  description text not null,
  days integer,
  day_kind text check (day_kind in ('calendar','business')),
  source text not null,
  primary key (code, jurisdiction)
);

-- Mandatory or critical stage inspections by jurisdiction and building class.
-- class_pattern is a regular expression matched against the job's building class (1a, 10a, 2).
create table stage_rules (
  jurisdiction text not null check (jurisdiction in ('NSW','QLD','VIC')),
  class_pattern text not null,
  stage text not null,
  sequence integer not null,
  source text not null,
  primary key (jurisdiction, class_pattern, stage)
);

create table certifiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null check (jurisdiction in ('NSW','QLD','VIC')),
  registration_no text not null,
  registration_class text not null,
  registration_expires date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table councils (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null check (jurisdiction in ('NSW','QLD','VIC')),
  lodgement_route text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'builder' check (kind in ('owner','builder','developer','designer','other')),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id),
  site_address text not null,
  jurisdiction text not null check (jurisdiction in ('NSW','QLD','VIC')),
  approval_type text not null,
  building_class text not null,
  description text not null default '',
  fee_cents bigint not null check (fee_cents >= 0),
  inspections_included integer not null default 0 check (inspections_included >= 0),
  sent_on date not null,
  status text not null default 'sent' check (status in ('sent','accepted','declined','expired')),
  answered_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  quote_id uuid references quotes(id),
  client_id uuid not null references clients(id),
  council_id uuid not null references councils(id),
  certifier_id uuid not null references certifiers(id),
  jurisdiction text not null check (jurisdiction in ('NSW','QLD','VIC')),
  approval_type text not null,
  building_class text not null,
  site_address text not null,
  description text not null default '',
  status text not null default 'assessing'
    check (status in ('assessing','information requested','approved','under construction','final issued','closed','withdrawn')),
  received_on date not null,
  decided_on date,
  decision text check (decision in ('approved','refused')),
  council_lodged_on date,
  commencement_notice_on date,
  work_commenced_on date,
  final_issued_on date,
  final_type text,
  closed_on date,
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  invoiced_cents bigint not null default 0 check (invoiced_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  certifier_design_role boolean not null default false,
  certifier_financial_interest boolean not null default false,
  conflict_note text,
  source jsonb,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (decided_on is null or decided_on >= received_on),
  check (final_issued_on is null or decided_on is not null)
);

-- A listed stage that does not apply to this job (no slab, no reinforced masonry), with the reason.
create table stage_exemptions (
  application_id uuid not null references applications(id),
  stage text not null,
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now(),
  primary key (application_id, stage)
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  application_id uuid not null references applications(id),
  stage text not null,
  booked_for date not null,
  inspector_id uuid references certifiers(id),
  result text not null default 'booked' check (result in ('booked','passed','failed','not ready','cancelled')),
  inspected_on date,
  findings text not null default '',
  evidence_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table info_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  application_id uuid not null references applications(id),
  request text not null,
  sent_on date not null,
  due_on date not null,
  received_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  actor text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  filename text not null,
  sha256 text not null unique,
  row_count integer not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id uuid,
  operation text not null,
  actor text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create trigger certifiers_touch before update on certifiers for each row execute function touch_updated_at();
create trigger councils_touch before update on councils for each row execute function touch_updated_at();
create trigger clients_touch before update on clients for each row execute function touch_updated_at();
create trigger quotes_touch before update on quotes for each row execute function touch_updated_at();
create trigger applications_touch before update on applications for each row execute function touch_updated_at();
create trigger inspections_touch before update on inspections for each row execute function touch_updated_at();
create trigger info_requests_touch before update on info_requests for each row execute function touch_updated_at();

create index applications_status_idx on applications(status);
create index inspections_application_idx on inspections(application_id);
create index info_requests_application_idx on info_requests(application_id);

-- ------------------------------------------------------------------ views

create view job_register as
select a.code, a.jurisdiction, a.approval_type, a.building_class as class, a.site_address, cl.name client,
  co.name council, ce.code certifier, a.status, a.received_on, a.decided_on, a.council_lodged_on,
  a.final_issued_on, a.fee_cents, a.invoiced_cents, a.paid_cents, a.id
from applications a
join clients cl on cl.id = a.client_id
join councils co on co.id = a.council_id
join certifiers ce on ce.id = a.certifier_id;

-- The lodgement clock: a decision has to reach council inside the jurisdiction's limit.
create view lodgement_clock as
select a.code, a.jurisdiction, co.name council, a.decided_on, r.days limit_days, r.day_kind,
  case when r.day_kind = 'business' then add_business_days(a.decided_on, r.days) else a.decided_on + r.days end due_on,
  a.council_lodged_on, a.id
from applications a
join councils co on co.id = a.council_id
join rules r on r.code = 'LODGE' and r.jurisdiction = a.jurisdiction
where a.decided_on is not null and a.decision = 'approved';

create view lodgements_due as
select code, jurisdiction, council, decided_on, due_on, due_on - current_date days_left
from lodgement_clock where council_lodged_on is null;

-- Each job's required stages and whether each one has a passed inspection.
create view stage_status as
select a.code, a.id application_id, a.jurisdiction, a.building_class, s.stage, s.sequence,
  (select max(i.inspected_on) from inspections i where i.application_id = a.id and lower(i.stage) = lower(s.stage) and i.result = 'passed') passed_on,
  (select max(i.booked_for) from inspections i where i.application_id = a.id and lower(i.stage) = lower(s.stage) and i.result = 'booked') booked_for,
  (select count(*)::int from inspections i where i.application_id = a.id and lower(i.stage) = lower(s.stage) and i.result in ('failed','not ready')) failed_attempts
from applications a
join stage_rules s on s.jurisdiction = a.jurisdiction and lower(a.building_class) ~ s.class_pattern
where a.status not in ('withdrawn') and a.decision is distinct from 'refused'
  and not exists (select 1 from stage_exemptions e where e.application_id = a.id and lower(e.stage) = lower(s.stage));

create view inspections_due as
select i.code, a.code job, i.stage, i.booked_for, coalesce(ce.code, '') inspector, a.site_address,
  case when i.booked_for < current_date then 'overdue: record the result' else 'booked' end state
from inspections i
join applications a on a.id = i.application_id
left join certifiers ce on ce.id = i.inspector_id
where i.result = 'booked';

-- A failed or not-ready inspection with no later passed or booked inspection of the same stage.
create view reinspections_needed as
select i.code, a.code job, i.stage, i.inspected_on, i.findings
from inspections i
join applications a on a.id = i.application_id
where i.result in ('failed','not ready')
  and a.status not in ('closed','withdrawn')
  and not exists (
    select 1 from inspections j where j.application_id = i.application_id and lower(j.stage) = lower(i.stage)
      and j.result in ('passed','booked') and coalesce(j.inspected_on, j.booked_for) >= i.inspected_on);

create view quotes_waiting as
select q.code, cl.name client, q.site_address, q.approval_type, q.fee_cents, q.sent_on, current_date - q.sent_on days_waiting
from quotes q join clients cl on cl.id = q.client_id
where q.status = 'sent';

create view info_requests_open as
select r.code, a.code job, r.request, r.sent_on, r.due_on, r.due_on - current_date days_left
from info_requests r join applications a on a.id = r.application_id
where r.received_on is null and a.status not in ('closed','withdrawn');

create view fees_owing as
select a.code, cl.name client, a.fee_cents, a.invoiced_cents, a.paid_cents,
  a.fee_cents - a.invoiced_cents uninvoiced_cents, a.invoiced_cents - a.paid_cents owing_cents
from applications a join clients cl on cl.id = a.client_id
where a.status <> 'withdrawn' and (a.fee_cents > a.invoiced_cents or a.invoiced_cents > a.paid_cents);

-- Jobs under construction with no inspection activity for 90 days.
create view quiet_jobs as
select a.code, a.site_address, cl.name client, a.status,
  coalesce((select max(coalesce(i.inspected_on, i.booked_for)) from inspections i where i.application_id = a.id), a.decided_on) last_activity
from applications a join clients cl on cl.id = a.client_id
where a.status in ('approved','under construction')
  and coalesce((select max(coalesce(i.inspected_on, i.booked_for)) from inspections i where i.application_id = a.id), a.decided_on) < current_date - 90;

create view finals_ready as
select a.code, a.site_address, a.status,
  count(s.stage)::int required_stages,
  count(s.passed_on)::int passed_stages
from applications a join stage_status s on s.application_id = a.id
where a.status = 'under construction'
group by a.id, a.code, a.site_address, a.status
having count(s.stage) = count(s.passed_on);

-- days holds years for RETAIN. No sourced period for a jurisdiction: keep_until is empty until you set one.
create view retention_register as
select a.code, a.jurisdiction, a.site_address, a.closed_on,
  (a.closed_on + make_interval(years => r.days))::date keep_until,
  case when r.code is null then 'no period recorded for ' || a.jurisdiction || ': set yours in rules' else r.description end basis
from applications a left join rules r on r.code = 'RETAIN' and r.jurisdiction = a.jurisdiction
where a.closed_on is not null;

create view approvals_by_month as
select to_char(decided_on, 'YYYY-MM') as month, approval_type, count(*)::int approvals
from applications where decision = 'approved'
group by 1, 2;

-- Every rule check in one place. One row per finding.
create view record_checks as
select code, 'LODGE' rule, jurisdiction,
  'decision of ' || decided_on || ' not given to council; due ' || due_on finding
from lodgement_clock where council_lodged_on is null and due_on < current_date
union all
select code, 'LODGE-LATE', jurisdiction,
  'given to council ' || council_lodged_on || ', after the ' || due_on || ' limit'
from lodgement_clock where council_lodged_on > due_on
union all
select s.code, 'STAGE-BEFORE-FINAL', s.jurisdiction,
  'final issued with no passed ' || s.stage || ' inspection'
from stage_status s join applications a on a.id = s.application_id
where a.final_issued_on is not null and s.passed_on is null
union all
select s.code, 'STAGE-SKIPPED', s.jurisdiction,
  s.stage || ' has no passed or booked inspection, but a later stage has passed'
from stage_status s join applications a on a.id = s.application_id
where a.status = 'under construction' and s.passed_on is null and s.booked_for is null
  and exists (select 1 from stage_status l where l.application_id = s.application_id and l.sequence > s.sequence and l.passed_on is not null)
union all
select a.code, 'COMMENCEMENT', a.jurisdiction,
  'work commenced ' || a.work_commenced_on || ' with no notice of commencement recorded'
from applications a join rules r on r.code = 'COMMENCE' and r.jurisdiction = a.jurisdiction
where a.work_commenced_on is not null and a.commencement_notice_on is null
union all
select a.code, 'COMMENCEMENT-SHORT', a.jurisdiction,
  'notice ' || a.commencement_notice_on || ' gave fewer than ' || r.days || ' days before work on ' || a.work_commenced_on
from applications a join rules r on r.code = 'COMMENCE' and r.jurisdiction = a.jurisdiction
where a.work_commenced_on is not null and a.commencement_notice_on is not null and a.work_commenced_on - a.commencement_notice_on < r.days
union all
select a.code, 'REGISTRATION', a.jurisdiction,
  ce.code || ' registration expired ' || ce.registration_expires || ' before the decision on ' || a.decided_on
from applications a join certifiers ce on ce.id = a.certifier_id
where a.decided_on is not null and ce.registration_expires < a.decided_on
union all
select a.code, 'CONFLICT', a.jurisdiction,
  'certifier recorded with a ' ||
  case when a.certifier_design_role and a.certifier_financial_interest then 'design role and financial interest'
       when a.certifier_design_role then 'design role' else 'financial interest' end ||
  coalesce(': ' || a.conflict_note, '')
from applications a
where (a.certifier_design_role or a.certifier_financial_interest) and a.status <> 'withdrawn'
union all
select r.code, 'INFO-OVERDUE', a.jurisdiction,
  'information requested ' || r.sent_on || ', due ' || r.due_on || ', not received'
from info_requests r join applications a on a.id = r.application_id
where r.received_on is null and r.due_on < current_date and a.status not in ('closed','withdrawn');

create view certifier_watch as
select code, name, jurisdiction, registration_no, registration_class, registration_expires,
  registration_expires - current_date days_left
from certifiers where active;

create view attention as
select code, 'lodgement overdue' issue, due_on due from lodgements_due where due_on < current_date
union all select code, 'inspection result not recorded', booked_for from inspections_due where booked_for < current_date
union all select code, 'reinspection not booked', inspected_on from reinspections_needed
union all select code, 'information request overdue', due_on from info_requests_open where due_on < current_date
union all select code, 'fee proposal unanswered 14+ days', sent_on from quotes_waiting where days_waiting >= 14
union all select code, 'no inspection activity for 90 days', last_activity from quiet_jobs
union all select code, case when days_left < 0 then 'registration expired' else 'registration expires within 60 days' end, registration_expires from certifier_watch where days_left <= 60;

-- Trusted-operator database: no anonymous access.
alter table public_holidays enable row level security;
alter table rules enable row level security;
alter table stage_rules enable row level security;
alter table stage_exemptions enable row level security;
alter table certifiers enable row level security;
alter table councils enable row level security;
alter table clients enable row level security;
alter table quotes enable row level security;
alter table applications enable row level security;
alter table inspections enable row level security;
alter table info_requests enable row level security;
alter table notes enable row level security;
alter table import_batches enable row level security;
alter table audit_log enable row level security;
revoke all on all tables in schema public from public;
