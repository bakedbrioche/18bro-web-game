# Agent workspaces

Each `agents/<name>/` contains only agent-specific operating mode, inbox, notes, and prompts. Product facts and shared findings belong in global `docs/`, `active/`, `decisions/`, or `history/`.

| Slug | Default role | Notes |
|---|---|---|
| `codex` | chief/auditor | implementation and evidence-first integration as assigned |
| `_template` | none | copy when a persistent new agent workspace is needed |

An empty inbox is healthy. Promote useful notes to global docs and prune stale personal context.
