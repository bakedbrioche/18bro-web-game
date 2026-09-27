# 2026-09-27 - Pursuit capture and reward polish

Author: Codex
Branch: feature/graphics-v2-pivot
Commit/PR: included in this handoff's graphics-v2 branch commit; draft PR #1 remains unmerged.

## State of the world

Police capture now follows the supplied four-panel reference as a physical sequence. The fixed net is sized around the actual Refreshed hero, exposes a dedicated payload socket and keeps its sack vertical in world space. The selected guard raises the open net, plants the catch, lifts the payload and carries the rigid pole across his shoulder. 18Bro remains upright inside the sack and trails the carrier. The escort transfers his open net to the outer hand, both officers walk at one pace, and the full group exits after 3.25 seconds instead of remaining behind the BUSTED card.

Jetpack reveal distance integrates remaining ordinary speed plus only the remaining Speed Burst overlap. Descent stops generation without deleting an already-visible chip; landing retires leftovers and returns directly to run. All chips share a tiny entrance, 1.24x overshoot, settled model and reverse retirement. The collection glow is now one soft camera-facing sprite rather than rotating geometry.

Escaping a net pursuit awards a deterministic duration/attempt/difficulty score with a 10,000 floor. The reward card shuffles four non-repeating 18Bro lines and uses an orange/green net-grid treatment. Its larger score addition follows a multi-overshoot curve and respects both saved and operating-system Reduced Motion.

The browser tab uses `dist/assets/icons/favicon.png`, an original guard-left/cat-right chase icon generated from the user references. The standalone exporter embeds the exact bytes. Full-resolution sources and prompt notes are retained only in the ignored dated image-generation workbench.

## Verification record

- Focused pursuit/UI/model/export suites passed.
- `npm run verify`: 162/162 tests passed; cat, human, power-up and 60-frame chip assets validated; standalone export succeeded.
- Real headless Chrome Refreshed smoke exercised menu, intro, chip field, net aim, catch, lift, shoulder carry and bounded two-guard exit.
- Chrome reported no console exceptions, log errors or failed requests. Ignored evidence is in `release/browser-final-v3/`.

## Landmines and next step

- Never scale a net to meet the cat. Preserve the rigid prop and derive the cat from `catch_net_payload_root`.
- Local +Y is the shaft and local -Z is sack-down. Keep the world-frame projection when adding poses.
- During carry, the mixer owns the acting arm. Do not layer `poseNetGuardArm()` over `carry_left` or `carry_right`.
- Keep the escort net on the outer hand during capture exit.
- A chip glow is one billboard sprite. Do not restore spinning torus or ring aura geometry.
- Pursuit score, tag choice and safety contracts remain deterministic and DOM-free in `dist/net-pursuit.mjs`.
- Generated `release/` and `tmp/` evidence stays ignored.
