# 2026-09-22 — workflow bootstrap

Author: Codex
Commits: llm-corner bootstrap (this commit)

## State of the world

`main` includes the colleague’s Snack Heist update through `ed86a9f`. Local development uses `server.mjs` because Python/uv served modules incorrectly on the operator’s Windows setup. The source is in `dist/`; tests, export, and browser play were green before this workflow commit. `PLAN-001-visual-refresh.md` records the immediate design discussion without authorizing implementation.

## Shipped

- Single llm-corner routing and lifecycle system adapted from the operator’s reference workflow.
- Node local server and `npm run verify` gate.
- Evergreen product/architecture/contracts/gotchas docs and reusable coordination templates.

## Open

- Agree the visual-refresh direction and phase order in PLAN-001.
- Add CI and define root standalone artifact refresh policy (`active/backlog.md`).

## Verification record

Before bootstrap: 88 tests passed; standalone export completed; Chrome loaded the new store scene, advanced a run to 21 m, and passed pause/resume with no browser errors. Re-run `npm run verify` and browser smoke on the final committed tree.
