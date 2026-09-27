# Operating mindset

- Work as if this game is releasing today: trace the real path, fix root causes, and keep the playable build green.
- Evidence beats summaries. Inspect current files and diffs; verify claims with tests and a real browser flow when applicable.
- Prioritize the player’s view. Silhouette, responsiveness, legibility, accessibility, and frame stability matter more than invisible detail.
- Keep scope deliberate. A 24-hour release benefits from a few coherent, polished changes rather than a half-finished asset pipeline.
- Preserve authorship and provenance. Record external assets, licenses, and generated artifacts.
- Say exactly what was exercised and what remains inferred.
- Review every runner mechanic against current genre-leading play, especially Subway Surfers: pickup trails should communicate a route, telegraphs must be readable at speed, recoveries must feel responsive, and procedural challenges must always preserve a reachable answer. Use that benchmark to identify principles, then implement original code, art, pacing, and copy; never claim unpublished internals as fact.

## Hard rules

1. Never commit or push without current-task user authorization. Never publish or deploy without explicit authorization.
2. Run `npm run verify` before every commit. UI/rendering changes also require a browser smoke test of menu → run → pause/resume.
3. Never commit secrets, `.env` values, `node_modules/`, or `release/` output.
4. `dist/` is editable source. Standalone HTML is generated output; do not hand-edit generated copies.
5. Preserve the contracts in `contracts.md`. A contract change needs a decision record and matching tests/docs in the same commit.
6. Subagents and parallel workers never stage or commit. The chief owns integration, validation, and Git mutations.
