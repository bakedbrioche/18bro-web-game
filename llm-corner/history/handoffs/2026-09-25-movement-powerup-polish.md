# 2026-09-25 — Responsive movement and authored power-up polish

Author: Codex with Astra animation and Blender asset workers
Commits: none; work remains in the uncommitted visual-refresh tree

## State of the world

Refreshed now atomically loads three Blender assets: the 18Bro rig, the shared human rig and a six-prop power-up set. The cat has reset-safe authored clips for a forward roll, scooter mount, scooter stunt-jump and left/right scooter low dodges. The cashier's new panic clip uses a 22nd mouth joint for a visible scream. Original remains a saved option and the full load-failure fallback.

Movement is responsive at action boundaries: ground roll can interrupt into jump, jump can interrupt into an airborne roll/fast fall, and the sequence does not create a double jump. Lateral vehicle hits are recoverable pressure, descending landings on vehicle roofs are safe and supported until the cat leaves the roof, and true frontal impacts retain capture.

Magnet keeps every chip it has latched and remains logically active until that debt is collected. Jetpack schedules frame-rate-independent airborne chip trails. Each power-up has a unique Blender prop, transparent 256x256 icon, animated in-world aura, pickup card and icon timer. Shield has a breathing bubble, three animated rings and orbiting sparks. Ambient road steam/white particles are disabled.

## Asset evidence

- Cat v3: 868,816 bytes, 3,972 triangles, 20 joints, 18 clips, SHA-256 `85f76dc881550840e05112f2d82d6c172e644f09c1c58218d073a974afa4d5d8`.
- Human v2: 739,148 bytes, 2,446 triangles, 22 joints, 12 clips, SHA-256 `cf81a9b25002a38d8b692e4895e5039f0ba87bb3a6c851e7f6e764dd7412a61e`.
- Power-ups v1: 447,628 bytes, 8,500 triangles across six centered roots, one vertex-color material, SHA-256 `fe1ba2c9c93fb21d600c5bff380a72a8d9ffc506438ac386b6154678917a6391`.
- Review renders are generated under ignored `release/power-animation-review/` and `release/powerup-review/`.

## Verification record

- `npm run verify`: 123/123 tests pass; cat/human manifest validation passes; all 156 sampled human poses, clip resets and independent skeleton cloning pass; all six power-up roots/icons pass; standalone export is 9,571,843 bytes.
- Modular server successfully returned the page, cache-busted app module, power-up GLB and PNG icon with correct MIME types at `http://localhost:4173/`.
- Roll, scooter, cashier and booster contact sheets were visually inspected for silhouette, contact and reset continuity.
- The Browser plugin reported no available browser backend, so a fresh interactive WebGL browser flow could not be executed in this session. The prior character-family pass had completed that Chrome flow before this delta.

## Open or deferred

- PLAN-001 localization and language UI remain open.
- A user-operated live visual pass should judge scooter side-dodge exaggeration, shield density and pickup-card screen time on the target desktop/mobile browsers.
- No commit, push, deploy or publication occurred.

## Landmines for the next session

- `dist/` remains editable source; regenerate the standalone rather than editing it.
- Imported bones remain mixer-only. New scooter/roll changes belong in Blender source and complete clips.
- The Refreshed atomic load now requires `powerups-v1`; omitting it intentionally falls back the whole family to Original.
