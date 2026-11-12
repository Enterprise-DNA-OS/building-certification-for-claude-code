---
description: "Record a payment against what was invoiced"
---

# payment

Read CLAUDE.md first. Run:

```bash
npm run certify -- payment <job> --amount=1200 --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change.
