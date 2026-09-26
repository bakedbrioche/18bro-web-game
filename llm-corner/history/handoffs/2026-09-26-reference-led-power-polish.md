# 2026-09-26 — Reference-led power, pacing and result polish

Author: Codex with delegated simulation, scene and UI review
Branch: feature/graphics-v2-pivot
Commit/PR: working tree intentionally remains uncommitted; the current task did not authorize a commit or push

## State of the world

Refreshed hero rig v5 remains the complete gameplay character: expressive full jump, roll, mount/ride, motorcycle-style scooter jump, low left/right scooter dodges, Jetpack and capture poses. The current pass fixes the surrounding power lifecycle and presentation.

Jetpack is a fixed ten-second flight. It progressively reveals six to eight route chips above 2.1 game units along a seeded three-lane path. Existing ordinary chips are removed at pickup, ordinary ground-chip rows stop during flight, and Magnet cannot pull ground chips from the air. Expiry clears every outstanding route chip and resets vertical, roof, slide and buffered-jump state directly into run, including when Speed Burst was stacked.

Power rows now occur every eight encounter rows and use the exported weights `magnet 30`, `moon 24`, `speedburst 16`, `doublechips 13`, `moped 8`, `shield 5`, `jetpack 4`. The previous result is excluded, so the same power never repeats immediately. These are explicit 18Bro balancing constants; public Subway Surfers material does not publish numeric spawn probabilities.

Three-Paw Guard lasts ten seconds and owns three protected collisions. Its true spherical Fresnel shell carries exactly three four-toe paw-shield badges on one clockwise equatorial stripe. Each hit removes one badge; depletion or timeout fades and collapses the sphere. The active HUD reports both seconds and remaining charges.

The wearable magnet now keeps its authored lower-bridge grip at the left carry socket with no extra wrist twist. Three restrained expanding arcs communicate magnetic pull and become static under Reduced Motion. Arrest officers now begin linear escort movement during the final pivot and keep one continuous pace, removing the visible stop between turn and carry.

Power HUD cards now retain keyed image nodes across frames and pause/resume. Pickup cards use the same robust PNG loader and glyph fallback. BUSTED is centered and staged: stamp, copy/rule, Score, Personal Best, Distance, Chips Banked, final rule and controls. Values count from zero over three seconds. The repeating per-letter wave is controlled by `RESULT_WAVE_ENABLED`; Reduced Motion resolves the sequence immediately. Enter completes the sequence before it can start another run.

## Reference and asset evidence

- `tmp/imagegen/2026-09-26/shield-three-charge/` is the ignored full GPT Image package. It contains nine inputs: authored front/rear/side/three-quarter renders, two official identity references, the generated turnaround, current shield pickup and negative gameplay example. Its prompt requires a true sphere, exactly three four-toe paw shields and 3→2→1→0 states. `notes/input-manifest.md` explains every role.
- The internal image-generation tool accepts at most five local paths. A high-information five-image subset was selected, but the host Windows sandbox helper could not read the paths; no generated output is claimed. The full nine-file package is ready for the ChatGPT website workflow.
- `scripts/blender/create_chip_icon.py` rebuilds original 3D saddle-chip geometry and renders `dist/assets/icons/chip.png`. `art/ui/chip-icon.blend`, its SHA-256 manifest and `validate-chip-icon.mjs` are tracked. Standalone export embeds it through `__18BRO_UI_IMAGES__`.
- Hero rig v5: 878,992 bytes, 3,972 triangles, 20 joints, 18 clips, SHA-256 `d3068a6adbad2b23afecf3b194fd948ce25d027878db5e19e392e31b37244f07`.
- Human rig v3: 777,208 bytes, 2,526 triangles, 24 joints and 12 clips.
- Power-ups revision 3: 643,248 bytes, one material, 12,703 triangles, SHA-256 `90543b21c1dcfb4f22a2b89ac18f14dd7ea2b27fdb8528fea3e76653ec5d3560`.
- Chip icon: 256×256 RGBA, 50,044 bytes, SHA-256 `ce060a29c0090682a60075203d49467678cae596399e40573608bb50133ef2bb`.

## Verification record

- `npm run verify`: 136/136 tests pass; cat, human, power-up and chip validators pass; offline standalone export is 10,064,883 bytes.
- Headless Chrome 153 loaded Refreshed + Clear at a 1,354×682 render surface, entered the real run and activated Magnet, Three-Paw Guard, Speed Burst and Jetpack through Developer Tools.
- The Magnet HUD image retained the exact same DOM node and a 256px decoded image before pause, during pause and after resume. No fallback or broken-image state appeared. Shield HUD read `10s · ×3` with a decoded 256px icon.
- Jetpack and Speed Burst appeared together; after the fixed flight both cards and the screen surge were gone. The staged BUSTED screenshot begins at score zero and the final centered card contains the authored 3D chip icon and visible controls.
- Chrome reported WebGL error 0, no JavaScript exceptions, no console errors and no failed network requests. Ignored evidence is under `release/browser-review/`.

## Landmines and next step

- `dist/` remains editable source. `release/` and `tmp/` remain ignored and must not be committed.
- Refreshed attachments own geometry independently from procedural cosmetic rebuilds; replacement must dispose per-cat Shield materials without disposing persistent authored attachments.
- Imported animation mixers exclusively own imported bones. Simulation continues to own world/root motion and collision state.
- The standalone result icon must use `globalThis.__18BRO_UI_IMAGES__?.chip` with its modular relative-path fallback.
- Review the working tree, then commit or push only after explicit authorization in the current task.
