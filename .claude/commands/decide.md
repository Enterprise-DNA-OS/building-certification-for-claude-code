---
description: "Record the decision on a job. Refuses while information is outstanding or the certifier's registration has lapsed"
---

# decide

Read CLAUDE.md first. Run:

```bash
npm run certify -- decide <job> --decision=approved|refused [--on=] --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change. Report the council due date it returns.
