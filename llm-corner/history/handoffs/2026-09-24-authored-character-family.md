# 2026-09-24 — Authored character family and complete animation ownership

Author: Codex with Astra asset/audit workers
Commits: none; this work remains in the uncommitted visual-refresh tree

## State of the world

Refreshed now loads two real Blender-authored assets before one atomic family swap:

- 18Bro v2: 3,972 triangles, 20 joints, three materials and 13 complete clips for idle/run/walk/jump/fall/slide/stumble/ride/jetpack/snack/celebrate/caught/carry.
- Human v1: one 21-joint family with police, cashier, rider and crowd variants, plus 11 complete role clips including side-specific officer carry poses.

The imported animation mixer is the exclusive owner of imported bones. The old procedural-bone multiplication that caused twitching and broken end poses is removed. Gameplay still owns world placement and capture choreography; only an explicit whole-root fall transform is applied to the authored cat. Hats, packet, jetpack and shield follow authored sockets/root, so fur and hat changes never select Original. Original remains an explicit saved choice and the atomic load-failure fallback.

Nearby crowds use independent skeleton-safe instances with six clothing palettes, four skin tones and short/bob hair variants. Distant people retain bounded billboard LODs. Clear Retro and 18Bro Sticker remain independent saved settings.

## Asset evidence

- Cat GLB: 701,808 bytes, SHA-256 `0e4043122716f3dcc8a3408f5b1589a609ca6d493afb32b9c8b606d2e6c61239`.
- Human GLB: 272,892 bytes, SHA-256 `066f665f9c3dc995a898fd4e355b1aafc41b9a29c23c8f249a7f725ee71a1310`.
- Cat clips contain 60 tracks each, start at time zero, stay in place, close loop seams and retain floor/contact bounds. The frame-one exporter hold found by the integration gate was fixed and asserted in the builder.
- Human runtime validation sampled 143 skinned poses, restored all 11 clips to idle and confirmed independent skeleton cloning.
- Review renders live under ignored `release/model-review/` and `release/human-review/`.

## Verification

- `node scripts/validate-assets.mjs --manifest art/manifest.json`: both assets pass hash, bounds, hierarchy, texture, weight, clip, socket and budget validation.
- `node scripts/blender/validate-human-runtime.mjs`: passed.
- `npm run verify`: 118/118 tests passed; standalone export 7,680,537 bytes.
- Regression coverage freezes a sampled slide for 240 frames and proves bit-for-bit stable bone quaternions, then exercises run/jump/fall/caught/carry/menu resets with finite transforms.
- Headless Chrome loaded both modular GLBs in Refreshed + Clear Retro + 18Bro Sticker, then exercised menu, opening, run, jump, slide, capture, game over, retry and pink-fur/crown customization. WebGL reported error 0, both model requests succeeded and no JavaScript exception was emitted. Headless-only software-WebGL and autoplay warnings were expected.
- `git diff --check` passes.

## Open

- Localization dictionaries and language UI remain in PLAN-001.
- Refreshed vehicles are still a later PLAN-002 asset phase.
- Facial shape keys/finger articulation are outside this release pass; facial expression is static.
- No commit, push, deploy or publication occurred.
