# llm-corner — 18Bro project knowledge hub

This directory is the routing table and shared source of truth for agents working on **18Bro: Run for the Chips**. The project turns the viral story of a Hong Kong black cat stealing chips from a local 7-Eleven into a globally shareable community browser game for a related crypto project, timed around the character's merchandise push. Canonical product context and unresolved positioning questions live in `docs/product/overview.md`.

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
| Character model runtime | `docs/architecture/character-assets.md` and `docs/conventions/3d-art.md` |
| Languages and future analytics | `docs/architecture/localization-analytics.md` |
| Hard project invariants | `docs/conventions/contracts.md` |
| Development steps | `docs/conventions/dev-flow.md` |
| Test, export, and browser gate | `docs/conventions/audit-gate.md` |
| Commit and push discipline | `docs/conventions/git.md` |
| Documentation filing rules | `docs/conventions/docs-style.md` |
| Known traps | `docs/reference/gotchas.md` |
| Blender, Astra, and model export setup | `docs/reference/blender-codex-setup.md` and `active/plans/PLAN-002-blender-model-pipeline.md` |
| Temporary GPT Image/reference work | `docs/conventions/generative-reference-workbench.md` |
| Integrate a colleague's street texture pack | `docs/reference/street-texture-integration.md` |
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
