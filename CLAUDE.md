# Building Certification for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** a private building certification or building surveying practice in NSW, Queensland or Victoria. Set the name in `brand.json`.
- **Operator:** the certifier, building surveyor or practice manager who runs the job file.
- **What matters most:** every approval reaches council inside its clock, no final certificate goes out with a required stage uninspected, and fees are collected.

The demo desk is fictional. Replace the "who" above with the real practice before the first live job.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| add a certifier with their registration | `/add-certifier` |
| add a client: an owner, builder, developer or designer | `/add-client` |
| add a council the desk lodges with | `/add-council` |
| open a job, from an accepted quote or directly | `/add-job` |
| record a fee proposal | `/add-quote` |
| record that a fee proposal was accepted, declined or expired | `/answer-quote` |
| approvals issued each month by type, the number a per-approval plan charges on | `/approvals-by-month` |
| everything overdue or about to lapse across the desk, in one list | `/attention` |
| the change history: who changed what and when | `/audit` |
| book a stage inspection | `/book-inspection` |
| how many jobs each certifier is assessing, has on site and inspects in the next seven days | `/certifier-workload` |
| each certifier's registration, class and days until it expires | `/certifiers` |
| close a job after its final; returns the date the file must be kept until | `/close` |
| record the notice of commencement and the day work started | `/commence` |
| check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited | `/compliance` |
| make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it | `/customise` |
| record the decision on a job. Refuses while information is outstanding or the certifier's registration has lapsed | `/decide` |
| draft a fee proposal letter from a recorded quote | `/draft-fee-proposal` |
| draft the request for further information letter | `/draft-info-request` |
| draft the inspection record for a recorded inspection | `/draft-inspection-report` |
| write every record, rule and change to one JSON file | `/export` |
| fees not yet invoiced and invoices not yet paid, by job | `/fees-owing` |
| jobs under construction with every required stage passed, ready for the final certificate | `/finals-ready` |
| bring jobs across from a Visual Approvals register report saved as CSV, test run first | `/import` |
| every file imported, with its fingerprint and row count | `/imports` |
| open requests for further information and when each is due back | `/info-requests` |
| inspections booked for the next seven days, plus booked inspections whose result was never recorded | `/inspections-due` |
| record an invoice against a job's agreed fee | `/invoice` |
| record the final certificate. Refuses while any required stage has no passed inspection | `/issue-final` |
| which mandatory or critical stage inspections one job still needs | `/job-stages` |
| one job file: the record, its required stages, inspections, information requests, rule findings and notes | `/job` |
| the job register: every application with its type, class, site, client, certifier and status | `/jobs` |
| record the day the approval documents reached council | `/lodge` |
| approvals not yet given to council, with the statutory due date and days left | `/lodgements-due` |
| add a note to a job file | `/log` |
| add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view` | `/new-view` |
| notes logged against jobs | `/notes` |
| record a payment against what was invoiced | `/payment` |
| approved jobs with no inspection activity for 90 days | `/quiet-jobs` |
| fee proposals sent with no answer yet, oldest first | `/quotes-waiting` |
| every fee proposal and its answer | `/quotes` |
| record that requested information arrived | `/receive-info` |
| record what an inspection found | `/record-inspection` |
| failed or not-ready inspections with no reinspection booked | `/reinspections` |
| record a certifier's renewed registration | `/renew-registration` |
| ask the applicant for further information; the job goes on hold | `/request-info` |
| closed job files and the date each must be kept until | `/retention` |
| the statutory clocks and stage lists the checks use | `/rules` |
| the Monday review: attention, lodgements, inspections, reinspections, rule checks, quotes and fees in one draft | `/weekly-review` |
| withdraw a job that will not proceed | `/withdraw` |

If an ask fits nothing here, run the CLI directly (`npm run certify -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Certification rules

- Every write needs `--actor` with the operator's name. It goes in the audit log. Actor names are labels, not verified identities.
- Record only what the certifier reports. Never mark an inspection passed, a decision made or a document lodged on a guess.
- Ask about a design role or financial interest when a job opens. Record the answer; never assume no.
- `decide` refuses while an information request is open or the certifier's registration has lapsed. `issue-final` refuses while a required stage has no passed inspection. Do not work around either: fix the record.
- A stage that genuinely does not apply (no slab, no reinforced masonry) is recorded with `stage-not-required` and a reason, never by deleting the rule.
- The statutory clocks and stage lists live in the `rules` and `stage_rules` tables, sourced in `docs/compliance.md`. Change them with a new migration after the operator confirms the rule. Nothing here is legal advice.
- Never submit to a council portal or the NSW Planning Portal from here. Record the lodgement after a person has done it.
- Run `npm test` after any change. Never edit an applied migration. Never seed a production database.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Visual Approvals.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/visual-approvals
