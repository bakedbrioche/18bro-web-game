# 2026-09-27 - Spaced chip trails and attached net capture

Author: Codex
Branch: feature/graphics-v2-pivot
Commit/PR: included in this closeout commit; draft PR #1 remains the unmerged integration target

## State of the world

Ordinary rewards now arrive as one deterministic 3–6-chip trail every 55–80 metres. Straight, lateral and weave paths reuse the weighted planner, while a jump row substitutes its five-chip arc for the section. The parallel three-lane heap generator is gone, so separate trails do not overlap or cross.

Each police-net attempt now gives a distance-scaled five-to-three-second warning and accelerates its target flicker over that full interval. A capture keeps the chosen officer's own net attached to the hand/socket: the guard catches 18Bro, lifts and turns, rests the stick at the shoulder, then walks backward with the second officer. The separate floating capture prop remains hidden.

Enter can skip the convenience-store opening only during its first 1.5 seconds. Once that window closes, the opening plays to completion.

## Verification record

- Focused deterministic gameplay, UI and model tests cover chip spacing/non-overlap, Jetpack suppression, the 3–5-second warning, late Enter lock, attached net ownership and idempotent carry transforms.
- Chrome desktop smoke exercised the real opening, confirmed `HEIST IN PROGRESS` before a rejected late Enter press, reviewed chip spacing and all net phases, and reported no console errors, page exceptions or failed requests.
- `npm run verify`: 160/160 tests passed; all cat, human, power-up and 60-frame chip assets validated; standalone export succeeded at 11,044,069 bytes.
- Ignored browser evidence lives under `release/browser-followup/`.

## Landmines and next step

- `COIN_SECTIONS` is the only ordinary section scheduler. Do not restore a second parallel formation pass.
- Jump arcs replace a due section; they must not layer another ground route under the obstacle.
- Net capture rendering consumes the DOM-free pursuit snapshot. It must keep the officer prop attached and must not decide hits or rewards.
- Keep the 3–5-second warning and at least one computed escape lane when changing pursuit difficulty.
- Draft PR #1 stays unmerged until the colleague's street-texture work is integrated and reviewed.
