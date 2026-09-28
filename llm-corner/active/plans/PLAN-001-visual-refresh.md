# PLAN-001 — 24-hour visual and release refresh

**Status:** ACTIVE — graphics-v2 model/power/UI pivot implemented and validated; localization remains
**Owner:** chief agent
**Commit cadence:** one reviewed commit per phase; no push/publish without explicit authorization

## 0. Goal

Make 18Bro recognizable and appealing, restore readable distant graphics, and align the interface with the official character’s playful orange/green sticker aesthetic without risking the game’s stable mechanics or 24-hour release target.

## 1. Evidence

- `dist/scene.mjs` renders the normal mode at a fixed 320 × 240 total pixel budget, about 370 × 208 at 16:9, then enlarges it with nearest-neighbor scaling.
- `dist/app.mjs` migrates the former `sharp` setting to `retro` and only exposes PS1/COARSER.
- The cat uses overlapping ellipsoids for its head/body/limbs; people use richer custom profiles, but global flat shading and low output resolution hide or fragment their detail.
- Official references emphasize rounded cheek/ear/body silhouettes, sleepy brows, orange/green/cream, thick sticker outlines, and energetic chunky lettering.

## 2. Proposed phases

### Phase A — Clear Retro graphics mode

- Add a readable default mode using viewport-scaled resolution with a device/performance cap.
- Preserve low-poly geometry, authored texture resolution, restrained palette, and selective retro effects.
- Keep the current framebuffer treatment as optional Classic Pixel and retain a performance mode.
- Files: `dist/app.mjs`, `dist/scene.mjs`, `dist/preview.html`, relevant tests.
- Verify: matched near/far screenshots, desktop/mobile performance, browser smoke, full gate.

### Phase B — model-set switch and safe fallback

Implementation status: the saved selector, atomic cat/human GLB loading, load-failure fallback and offline standalone embedding are complete. Refreshed remains active for every hero pose and all 36 fur/hat combinations. Police, cashier, riders and both crowd systems use the authored human family. Mixer-only bone ownership and frame-zero/full-track validation cover the reported twitch and broken-reset defect.

- Add one saved `Models` preference with `Original` and `Refreshed` choices.
- Keep model selection independent from the `Clear Retro`, `Classic Pixel`, and `Performance` picture-quality choices.
- Apply a model change at the main menu or after a run rather than rebuilding live scene pools mid-run.
- Preserve the current procedural set as the guaranteed fallback. A failed refreshed-model load must leave controls, saves, and the run loop usable and must not overwrite the player's saved choice.
- Switch the whole visible cast together: cat, police, clerk, pedestrians, riders, and vehicles. Per-model overrides are developer-preview tools only.
- Mark `Refreshed` as a preview until its assets pass the model release gate. Promote it to the default only for new players after that gate passes; preserve every explicit `Original` choice.
- Likely files: `dist/app.mjs`, a new DOM-free `dist/model-config.mjs`, `dist/scene.mjs`, `dist/district-scene.mjs`, `dist/preview.html`, and relevant tests.

Acceptance:

- the selector is saved without changing progression or cosmetic data;
- rapid switching cannot apply a stale asynchronous load;
- swaps leave no stale pooled actors and renderer memory plateaus after repeated changes;
- all 36 fur/hat combinations and gameplay attachments remain aligned;
- the standalone export remains fully offline;
- keyboard, touch, pause, capture, and restart flows still pass.

### Phase C — hero cat — complete

- Replace the overlapping head/body primitives with purpose-shaped low-poly ring meshes and smooth normals.
- Prioritize broad cheeks, ear rims, pear torso, short limbs, curled tail, cap silhouette, brows, and rear gameplay view.
- Files: primarily `dist/scene.mjs` and model tests.

### Phase D — reusable human family — complete

- Simplify tiny invisible details and strengthen connected torso/limb/head silhouettes.
- Smooth-shade skin/cloth volumes; reserve hard edges for clothing, hair, shoes, and accessories.
- Produce one strong police/clerk base, then derive pedestrians.

