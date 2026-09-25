# 2026-09-25 — Graphics-v2 pivot and visible power identity

Author: Codex with Astra Blender workers and a simulation worker
Branch: `feature/graphics-v2-pivot`
Commit/PR: created by the chief after this handoff passes final review

## State of the world

The full uncommitted visual-refresh line now lives on a dedicated collaboration branch. Settings independently select Original/Refreshed models, Clear Retro/Classic Pixel/Coarser picture treatment and Arcade/18Bro Sticker typography. Clear Retro is the readable default. Refreshed remains atomic across the cat, police, cashier, riders, nearby crowd and power-ups; Original is the explicit choice and the load-failure fallback.

The current request adds visible power identity. The active magnet is held in the left paw and Moon Boots follow both animated feet in both model families. Moon Boots now own only a 6.1-unit super jump. A separate blue Speed Burst owns the 1.6× acceleration effect and has its own Blender pickup, icon, aura, pickup card and timer. Jetpack creates a complete connected chip route immediately, keeps flight through that route, ends when the last chip is collected and has a bounded two-second overdue fallback. Layered flame cones, exhaust rings and particles make tube thrust visible.

The Shield no longer emits the white cloud trail. It is a translucent energy sphere with independently flickering regions and a three-dimensional orbit of nine red hearts carrying white paw marks. The cat's left/right scooter dodge clips now sit below the 1.6-unit rail. Cashier panic uses raised fists, planted lateral recoil, angry brows, an open scream mouth and an original orange comic anger mark.

## Asset evidence

- Cat rig v4: 868,816 bytes, 3,972 triangles, 20 joints, 18 complete clips, SHA-256 `6cfe638385e4365ceb98886ab4357a308fce834e287d6d3ce6dea36e60076ce7`.
- Human rig v3: 777,208 bytes, 2,526 triangles, 24 joints, 12 complete clips, SHA-256 `a69e3d757624ae48fb832514350de13b605fd729f87278acefb1338bc59afbbf`.
- Power-ups v2: 633,768 bytes, one material and 12,323 triangles: 9,127 across seven pickup roots plus 3,196 across three wearable roots. SHA-256 `4d70447876492bdb09b23923337bf9b94ac8a41caa64a9880e702145ba1372ce`.
- Ignored review renders under `release/power-animation-review/` and `release/powerup-review/` were visually inspected. Scooter held height is 1.5398 game units; human runtime validation sampled 156 poses and all 12 clip-to-idle resets.

## Verification record

- `npm run verify`: 127/127 tests pass; cat/human manifests pass; human pose/reset/clone validation passes; all seven pickups and three wearable contracts pass; offline standalone export is 9,949,289 bytes.
- The local Node server started successfully at `http://localhost:4173/`.
- HTTP smoke returned 200 with correct MIME types for the page, cache-busted modules, 633,768-byte power-up GLB and 46,947-byte Speed Burst PNG.
- The Browser plugin connection closed during initialization, so this session could not complete a fresh interactive menu → run → pause/resume WebGL flow. The generated Blender contact sheets and prior Refreshed browser pass cover the asset family, but a contributor should repeat the interactive smoke before merge.

## Colleague integration

The street texture contributor must start from `origin/feature/graphics-v2-pivot`, then merge or cherry-pick the texture work without replacing graphics-v2 runtime/model files with `main`. The complete file ownership, provenance, graphics-mode and review checklist is in `llm-corner/docs/reference/street-texture-integration.md`.

Keep the pull request open and unmerged until that texture pass is added and the combined Clear Retro/Classic Pixel visual review is complete.

## Landmines

- `dist/` is editable source; `release/` is generated and ignored.
- Imported mixers exclusively own imported bones. Do not add procedural rotations to the authored rigs.
- `powerups-v1.glb` now requires seven `powerup_*` pickup roots and three `wearable_*` roots. A missing root intentionally falls the complete Refreshed family back to Original.
- Moon Boots are no longer a speed/score/invulnerability power. Use `speedburst` for acceleration.
- The Jetpack trail is allocated from the fixed 256-entity pool and deliberately leaves headroom; preserve that bound.
