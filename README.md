# 18Bro: Run for the Chips — Snack Heist Edition

A 3D browser runner set on one continuous Hong Kong street. Every run starts inside a stocked convenience store: 18Bro takes a packet, dances, bursts through the doors, and is chased by two officers arriving from the street. They fall behind after a few seconds of clean running. When caught, the officers pick him up and carry him out of the shot. **One More Run** always restarts the store scene.

## Run locally

Install Node.js for npm/test commands and Python 3 for the static server. No npm dependencies or API keys are needed; Three.js and the font are included.

```sh
npm start
# or: python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173/. `npm run dev` is an alias. Use a local server for the modular source, or export a standalone HTML file with `npm run export` and open `release/18Bro-Snack-Heist.html` directly.

## Controls and gameplay

Arrows/WASD: change lane, jump or slide. Space: jump. Esc/P: pause. Enter: start/retry (or skip an opening). M: mute effects. Touch: swipe or use the on-screen buttons. Settings and other menu tabs are at the top.

Coins follow safe lanes, with extra arcs over the larger low barriers. High barriers require a lane change. Later tiers add more barriers and shorten encounter gaps while reserving a clear lane. Cars and scooter riders approach faster than the scenery and can be jumped. Clipping a vehicle's side causes a recoverable stumble; a head-on hit ends the run. One ordinary mistake brings the police close, and the second ends the run. The electric moped accelerates 18Bro and absorbs one collision. Coin Magnet and Moon Mode remain available.

The crowd includes men and women with varied clothes, hair, bags, heights and walking rhythms. Markets include seafood on ice, roast-food stalls, bamboo dim-sum steamers, vegetables, fruit, drinks and clothing. Camera and particle effects accompany the heist, pickups, movement, impacts and powers. There is no background music.

## Source map

- `dist/core.mjs`: simulation, encounter generation, collision, difficulty, chase and power-ups.
- `dist/choreography.mjs`: opening and capture timelines, shared with regression tests.
- `dist/scene.mjs`: procedural meshes, city/store construction, character animation and pooled effects.
- `dist/material-assets.mjs`: local texture loading, atlas regions and material tiling.
- `dist/assets/textures/`: all supplied store, street, vehicle-cart, produce, storefront and tenement textures, plus the generated city atlas.
- `dist/crowd.mjs`: continuous sidewalk paths and clearance dimensions.
- `dist/app.mjs`: menus, input, local saves, HUD and optional browser tools.
- `dist/audio.mjs`: sound effects. `dist/style.css`: responsive interface.
- `scripts/export-game.mjs`: standalone exporter, including all textures, engine, fonts and game code.

This game runs entirely in the browser. It has no server-side backend or `.env`. Scores and outfits are stored in localStorage on each player's browser. To add shared leaderboards or accounts, a future backend can integrate with `dist/app.mjs` and `RunnerGame.snapshot()`.

## Verification and animation review

```sh
npm test
```

32 tests cover the retry flow, street-only police entrance, glancing/head-on vehicle collisions, jump and coin alignment, larger collision models, increasing difficulty, pause behavior, moped shielding, pedestrian clearance and a ten-minute pooled simulation. For visual review, open http://localhost:4173/preview.html and move the timeline slider through the store heist or carry-away. The regular game's **~** key opens practice/debug tools.

## Assets

All models are editable procedural Three.js geometry; no external model service is required. Texture provenance and the image-generation prompt are in `docs/textures.md`. Third-party engine/font notices are retained in `dist/vendor/`. The supplied images are embedded as local project assets: apartment facades cover upper tenements, matching shop photos cover street storefronts, the soda refrigerator and convenience materials dress the opening store, asphalt covers the road, and the metal, wood, blue-cart and fruit sheets dress street fixtures and produce.
