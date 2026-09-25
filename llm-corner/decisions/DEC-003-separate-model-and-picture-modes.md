# DEC-003 — Separate model sets from picture quality

Status: ACCEPTED
Date: 2026-09-22
Decision by: operator and Codex

## Context

The current game has procedural models and a heavily pixelated framebuffer. The visual refresh introduces both a more readable rendering mode and a new authored model family. Coupling those choices would prevent players from comparing model quality fairly, complicate fallback, and make one failed model load change an unrelated graphics preference.

## Decision

Store model set and picture quality as independent preferences. `Models` offers `Original` and `Refreshed`; picture quality offers `Clear Retro`, `Classic Pixel`, and `Performance`. The whole visible cast uses one model generation at a time. Changes apply at a safe scene boundary, and a refreshed-asset failure activates Original for the session without overwriting the saved preference.

Refreshed remains a preview until it passes the model release gate. After promotion it may become the default for new or missing preferences, while every explicit Original selection remains intact.

## Consequences

The save schema gains one normalized setting without changing progression or cosmetics. Runtime integration needs atomic loading, stale-request protection, explicit resource ownership, and a procedural fallback. Preview and release testing must cover the model/picture matrix rather than treating either as a single visual preset.
