# 2026-09-26 - Smooth results and 3D chip turntable

Author: Codex
Branch: feature/graphics-v2-pivot
Commit/PR: this commit follows 33f8c8b; draft PR #1 remains the integration target

## State of the world

The BUSTED word now uses a 1.5-second compositor-only loop with 85 ms per-letter offsets. Its active portion crosses all seven glyphs in about 0.84 seconds, and neighboring glyphs overlap so the motion reads as a continuous wave. `RESULT_WAVE_ENABLED` remains the code switch. Saved and operating-system Reduced Motion disable the wave.

The Chips Banked icon no longer rotates a flat PNG with CSS. `art/ui/chip-icon.blend` and `scripts/blender/create_chip_icon.py` render the real saddle-chip geometry through 36 angles at 30 fps. FFmpeg encodes those frames as the 128 x 128 transparent `dist/assets/icons/chip-turntable.png` APNG. The 256 x 256 `chip.png` still remains the Reduced Motion and load-failure fallback. Both assets are original and are embedded into the standalone build.

The APNG validator checks RGBA dimensions, hash, animation control, 36 frame controls, infinite looping and animated frame data. The earlier variable-route test now deactivates ordinary row chips before measuring the fixed five-chip jump arc, removing a random false failure without changing gameplay.

## Verification record

- Focused Node checks: 27/27 passed across results UI, standalone export and heist flow.
- Blender/FFmpeg output: 36 distinct decoded frames, 30 fps, 128 x 128, 300,480 bytes.
- Chrome loaded the APNG at its natural 128 x 128 size with no CSS animation on the image. Two icon-only captures 240 ms apart had different hashes.
- Chrome sampled 80 requestAnimationFrame callbacks over 902.8 ms, 47 distinct wave transform states and an 18.2 ms worst frame gap.
- WebGL error was 0; no console errors, exceptions or failed requests.
- Ignored browser and render evidence lives under `release/browser-result-review/` and `release/ui-review/`.

## Landmines and next step

- Do not restore `result-chip-spin`; it recreates the flat-card effect this change removes.
- Keep `chip-turntable.png` as an APNG despite its PNG extension. The validator proves the animation chunks.
- Rebuilding the asset requires Blender 5.2 and FFmpeg on `PATH`.
- `release/` and `tmp/` stay ignored.
- The colleague street-texture work still integrates into this branch; draft PR #1 stays unmerged.
