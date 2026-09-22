# DEC-001 — Adopt the llm-corner workflow

Status: ACCEPTED
Date: 2026-09-22
Decision by: operator request, adapted by Codex

## Context

Project knowledge lived mainly in a long root README and source code. There was no durable place for active plans, handoffs, decisions, quality gates, agent ownership, or design/release context. The operator supplied the established CoursesTools `llm-corner` workflow as the reference.

## Decision

Adopt one project-neutral `llm-corner/` organized by content type and lifecycle: evergreen docs, protocols, decisions, templates, active work, history, and agent workspaces. Keep root `AGENTS.md` and `CLAUDE.md` as short entry shims. Tailor the gate and contracts to a dependency-free browser game instead of copying backend/database/deployment rules.

## Consequences

- New sessions have a deterministic boot path and do not need to rediscover the project.
- Important rationale and release state persist across agents.
- The process adds upkeep: active plans, changelog, and handoffs must be closed honestly.
- Empty bureaucracy is avoided by keeping only files used by this project and adding new categories when real work requires them.

Alternatives rejected: copying the backend tree verbatim (irrelevant operational noise), per-agent context folders (fact drift), and only expanding the root README (no lifecycle or decision trail).
