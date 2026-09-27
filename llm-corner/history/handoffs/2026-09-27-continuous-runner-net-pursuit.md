# 2026-09-27 - Continuous runner pressure and police net pursuit

Author: Codex
Branch: feature/graphics-v2-pivot
Commit/PR: included in this closeout commit; draft PR #1 remains the integration target and must stay unmerged

## State of the world

The runner now maintains action across the full route. Seeded chip formations arrive every 40–50 metres, cover all three lanes with 5–8 chips per line, and rotate among straight, arrow and weave shapes without immediately repeating the same shape and starting lane. Ordinary 3–6-chip routes remain between major formations. Wide roads retain sparse forward vehicles, and intersections add capped perpendicular traffic with enough time for a jump and two-lane correction.

Moon Boots last ten seconds. Reachable obstacle roofs accept descending landings. Jetpack owns an airborne-only route and clears it when descent starts; Speed Burst changes the planned flight distance, while Double Chips changes chip value only.

Police can now pull up for a deterministic net pursuit. Each officer alternates 2–4 telegraphed attacks through an accelerating PS1-style ground target. One escape lane is reserved and cleared while normal hazards remain active. Dodging the sequence awards 10,000 score through a themed popup and temporary gold score addition. A hit uses dedicated netted, lift and backward-carry phases before BUSTED appears.

Magnet feedback is a single centered signal and fades during a roll. The BUSTED title uses continuously interpolated compositor transforms, and Chips Banked uses a 60-frame, 60 fps transparent APNG rendered from the real Blender chip geometry. Reduced Motion keeps the static fallback.

## Verification record

- `npm run verify`: 159/159 tests passed; all character, human, power-up and 60-frame chip assets validated; standalone export succeeded at 11,044,011 bytes.
- Chrome desktop smoke: menu, start, run, pause/resume, staged BUSTED result, retry, net telegraph and net capture completed against `http://localhost:4173`.
- Result asset loaded as the 160 x 160 animated `chip-turntable.png`; captures 180 ms apart produced different full-frame hashes.
- WebGL error was 0. No console errors, page exceptions or failed requests occurred; Chrome reported only its software-WebGL fallback warning in the automated profile.
- Ignored evidence lives under `release/browser-smoke-v4/`.

## Landmines and next step

- Keep the net controller DOM-free. Rendering consumes its snapshot and must not own hit or reward decisions.
- Do not spawn ground chips during Jetpack or let stacked powers extend its fixed lifetime.
- Any new generated challenge must retain a computed escape route at capped difficulty.
- Keep `chip-turntable.png` as APNG despite its extension and retain `chip.png` for Reduced Motion and decode failure.
- The colleague street-texture work still targets this feature branch; draft PR #1 stays unmerged until combined visual review.