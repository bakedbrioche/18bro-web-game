# 18Bro: Run for the Chips — Snack Heist Edition

A 3D browser runner set on one continuous Hong Kong street. Every run starts inside a stocked convenience store: 18Bro takes a packet, dances, bursts through the doors, and is chased by two officers arriving from the street. They fall behind after a few seconds of clean running. When caught, the officers pick him up and turn and carry him toward the camera. **One More Run** always restarts the store scene.

The market continues into a commercial street (420 m), a signal-controlled intersection (240 m), and a neon entertainment district (420 m). The first sequence begins at 240 m; subsequent 1,080 m loops shuffle the district order using a new seed for each run. Streets, lighting and fog blend continuously. The chase is endless, with no hallway detours, final roadblock, title cards, loads or fades.

The renderer uses a roughly 320×240 pixel budget at the viewport's aspect ratio, nearest-neighbor enlargement, quantized color, ordered dithering, stable perspective-correct texture mapping, subtle vertex snapping on solid objects and short fogged sightlines. New scenery uses 64/128-pixel textures and streamed, bounded street chunks. Neon pavement colors are painted patches. The opening's layout and choreography are retained. The supplied market audio loops continuously after the first browser interaction, with overlapping ends; its ambience gain is halved to 0.0225. Traffic and distant sirens change gradually along the route.

## Run locally

No dependency installation or build step is needed. The game files and browser dependencies are included in `dist/`. Node.js and npm are needed only to run the local server.

1. Open a terminal in this project folder. On Windows, you can run `cd "C:\Users\taras\Desktop\codex-projects\18bro-web-game"` in PowerShell.
2. Start the local server with `npm start`. This serves JavaScript modules with the MIME type browsers require.
3. Keep the terminal open and visit `http://localhost:4173/` in a WebGL-capable browser such as Chrome. Select **LET'S RUN** or press Enter. Press Enter again to skip the opening sequence.
4. Stop the server with Ctrl+C when finished.

Use arrows or WASD to dodge, jump, and slide. Space jumps; Esc or P pauses; M mutes sound effects. Phones support swipes and on-screen buttons. Do not double-click `dist/index.html`: its JavaScript modules need the local server.

Open http://localhost:4173/. `npm run dev` is an alias. Use a local server for the modular source, or export a standalone HTML file with `npm run export` and open `release/18Bro-Snack-Heist.html` directly.

## Development workflow

Agent and contributor context lives in [`llm-corner/`](llm-corner/README.md). Start there for the project contracts, architecture map, quality gate, active plans, decisions, and handoffs. Run `npm run verify` before committing; visible game changes also require the browser smoke flow in [`llm-corner/docs/conventions/audit-gate.md`](llm-corner/docs/conventions/audit-gate.md).

## Controls and gameplay

Arrows/WASD: change lane, jump or slide. Space: jump. Esc/P: pause. Enter: start/retry (or skip an opening). M: mute effects. Touch: swipe or use the on-screen buttons. Settings and other menu tabs are at the top.

Floating potato chips follow safe lanes, with extra arcs over the larger low barriers. Tall rail barriers have an opening for sliding and cannot be jumped. Later tiers add traffic and shorten encounter gaps while reserving a clear lane. Traffic spawns farther away until barriers in its lane clear; new barriers cannot cut off approaching vehicles. Braking remains a fallback for injected obstacles. Cars and scooter riders approach faster than the scenery and can be jumped. Clipping a vehicle's side causes a recoverable stumble; a head-on hit ends the run. One ordinary mistake brings the police close, and the second ends the run. The electric moped immediately drops the police, accelerates 18Bro and absorbs one collision. Down/S smoothly ducks the rider’s head. Pursuing officers stay in their lane and walk directly toward 18Bro during the arrest. Chip Magnet and Moon Mode remain available. Jetpack carries 18Bro above street hazards for seven seconds and draws in chips; Double Chips doubles pickups for twelve seconds; Shield absorbs one hit or expires after twelve seconds. Compact icons show remaining power time without popup banners.

