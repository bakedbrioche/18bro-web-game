# Authored UI renders

`chip-icon.blend` is the editable Blender source for both result-screen chip assets. `scripts/blender/create_chip_icon.py` rebuilds the original saddle-shaped 3D chip, renders the 256 x 256 transparent still at `dist/assets/icons/chip.png`, renders a complete 60-frame turntable at 60 fps, and uses FFmpeg to encode the transparent APNG at `dist/assets/icons/chip-turntable.png`. The turntable is displayed at 27 CSS pixels, while the still is the Reduced Motion and load-failure fallback.

`chip-icon.manifest.json` records dimensions, frame rate, frame count, byte sizes and SHA-256 values for both outputs. The validator parses the PNG chunks and requires real APNG animation control, 60 frame-control chunks, infinite looping and animated frame data.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/create_chip_icon.py
node scripts/blender/validate-chip-icon.mjs
```

Blender 5.2 and FFmpeg on `PATH` are required to rebuild the animation. The standalone exporter embeds both non-power-up PNG assets from `dist/assets/icons/` in `globalThis.__18BRO_UI_IMAGES__`, so UI code uses the embedded values in the standalone build and relative paths during modular development. The source geometry, lighting and renders are original repository assets; no external texture or artwork is used.


## Browser favicon

`dist/assets/icons/favicon.png` is a 128 × 128 generated chase mark for browser tabs. Codex created the composition with OpenAI GPT Image on 2026-09-27 from user-supplied 18Bro and police-chase references, then downsampled the selected result without manual repainting. The mark uses an original guard-left/cat-right chase composition, contains no text or store logo, and is intended only for this community game's UI. The exact prompt and full-resolution working outputs live in the ignored `tmp/imagegen/2026-09-27/favicon-chase/` workbench. The standalone exporter embeds the exact PNG into the favicon link.
