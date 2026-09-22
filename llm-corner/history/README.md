# History

Append-only archive. Do not read everything at boot. The only normal boot entry is the top row of `handoffs/INDEX.md`.

- `changelog/`: monthly tagged commit stream.
- `handoffs/`: session state, newest first in the index.
- `plans/`: shipped or superseded plans.
- `audits/`: formal evidence-first reviews.
- `inbox/`: resolved inter-agent messages.

Anything agents must consult routinely belongs in evergreen `docs/`, not here.
