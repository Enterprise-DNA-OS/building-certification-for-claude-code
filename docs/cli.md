# CLI reference

One CLI: `npm run certify -- <command> [reference] [--flag=value]`. Human tables by default; add `--json` for full values. References accept a code (J-0004), an ID prefix, or a case-insensitive name or address; ambiguous references list the candidates and exit 1. Every write needs `--actor`. Dates are YYYY-MM-DD; amounts are dollars (1850 or 1850.50).

| Command | Usage | What it does |
|---|---|---|
| add-certifier | `add-certifier --code=... --name="..." --jurisdiction=NSW --registration-no=... --registration-class="..." --registration-expires=YYYY-MM-DD --actor="..."` | Add a certifier with their registration |
| add-client | `add-client --name="..." [--kind=builder] [--email=] [--phone=] --actor="..."` | Add a client: an owner, builder, developer or designer |
| add-council | `add-council --code=... --name="..." --jurisdiction=NSW&#124;QLD&#124;VIC [--route=portal] --actor="..."` | Add a council the desk lodges with |
| add-job | `add-job [--quote=Q-0003] --council=... --certifier=... [--client= --site= --jurisdiction= --type= --class= --fee=] [--design-role=yes] [--financial-interest=yes] [--conflict-note=] --actor="..."` | Open a job, from an accepted quote or directly |
| add-quote | `add-quote --client=... --site="..." --jurisdiction=NSW --type="Complying development certificate" --class=1a --fee=2450 [--inspections=4] [--sent-on=] --actor="..."` | Record a fee proposal |
| answer-quote | `answer-quote <quote> --status=accepted&#124;declined&#124;expired [--on=] --actor="..."` | Record that a fee proposal was accepted, declined or expired |
| approvals-by-month | `approvals-by-month` | Approvals issued each month by type, the number a per-approval plan charges on |
| attention | `attention` | Everything overdue or about to lapse across the desk, in one list |
| audit | `audit` | The change history: who changed what and when |
| book-inspection | `book-inspection <job> --stage="Frame" --date=YYYY-MM-DD [--inspector=] --actor="..."` | Book a stage inspection |
| certifier-workload | `certifier-workload` | How many jobs each certifier is assessing, has on site and inspects in the next seven days |
| certifiers | `certifiers` | Each certifier's registration, class and days until it expires |
| close | `close <job> [--on=] --actor="..."` | Close a job after its final; returns the date the file must be kept until |
| commence | `commence <job> [--notice-on=] [--work-on=] --actor="..."` | Record the notice of commencement and the day work started |
| decide | `decide <job> --decision=approved&#124;refused [--on=] --actor="..."` | Record the decision on a job. Refuses while information is outstanding or the certifier's registration has lapsed |
| draft-fee-proposal | `draft-fee-proposal <quote>` | Draft a fee proposal letter from a recorded quote |
| draft-info-request | `draft-info-request <request>` | Draft the request for further information letter |
| draft-inspection-report | `draft-inspection-report <inspection>` | Draft the inspection record for a recorded inspection |
| export | `export [--out=exports/backup.json]` | Write every record, rule and change to one JSON file |
| fees-owing | `fees-owing` | Fees not yet invoiced and invoices not yet paid, by job |
| finals-ready | `finals-ready` | Jobs under construction with every required stage passed, ready for the final certificate |
| imports | `imports` | Every file imported, with its fingerprint and row count |
| info-requests | `info-requests` | Open requests for further information and when each is due back |
| inspections-due | `inspections-due` | Inspections booked for the next seven days, plus booked inspections whose result was never recorded |
| invoice | `invoice <job> --amount=1200 --actor="..."` | Record an invoice against a job's agreed fee |
| issue-final | `issue-final <job> --type="Occupation certificate" [--on=] --actor="..."` | Record the final certificate. Refuses while any required stage has no passed inspection |
| job-stages | `job-stages <job>` | Which mandatory or critical stage inspections one job still needs |
| job | `job <job>` | One job file: the record, its required stages, inspections, information requests, rule findings and notes |
| jobs | `jobs` | The job register: every application with its type, class, site, client, certifier and status |
| lodge | `lodge <job> [--on=] --actor="..."` | Record the day the approval documents reached council |
| lodgements-due | `lodgements-due` | Approvals not yet given to council, with the statutory due date and days left |
| log | `log <job> --body="..." --actor="..."` | Add a note to a job file |
| notes | `notes` | Notes logged against jobs |
| payment | `payment <job> --amount=1200 --actor="..."` | Record a payment against what was invoiced |
| quiet-jobs | `quiet-jobs` | Approved jobs with no inspection activity for 90 days |
| quotes-waiting | `quotes-waiting` | Fee proposals sent with no answer yet, oldest first |
| quotes | `quotes` | Every fee proposal and its answer |
| receive-info | `receive-info <request> [--on=] --actor="..."` | Record that requested information arrived |
| record-inspection | `record-inspection <inspection> --result=passed&#124;failed&#124;not ready&#124;cancelled --findings="..." [--evidence=] [--on=] --actor="..."` | Record what an inspection found |
| reinspections | `reinspections` | Failed or not-ready inspections with no reinspection booked |
| renew-registration | `renew-registration <certifier> --expires=YYYY-MM-DD --actor="..."` | Record a certifier's renewed registration |
| request-info | `request-info <job> --request="..." --due-on=YYYY-MM-DD --actor="..."` | Ask the applicant for further information; the job goes on hold |
| retention | `retention` | Closed job files and the date each must be kept until |
| rules | `rules` | The statutory clocks and stage lists the checks use |
| weekly-review | `weekly-review` | The Monday review: attention, lodgements, inspections, reinspections, rule checks, quotes and fees in one draft |
| withdraw | `withdraw <job> [--on=] --actor="..."` | Withdraw a job that will not proceed |
| compliance | `compliance` | Every rule finding, with the rule code. Sources in docs/compliance.md |
| import | `import visual-approvals --file=register.csv [--mapping=map.json] [--dry-run] --actor=...` | Bring jobs across from a register report saved as CSV |

Refusals worth knowing: `add-job --quote` needs an accepted quote; `decide` refuses with an open information request or a lapsed registration; `issue-final` refuses while a required stage has no passed inspection; `invoice` cannot pass the agreed fee and `payment` cannot pass what was invoiced; `record-inspection` needs `--findings` unless cancelled.

