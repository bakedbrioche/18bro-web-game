# 2026-09-27 - Doubled chip cadence and rebuilt net capture

Author: Codex
Branch: feature/graphics-v2-pivot
Commit/PR: included in this closeout commit; draft PR #1 remains the unmerged integration target

## State of the world

Ordinary rewards now schedule one deterministic, non-crossing 3–6-chip trail every 28–36 metres. This is more than twice the previous cadence while retaining the single section scheduler, weighted straight/lateral/weave routes, unique route indices and jump-arc substitution. Debug seek derives its section index from the same cadence, so previewed routes match a normal run.

The police-net presentation was rebuilt around a single animation owner. The left officer carries the left-hand net and the right officer carries the right-hand net, so the hoops face forward instead of crossing behind the guards. During the 3–5-second warning, a mixer-owned ready-to-aim layer changes only the selected arm, hand and socket; the authored chase legs and all other tracks remain unchanged. Original models use the matching post-gait arm override.

A net catch bypasses the ordinary crash-capture renderer. The pursuit renderer keeps the acting guard, cat and the same attached net coherent through strike, enclosure, lift, turn, shoulder carry and backward retreat. The completed caught snapshot preserves the final carry behind the results overlay until the scene resets.

## Verification record

- Focused gameplay, UI and model suite: 121/121 tests passed, including doubled cadence, non-crossing trails, mirrored attachments, progressive hand elevation, unchanged leg tracks, attached strike/catch/lift/carry and stable repeated frames.
- Chrome desktop smoke used the Refreshed family, reviewed the ready, late-aim, strike and persistent final-carry frames, and reported no console errors, page exceptions or failed requests. The chip view showed a single compact trail with no crossing or heap.
- `npm run verify`: 160/160 tests passed; cat, human, power-up and 60-frame chip assets validated; standalone export succeeded at 11,050,455 bytes.
- Ignored browser evidence lives under `release/browser-net-v2/`; generated release output remains untracked.

## Landmines and next step

- `COIN_SECTIONS` is the only ordinary scheduler. Preserve one active trail and do not restore parallel three-lane formation passes.
- The 28–36-metre cadence supersedes only DEC-016's 55–80-metre interval. Its no-crossing, bounded-length and jump-substitution rules remain active.
- An authored net-arm variant may replace only the selected arm/hand/socket tracks. Copy every other chase track exactly so the mixer remains the sole owner of Refreshed bones.
- Never run `animateCapture()` for a net crash. It competes for the same roots and recreates the disconnected, deformed carrier.
- Draft PR #1 stays unmerged until the colleague's street-texture work is integrated and reviewed.