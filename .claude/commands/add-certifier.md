---
description: "Add a certifier with their registration"
---

# add-certifier

Read CLAUDE.md first. Run:

```bash
npm run certify -- add-certifier --code=... --name="..." --jurisdiction=NSW --registration-no=... --registration-class="..." --registration-expires=YYYY-MM-DD --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change.
