# Architecture

## Runtime flow

`dist/index.html` loads `dist/app.mjs`, which owns menus, input, saves, HUD, audio state, and the animation loop. `app.mjs` advances the deterministic `RunnerGame` from `dist/core.mjs` and renders it through `GameScene` in `dist/scene.mjs`.

## Source map

| Surface | Responsibility |
|---|---|
| `dist/core.mjs` | DOM-free simulation, encounters, collision, chase, scoring, powers |
| `dist/app.mjs` | browser input, menus, saves, HUD, runtime wiring |
| `dist/scene.mjs` | WebGL renderer, store/city geometry, characters, animation |
| `dist/route.mjs` | seeded continuous district sequence and traffic phases |
| `dist/district-scene.mjs` | streamed commercial/intersection/neon scenery |
| `dist/choreography.mjs` | opening and capture timelines shared by runtime/tests |
| `dist/customization.mjs` | fur/hat catalog, purchases, save migration |
| `dist/crowd.mjs` | sidewalk/crosswalk movement and clearance dimensions |
| `dist/material-assets.mjs` | texture loading and material surfaces |
| `dist/audio.mjs` | sound effects and market ambience |
| `dist/style.css` | menus, HUD, responsive layout, display treatment |
| `tests/*.test.mjs` | simulation, model, menu, route, surface, and power regressions |

## Build and delivery

There is no dependency installation or bundler. Browser dependencies are vendored under `dist/vendor/`. `server.mjs` serves the editable modules with correct MIME types. `scripts/export-game.mjs` embeds modules, textures, audio, font, and CSS into one standalone HTML file.

`dist/` is the editable source of truth. Do not edit generated `release/` files. The checked-in root `18Bro-Snack-Heist.html` is a release snapshot and must be regenerated deliberately when preparing a standalone release.

## Persistence boundary

All persistent player data is device-local under `18bro.save.v1`. Save-shape changes require normalization or migration in `dist/app.mjs`/`dist/customization.mjs`; silently discarding progress violates C4.
