# Session lifecycle

Run this checklist after a session that changes code or documentation:

1. Write `history/handoffs/YYYY-MM-DD-<slug>.md` and add it at the top of `history/handoffs/INDEX.md`.
2. Mark shipped plans, move them to `history/plans/`, and update its index. Move deferred work to `active/backlog.md`.
3. Move resolved inbox messages to `history/inbox/`; backlog unresolved findings first.
4. Add one tagged changelog entry for every commit.
5. Record significant choices in `decisions/`.
6. Archive reviewed taskboard files with their plan.
7. Fix any contradiction between code and evergreen docs.

Healthy state: zero to two active plans, empty inboxes, newest handoff first, and no completed work left in `active/`.