### Phase E — brand UI

- Create an original 18Bro wordmark treatment inspired by the references rather than claiming an exact proprietary font.
- Use chunky rounded display lettering, layered white/dark outlines, offset shadows, slight rotations, sticker panels, and orange/green/cream/charcoal.
- Keep small controls readable and support required Chinese glyphs.
- Add reviewed English, Traditional Chinese and Cantonese dictionaries with a saved language selector; do not reuse one Chinese translation as Cantonese.

### Phase F — release gate

- Full tests/export, browser flows, representative phone/desktop review, performance checks, save migration, standalone refresh, and release notes.

### Phase G — movement and power-up polish — complete

- Added authored roll, scooter mount, scooter stunt-jump, and randomized left/right scooter dodge clips.
- Restored cashier panic with a dedicated mouth joint and full-track reset-safe animation.
- Added Blender-authored models and transparent rendered icons for the original six power-ups, plus per-type auras, pickup cards and icon timers; Phase H adds Speed Burst as the seventh.
- Made side vehicle contacts recoverable, car-roof landings safe, slide/jump/slide chaining responsive, magnet acquisition debt persistent, and jetpack chip trails airborne and deterministic.
- Removed ambient white road particles; effects now correspond to actions, pickups, powers or damaged props.

### Phase H — visible equipment and power identity — complete

- Added Blender-authored magnet and Moon Boot wearables that follow the Refreshed cat's animated paw/feet, with coherent procedural equivalents for Original.
- Separated Moon Boots into a high-jump power and introduced a distinct blue Speed Burst pickup, icon, aura, HUD timer and deterministic speed effect.
- Replaced the first incremental Jetpack trail with a fixed ten-second airborne-only route; its rolling window is cleared exactly at landing.
- Rebuilt the Shield as a true energy sphere with three rotating four-toe paw-shield charges and removed its white particle trail.
- Lowered authored scooter dodges below the 1.6-unit rail and replaced the cashier's party-like motion with a planted angry panic loop.


### Phase I — reference-led animation and power feedback — complete

- Used an ignored, dated GPT Image workbench to preserve prompts, inputs and outputs for shield, mascot turnaround and animation-keyframe studies without committing temporary reference media.
- Re-authored the hero as rig v5 with a more expressive full jump arc, a motorcycle-style scooter jump and lower left/right side-saddle dodges; runtime now samples the complete jump clip through descent.
- Rebuilt the Shield as a true sphere with restrained energy regions and exactly three four-toe paw-shield badges. One badge disappears per protected hit; the authored pickup uses the same paw language.
- Jetpack reveals a connected lane-changing airborne route progressively, keeping six to eight chips readable ahead. It suppresses ground chips during flight, expires at ten seconds, clears the route and resets directly to run.
- Power-up spawning uses a sparse exported weighted table: Magnet/Moon Boots are common, Shield/Jetpack are rare, and the same power never repeats immediately.
- Speed Burst uses a motion-aware blue edge vignette and directional swooshes instead of emitting particles behind the cat.


### Phase J — route, camera and result refinement — complete

- Raised the active Magnet in a straight mixer-owned arm pose while preserving every base clip's non-arm tracks; enlarged its U and blue wave signal.
- Enlarged and evenly spaced the three Shield badges, set a three-second orbit, added per-charge shatter/fade feedback and extended the power to fifteen seconds.
- Replaced repetitive four-chip ground rows with seeded 3–6 chip straight, lateral and weave paths using a 1:3:3:1 length distribution.
- Kept Moon Boots and Jetpack camera pitch constant by lifting the camera position and look target together.
- Smoothed the BUSTED letter wave so adjacent glyphs flow together and spun the model-rendered result chip with reduced-motion fallbacks.

### Phase K — smooth result motion — complete

- Replaced the CSS-flipped still chip with a Blender-rendered 60-frame, 60 fps transparent APNG turntable and retained the still for Reduced Motion and decode fallback.
- Accelerated the BUSTED traversal from roughly 1.60 seconds to 0.84 seconds, added closer letter overlap and kept the motion on compositor transforms.
- Extended deterministic asset validation and standalone embedding coverage for the animated PNG.

