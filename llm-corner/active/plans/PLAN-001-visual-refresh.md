# PLAN-001 — 24-hour visual and release refresh

**Status:** DRAFT — awaiting operator direction
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

### Phase B — hero cat

- Replace the overlapping head/body primitives with purpose-shaped low-poly ring meshes and smooth normals.
- Prioritize broad cheeks, ear rims, pear torso, short limbs, curled tail, cap silhouette, brows, and rear gameplay view.
- Files: primarily `dist/scene.mjs` and model tests.

### Phase C — reusable human family

- Simplify tiny invisible details and strengthen connected torso/limb/head silhouettes.
- Smooth-shade skin/cloth volumes; reserve hard edges for clothing, hair, shoes, and accessories.
- Produce one strong police/clerk base, then derive pedestrians.

### Phase D — brand UI

- Create an original 18Bro wordmark treatment inspired by the references rather than claiming an exact proprietary font.
- Use chunky rounded display lettering, layered white/dark outlines, offset shadows, slight rotations, sticker panels, and orange/green/cream/charcoal.
- Keep small controls readable and support required Chinese glyphs.

### Phase E — release gate

- Full tests/export, browser flows, representative phone/desktop review, performance checks, save migration, standalone refresh, and release notes.

## 3. Scope guard

Defer a bespoke Blender/GLB pipeline, fur rendering, city-wide remodeling, and extensive new animation. The deadline supports one polished hero cat, one reusable human family, one clear graphics preset, and one coherent UI pass.

## 4. Open decisions for operator

1. Confirm Clear Retro as the new default and current pixel mode as optional.
2. Confirm whether the official-style wordmark may be an original traced-by-eye vector treatment, subject to brand permission.
3. Choose desktop/mobile performance targets and the exact release channel.
