# 2026-09-23 — Continuous Refreshed presentation

Author: Codex
Commits: none; this work remains in the uncommitted visual-refresh tree

## State of the world

Refreshed no longer changes back to Original when the player slides, is hit, rides, uses a jetpack, plays the store opening, or is captured. Imported idle/run clips handle their native states and the stable procedural controller supplies additive poses elsewhere. The hidden procedural hero remains authoritative for simulation and prop transforms.

All six fur colors and six hats remain on the authored family. Special hats follow the authored hat socket. Police, clerk, scooter riders and both nearby crowd systems switch with the hero to shared smooth materials over the existing purpose-shaped articulated human rigs. Original remains available as an explicit preference and as the asset-load failure fallback.

Settings now expose three independent saved presentation choices:

- Picture: Clear Retro, Classic Pixel, Coarser.
- Models: Original, Refreshed.
- Font style: Arcade, 18Bro Sticker.

Clear Retro renders at viewport resolution, disables vertex snapping and nearly removes the CRT overlay. The sticker type treatment uses system/available rounded fonts plus original orange, green, cream, outline and offset-shadow CSS; it does not embed or claim an official proprietary font.

## Verification

- `npm run verify`: 114/114 tests passed; standalone export 6,579,650 bytes.
- GLB manifest validation still reports the expected SHA-256, 155,188 bytes, 3,674 triangles, 14 joints, three materials, idle/run and five sockets.
- Tests cover every fur/hat combination, slide/capture continuity, human-family switching, shader preservation, save migration, global font application and native-resolution Clear Retro behavior.
- The existing local server on port 4173 responds successfully. It belongs to the user session and was left running.
- `git diff --check` passes.

## Open

- The in-app Browser runtime still reports no attached browser. Manually refresh `http://localhost:4173/`, select Refreshed + Clear Retro + 18Bro Sticker, and exercise menu → opening → run → jump → slide → pause/resume → capture before committing.
- A separate authored Blender human GLB remains planned. The current Refreshed human family is a smooth presentation of the already purpose-shaped articulated procedural rigs so capture choreography and bounded crowd pooling remain stable.
- Localization dictionaries and final desktop/mobile typography tuning remain in PLAN-001.
- No commit, push, deploy or publication occurred.
