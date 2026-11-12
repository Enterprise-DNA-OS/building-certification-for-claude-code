# Moving off Visual Approvals

Run both side by side for a month. Keep Visual Approvals until the job file here has been checked against it.

## 1. Get your records out

Visual Approvals does not publish an export format or a data model. Its pricing and feature pages list standard reports, custom reports and income summaries. Run the report that lists your applications (number, type, class, site, council, client, certifier, dates and fee) and save it as CSV. Excel works too: open it and save as CSV UTF-8.

What it does not give you in one report: inspection history, information requests and payments. Bring those across by hand for open jobs (the inspection list for each live job is usually short), and keep the closed files in your document store with their retention date.

## 2. Test the import

```bash
npm run certify -- import visual-approvals --file=register.csv --dry-run --actor="Your Name"
```

Nothing is written. It reports rows, new jobs and jobs already in the database. If it cannot find a column it names the columns in your file.

## 3. Map your columns

The importer recognises these headings (case does not matter):

| Field | Headings tried |
|---|---|
| Job number | Application No, Application Number, Job No, Job Number, Reference |
| Approval type | Approval Type, Application Type, Type |
| Building class | Building Class, BCA Class, Class |
| Site | Site Address, Property Address, Address |
| State | State, Jurisdiction |
| Council | Council, Local Government, LGA |
| Client | Client, Applicant, Client Name |
| Certifier | Certifier, Building Surveyor, Assessing Officer |
| Received | Received, Date Received, Lodged |
| Decision | Decision Date, Approved, Date Approved, Issued |
| Fee | Fee, Total Fee, Quoted Fee |
| Description | Description, Description of Work, Works |

Job number, site, council, client and certifier are required. State must be NSW, QLD or VIC on every row. Dates read as DD/MM/YYYY or YYYY-MM-DD. If your headings differ, copy `examples/visual-approvals-mapping.json`, put your own heading against each field and pass `--mapping=your-mapping.json`.

## 4. Import

```bash
npm run certify -- import visual-approvals --file=register.csv --actor="Your Name"
```

- A row with a decision date comes in as approved; without one, as assessing.
- Councils, clients and certifiers are matched by name, or created.
- A new certifier gets a placeholder registration that shows as expired, so `/attention` flags it until you run `add-certifier` details or `renew-registration`.
- Every original row is kept on the job (`source`), the file's fingerprint is recorded, and the same file is refused a second time. Rows whose job number already exists are skipped.

## 5. Finish the open jobs

For each live job: set the status (`commence`, `lodge`), book or record the inspections done so far, record stages that do not apply, and enter invoices and payments. Then run `/compliance` and `/attention` and compare with what Visual Approvals shows.

## What does not carry over

- Plans, documents and photos stay in your document store. Record the reference in each inspection's `--evidence`.
- The iPad inspection app, e-sign, SMS, the quote portal and the Xero link. Enterprise DNA builds the ones you use into your version.
- NSW Planning Portal, QBCC and other mandated reporting. Keep doing those where you do them now; record the date here.
