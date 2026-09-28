# Authored pickups

`powerups.blend` is the editable original art. `scripts/blender/create_powerups.py` plus the focused revision-5 geometry module `scripts/blender/powerup_models_v5.py`
rebuilds the scene, the seven-pickup/three-wearable GLB, the seven transparent
256px icons and this
folder's machine-readable `manifest.json`. No external artwork or fonts are used.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/create_powerups.py
node scripts/blender/validate-powerups.mjs
```

The saved Blender scene opens with the magnet visible. The other named meshes
remain hidden in the outliner so each can be edited at the shared origin. All
runtime roots have identity transforms. The generator renders a separate seven-prop
contact sheet under ignored `release/powerup-review/`.

The GLB exports seven independently cloneable pickup meshes: `powerup_magnet`,
`powerup_moon`, `powerup_moped`, `powerup_shield`, `powerup_doublechips`, and
`powerup_jetpack`, plus `powerup_speedburst`. It also exports attachable
`wearable_magnet`, `wearable_moon_L`, and `wearable_moon_R` roots. Every prop uses
visual-center origin, Y-up and +Z forward after
glTF conversion, with a maximum dimension of 1.4 game units. The one shared
`powerup_palette` material uses vertex colors; retain vertex colors when adapting
the material to the game's lighting. There are no textures, skins, or animations.

`manifest.json` records bounds, triangle counts, source/output hashes, PNG hashes,
alpha coverage and effects hints. The simulation owns pickup position. Runtime
presentation can add the per-type bob, orbit/aura and glints listed in the manifest;
these effects are deliberately absent from the collision shape and icon alpha.

Designs are original: split blue/red horseshoe magnet with aligned gray poles and one gold zap, lime mid-top Moon sneakers with contained ear-green/ear-red heel arrows, mint delivery
scooter, cat-ear paw shield, twin golden chips in an orange packet, cream/teal
twin-tank jetpack, and a cyan diamond/lightning Speed Burst. The matching UI
pictures are rendered directly from these models from one consistent three-quarter
studio camera.
The revision-5 Magnet and Moon sneaker metadata is enforced by `validate-powerups.mjs`: one gold zap, zero side zaps, aligned gray poles, zero rear wings and exact left-green/right-red heel arrows.
The wearable magnet's origin is the lower bridge of its U shape and its recommended
runtime rotation is identity. Attach that origin to the cat's carry socket; do not
restore the former quarter-turn wrist correction. The runtime adds the animated
magnetic-wave arcs. The shield pickup and its runtime energy sphere share a
four-toe paw mark. The sphere presents exactly three equally spaced charge badges for fifteen seconds,
removing one badge after each protected hit.
