---
description: "Record what an inspection found"
---

# record-inspection

Read CLAUDE.md first. Run:

```bash
npm run certify -- record-inspection <inspection> --result=passed|failed|not ready|cancelled --findings="..." [--evidence=] [--on=] --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change. Record only what the inspector reports. Offer /draft-inspection-report.
