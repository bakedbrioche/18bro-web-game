# 18Bro: Run for the Chips — Snack Heist Edition

A 3D browser runner set on one continuous Hong Kong street. Every run starts inside a stocked convenience store: 18Bro takes a packet, dances, bursts through the doors, and is chased by two officers arriving from the street. They fall behind after a few seconds of clean running. When caught, the officers pick him up and turn and carry him toward the camera. **One More Run** always restarts the store scene.

The market now continues into three playable areas: a commercial street, a signal-controlled intersection, and a neon entertainment district. The finite chase ends at the arcade doorway, 5,560 route units from the opening. Shops and alleys branch from outside lanes and reconnect ahead. The pedestrian crossing pauses at red; the main street crosses lateral traffic directly. A karaoke detour climbs upstairs and returns by the rear passage. The closing police roadblock sends the chase toward the arcade. There are no area title cards, loads or fades.

The renderer uses a roughly 320×240 pixel budget at the viewport's aspect ratio, nearest-neighbor enlargement, quantized color, ordered dithering, stable perspective-correct texture mapping, subtle distant vertex snapping and short fogged sightlines. New scenery uses 64/128-pixel textures and streamed, bounded street chunks. Neon pavement colors are painted patches. The opening's layout and choreography are retained. The supplied market audio loops continuously after the first browser interaction, with overlapping ends; its ambience gain is halved to 0.0225. Traffic, distant sirens and arcade sounds change gradually along the route.

## Run locally

Install Node.js for npm/test commands and Python 3 for the static server. No npm dependencies or API keys are needed; Three.js and the font are included.

```sh
npm start
# or: python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173/. `npm run dev` is an alias. Use a local server for the modular source, or export a standalone HTML file with `npm run export` and open `release/18Bro-Snack-Heist.html` directly.

## Controls and gameplay

Arrows/WASD: change lane, jump or slide. Space: jump. Esc/P: pause. Enter: start/retry (or skip an opening). M: mute effects. Touch: swipe or use the on-screen buttons. Settings and other menu tabs are at the top.

Floating potato chips follow safe lanes, with extra arcs over the larger low barriers. Tall rail barriers have an opening for sliding and cannot be jumped. Later tiers add traffic and shorten encounter gaps while reserving a clear lane. Traffic spawns farther away until barriers in its lane clear; new barriers cannot cut off approaching vehicles. Braking remains a fallback for injected obstacles. Cars and scooter riders approach faster than the scenery and can be jumped. Clipping a vehicle's side causes a recoverable stumble; a head-on hit ends the run. One ordinary mistake brings the police close, and the second ends the run. The electric moped immediately drops the police, accelerates 18Bro and absorbs one collision. Down/S smoothly ducks the rider’s head. Pursuing officers stay in their lane and walk directly toward 18Bro during the arrest. Chip Magnet and Moon Mode remain available.

Humans use faceted anatomical profiles, tapered limbs, articulated hands, modeled shoes and smaller faces. During capture, officers crouch, keep their grips below the cat’s folded arms, pivot and carry him toward the camera with planted feet during pickup and walking steps during approach, turning and carrying. The busted screen opens as the carry begins, while the animation continues. Batons are holstered during the lift.

The crowd includes men and women with varied clothes, hair, bags, heights and walking rhythms, with 72 evenly spaced pedestrians that cannot overtake each other. Markets include seafood on ice, roast-food stalls, bamboo dim-sum steamers, vegetables, fruit, drinks and clothing. Camera and particle effects accompany the heist, pickups, impacts and powers. The store has individually modeled stock, a staffed checkout and stocked 3D drink coolers. The clerk raises his fists and calls for the police, using four alternating subtitle-only lines. There is no background music. There are no powerup or collision text popups, and no continuous running dust.

## Source map

- `dist/core.mjs`: simulation, encounter generation, collision, difficulty, chase and power-ups.
- `dist/choreography.mjs`: opening and capture timelines, shared with regression tests.
- `dist/route.mjs`: shared route distances, branches, continuous profiles and traffic phases.
- `dist/district-scene.mjs`: streamed commercial, intersection and neon geometry.
- `dist/scene.mjs`: procedural meshes, city/store construction, character animation and pooled effects.
- `dist/material-assets.mjs`: the user-supplied asphalt, uniformly tiled sidewalk and solid-color scene materials.
- `dist/assets/textures/`: the user-supplied road and sidewalk images.
- `dist/crowd.mjs`: continuous sidewalk paths and clearance dimensions.
- `dist/app.mjs`: menus, input, local saves, HUD and optional browser tools.
- `dist/audio.mjs`: sound effects. `dist/style.css`: responsive interface.
- `scripts/export-game.mjs`: standalone exporter, including all textures, engine, fonts and game code.

This game runs entirely in the browser. It has no server-side backend or `.env`. Scores and outfits are stored in localStorage on each player's browser. To add shared leaderboards or accounts, a future backend can integrate with `dist/app.mjs` and `RunnerGame.snapshot()`.

## Verification and animation review

```sh
npm test
```

77 tests cover the opening and arrest, collision sizes, vehicle queuing, pause and retry, powers, pedestrian clearance, route continuity, branch entry/merge, pedestrian signals, lateral traffic collisions, pooled entity resets, arcade arrival, and closed building walls around shortcut exits. The ten-minute simulation ends at the arcade with the same bounded pool. For visual review, open http://localhost:4173/preview.html: the timeline reviews the heist/capture, while Connected route exposes distance, traffic time and passage controls. The regular game's **~** key or Settings → Developer Tools opens practice controls with a route review selector. Practice runs do not change saved records.

## Assets

All models are editable procedural Three.js geometry; no external model service is required. Material and texture provenance are in `docs/textures.md`. Third-party engine/font notices are retained in `dist/vendor/`. The store design uses the user-requested 7-Eleven reference. The supplied storefront photograph is a design reference and is not embedded.
