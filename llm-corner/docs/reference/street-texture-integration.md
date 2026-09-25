# Street texture-pack integration

This guide is the handoff boundary for a contributor bringing new street texture packs onto `feature/graphics-v2-pivot`.

## Start from the shared branch

1. Commit or stash your texture work in your own checkout.
2. Fetch `origin` and create your working branch from `origin/feature/graphics-v2-pivot`.
3. Bring the texture commit onto that branch with a normal merge or cherry-pick. Do not overwrite `dist/scene.mjs`, `dist/core.mjs`, the generated GLBs or model manifests with versions from `main`; the graphics-v2 branch contains the new model/power runtime contracts.
4. Resolve any material conflicts around the current files rather than accepting one side wholesale.

## Ownership boundary

- Put source texture images in `dist/assets/textures/` and record their origin and permission in `docs/textures.md` and `art/manifest.json` when applicable.
- Define loading, color space, wrapping, mipmaps and filtering in `dist/material-assets.mjs`.
- Use the loaded materials from `dist/scene.mjs` for the market/store chunks and from `dist/district-scene.mjs` for streamed commercial, intersection or neon districts.
- Keep simulation and collision in `dist/core.mjs` unchanged unless the texture pack truly changes physical layout.
- Do not hand-edit `release/18Bro-Snack-Heist.html`; `npm run export` regenerates the standalone and embeds every referenced local texture.

## Graphics-mode expectations

Test every pack in Settings under **Clear Retro**, **Classic Pixel** and **Coarser**. Clear Retro is the readable default and must preserve distant road markings and storefront silhouettes. Classic Pixel may quantize the picture but should not require a separate texture asset. Avoid baking display-scale pixels or blur into source images; the renderer owns resolution treatment.

Keep texture dimensions modest and power-of-two where practical. Use mipmaps for surfaces viewed at distance. Road and pavement textures must tile without a bright seam and must not create high-contrast false obstacles in the running lane.

## Required checks

1. Run `npm run verify`.
2. Start `npm start` and exercise menu → opening → run → pause/resume in a browser.
3. Review the first market, commercial street, intersection and neon district in Clear Retro and Classic Pixel. Developer Tools route shortcuts can jump to each area; practice mode does not bank progress.
4. Confirm the standalone export opens offline and contains the new textures.
5. Record representative screenshots, the texture source/provenance and any material tradeoff in the handoff.

When the texture work is ready, open a PR from the contributor branch into `feature/graphics-v2-pivot`. Complete the combined visual review there, then merge that contributor PR and push the updated `feature/graphics-v2-pivot`; the push updates the existing graphics-v2 PR into `main`. Keep the main-targeting graphics-v2 PR unmerged until the final release review is complete.
