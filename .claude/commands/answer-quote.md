---
description: "Record that a fee proposal was accepted, declined or expired"
---

# answer-quote

Read CLAUDE.md first. Run:

```bash
npm run certify -- answer-quote <quote> --status=accepted|declined|expired [--on=] --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change.
