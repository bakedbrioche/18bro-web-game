# Authored UI renders

`chip-icon.blend` is the editable Blender source for the result-screen chip icon. `scripts/blender/create_chip_icon.py` rebuilds the source scene and renders `dist/assets/icons/chip.png` from original 3D geometry: the same thin saddle-shaped potato slice used by gameplay, with seven raised ridges and a transparent product-studio background. `chip-icon.manifest.json` records its dimensions, byte size and SHA-256.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/create_chip_icon.py
node scripts/blender/validate-chip-icon.mjs
```

The standalone exporter embeds non-power-up PNGs from `dist/assets/icons/` in `globalThis.__18BRO_UI_IMAGES__`, so UI code must use the embedded value when available and the relative file path during modular development. The source geometry, lighting and render are original repository assets; no external texture or artwork is used.
