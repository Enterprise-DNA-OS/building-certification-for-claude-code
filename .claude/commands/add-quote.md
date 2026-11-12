---
description: "Record a fee proposal"
---

# add-quote

Read CLAUDE.md first. Run:

```bash
npm run certify -- add-quote --client=... --site="..." --jurisdiction=NSW --type="Complying development certificate" --class=1a --fee=2450 [--inspections=4] [--sent-on=] --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change. Then offer /draft-fee-proposal.