### Phase L — continuous runner pressure and police net pursuit — complete

- Added seeded three-lane chip formations every 40–50 metres, retained smaller variable routes, and kept sparse forward cars on broad roads.
- Made all reachable obstacle roofs safe landings; set Moon Boots to ten seconds; bound Jetpack chips to airborne flight and let Speed Burst, not Double Chips, affect the planned distance.
- Added capped, computed-solvable perpendicular intersection traffic with reaction time for a jump and two-lane correction.
- Added a deterministic two-officer net pursuit with alternating 2–4 attempts, tracking PS1-style telegraphs, a protected escape lane, custom net capture and a 10,000-score dodge reward.
- Reduced Magnet feedback to one centered signal that fades during rolling.
- Upgraded the result chip to a 60-frame, 60 fps Blender APNG and kept BUSTED motion on continuously interpolated compositor transforms.
### Phase T - pursuit, power and pause contract - complete

- Resolve active net pursuits immediately through Moped or Jetpack while retaining the controller's scaled escape reward and one-shot scheduling.
- Treat a shielded net connection as one ordinary protected hit, consume one charge and return to pursuit recovery.
- Freeze transient in-run feedback clocks and CSS animation state during pause, then continue from the same frame.
- Give every booster a subtle tinted billboard halo and sample Refreshed guards continuously with the Refreshed hero.

## 3. Model and animation contract

- The simulation owns position, facing, collision, capture logic, and root motion. Imported animation clips are in-place visual motion.
- A controller owns a character's bones. Procedural animation and an imported animation mixer must never write to the same bones in the same frame.
- Runtime model instances expose a root, stable attachment sockets, look customization, pose sampling, visibility, and explicit disposal.
- The model library prepares one generation atomically, creates cat/human/vehicle instances, and releases only resources it owns. Shared GLB geometry and materials use reference-safe disposal.
- Hats and gameplay props attach through named sockets rather than shape-specific offsets.
- `llm-corner/active/plans/PLAN-002-blender-model-pipeline.md` owns the asset-production details.

## 4. Scope guard

Defer fur rendering, city-wide remodeling, compression infrastructure, and an extensive animation library. The deadline supports one polished hero cat, one reusable human family, one safe model selector, one clear graphics preset, and one coherent UI pass. The Blender pipeline may progress in parallel, but interactive Blender control is not a release blocker.

## 5. Confirmed direction

1. Clear Retro is the intended readable default; the current pixel-heavy treatment remains available as Classic Pixel.
2. Original and Refreshed models are selectable independently from picture quality.
3. A checked-in Blender-to-GLB pipeline and deterministic validation are part of the development plan.

## 6. Remaining operator decisions

1. Confirm whether the official-style wordmark may be an original traced-by-eye vector treatment, subject to brand permission.
2. Choose desktop/mobile performance targets and the exact release channel.
3. Confirm the crypto-project public name and destination before release copy is finalized. The community relationship, `18bro.fun` TBU status, and “Run for your chips” tag are confirmed.

### Phase M — spaced chip trails and attached net capture — complete

- Replaced overlapping three-lane chip heaps with one deterministic, non-crossing 3–6-chip trail every 55–80 metres; jump arcs replace that section's ground line instead of layering over it.
- Expanded each police-net warning to a distance-scaled 3–5 seconds and tied its blink acceleration to the same warning window.
- Kept the selected officer's net attached through catch, lift, turn, shoulder carry and backward retreat; removed the duplicate world-space capture prop.
- Limited Enter skipping to the opening cutscene's first 1.5 seconds so a committed intro plays through without accidental late cancellation.
### Phase N — doubled chip cadence and single-owner net animation — complete

