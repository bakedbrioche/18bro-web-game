# 18Bro project reminder

Canonical truth: `../../../docs/product/overview.md`. Update that file, not this note, when facts change.

- Viral origin: a Hong Kong black cat stole chips from a local 7-Eleven and became the 18Bro meme.
- Business context: this is a community game for a related crypto project, timed around the character's merchandise moment; never present it as official, licensed, or partnered.
- Immediate goal: major visual polish and release readiness within 24 hours.
- Product shape: instantly playable, shareable desktop/mobile web runner; no account, wallet, or backend today.
- Technical shape: static ES modules + vendored Three.js/WebGL + procedural world/Original cast + Blender-authored Refreshed cat/humans/power-ups and generated icons + Node tests/asset validation/export + localStorage.
- Visual direction: readable PS1-inspired shapes, appealing 18Bro silhouette, official-reference color/type language, and selectable legacy/authored model sets.
- Animation invariant: imported mixers exclusively own imported bones; gameplay owns world/root choreography. Never reintroduce procedural rotations on authored bones.
- Movement contract: roll/jump/air-roll transitions are interruptible; scooter has mount/ride/jump/left-right dodge clips; side vehicle contact is recoverable and descending roof landings are safe.
- Power contract: magnet/boots visibly attach to the cat; Moon Boots own high jump, Speed Burst owns acceleration, Three-Paw Guard owns three hits over ten seconds, and Jetpack owns a fixed ten-second airborne-only route before a direct return to run. Spawns use the exported sparse weighted table, with Shield and Jetpack rare and no immediate repeats.
- Collaboration branch: graphics-v2 work lives on `feature/graphics-v2-pivot`; texture contributors start from that branch and follow `docs/reference/street-texture-integration.md`.
- Public details: `18bro.fun` is the original URL but is TBU until restored; tag is “Run for your chips.”
- Launch languages: English, Traditional Chinese, and Cantonese. Future analytics: consent-aware Yandex Metrica and Meta Pixel, disabled until IDs/policy are approved.
