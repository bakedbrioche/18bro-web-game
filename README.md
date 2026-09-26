# 18Bro: Run for the Chips — Snack Heist Edition

A 3D browser runner set on one continuous Hong Kong street. Every run starts inside a stocked convenience store: 18Bro takes a packet, dances, bursts through the doors, and is chased by two officers arriving from the street. They fall behind after a few seconds of clean running. When caught, the officers pick him up and turn and carry him toward the camera. **One More Run** always restarts the store scene.

The project is inspired by the viral Hong Kong story of 18Bro, a black cat known for stealing chips from a local 7-Eleven and becoming a meme. This is a community game for a related crypto project, built as a globally shareable experience around the character's merchandise moment. It is not presented as an official or licensed game. The original public URL was `18bro.fun`; that destination is currently unavailable and is marked TBU. Tagline: **Run for your chips.**

The market continues into a commercial street (420 m), a signal-controlled intersection (240 m), and a neon entertainment district (420 m). The first sequence begins at 240 m; subsequent 1,080 m loops shuffle the district order using a new seed for each run. Streets, lighting and fog blend continuously. The chase is endless, with no hallway detours, final roadblock, title cards, loads or fades.

The default Clear Retro picture mode renders at the viewport's resolution so distant characters, vehicles, and shop fronts remain readable. Classic Pixel retains the roughly 320×240 framebuffer, nearest-neighbor enlargement, color quantization, ordered dithering, stable perspective-correct texture mapping, subtle solid-object vertex snapping, and short fogged sightlines; Coarser is the lower-performance option. New scenery uses 64/128-pixel textures and streamed, bounded street chunks. Neon pavement colors are painted patches. The opening's layout and choreography are retained. The supplied market audio loops continuously after the first browser interaction, with overlapping ends; its ambience gain is halved to 0.0225. Traffic and distant sirens change gradually along the route.

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

Floating potato chips follow safe lanes, with extra arcs over the larger low barriers. Tall rail barriers have an opening for rolling under and cannot be jumped. A roll can become a jump immediately; pressing slide during a jump starts an airborne roll and fast fall without adding a second jump. Later tiers add traffic and shorten encounter gaps while reserving a clear lane. Cars and scooter riders approach faster than the scenery and can be jumped. Clipping a vehicle's side causes a recoverable stumble, landing on a vehicle roof is safe, and a head-on hit ends the run. One ordinary mistake brings the police close, and the second ends the run. The electric scooter immediately drops the police, accelerates 18Bro and absorbs one collision. It has authored mount, ride, stunt-jump and randomized left/right low-dodge poses. Pursuing officers stay in their lane and walk directly toward 18Bro during the arrest.

Chip Magnet, Moon Boots, Speed Burst, scooter, Three-Paw Guard, Double Chips and Jetpack each have an original Blender model, animated aura, pickup card and matching persistent icon timer. The cat visibly raises the magnet in a straight paw, grips the bottom of its U, and wears Moon Boots in both model families. Moon Boots grant a 6.1-unit high jump that clears the tallest barrier; Speed Burst separately accelerates the run by 1.6×. A magnet finishes collecting every chip it has acquired even after its timer reaches zero. Jetpack owns a fixed ten-second flight and progressively reveals a connected lane-changing route of six to eight airborne chips; ground chips are absent until landing, then 18Bro returns directly to run. Its twin tubes emit layered animated thrust. Double Chips doubles pickups for twelve seconds. The Three-Paw Guard lasts fifteen seconds, blocks three hits and breaks one large rotating four-toe paw shield per hit. Power rows are sparse and weighted, with Magnet and Moon Boots common and Shield and Jetpack rare; the same power never repeats immediately.

Refreshed humans use one Blender-authored 24-joint family with role meshes for police, cashier, scooter riders and pedestrians. Clothing palettes, skin tones and short/bob hair vary the crowd while keeping the pool bounded. The cashier has an authored panic loop with raised fists, planted side-to-side recoil, angry brows, an opening scream mouth and an original comic anger mark. During capture, side-specific officer clips support 18Bro with the inner hands as the world choreography approaches, pivots and carries him toward the camera. The busted screen opens as the carry begins, while the animation continues. Its title flows as a fast overlapping letter wave, and Chips Banked uses a real 36-frame render of the rotating 3D chip.

The opening crowd has 72 evenly spaced pedestrians. Later streets use half the previous pedestrian density, with authored walk cycles tied to sidewalk travel. Intersections have signal-controlled walking crossings, animated LED advertising and covered minibus stops; distant crowds use simple billboard silhouettes. Nearby skeleton-safe instances are pooled as scenery streams past. Markets include seafood on ice, roast-food stalls, bamboo dim-sum steamers, vegetables, fruit, drinks and clothing. Camera and particle effects accompany the heist, pickups, impacts and powers. The store has individually modeled stock, an authored cashier and stocked 3D drink coolers. The cashier calls for the police using four alternating subtitle-only lines. There is no background music. There are no powerup or collision text popups, and no continuous running dust.

