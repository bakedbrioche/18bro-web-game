# 2026-09-23 — Blender hero preview

Author: Codex with three Astra workers
Commits: none; all changes in this handoff remain uncommitted

## State of the world

The project is confirmed as a community game for a related crypto project. `18bro.fun` is the original URL but remains TBU, the public tag is “Run for your chips,” and launch language requirements are English, Traditional Chinese and Cantonese. Future Yandex Metrica and Meta Pixel support exists behind a disabled-by-default consent boundary; no analytics IDs are configured and no vendor script loads.

Blender 5.2.2 LTS is installed at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. `scripts/blender/create_18bro.py` reproducibly builds the first authored hero, saves `art/characters/18bro/18bro.blend`, exports `dist/assets/models/18bro-v1.glb` and creates ignored review renders.

Settings now save an independent Original/Refreshed model preference. Refreshed loads the authored hero lazily for menu idle, ordinary running and jumps. The procedural rig remains authoritative for root placement and safely appears for opening/capture, slide, stumble, moped, jetpack, special hats and other unfinished coverage.

## Verification

- `npm run verify`: 111/111 tests passed; standalone export 6,573,360 bytes.
- `scripts/validate-assets.mjs --manifest art/manifest.json`: 155,188-byte GLB, 3,674 triangles, 14 skin joints, three materials, idle/run, required sockets and expected SHA-256.
- Local server returned 200 for the game and GLB, with `model/gltf-binary` for the model.
- Front, side, rear, three-quarter and run-frame Blender renders were inspected; cap intersections and palette issues were corrected during iteration.
- `git diff --check` passed.

Node's test environment logs a harmless texture-decoder warning while testing GLTFLoader because Node has no browser image decoder; browser loading uses the embedded PNG normally.

## Open

- The in-app Browser runtime reported no attached browser, so the required Settings → Refreshed → menu → run → pause/resume visual smoke remains unverified. Do this before any commit.
- Continue PLAN-001 with Clear Retro picture mode, brand UI and real localization dictionaries.
- Continue PLAN-002 with authored jump/slide/capture/moped/jetpack clips, special-hat socket fits and the human family.
- No commit, push, deploy or publication has occurred.
