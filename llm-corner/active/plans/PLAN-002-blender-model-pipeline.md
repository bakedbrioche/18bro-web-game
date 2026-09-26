# PLAN-002 — Blender character pipeline

**Status:** ACTIVE — authored hero/human runtime integration complete; vehicle assets and optional preview tooling remain
**Owner:** chief agent, with one asset worker and one runtime worker when parallel work is authorized
**Commit cadence:** reviewed integration commits only; subagents never commit

## 0. Goal

Create pleasant PS1-inspired character and vehicle models in Blender, export them reproducibly to self-contained GLB files, validate them before runtime use, and support both the existing procedural models and the refreshed authored set.

The pipeline must work without an interactive Blender connection. An optional local Blender MCP connection can accelerate supervised iteration, but the reviewed command-line scripts remain the reproducible source of release assets.

## 1. Repository layout

```text
art/
  characters/
    18bro/18bro.blend
    human/human.blend
  textures/
  manifest.json
scripts/
  blender/create_18bro.py
  blender/create_human.py
  blender/create_powerups.py
  blender/validate_human.py
  blender/validate-human-runtime.mjs
  blender/validate-powerups.mjs
  validate-assets.mjs
dist/
  assets/models/18bro-v1.glb
  assets/models/human-v1.glb
  model-manifest.mjs
  character-assets.mjs
  character-animation.mjs
  vendor/addons/loaders/GLTFLoader.js
  vendor/addons/utils/BufferGeometryUtils.js
  vendor/addons/utils/SkeletonUtils.js
llm-corner/docs/
  architecture/character-assets.md
  conventions/3d-art.md
  reference/blender-codex-setup.md
```

`art/` is the editable source of truth. Checked-in GLB files are reviewed runtime assets. `release/`, Blender backup files, caches, and temporary renders stay untracked. Start with normal Git; introduce Git LFS only if the authored sources become large enough to hurt normal repository use.

## 2. Visual target

- Preserve PS1-era economy through clear shapes, small textures, deliberate faceting, and restrained materials.
- Use connected, purpose-built volumes for cheeks, muzzle, torso, limbs, paws, clothing, and hair rather than stacked spheres and boxes.
- Smooth broad organic forms and keep deliberate hard seams at clothing, shoes, accessories, ear rims, and selected silhouette breaks.
- Prioritize the rear gameplay silhouette, readable ears and cap, broad cheeks, sleepy brows, pear-shaped torso, short limbs, and curled tail.
- Avoid runtime subdivision, strand fur, dense normal-map detail, and noise that disappears at play distance.

Initial budgets:

| Asset | Triangles | Bones | Materials | Textures |
|---|---:|---:|---:|---:|
| 18Bro hero | 2,000–4,000 | at most 24 | at most 3 plus equipment | one 512×512 atlas |
| Human base | 1,000–2,000 | at most 24 | at most 3 | 256–512 atlas |
| Hat/accessory | 100–500 | inherited socket | 1/shared atlas | shared where possible |

Target at most 1 MB for the first model GLB and at most 3 MB of added uncompressed model data in the standalone release. Base64 embedding adds roughly one third to binary size, so measure the generated HTML rather than relying only on GLB size.

## 3. Blender authoring contract

- Work in metric units: one Blender unit equals one game unit.
- Author Z-up, facing Blender `-Y`, with feet on the origin. Export glTF Y-up; the runtime adapter establishes the game's `+Z` forward convention before scene yaw is applied.
- Keep object and armature root transforms at identity before export.
- Use one explicit export collection and exclude cameras, lights, helpers, and unused objects.
- Give every node, mesh, material, action, bone, and socket a unique ASCII name.
- Minimum rig vocabulary: `root`, `hips`, `spine`, `head`, paired limbs, and `tail`; humans add useful hand and foot bones.
- Required attachment empties/bones: `socket_hat`, `socket_bag`, `socket_back`, `socket_carry_L`, and `socket_carry_R`.
- Stable material slots: `fur`, `face`, `hat`, `clothes`, and `skin` as applicable.
- Limit a vertex to four bone weights. Bake constraints and IK into exported clips.
- Export in-place actions with explicit names. Start with `idle`, `run`, `jump`, `slide`, `ride`, `stumble`, and `caught`; intro and carry poses may temporarily use the controller's procedural pose adapter.

## 4. Export and validation

1. Rebuild the intended source and GLB with `scripts/blender/create_18bro.py`, `create_human.py`, or `create_powerups.py` through Blender 5.2 in background/factory mode. The commands are recorded beside each asset in its `art/` README.
2. Run `scripts/blender/validate_human.py` for the human source when applicable; the builders use pinned export settings and write the named collection to its checked-in output.
3. Generate `art/manifest.json` entries containing schema version, asset and rig IDs, Blender version, source/output paths, export preset, SHA-256, bounds, triangle/bone/material counts, clips, sockets, and provenance.
4. Run `npm run validate:assets`; it invokes `scripts/validate-assets.mjs`, the Three.js human runtime validator and the power-up root/icon validator without requiring a browser.
5. Reject missing nodes/sockets/actions, external resource URIs, non-finite transforms, invalid weights, unexpected bounds, or budget overruns.
6. Load the result in `dist/preview.html`, exercise every required clip/socket/look, and then use it in a real run.

Use ordinary GLB for the first release. Do not add Draco, Meshopt, KTX2, or external texture files during the 24-hour pass. Vendor the Three.js r169 loader utilities and their MIT notices; teach the standalone exporter to include those exact modules and embed each GLB for `GLTFLoader.parseAsync`.

