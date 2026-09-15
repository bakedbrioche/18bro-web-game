# 18Bro: Run for the Chips — Hong Kong Street Edition

A browser-based 3D endless runner. This edition has a single continuous Hong Kong street, denser safe obstacle patterns, faster rounded oncoming cars and electric scooters, roaming pedestrians, varied shops and vendors, a stocked 7-Eleven escape intro, and two police officers who close in smoothly.

Controls: arrows or WASD to dodge/jump/slide; Space jumps; Esc or P pauses; Enter starts/retries; M mutes sound effects. Phones support swipes and on-screen buttons. The ~ key opens developer tools. Runs modified through developer tools are practice runs and do not bank progress.

This edition has coin pickups, a coin magnet, Moon Mode, and an electric Chinese-style moped powerup that absorbs one collision. There is no background music. Outfits, missions, coins and records save in this browser.

## Run the editable source

No dependency installation or build step is needed. All browser dependencies are vendored.

From this folder, run `npm start` and open `http://localhost:4173/` in a WebGL-capable browser. No install step is required because all browser dependencies are included. Do not double-click the modular `dist/index.html`; launch the local server.

## Source

- `dist/core.mjs`: pooled simulation, controls, encounter generation, oncoming traffic, swept collision, chase, scoring and the remaining powers.
- `dist/scene.mjs`: procedural textured 3D environment, character/crowd/vehicle geometry, stocked-store opening animation, smooth pedestrians and capture sequence.
- `dist/crowd.mjs`: continuous sidewalk paths that keep pedestrians clear of vendor carts and curb fixtures.
- `dist/app.mjs`: input, menus, persistent local progress, HUD and optional browser tools.
- `dist/audio.mjs`: sound effects only.
- `dist/style.css`: interface and responsive layout.
- `tests/street.test.mjs`: simulation regressions. Run with `npm test`.

## Validation

24 tests pass, including 10,000 valid traffic patterns, coordinated car arrival times, high-speed swept collisions, jumpable cars and scooters, moped shielding, two-mistake capture, pedestrian clearance, pause/retry and a 10-minute single-level simulation. The game has also been loaded and exercised in the browser.

The street and character visuals are procedural game assets inspired by the supplied references; the supplied photos are not embedded in the game.
