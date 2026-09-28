# Authored UI renders

`chip-icon.blend` is the editable Blender source for both result-screen chip assets. `scripts/blender/create_chip_icon.py` rebuilds the original saddle-shaped 3D chip, renders the 256 x 256 transparent still at `dist/assets/icons/chip.png`, renders a complete 60-frame turntable at 60 fps, and uses FFmpeg to encode the transparent APNG at `dist/assets/icons/chip-turntable.png`. The turntable is displayed at 27 CSS pixels, while the still is the Reduced Motion and load-failure fallback.

`chip-icon.manifest.json` records dimensions, frame rate, frame count, byte sizes and SHA-256 values for both outputs. The validator parses the PNG chunks and requires real APNG animation control, 60 frame-control chunks, infinite looping and animated frame data.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/create_chip_icon.py
node scripts/blender/validate-chip-icon.mjs
```

Blender 5.2 and FFmpeg on `PATH` are required to rebuild the animation. The standalone exporter embeds both non-power-up PNG assets from `dist/assets/icons/` in `globalThis.__18BRO_UI_IMAGES__`, so UI code uses the embedded values in the standalone build and relative paths during modular development. The source geometry, lighting and renders are original repository assets; no external texture or artwork is used.


## Browser favicon

`dist/assets/icons/favicon.png` is the 128 × 128 calm peeking-18Bro browser mark. Codex created it with the built-in OpenAI image tool on 2026-09-28 using the user-supplied official front view as the strict identity anchor, then downsampled the selected 1024 × 1024 output with Lanczos. The orange tab mark preserves the official low brows, half-lidded oval eyes, forehead, ears and branded green/white cap so the character remains recognizable at 16 × 16. The full-resolution output and prompt provenance live in the ignored `tmp/imagegen/2026-09-28/favicon-sleepy/` workbench.

The preceding surprised peeking mark is tracked at `art/ui/archive/favicon-peek-v1.png`; the earlier guard-and-cat chase mark remains at `art/ui/archive/favicon-chase-v1.png`. Both are archive assets and are not loaded by the game. The standalone exporter embeds the exact current runtime PNG into the favicon link.
## Pursuit escape banner

`dist/assets/icons/pursuit-guard.png` and `pursuit-cat.png` are compact geometric crops of the user-supplied chase artwork. CSS joins them as two diagonally cut profile panels, adds a shadow overlay and achievement aura, then presents the existing rotating reward copy and score. The full four-panel capture collage, original chase image and user layout sketch are retained locally in the ignored `tmp/imagegen/2026-09-27/net-escape-banner/` workbench. The prior code-rendered orange/green banner is preserved as `art/ui/archive/pursuit-reward-v1.css` for future reuse and is not loaded at runtime.

Both reward crops are embedded through `globalThis.__18BRO_UI_IMAGES__` in the standalone release. The live UI has no network dependency and provides a static Reduced Motion presentation.
