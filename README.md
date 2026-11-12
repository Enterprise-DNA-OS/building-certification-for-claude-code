<h1 align="center">Building Certification for Claude Code</h1>

<p align="center">
  <strong>The open-source building certification desk that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Visual Approvals data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=visual-approvals">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/visual-approvals?utm_source=github&utm_medium=readme&utm_campaign=visual-approvals">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-visual-approvals">Instead of Visual Approvals</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Building Certification for Claude Code does the job you pay Visual Approvals for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Visual Approvals dashboard cannot.

**The bill it replaces.** Visual Approvals' [pricing page](https://visualapprovals.com.au/pricing), checked 12 November 2026, lists Accelerate at $725 +GST a month for five users and 40 approvals a month, which is $8,700 a year. Each building approval over the allotment adds $27.50 (under 100 a month), so a practice issuing 100 approvals a month pays about $28,500 a year before e-sign, SMS, storage and extra user licences. BCS Office, the other common choice, publishes no plan prices. Independent software, not affiliated with Visual Approvals or BCS.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=visual-approvals).

It is the job file for a private building certification or building surveying practice in New South Wales, Queensland or Victoria: fee proposals, applications, information requests, decisions, the clock to get approval documents to council, mandatory and critical stage inspections, final certificates, fees and how long each closed file must be kept. The rule checks know each state's lodgement clock and inspection stages, with the source of every rule in [docs/compliance.md](docs/compliance.md).

### Five weekly rituals

- `/lodgements-due`: approvals still to reach council, with each state's clock (QLD 5 business days, VIC 7 days, NSW 2 days).
- `/inspections-due`: the next seven days of stage inspections, plus any booked inspection whose result was never recorded.
- `/reinspections`: failed or not-ready inspections with nothing rebooked.
- `/compliance`: every rule finding: late lodgements, skipped stages, a final issued with a stage uninspected, notice of commencement, registrations, conflicts, overdue information.
- `/weekly-review`: the Monday paper, written to `drafts/` from the attention list, lodgements, inspections, rule checks, quotes and fees.

### Ten questions Visual Approvals' dashboard will not answer for you

Each is one command against your own records today.

1. Which approvals have not reached council inside the state's clock? `/lodgements-due`
2. Which jobs have a later stage passed but an earlier required stage never inspected? `/compliance`
3. Which final certificates went out with a required stage uninspected? `/compliance`
4. Which failed inspections have no reinspection booked? `/reinspections`
5. Which booked inspections never had a result recorded? `/inspections-due`
6. Which fee proposals have waited more than two weeks for an answer? `/quotes-waiting`
7. Which applicants are late with information we asked for? `/info-requests`
8. Whose registration lapses in the next 60 days? `/certifiers`
9. Which jobs on site have gone quiet for 90 days? `/quiet-jobs`
10. How many approvals did we issue each month, by type? `/approvals-by-month`

### Your first hour: ten things to ask for

