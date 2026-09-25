# Authored human family

`human.blend` is the editable Blender source scene for police, cashier, street
crowds and scooter riders. `scripts/blender/create_human.py` reproducibly builds
the source, rig, original palette, clips and self-contained `human-v1.glb`.
There are no imported models, textures, logos, fonts or animations.

The silhouette is formed from shaped cheek/jaw, shoulder/chest/waist, trouser,
forearm, hand and shoe profiles. Clothing boundaries are deliberate seams.
Continuous weighted knee and elbow regions replace separate rigid limb balls.

## Runtime contract

The exported model is already Y-up, facing **+Z**, with identity armature and mesh
root transforms. Use native scale **1** inside the existing person's root. The
existing root scale of 1.12 for police/crowds or .91 for riders remains external.
Do not derive scale from optional headwear: that would change shoulder and hand
reach when a helmet or hat changes. A local Y offset of -.014 places soles on
the ground; it is small enough to retain the existing .005–.02 ground clearance.

Rest bounds including all packed variants:

```text
min: [-0.4659999907, 0.0140000004, -0.1856123805]
max: [ 0.4659999907, 2.2929999828,  0.2849999964]
```

Pivots in exported Y-up units: hips Y=.92; shoulders X=+/-.34, Y=1.61;
elbows Y=1.31; wrists Y=.98; knees Y=.48; ankles Y=.08; head pivot Y=1.78.
The simulation/person root owns world position, yaw and uniform scale.

All roles show `human_skin`, `human_clothes` and `human_details`. Select extras
before making an instance visible; do not render all packed variants together.

| Role | Extra meshes to show | Hair | Visible triangles | Draws |
|---|---|---|---:|---:|
| Police/guard | `role_police` | Hide both | 1,946 | 4 |
| Cashier/clerk | `role_cashier` | `hair_short` | 1,918 | 5 |
| Civilian short hair | None | `hair_short` | 1,790 | 4 |
| Civilian bob | None | `hair_bob` | 1,814 | 4 |
| Scooter rider | `role_rider` | Hide both | 1,814 | 4 |

The full GLB packs 2,526 triangles across eight meshes, with **three materials**,
one embedded 256x256 palette image and **24 joints**. At most two normalized
weights affect a vertex. Visible role budgets remain below 2,000 triangles.

Material names are exact:

- `skin`: white/warm palette base; multiply `material.color` by the person's
  complexion. This changes face, neck, forearms and hands together.
- `clothes`: white shirt and shaded trousers in one atlas material; multiply
  `material.color` by the role/crowd shirt color. Trousers retain their darker
  value and seams remain legible. Police use pale blue, cashier warm cream.
- `details`: preserve white material tint. Hair, eyes, shoes, collar, buttons,
  police navy/gold, cashier green/orange and rider orange are authored here.

Keep the embedded texture maps for every palette. Share immutable geometry and
textures; clone skeletons and mutable materials per person. Clone each unique
material once per person so role meshes that use `details` remain consistent.

## Animation and sockets

**The animation mixer is the sole writer of imported human bones.** Do not copy
procedural Euler angles onto these bones. This is a conventional Blender rig:
upper limbs point downward and feet forward in their rest basis, so replacing
their bind quaternions would break limbs. Rig rest bases are recorded in the
generated `release/human-review/validation.json` for future retargeting work.

Every clip explicitly keys location and quaternion on all 15 deform bones;
root and mesh transforms remain fixed. Frame zero is the first key. Loop
endpoints are identical, so no extra frame-one hold is added by export.

| Clip | Seconds | Intended use |
|---|---:|---|
| `idle` | 2 | Neutral standing, restrained breathing |
| `walk` | 1.333333 | Pedestrians with planted stance feet and lifted swing feet |
| `run` | .833333 | Full stride and opposing arms, eased toe-off |
| `chase` | .833333 | Police chase alias of the complete run cycle |
| `alert` | 1.666667 | Clerk or guard pointing toward the escape |
| `clerk` | 2 | Hands working in front of the counter |
| `ride` | 2 | Bent knees, level shoes and hands toward handlebars |
| `crouch` | 1 | Planted pickup posture |
| `carry` | 1.5 | Two hands forward, restrained walking gait |
| `carry_left` | 1.5 | Left hand supports the cat toward the inner side |
| `carry_right` | 1.5 | Right hand supports the cat toward the inner side |

Sample `AnimationClip.duration` at runtime rather than hardcoding rounded table
values. A logical state change should select a whole clip and blend once over
its intended transition. A gameplay pause freezes the same sampled pose. Do not
add the old human body bob/limb pose on top of the authored scene.

The five socket names are `socket_hat`, `socket_bag`, `socket_back`,
`socket_carry_L`, `socket_carry_R`. Carry sockets follow the hand bones.
At the end/start of the side-specific carry loop, the inner socket is within
.008 units of this native Y-up target:

```text
carry_left:  [-.652, 1.375, -.250]
carry_right: [ .652, 1.375, -.250]
```

These targets match the existing two-officer hip support choreography at native
scale: use `carry_left` for cop[0], `carry_right` for cop[1]. The root turn swaps
their world sides. Sample phase zero while planted, then advance gait during
the carry. Actual pickup timing and cat-to-hand contact still require the real
capture flow review; neither these assets nor the mixer move the game root.

## Rebuild and verification

From the repository root using Blender 5.2.2 LTS:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/create_human.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/validate_human.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/review_human.py
node scripts/validate-assets.mjs --manifest art/characters/human/manifest-entry.json
node scripts/blender/validate-human-runtime.mjs
```

The builder saves the source with a police studio preview. Its `REVIEW_tint`
nodes visualize runtime material color multipliers; the reproducible GLB export
happens before those preview nodes are added. Regenerate through the builder,
rather than exporting the tinted review material directly from the GUI.

`manifest-entry.json` is the exact integration entry. The chief copies it into
the shared source/runtime manifests after reviewing the actual GLB. This worker
does not edit shared manifests or runtime code.

Evidence under ignored `release/human-review/` includes ten individual role/pose
renders, a cast lineup, a run contact sheet, generated budget/pose data, Blender
round-trip validation and actual Three.js CPU skinning/transition validation.
The gates exercise the source and fresh GLB import, 156 sampled game-loader
poses, all twelve clip-to-idle transitions and independent skeleton cloning.
The embedded palette must also be reviewed in the chief's real browser flow.
