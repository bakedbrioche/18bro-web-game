# DEC-010 — Reveal power routes progressively and author motion from reviewed references

**Status:** Accepted
**Date:** 2026-09-26

This decision supersedes DEC-009 only where that record requires the complete Jetpack route to exist visibly at activation.

## Context

A straight, fully visible Jetpack line removed lane choice and made the next several seconds predictable. The earlier shield, jump, scooter tricks and Speed Burst particles also lacked a coherent visual target. Iterating on those effects without saved reference prompts made review harder to reproduce.

## Decision

- Jetpack owns a deterministic route plan for its full duration but exposes only a rolling window of six to eight chips. New chips extend the far end as earlier chips are collected or passed. Route blocks move among all three lanes, and the final chip still ends flight with the existing bounded timeout.
- Normal power pickups come from shuffled bags containing all seven powers once. The bag boundary may not repeat the previous power.
- Jump, scooter stunt and shield presentation use reviewed reference sheets stored in an ignored dated workbench. Exact prompts and short integration notes remain beside the temporary images.
- The hero jump plays one authored arc across ascent and descent. Scooter jump and side-dodge clips preserve handle contact while moving the body clear of the scooter and low obstacle envelope.
- Shield presentation uses a true spherical shell and nine four-toe paw-heart medallions. Speed Burst uses a screen-edge surge; Jetpack uses layered animated exhaust.
- The simulation remains DOM-free. Route state and randomization stay in dist/core.mjs; screen-space presentation stays in the app, stylesheet and renderer.

## Consequences

Jetpack reserves a small route plan in simulation memory but keeps the active entity pool bounded. Seeded runs remain reproducible. The temporary ImageGen workbench is excluded from Git, while its directory contract is documented so another session can reconstruct the process. Existing saves need no migration because route plans, shuffled bags and active presentation are run-local.
