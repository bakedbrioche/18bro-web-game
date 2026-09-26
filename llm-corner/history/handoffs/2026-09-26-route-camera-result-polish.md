# 2026-09-26 - Route, camera and result polish

Author: Codex with delegated simulation, scene and UI workers
Branch: feature/graphics-v2-pivot
Commit/PR: this commit; draft PR #1 remains the integration target

## State of the world

The active Magnet now reads as an intentional held power. Original raises its existing player-right arm and resets it through the ordinary pose path. Refreshed builds one cached AnimationMixer variant for every base hero clip; only `arm_L.quaternion` and `forearm_L.quaternion` are replaced with a straight approximately 40-degree hold. All other tracks are cloned unchanged, the runtime effect never writes imported bones, and removing Magnet restores the matching base action in the same frame. The enlarged authored U remains attached at its lower bridge and emits three cyan wave arcs.

Three-Paw Guard now lasts fifteen seconds with the existing three charges. Its badges are 1.04 scale, exactly 120 degrees apart, and orbit clockwise once every three seconds. Consuming a charge shrinks its badge and emits six bounded cyan shards over 0.58 seconds; Reduced Motion freezes the orbit and uses a short dissolve without flying shards.

Ordinary ground rewards no longer repeat a fixed four-chip line. `COIN_SEQUENCES` selects three to six chips using weights `1:3:3:1`, alternates seeded straight/lateral/weave paths, and excludes the previous pattern/start-lane pair. Obstacle routes pass through the safe lane at their central chips, use speed-aware lane-change spacing, and remain suppressed during Jetpack. Broad intersections use the same planner.

Moon Boots and Jetpack now lift camera position and look target by the same `player height * 0.9` amount. This preserves viewing pitch across high jumps and removes the former abrupt height-threshold switch. Ordinary jumps retain the small capped camera-position response.

The BUSTED wave now takes about 1.60 seconds to traverse the word, with two or three adjacent glyphs moving together before a short rest. The existing Blender-rendered chip uses a 1.45-second CSS 3D spin and lighting cycle. Both loops stop under saved or operating-system reduced motion.

## Verification record

- `npm run verify`: 140/140 tests pass; cat, human, power-up and chip validators pass; standalone export is 10,073,843 bytes.
- Deterministic coverage samples 16,000 chip sequences against the explicit 1:3:3:1 distribution and verifies safe-lane reachability, pattern variation, pool reset and Jetpack suppression.
- Headless Chrome exercised Refreshed + Clear through menu, run, raised Magnet, fifteen-second Shield, charge break, Moon Boots apex, route seek, pause/resume, Jetpack + Speed Burst, capture and staged results.
- Magnet and Shield icons retained their decoded 256px nodes through pause/resume. Shield HUD reported `15s x3` with three remaining charges.
- The result chip transform changed between captured frames and adjacent BUSTED glyphs overlapped during the wave.
- Chrome reported WebGL error 0 with no console errors, JavaScript exceptions or failed network requests. Ignored evidence is under `release/browser-review-2/`.

## Landmines and next step

- Imported bones remain exclusively AnimationMixer-owned. Do not replace the Magnet action variants with per-frame authored-bone rotations or a duplicate display arm.
- `ordinaryCoin`, `coinSequenceId`, `coinPattern`, `coinSequenceLength` and `sequenceIndex` are pooled entity fields and must reset in `spawnEntity`.
- Keep the three badge spacing and three-second orbit independent from the fifteen-second simulation timer.
- `release/` and `tmp/` are ignored review/workbench output and must remain uncommitted.
- Colleague street-texture work still targets this branch using `llm-corner/docs/reference/street-texture-integration.md`; the main-targeting draft PR stays unmerged.
