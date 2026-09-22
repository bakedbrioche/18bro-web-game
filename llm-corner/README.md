# llm-corner — 18Bro project knowledge hub

This directory is the routing table and shared source of truth for agents working on **18Bro: Run for the Chips**, a browser-based 3D endless runner starring the black cat 18Bro in Hong Kong.

## Boot sequence

Read in this order:

1. This file.
2. `docs/conventions/mindset.md` and `docs/conventions/contracts.md`.
3. The top entry in `history/handoffs/INDEX.md`, then that handoff.
4. `active/plans/` and `active/backlog.md`.
5. Your `agents/<name>/inbox/` and relevant notes.
6. `git status --short --branch` and `git log --oneline -10`.
7. Before code changes, run `npm run verify` to establish a green baseline.

For multi-agent work, also read `protocols/roles.md`, `protocols/subagents.md`, and the assigned agent workspace.

## Routing table

| Need | Read |
|---|---|
| Product, audience, gameplay | `docs/product/overview.md` |
| Source layout and runtime flow | `docs/architecture/README.md` |
| Hard project invariants | `docs/conventions/contracts.md` |
| Development steps | `docs/conventions/dev-flow.md` |
| Test, export, and browser gate | `docs/conventions/audit-gate.md` |
| Commit and push discipline | `docs/conventions/git.md` |
| Documentation filing rules | `docs/conventions/docs-style.md` |
| Known traps | `docs/reference/gotchas.md` |
| Why a choice was made | `decisions/INDEX.md` |
| Current work | `active/plans/` and `active/backlog.md` |
| Delegate or parallelize | `protocols/subagents.md` and `protocols/taskboard.md` |
| End a session | `protocols/lifecycle.md` |
| Blank work artifact | `templates/` |

## Layout

```text
docs/        evergreen current truth
protocols/   agent coordination and lifecycle
decisions/   append-only architectural decisions
templates/   plans, tasks, handoffs, audits, subagent briefs
active/      in-flight plans, taskboard, and backlog
history/     append-only changelog, handoffs, audits, archived plans
agents/      agent-specific inbox, notes, prompts, and operating mode
```

Every durable fact has one canonical home. Link to it elsewhere instead of copying it. `active/` should stay small; `history/` is not read at boot except for the newest handoff pointer.