## Customize

The Customize menu sells six fur colors and six hat choices independently using banked chips. Sombrero, beanie, bucket hat and crown are modeled geometry; the original cap and no-hat option are free. Purchases persist in the browser and are only charged once. Old outfit purchases migrate into corresponding fur/hat unlocks.

## Source map

- `dist/customization.mjs`: cosmetic catalog, purchase rules and old-save migration.
- `dist/core.mjs`: simulation, encounter generation, collision, difficulty, chase and power-ups.
- `dist/choreography.mjs`: opening and capture timelines, shared with regression tests.
- `dist/route.mjs`: seeded district sequences, continuous profiles and traffic phases.
- `dist/district-scene.mjs`: streamed commercial, intersection and neon geometry.
- `dist/scene.mjs`: procedural meshes, city/store construction, character animation and pooled effects.
- `dist/model-config.mjs`, `dist/model-manifest.mjs`, `dist/character-assets.mjs`, `dist/character-animation.mjs`: saved model-family choice, validated asset metadata, offline-safe GLB loading and DOM-free clip selection.
- `dist/presentation-config.mjs`: save-safe Clear Retro, Classic Pixel, Coarser, Arcade and 18Bro Sticker presentation choices.
- `dist/assets/models/`: generated runtime character and power-up GLBs; editable Blender sources live under `art/characters/` and `art/powerups/`.
- `dist/assets/icons/`: transparent pickup renders generated from the Blender power-up source.
- `dist/analytics.mjs`: dormant consent-aware boundary for future Yandex Metrica and Meta Pixel integrations.
- `dist/material-assets.mjs`: the user-supplied asphalt, uniformly tiled sidewalk and solid-color scene materials.
- `dist/assets/textures/`: the user-supplied road and sidewalk images.
- `dist/crowd.mjs`: continuous sidewalk paths and clearance dimensions.
- `dist/app.mjs`: menus, input, local saves, HUD and optional browser tools.
- `dist/audio.mjs`: sound effects. `dist/style.css`: responsive interface.
- `scripts/export-game.mjs`: standalone exporter, including models, textures, engine, fonts and game code.

This game runs entirely in the browser. It has no server-side backend or `.env`. Scores and outfits are stored in localStorage on each player's browser. To add shared leaderboards or accounts, a future backend can integrate with `dist/app.mjs` and `RunnerGame.snapshot()`.

Visible opening hazards are constructed during the heist and retain their world position when the chase begins. Road textures finish loading before Play is enabled. Streamed scenery is built beyond the fog horizon, including the first apartment blocks during the menu.

## Verification and animation review

```sh
npm run verify
```

The verification gate runs regression tests, strict cat/human/power-up asset validation and the standalone export. Coverage includes the opening and arrest, chained moves, recoverable side impacts, safe car-roof landings, visible equipment, separate Moon Boots/Speed Burst behavior, progressively revealed airborne Jetpack routes, weighted power pacing, three-charge Shield behavior, persistent HUD icons, staged results, vehicle queuing, menus, pedestrian clearance, continuous district boundaries, seeded looping, bounded pools, model loading/fallback and offline export. For visual review, open http://localhost:4173/preview.html: the timeline reviews the heist/capture, while Connected route exposes distance and traffic time. The regular game’s **~** key or Settings → Developer Tools opens practice controls. Practice runs do not change saved records.

## Assets

The Original family remains editable procedural Three.js geometry. Refreshed adds original Blender-authored cat, human and power-up families generated by `scripts/blender/create_18bro.py`, `scripts/blender/create_human.py` and `scripts/blender/create_powerups.py`; their `.blend` sources, manifests and self-contained GLBs are checked in. Settings switch the complete visible family independently from picture quality. The authored cat has dedicated clips for the store opening, running, jumping, falling, rolling, impacts, four scooter states, jetpack and capture/carry, and all six fur colors and six hats remain on that family. The power-up GLB includes seven pickup roots plus independently attachable magnet and Moon Boot wearables. Police, cashier, riders and nearby crowds use the authored human family at the same time. Imported animation mixers exclusively own imported bones, which prevents pose drift and broken-limb resets. Original remains the explicit alternative and the load-failure fallback.

Material and texture provenance are in `docs/textures.md` and `art/manifest.json`. Third-party engine, loader and font notices are retained in `dist/vendor/`. The store design uses the user-requested 7-Eleven reference. The supplied storefront photograph is a design reference and is not embedded.