Humans use faceted anatomical profiles, tapered limbs, articulated hands, modeled shoes and smaller faces. During capture, officers crouch, keep their grips below the cat’s folded arms, pivot and carry him toward the camera with planted feet during pickup and walking steps during approach, turning and carrying. The busted screen opens as the carry begins, while the animation continues. Batons are holstered during the lift. After the result panel appears, the officers continue carrying 18Bro past the camera.

The opening crowd has 72 evenly spaced pedestrians. All nearby humans share the police anatomical build, with varied clothes, hair and bags. Later streets use half the previous pedestrian density, with walking strides tied to sidewalk travel. Intersections have signal-controlled walking crossings, animated LED advertising and covered minibus stops; distant crowds use simple billboard silhouettes. Nearby articulated models are pooled as scenery streams past. Markets include seafood on ice, roast-food stalls, bamboo dim-sum steamers, vegetables, fruit, drinks and clothing. Camera and particle effects accompany the heist, pickups, impacts and powers. The store has individually modeled stock, a staffed checkout and stocked 3D drink coolers. The clerk raises his fists and calls for the police, using four alternating subtitle-only lines. There is no background music. There are no powerup or collision text popups, and no continuous running dust.

## Customize

The Customize menu sells six fur colors and six hat choices independently using banked chips. Sombrero, beanie, bucket hat and crown are modeled geometry; the original cap and no-hat option are free. Purchases persist in the browser and are only charged once. Old outfit purchases migrate into corresponding fur/hat unlocks.

## Source map

- `dist/customization.mjs`: cosmetic catalog, purchase rules and old-save migration.
- `dist/core.mjs`: simulation, encounter generation, collision, difficulty, chase and power-ups.
- `dist/choreography.mjs`: opening and capture timelines, shared with regression tests.
- `dist/route.mjs`: seeded district sequences, continuous profiles and traffic phases.
- `dist/district-scene.mjs`: streamed commercial, intersection and neon geometry.
- `dist/scene.mjs`: procedural meshes, city/store construction, character animation and pooled effects.
- `dist/material-assets.mjs`: the user-supplied asphalt, uniformly tiled sidewalk and solid-color scene materials.
- `dist/assets/textures/`: the user-supplied road and sidewalk images.
- `dist/crowd.mjs`: continuous sidewalk paths and clearance dimensions.
- `dist/app.mjs`: menus, input, local saves, HUD and optional browser tools.
- `dist/audio.mjs`: sound effects. `dist/style.css`: responsive interface.
- `scripts/export-game.mjs`: standalone exporter, including all textures, engine, fonts and game code.

This game runs entirely in the browser. It has no server-side backend or `.env`. Scores and outfits are stored in localStorage on each player's browser. To add shared leaderboards or accounts, a future backend can integrate with `dist/app.mjs` and `RunnerGame.snapshot()`.

Visible opening hazards are constructed during the heist and retain their world position when the chase begins. Road textures finish loading before Play is enabled. Streamed scenery is built beyond the fog horizon, including the first apartment blocks during the menu.

## Verification and animation review

```sh
npm test
```

Regression tests cover the opening and arrest, vehicle queuing, menus, powers, pedestrian clearance, continuous district boundaries, seeded looping, crossing traffic in later intersections, bounded pools and closed former hallway frontages. For visual review, open http://localhost:4173/preview.html: the timeline reviews the heist/capture, while Connected route exposes distance and traffic time. The regular game’s **~** key or Settings → Developer Tools opens practice controls. Practice runs do not change saved records.

## Assets

All models are editable procedural Three.js geometry; no external model service is required. Material and texture provenance are in `docs/textures.md`. Third-party engine/font notices are retained in `dist/vendor/`. The store design uses the user-requested 7-Eleven reference. The supplied storefront photograph is a design reference and is not embedded.
