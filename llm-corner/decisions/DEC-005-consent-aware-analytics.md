# DEC-005 — Keep analytics consent-aware and disabled by default

Status: ACCEPTED
Date: 2026-09-23
Decision by: operator and Codex

## Context

The future public site needs Yandex Metrica and Meta Pixel support, but production IDs, the replacement URL, consent copy and success metrics are still TBU. Loading vendor scripts now would create network tracking in a community game and would break the offline standalone expectation.

## Decision

Route future measurement through `dist/analytics.mjs`. The module has no import-time side effects, accepts explicit release configuration, requires granted consent before loading either vendor and exposes stable minimal game events. Direct `ym`/`fbq` calls are prohibited outside this boundary.

Keep the live game unconfigured and offline. Public measurement IDs may later enter reviewed release configuration; analytics failure must never block play, saves or rendering. English, Traditional Chinese and Cantonese consent text must be approved before production enablement.

## Consequences

The current build sends no analytics and contacts neither vendor. Production enablement requires IDs, policy copy, consent UI, CSP/hosting review and browser verification of both accepted and denied paths. Standalone releases keep analytics disabled unless explicitly built for a live host.
