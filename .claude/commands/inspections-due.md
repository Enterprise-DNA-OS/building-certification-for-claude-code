---
description: "Inspections booked for the next seven days, plus booked inspections whose result was never recorded"
---

# inspections-due

Read CLAUDE.md first. Run:

```bash
npm run certify -- inspections-due
```

Present the rows with job codes first. Use --json for untrimmed values. If a reference is ambiguous, list the candidates and stop; never pick one by guess. Group by date, then inspector.
