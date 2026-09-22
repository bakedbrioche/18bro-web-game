# Gotchas

- Python’s simple server may send `.mjs` as `text/plain` on this Windows setup. Chrome then displays the HTML menu but refuses to run the game modules. Use `npm start`, which runs `server.mjs` with `text/javascript` MIME types.
- Do not open `dist/index.html` directly. ES modules and media need an HTTP origin.
- The current `retro` renderer uses a total `320 × 240` pixel budget adjusted to aspect ratio. At 16:9 this is about 370 × 208 before nearest-neighbor enlargement, so distant geometry loses detail. See the draft visual-refresh plan before judging model quality solely from gameplay screenshots.
- `dist/app.mjs` currently migrates the old `sharp` quality setting to `retro`; the settings UI exposes only `retro` and `low`.
- `release/` is ignored generated output. The checked-in root standalone HTML is a release snapshot and can drift unless deliberately regenerated during release preparation.
- Browser progress lives in `localStorage` under `18bro.save.v1`; clearing site data resets it.
- `dist/preview.html` is the repeatable review surface for opening/capture animation and route distance/traffic state.
