# DEC-008 — Responsive move chaining and authored power-up presentation

**Status:** Accepted
**Date:** 2026-09-25

## Context

Ground slide and jump inputs were mutually gated, scooter riding reused one pose, vehicle contacts treated too many side/top encounters as fatal, and timed magnet/jetpack behavior could leave promised chips behind or only on the road. Power-ups were simple procedural symbols with text-only HUD badges. Ambient cart steam also appeared as unexplained white pixels along ordinary road chunks.

## Decision

- `slide` is presented as an authored forward roll. A grounded roll can become a jump immediately, and a jump can become an airborne roll/fast fall without granting a second jump.
- Scooter pickup exposes a short mount phase and latches a randomized left/right dodge side. Authored mount, ride, stunt-jump and side-dodge clips own the imported cat bones.
- A lateral vehicle contact is recoverable pressure; a true frontal collision retains capture. A descending cat may land on a vehicle roof, stay supported while overlapping it and continue after leaving its far edge.
- Magnet tags chips once they enter its radius. Expiry stops acquiring new targets but keeps the power logically and visually active until every tagged chip is collected.
- Jetpack schedules deterministic chip lines at predicted airborne height by traveled distance, preserving identical behavior across frame rates.
- Blender is the source for all six Refreshed pickup props and their matching transparent icons. The runtime adds bounded per-type aura/bob motion, an icon pickup card and icon timer badges. The standalone exporter embeds the icons.
- Ambient white road particles remain off. Particle bursts are reserved for actions, pickups, powers and future visibly damaged props.

## Consequences

The simulation gains explicit transient fields (`mopedMount`, `mopedSlideSide`, `roofEntityId`, `magnetLatched`, `flightTrail`) but no save-schema fields. Keyboard and touch continue to call the same four move actions. Collision, move chaining, magnet debt and jetpack trails stay DOM-free and deterministic. Refreshed now depends atomically on cat, human and power-up GLBs; Original remains the explicit preference and load-failure fallback.
