---
description: "Bring jobs across from a Visual Approvals register report saved as CSV, test run first"
---

# import

Read docs/replace-visual-approvals.md first.

1. Ask for the CSV the operator saved from their Visual Approvals application register report. Look at its header row.
2. If the columns differ from the defaults in docs/replace-visual-approvals.md, write a mapping file from examples/visual-approvals-mapping.json and show it to the operator.
3. Test run, which writes nothing:

```bash
npm run certify -- import visual-approvals --file=register.csv [--mapping=mapping.json] --dry-run --actor="..."
```

4. Report rows, new jobs and jobs already there. Only on the operator's yes, run it again without --dry-run.
5. Then list what the import cannot know: certifier registrations, lodgement dates, inspections and payments. Offer to enter them.