1. Put our practice name and colours in `brand.json`.
2. Run the Monday review on the demo desk.
3. Show me everything that needs attention this week.
4. Add our certifiers with their registration numbers and expiry dates.
5. Add the councils we lodge with.
6. Test the import with our Visual Approvals register report.
7. Which of our jobs still need a stage inspection?
8. Draft the fee proposal for the job we quoted today.
9. Add our public holidays so the business-day clock counts them.
10. `/customise`: our inspection stages and fee rules, the way we run them.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/building-certification-for-claude-code.git
cd building-certification-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`, or ask "what needs doing this week?".

Or run the CLI directly:

```bash
npm test                          # PASS on a throwaway database
npm run certify -- lodgements-due
npm run certify -- compliance
npm run view                      # branded HTML dashboards in ./views
npm run docs                      # inspection records, fee proposals and job file summaries in ./docs-out
```

The demo desk is fictional and seeds once. A shared Postgres needs `node scripts/seed.mjs --demo-database` on an empty disposable database. Never seed production.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands


50 commands, one per recurring job. Full syntax: [docs/cli.md](docs/cli.md).

| Command | What it does |
|---|---|
| `/add-certifier` | Add a certifier with their registration |
| `/add-client` | Add a client: an owner, builder, developer or designer |
| `/add-council` | Add a council the desk lodges with |
| `/add-job` | Open a job, from an accepted quote or directly |
| `/add-quote` | Record a fee proposal |
| `/answer-quote` | Record that a fee proposal was accepted, declined or expired |
| `/approvals-by-month` | Approvals issued each month by type, the number a per-approval plan charges on |
| `/attention` | Everything overdue or about to lapse across the desk, in one list |
| `/audit` | The change history: who changed what and when |
| `/book-inspection` | Book a stage inspection |
| `/certifier-workload` | How many jobs each certifier is assessing, has on site and inspects in the next seven days |
| `/certifiers` | Each certifier's registration, class and days until it expires |
| `/close` | Close a job after its final; returns the date the file must be kept until |
| `/commence` | Record the notice of commencement and the day work started |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it |
| `/decide` | Record the decision on a job. Refuses while information is outstanding or the certifier's registration has lapsed |
| `/draft-fee-proposal` | Draft a fee proposal letter from a recorded quote |
| `/draft-info-request` | Draft the request for further information letter |
| `/draft-inspection-report` | Draft the inspection record for a recorded inspection |
| `/export` | Write every record, rule and change to one JSON file |
| `/fees-owing` | Fees not yet invoiced and invoices not yet paid, by job |
| `/finals-ready` | Jobs under construction with every required stage passed, ready for the final certificate |
| `/import` | Bring jobs across from a Visual Approvals register report saved as CSV, test run first |
| `/imports` | Every file imported, with its fingerprint and row count |
| `/info-requests` | Open requests for further information and when each is due back |
| `/inspections-due` | Inspections booked for the next seven days, plus booked inspections whose result was never recorded |
| `/invoice` | Record an invoice against a job's agreed fee |
| `/issue-final` | Record the final certificate. Refuses while any required stage has no passed inspection |
| `/job-stages` | Which mandatory or critical stage inspections one job still needs |
| `/job` | One job file: the record, its required stages, inspections, information requests, rule findings and notes |
| `/jobs` | The job register: every application with its type, class, site, client, certifier and status |
| `/lodge` | Record the day the approval documents reached council |
| `/lodgements-due` | Approvals not yet given to council, with the statutory due date and days left |
| `/log` | Add a note to a job file |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view` |
| `/notes` | Notes logged against jobs |
| `/payment` | Record a payment against what was invoiced |
| `/quiet-jobs` | Approved jobs with no inspection activity for 90 days |
| `/quotes-waiting` | Fee proposals sent with no answer yet, oldest first |
| `/quotes` | Every fee proposal and its answer |
| `/receive-info` | Record that requested information arrived |
| `/record-inspection` | Record what an inspection found |
| `/reinspections` | Failed or not-ready inspections with no reinspection booked |
| `/renew-registration` | Record a certifier's renewed registration |
| `/request-info` | Ask the applicant for further information; the job goes on hold |
| `/retention` | Closed job files and the date each must be kept until |
| `/rules` | The statutory clocks and stage lists the checks use |
| `/weekly-review` | The Monday review: attention, lodgements, inspections, reinspections, rule checks, quotes and fees in one draft |
| `/withdraw` | Withdraw a job that will not proceed |

## Instead of Visual Approvals

Visual Approvals does not publish an export format. Its standard and custom reports print to CSV or Excel. Save your application register report as CSV, then:

```bash
npm run certify -- import visual-approvals --file=register.csv --dry-run --actor="Your Name"
npm run certify -- import visual-approvals --file=register.csv --actor="Your Name"
```

The test run writes nothing. The importer matches the usual column names and takes a mapping file when yours differ. It keeps every original row, refuses the same file twice, and flags new certifiers until their registration is entered. Inspections, lodgement dates and payments are entered after the import. The full guide: [docs/replace-visual-approvals.md](docs/replace-visual-approvals.md).

## Architecture

```
building-certification-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Building Certification for Claude Code for your business, migrates your Visual Approvals data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=visual-approvals)
- Read more: [enterprisedna.co/omni/instead-of/visual-approvals](https://enterprisedna.co/omni/instead-of/visual-approvals?utm_source=github&utm_medium=readme&utm_campaign=visual-approvals)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