- Increased ordinary chip-trail cadence to one deterministic 3–6-chip trail every 28–36 metres, more than doubling encounter frequency while retaining one active non-crossing trail and preserving jump-row substitution.
- Mirrored each officer's net to the inward hand/socket so the pair no longer crosses or reads backward.
- Added mixer-owned left/right ready and aim variants that preserve the chase gait byte-for-byte outside the selected arm; the armed hand rises progressively over the full warning.
- Made the pursuit renderer the sole owner of net capture presentation, eliminating the competing ordinary capture pass that disconnected props and deformed the acting guard.
- Kept the same attached net through strike, catch, lift, turn, shoulder carry and stable final result presentation.

### Phase O — rigid sack capture and graceful chips — complete

- Rebuilt the police prop as one fixed-scale net with open and connected-sack states plus a hero-sized payload socket; 18Bro now follows that socket while the sack stays world-down instead of stretching the whole prop.
- Split capture presentation into raised aim, planted catch, vertical lift and shoulder carry, cached actor transforms at impact, delayed the turn until the load is secure, and made both guards exit fully after the result appears.
- Changed authored net aim to a raised panic-derived arm pose while preserving chase locomotion outside the selected arm chain.
- Budgeted Jetpack reveals from remaining cruise distance and only the remaining Speed Burst overlap. Descent stops generation without deleting already-visible chips; landing retires leftovers cleanly.
- Added a shared chip entrance/exit overshoot and a subtle camera-facing gold billboard, with a non-bouncy Reduced Motion path.
- Archived the user-supplied four-panel pose reference and prompt in the ignored dated image-generation workbench; the shipped implementation is rebuilt in Three.js.


### Phase P - pursuit presentation closeout - complete

- Sized the rigid net to the real hero envelope, attached 18Bro to a dedicated payload socket and moved the escort net to the outer hand for a clear two-officer exit silhouette.
- Replaced chip aura geometry with one non-spinning radial-gradient sprite that always faces the camera.
- Scaled escape rewards from chase duration, resolved attempts and capped difficulty; added four non-repeating themed reward tags and a Reduced Motion-safe orange/green chase card.
- Added an original generated chase favicon, retained prompt/source provenance in the ignored workbench and embedded the exact runtime PNG in standalone export.

### Phase Q - readable pursuit prop and opening heist emotion - complete

- Present only the currently acting guard's net, using a sagging square open lattice and one tapered payload sack after capture; keep the escort clear while both guards share the bounded exit.
- Replace the flat stolen packet with one rounded sealed-pillow mesh, integrated crimp bands and two modeled CHIPS panels shared by Original and Refreshed models.
- Animate and exactly restore each model family's existing eyes, eyelids, pupils, brows and mouth from packet contact through the store exit; add no duplicate panic-face mesh. Cover the old cap diamond with a readable orange/red/green seven-inspired mark.

### Phase R - final pursuit and heist presentation - complete

- Derive the acting net's carry frame through the selected guard's real shoulder anchor, preserve one fixed-scale sack and keep the escort clear; both guards finish a bounded exit.
- Join two compact crops of the supplied chase illustration into a diagonal old-arcade pursuit-success banner with shadow, achievement aura, four non-repeating messages and a static Reduced Motion fallback.
- Replace the busy chase favicon with a 128 x 128 orange peeking-18Bro cap mark, archive the previous favicon and prior code-rendered reward card, and embed the current UI images in standalone export.
- Preserve the supplied chase/capture references and generation provenance in the ignored dated image workbench.
### Phase S - production packet and identity correction - complete

- Rebuilt the stolen snack packet as one closed 1,152-triangle analytic pillow with tapered gussets, integrated seals/artwork and surface-conforming CHIPS lettering; manifold tests require every edge to have exactly two incident triangles.
- Moved only the existing eye and pupil geometry forward during surprise, retracted the existing lids by measured depth, and preserved exact Original transforms and Refreshed vertex restoration.
- Replaced the floating cap blocks with a shallow ordered badge containing a white panel, orange bar, one curved red 7 and block-built green ELEVEN treatment.
- Replaced the tab icon with a calm peeking-18Bro crop anchored to the official half-lidded eyes and low brows; archived the preceding peeking favicon and retained the generated source/prompt in the ignored workbench.
