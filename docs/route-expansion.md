# Connected route implementation / September 18, 2026

The playable expansion is integrated in the modular source and exported to `outputs/18Bro-Snack-Heist.html` at the workspace root. `npm run export` creates the same bundle in the site's `release` folder.

The existing heist and market feed into commercial streets at distance 240. The street widens into the signal-controlled junction around 3000–3300. Lighting and businesses change gradually into the neon district after 3300. The roadblock diverts the runner toward the arcade doorway at 5560, where the run ends without an area card or fade. There is no arcade interior level.

Outside dodge positions choose eight authored detours, including shop/kitchen passages, a traffic-light crossing, a delivery-van bypass and an upstairs karaoke passage. Branch offsets, elevation, collisions, camera and geometry use the same route data. Roads use two vehicle lanes with three runner dodge positions. Cross traffic uses grouped releases with all-red clearance intervals. The pedestrian detour waits for a long enough green to clear both streams. Intersection vehicle types vary with the cycle. All normal road encounter patterns retain a safe dodge position.

The PS1 treatment is implemented in the material shaders and renderer: low internal resolution, nearest-neighbor enlargement, stable texture mapping with mipmapped distance filtering, subtle distant screen-space vertex snapping, ordered 5-bit color dithering, fog, 64/128-pixel district textures and stepped motion. District scenery is streamed in bounded chunks. Indoor stock and props remain procedural geometry.

Audio retains the supplied overlapping market loop at the requested half gain (0.0225). Traffic and distant sirens build into the city; interior filtering and arcade tones blend at the doorway. Browser interaction is required to unlock audio.

## Verification

- 77 Node regression tests passed, including branch selection/rejoining, continuous profiles, signal safety, pedestrian waiting and pause, cross-traffic collisions, pooled route-field resets, finite arcade arrival, original opening/arrest, powers and traffic/barrier separation. Surface regressions also check UV continuity across curved streamed sections, shortcut building frontage/runner clearance, closed outer walls and storefront side returns.
- Browser reviewed commercial and neon streets, crossing geometry/traffic, shop and upstairs passages, and the final approach.
- Standalone HTML loaded and played to the arcade endpoint through practice review controls without console errors. The endpoint displayed 5560 and retry/menu controls. The normal opening was smoke-tested after rebuilding.
- Standalone module passes Node syntax checking. Engine, textures, font and ambience are embedded; no network asset dependency.

The route remains a lane-based runner: detours are selected at their entrances and reconnect automatically, rather than providing free-roaming navigation. The scene review page exposes distance, traffic phase and passage selectors for visual iteration.

## Surface stability fix

Diffuse, emissive and alpha maps now share perspective-correct coordinates. Removing independent affine sampling prevents duplicated sign lettering and severe stretching on large road and facade triangles. Close geometry no longer snaps; subtle distant wobble, low internal resolution and dithering retain the pixel presentation. Mipmaps reduce distant texture shimmer while magnification stays nearest-neighbor. Road, pavement and passage UVs use consistent world coordinates across chunks. Facade and painted wet-road overlays have a depth bias, sign textures clamp at their edges, and distant crowd cards use alpha cutouts without transparent sorting.

Shortcut buildings now retain complete frontage and back walls below their upper floors, with openings only where the playable route crosses the facade. The reported 871 m noodle-shop entrance, its interior, the karaoke entrance, opening street and neon street were reviewed in the browser.

## Menu control fix

The result screen now banks and displays the current result when it first appears. Retry and Main Menu remain available during the arrest animation, and finishing the animation cannot bank the same run twice or steal focus. Pause input ignores held-key repeats, Escape/P can pause an arrest, Enter resumes when the canvas has focus, and paused HUD controls are inert. Four app-level regression tests exercise real button handlers through opening, running, capture and result states.

## Quick arrest / September 19, 2026

On a fatal collision, both officers relocate just outside the camera before entering to pick up 18Bro. Placement accounts for each officer’s complete body, narrow/wide viewports, raised passages and the arrest camera’s pullback. The approach finishes after 1.4 seconds; the complete pickup, turn and short carry lasts four seconds, independent of the previous chase distance. The planted lift and hand/arm clearance remain covered by geometry tests. Retry and Main Menu remain immediately usable.

## Building wall closure / September 19, 2026

The noodle-shop exit around 985–1000 m exposed unfinished ground-floor building sides. Ordinary shops now have solid ground-floor volumes. Shortcut buildings have closed volumes following both sides of the curved passage, with matching bay endpoints and a slab joining the recessed frontage to the upper floors. The playable entrance and exit stay open. Browser checks covered the alley exit and the reported street view; regression checks cover the same building construction across the other shortcuts.
