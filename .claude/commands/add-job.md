---
description: "Open a job, from an accepted quote or directly"
---

# add-job

Read CLAUDE.md first. Run:

```bash
npm run certify -- add-job [--quote=Q-0003] --council=... --certifier=... [--client= --site= --jurisdiction= --type= --class= --fee=] [--design-role=yes] [--financial-interest=yes] [--conflict-note=] --actor="..."
```

Confirm the record and every value with the operator before running. Every write needs --actor with the operator's name. Report the returned row, then run the read that shows the change. Ask whether the certifier had any role in the design or any financial interest; record it, never assume no.
