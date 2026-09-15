# 18Bro: Run for the Chips — Hong Kong Street Edition

A browser-based 3D endless runner. This edition has a single continuous Hong Kong street, denser safe obstacle patterns, oncoming taxis/minibuses, roaming pedestrians, varied shops and vendors, a convenience-store escape intro, and one police officer who appears when close.

Controls: arrows or WASD to dodge/jump/slide; Space jumps; Esc or P pauses; Enter starts/retries; M mutes sound effects. Phones support swipes and on-screen buttons. The ~ key opens developer tools. Runs modified through developer tools are practice runs and do not bank progress.

This edition has coin pickups, magnet and Moon Mode only. There is no background music. Outfits, missions, coins and records save in this browser. Existing hoodie selection falls back to the default cat.

## Run the editable source

No dependency installation or build step is needed. All browser dependencies are vendored.

From this folder, run `python3 -m http.server 4173 --directory dist` and open `http://localhost:4173/` in a WebGL-capable browser. Do not double-click the modular `dist/index.html`; use the separate self-contained HTML download for that.

## Source

- `dist/core.mjs`: pooled simulation, controls, encounter generation, oncoming traffic, swept collision, chase, scoring and the remaining powers.
- `dist/scene.mjs`: procedural textured 3D environment, character/crowd/vehicle geometry and opening animation.
- `dist/app.mjs`: input, menus, persistent local progress, HUD and optional browser tools.
- `dist/audio.mjs`: sound effects only.
- `dist/style.css`: interface and responsive layout.
- `tests/street.test.mjs`: simulation regressions. Run with `node --test tests/street.test.mjs`.

## Validation

13 simulation tests pass, including 10,000 valid traffic patterns, coordinated car arrival times, high-speed swept collisions, jump/slide timing, pause/retry and a 10-minute single-level simulation. The self-contained HTML has also been loaded and exercised in the browser.

The street and character visuals are procedural game assets inspired by the supplied references; the supplied photos are not embedded in the game.
