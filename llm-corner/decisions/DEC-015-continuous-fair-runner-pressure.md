# DEC-015 - Keep runner pressure continuous, fair and legible

**Date:** 2026-09-27
**Status:** ACCEPTED

## Context

Long empty road spans, rigid chip rows and isolated traffic made the endless run feel inactive. New police pressure also needed a fairness contract: the player must be able to read and avoid every generated attack even after the difficulty cap is reached. Subway Surfers is the genre benchmark for readable pickup trails, telegraphed threats and responsive recovery, but its unpublished spawn internals are not available for reuse.

## Decision

- Generate deterministic chip formations every 40–50 metres. Each formation crosses three lanes with 5–8 chips per line and selects among straight, arrow and weave shapes while suppressing immediate pattern and starting-lane repeats.
- Keep ordinary 3–6-chip paths between formations. Broad roads retain sparse forward vehicles so they feel active without becoming blocked.
- Let Jetpack exclusively own airborne chip routing while active. Stop and clear its route at the descent boundary; Speed Burst may increase legitimate travel distance, while Double Chips changes pickup value only.
- Treat every geometrically reachable obstacle roof as a safe descending landing.
- Schedule perpendicular intersection traffic with capped difficulty. Every crossing gap must exceed the time for one jump plus a two-lane correction, and at least two forward escape lanes stay open.
- Run police net pursuits through a separate deterministic controller. Two officers alternate 2–4 telegraphed attempts each. The simulation reserves and clears one escape lane, keeps normal hazards present, and exposes the phase snapshot to rendering. Dodging all attempts awards 10,000 score; a hit uses a dedicated net, lift and carry capture before the result screen.
- Use current genre leaders as interaction references, then implement original timing, code, art and copy. Do not present inferred algorithms as another studio's internal implementation.

## Consequences

Runs maintain a bounded rhythm of collection, hazards and pursuit without guaranteed repetition or impossible walls. The entity pool remains capped at 256, so formation planners reserve capacity before spawning. Net pursuit adds `dist/net-pursuit.mjs` to the modular and standalone module graphs and introduces a rare 10,000-point reward that does not alter saved chip currency.