# Character assets

## Current implementation

The renderer has two independent concepts:

- picture quality controls framebuffer treatment;
- model set controls Original or Refreshed character presentation.

The saved `settings.modelSet` value is normalized by `dist/model-config.mjs`. Original is the safe default. `GameScene.setModelSetPreference()` loads the authored hero lazily and exposes requested, effective, loading, ready and fallback state without changing simulation data.

Original remains the authoritative simulation proxy for collision-independent root placement and opening/capture world choreography. Refreshed copies only the world transform and uses its own in-place Blender clips. It never writes player position, collision bounds, score, chase or route state.

Refreshed keeps the authored 18Bro visible for every runtime state. Complete authored clips cover store snack/celebration, locomotion, jump/fall, a tucked roll, impact, jetpack, capture/carry, and separate scooter mount, ride, stunt-jump and left/right low-dodge poses. `AnimationMixer` exclusively owns every imported bone; runtime code must never multiply procedural rotations into the imported skeleton. Every fur color tints the authored fur material. All hats follow the authored hat socket, the packet follows the carry socket, and jetpack/shield visuals live on the authored model/root.

The character-family switch also applies to police, cashier, scooter riders and both crowd systems through `human-v1.glb`. Police, cashier, rider and pedestrian role meshes share one 24-joint skeleton and role-specific clips. Mouth and brow joints give the cashier a readable angry scream while every other clip resets the face and comic mark. Existing controllers still own world placement and bounded district pooling; each visible imported actor has an independent skeleton.

`powerups-v1.glb` adds seven static authored pickups: magnet, moon boots, scooter, shield, double chips, jetpack and speed burst. It also carries independently cloneable `wearable_magnet`, `wearable_moon_L` and `wearable_moon_R` attachment roots. The Refreshed family loads cat, human and power-up templates atomically. Each pickup keeps a deterministic simulation type while the renderer clones its named `powerup_<type>` root, adds a bounded color-coded camera-facing halo and uses the matching transparent icon in the pickup card and timer HUD. The active magnet follows the left carry socket and the boots follow their animated foot bones. Original appears only when explicitly selected or when any required asset fails to load.
The magnet is held from the lower bridge of its U shape in a straight paw raised about 40 degrees. The renderer creates mixer-owned variants of each authored clip by replacing only the left arm-chain tracks; every other animation track stays byte-identical. The renderer also supplies the blue magnetic-wave effect independently of the GLB.
Three-Paw Guard renders as a true sphere with three equatorial four-toe paw-shield
badges, rotates them once every three seconds, and plays a short break animation when each protected collision consumes a badge. The power expires after fifteen seconds.
Jetpack owns a fixed ten-second airborne-only chip route with a progressive six-to-eight
chip look-ahead. Reveal distance integrates remaining cruise time with only the remaining
Speed Burst overlap. Descent creates no new chips while already-visible chips remain
collectible; landing retires leftovers with the shared bounce-to-zero lifecycle and restores
the ordinary run without carrying jump input or flight chips into the street phase.

Police net capture uses one visible fixed-scale prop for the officer taking the current
attempt. Its open state uses a sagging square lattice; its caught state becomes a tapered
connected sack with a named payload socket sized to the hero envelope. The same acting
prop performs raised aim, planted catch, vertical lift and shoulder carry while the escort
stays clear of the hero silhouette. The cat follows the payload position while local -Z
remains world-down. Both guards leave at one pace and hide after a bounded exit. Runtime
capture never rescales the shaft/web or lets the ordinary crash renderer write the same
roots.

The stolen packet is one 1,152-triangle closed manifold pillow mesh with tapered side gussets, heat-seal material zones, integrated red artwork and two outward-facing CHIPS marks bent to the analytic bag surface. Its 0.72 × 0.82 × 0.33 volume reads from front, back, side and top instead of relying on overlay planes. Both model families use the same scene-authored prop. From packet contact through the store exit, Original brings its existing eyes and pupils forward while retracting its existing lids, then restores every transform exactly. Refreshed does the same through its existing palette face and the two disconnected eyelid components, maintaining measured eye-to-lid clearance before restoring the immutable vertex arrays. No duplicate panic-eye mesh is created. Both caps use a shallow ordered badge with a white panel, orange bar, one curved red 7 and block-built green ELEVEN word geometry.

Ground chip sequences use deterministic seeded 3–6 chip paths with straight, lateral and weave forms. Length weights are 1:3:3:1, and each obstacle route crosses its safe lane at the central chips. Moon Boots and Jetpack lift the camera position and look target together so vertical movement does not change camera pitch.

## Asset lifecycle

`dist/character-assets.mjs` preflights each GLB before parsing. It rejects malformed headers, external buffers/images and unsupported required extensions. The deeper Node validator enforces mesh, hierarchy, skin, animation, bounds, socket, budget and manifest contracts.

Templates are cached once. Instances clone skeletons and mutable materials while sharing immutable geometry and textures. Instance disposal releases its materials and skeleton; shared resources remain alive until the store is disposed and every instance has been released.

Modular builds fetch the three GLBs in `dist/assets/models/`. Standalone builds embed exact GLB bytes in `globalThis.__18BRO_EMBEDDED_MODELS__` plus all seven pickup icons in `globalThis.__18BRO_POWER_ICONS__`; the same runtime parses them without a network request.

## Authored character family

- Source: `art/characters/18bro/18bro.blend`
- Builder: `scripts/blender/create_18bro.py`
- Runtime asset: `dist/assets/models/18bro-v1.glb`
- Blender: 5.2.2 LTS
- Budget: 3,972 triangles, 20 skin joints, three materials/draw calls, 878,992 bytes; rig version 5
- Texture: one embedded 512×512 palette atlas
- Clips: `idle`, `run`, `walk`, `jump`, `fall`, `slide`, `roll`, `stumble`, `ride`, `moped_mount`, `moped_jump`, `moped_slide_L`, `moped_slide_R`, `jetpack`, `snack`, `celebrate`, `caught`, `carry`
- Sockets: hat, bag, back and left/right carry

Refreshed human mixers sample continuous render time like the Refreshed hero; Original models retain the intentional 12 fps presentation.

The human family lives in `art/characters/human/human.blend`, builds through `scripts/blender/create_human.py`, and exports police, cashier, rider and pedestrian roles in `dist/assets/models/human-v1.glb`. It has 2,526 triangles, 24 joints, 777,208 bytes and clips for idle/walk/run/chase/alert/clerk/panic/ride/crouch plus shared and side-specific carry poses. The extra facial joints drive angry panic brows while the cashier-only comic anger mark remains hidden in neutral clips.

Power-up source lives in `art/powerups/powerups.blend`, builds through `scripts/blender/create_powerups.py`, and exports one texture-free 643,248-byte GLB with 12,703 triangles: 9,279 across seven independently cloneable pickup roots and 3,424 across three wearable roots. The same builder renders seven 256x256 transparent icons. `scripts/blender/validate-powerups.mjs` checks the exact hash, root names, wearable pivots/dimensions, triangle counts, identity transforms, vertex colors and icon bytes.

`art/manifest.json` and `dist/model-manifest.mjs` record both hashes, exported Y-up bounds and provenance. Rebuilds must update both manifests only after validation and visual review.
