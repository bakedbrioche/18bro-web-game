# 3D art conventions

- Author in Blender metric units with one unit equal to one game unit.
- Use Z-up in Blender, face `-Y`, place feet at the origin and export glTF Y-up. Runtime forward is `+Z` before scene yaw.
- Keep mesh and armature root transforms at identity.
- Export one named collection without cameras, lights or construction helpers.
- Use unique ASCII names for meshes, materials, bones, actions and sockets.
- Keep locomotion clips in place. The game simulation owns root movement.
- Bake constraints/IK, limit vertices to four normalized weights and avoid animation on the simulation root.
- Prefer connected purposeful volumes, smooth broad organic forms and deliberate hard seams. Do not use runtime subdivision or strand fur.
- Required sockets: `socket_hat`, `socket_bag`, `socket_back`, `socket_carry_L`, `socket_carry_R`.
- Stable material slots: `fur`, `face`, `hat`, `clothes`, `skin` as applicable.
- Initial hero budget: 2,000–4,000 triangles, at most 24 bones, at most three materials plus equipment and one 512×512 atlas.
- Initial human budget: 1,000–2,000 triangles, at most 24 bones, at most three materials and a 256–512 atlas.
- Export self-contained ordinary GLB. Do not add external URIs, Draco, Meshopt or KTX2 without a recorded delivery decision.
- Run `scripts/validate-assets.mjs --manifest art/manifest.json`, inspect all review views, exercise the asset in the actual game and run `npm run verify` before accepting a regenerated model.
