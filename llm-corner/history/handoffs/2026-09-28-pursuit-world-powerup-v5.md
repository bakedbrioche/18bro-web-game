# Pursuit world and power-up revision 5 handoff

Date: 2026-09-28
Branch: `feature/graphics-v2-pivot`

## Delivered

- The pause modal renders above every transient in-run layer. Presentation clocks and remaining lifetimes remain frozen and resume from the same frame.
- Net pursuits no longer deactivate nearby hazards, clear a suggested escape lane, or rewrite ordinary obstacle and traffic patterns.
- Refreshed Magnet is split blue on the player's left and red on the right, with aligned gray ends and one gold zap. The Original fallback uses the same identity.
- Refreshed Moon Boots are layered mid-top court sneakers without wings. Their contained rear arrows use 18Bro's green left-ear and red right-ear colors. The Original fallback matches them.
- Power-up asset revision 5 is reproducible from `scripts/blender/create_powerups.py`, with focused geometry in `scripts/blender/powerup_models_v5.py` and contracts in `scripts/blender/validate-powerups.mjs`.

## Current asset contract

- Runtime GLB: `dist/assets/models/powerups-v1.glb`
- SHA-256: `c2a688f4862f5a9691997b0d0740757b05ccec19f849cf5ba206a7014efeec50`
- Size: 556,800 bytes
- Geometry: 11,303 triangles total; 9,187 pickup and 2,116 wearable
- Changed pickup icons: Magnet and Moon Boots only

## Continuation notes

- `netPursuit.safety.keepClearLanes` remains compatibility metadata for telegraph presentation. It does not authorize scene or simulation code to remove hazards.
- Preserve `#pause-panel` above transient gameplay, reward, toast and developer layers.
- Blender rerenders every power-up icon. Five unchanged icon images are pixel-identical but can receive encoding-only byte changes; keep those files out of future commits unless their decoded pixels change.
- Keep generated review output in ignored `release/` and temporary source material in ignored `tmp/`.

## Verification

- Blender power-up validator passed after the final asset build.
- Refreshed and Original model attachment flows were exercised in Chrome.
- Pause overlay ordering and frozen popup behavior were exercised in Chrome.
- `npm run verify` passed: 172 tests, all asset validators, and an 11,523,783-byte standalone export.