## 5. Runtime integration

Provide a stable adapter for both sets:

```text
root
setLook({ fur, hat, palette })
samplePose(name, time, context)
getSocket(name)
setVisible(visible)
dispose()
```

- Existing procedural models implement the adapter as `Original`.
- Imported rigs implement it as `Refreshed`.
- The simulation remains the sole owner of root movement, collisions, district logic, capture, and scoring.
- Animation clips remain in place; the adapter maps logical poses to either procedural joints or imported bones.
- Imported assets are cloned with skeleton-safe utilities. Shared GLB resources are cached and disposed only when the owning model generation is released.
- Prepare a refreshed set fully before an atomic swap. Ignore stale loads with a request token. A critical load or validation failure activates Original without changing the saved preference.

## 6. First 24-hour sequence

These tracks can run in parallel after their contracts are agreed:

1. **Runtime:** model config, save normalization, loader/controller adapter, skeleton-safe cloning, atomic fallback, and tests.
2. **Hero asset:** Blender file, silhouette and rig, first clips, sockets, GLB export, and manifest.
3. **Interface:** Models selector, preview matrix, loading/error states, and accessible copy.
4. **Integration:** all fur/hat combinations, police/clerk/pedestrian coverage, mobile budget, standalone embedding, and browser smoke.

The refreshed procedural hero can ship as an interim visual improvement if authored GLB integration misses the release gate. Blender MCP availability must never block the build.

## 7. Release gate

- Blender export produces identical validated structure from a clean checkout.
- The model preview covers model set, picture mode, actor family, camera distance, clip, fur, hat, and attachments.
- All required clips are in place and do not move the simulation root.
- Original/Refreshed switching survives reload and leaves progression intact.
- Repeated switches do not grow renderer memory or stale actor pools.
- Missing/corrupt assets fall back cleanly.
- Cat bounds, police capture, clerk pose, pedestrians, riders, and vehicles are correct at near and far distances.
- The complete standalone HTML works offline and remains within the agreed size budget.
- `npm run verify` and the real desktop/mobile browser flows pass.

## 8. Decisions

- `DEC-003` fixes model set as a preference independent from picture quality and defines safe fallback/default promotion.
- `DEC-004` fixes `.blend` source plus generated checked-in GLB, pinned local Three.js loaders, and a deterministic release path.
- Record a further decision if implementation materially changes bone ownership, animation control, or simulation root-motion contracts.

## 9. First implementation record — 2026-09-23

- Blender 5.2.2 LTS verified at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.
- Reproducible builder generated the editable hero source, review renders and a 155,188-byte self-contained GLB.
- Asset result: 3,674 triangles, 14 skin joints, three materials/draw calls, embedded 512×512 atlas, idle/run and five sockets.
- Node validation, actual Three.js r169 loading, skeleton/material isolation, fallback, resource lifetime and embedded standalone loading have automated coverage.
- The live Settings selector preserves saves and switches the whole visible character family at the main menu. Refreshed remains active through every state and all fur/hat combinations; imported idle/run clips are supplemented by the stable procedural pose adapter.
- Police, clerk, riders and both crowd systems use a shared smooth Refreshed presentation over their bounded articulated rigs. A separate authored Blender human GLB remains a later pipeline step rather than a release blocker.
- Clear Retro, Classic Pixel, Coarser, Arcade and 18Bro Sticker controls are saved independently from the model family.
- The full verification count and standalone size are recorded in the newest handoff after each integration pass. HTTP serving returns `model/gltf-binary` for the modular GLB.
- Generated review renders passed chief inspection. A live browser click-through remains required before committing because no browser was attached to the in-app Browser runtime during this session.

## 10. Complete character pass — 2026-09-24

- Hero v2 exports 3,972 triangles, 20 joints, three materials and 13 complete in-place clips baked at 48 fps. Every clip keys all 20 bone transforms from time zero. Run/walk contacts, loop seams, floor clearance and exported sampler timing are validated from the actual GLB.
- Human v1 exports one 21-joint family with police, cashier, rider and two hair variants. Eleven clips key all 15 deform bones from time zero; side-specific carry clips match the two-officer choreography. Visible roles remain below 2,000 triangles.
- Refreshed loads both templates before an atomic swap. Each human instance uses a skeleton-safe clone and per-person material palette. Imported mixers exclusively own imported bones; gameplay owns world placement and explicit whole-root capture tipping.
- Hats, packet, jetpack and shield follow the authored rig/root. Fur and hat customization remain on Refreshed through every pose.
- The automated gate has 118 passing tests, both GLB validators pass, and the standalone export is 7,680,537 bytes. A headless Chrome flow loaded both modular GLBs in Clear Retro, exercised intro/run/jump/slide/capture/game-over/retry and pink-fur/crown customization, and reported WebGL error 0 with no JavaScript exception.

## 11. Reference-led animation record — 2026-09-26

- Hero rig v5 remains at 3,972 triangles, 20 joints, three materials and 18 complete in-place clips. The expressive jump uses the full ascent/descent timeline; scooter jump extends the lower body behind the gripped bars, and left/right side-saddle dodges move the body outside the scooter cowl.
- Power-ups revision 3 exports seven pickup roots plus three wearables in a 643,248-byte, 12,703-triangle GLB. Shield paw marks use four toes in both the authored pickup and runtime energy sphere.
- Exact GPT Image prompts, inputs, outputs and notes live only in the ignored dated workbench defined by docs/conventions/generative-reference-workbench.md. Shipped results are rebuilt in Blender or code and validated normally.
