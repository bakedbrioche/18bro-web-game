# Audit gate

## Before every commit

```sh
npm run verify
git diff --check
```

`npm run verify` runs the full Node test suite and builds the standalone release into ignored `release/`. It proves simulation/tests and export wiring. It does not judge the rendered result.

For changes to `dist/app.mjs`, `dist/scene.mjs`, `dist/district-scene.mjs`, `dist/style.css`, `dist/index.html`, controls, audio, or assets:

1. Run `npm start`.
2. Load `http://localhost:4173/` in a WebGL browser with no console/page/request errors.
3. Verify the menu, start or skip the intro, confirm score/distance advances, pause, and resume.
4. Use `dist/preview.html` for deterministic character/route comparisons.
5. Check mobile sizing/touch when the change can affect them.

## Safety review

- No conflict markers, secrets, `.env`, `node_modules/`, or `release/` paths staged.
- No hand-edited generated standalone HTML.
- New assets have provenance and licensing notes.
- Changed save data has migration/normalization coverage.
- Changed gameplay preserves input parity and long-run pool bounds.

If a check fails, fix the root cause and rerun the full gate.
