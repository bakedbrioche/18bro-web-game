# 2026-09-28 - Final pursuit and heist presentation

Author: Codex
Branch: feature/graphics-v2-pivot
Commit/PR: included in this handoff's branch commit; draft PR #1 remains unmerged.

## State of the world

The opening heist now uses one rounded, sealed chip packet and animates the existing face data for both model families. Original changes its existing eye, pupil, eyelid, brow and mouth objects. Refreshed deforms its existing palette face and two eyelid components, then restores immutable positions exactly. The cap carries a small orange/red/green seven-inspired mark.

Police net capture presents one acting prop. Its open square lattice becomes one fixed-scale tapered sack around the dedicated hero payload socket. The planted catch lifts vertically, then derives the carry pole through the selected guard's shoulder anchor. The escort stays visually clear and both officers finish a bounded exit.

A successful pursuit escape now assembles two diagonal character panels from the supplied chase art, adds a dark readability layer and restrained achievement aura, and reveals one of four non-repeating reward lines plus the deterministic scaled bonus. Reduced Motion receives the assembled static card.

The active browser icon is `dist/assets/icons/favicon.png`: an orange peeking-18Bro forehead, ears and cap. The previous chase icon is preserved at `art/ui/archive/favicon-chase-v1.png`; the previous code-rendered reward card is preserved at `art/ui/archive/pursuit-reward-v1.css`. Source references and full generation outputs remain in the ignored dated `tmp/imagegen/` workbench.

## Shipped

- Shoulder-contact, single-owner net carry and bounded two-guard exit.
- Existing-geometry surprise expression with exact reset and no duplicate eye mesh.
- One volumetric sealed packet with modeled crimps and two CHIPS panels.
- Geometry-only seven-inspired cap mark for Original and Refreshed.
- Split pursuit-success banner, four reward lines, aura and Reduced Motion fallback.
- Peeking-18Bro favicon plus tracked archives of both replaced presentation assets.
- Exact standalone embedding and provenance/decision documentation.

## Open or deferred

- Draft PR #1 stays open for the colleague's street-texture integration and joint visual review.
- The active graphics plan still has localization, final release channel and analytics IDs/copy as operator decisions.

## Landmines for the next session

- Do not add panic overlay meshes. Preserve the stored Original transforms and Refreshed face/eyelid vertex arrays.
- Keep the capture net at fixed scale. Move 18Bro through `catch_net_payload_root` and derive carry orientation through the real shoulder anchor.
- Keep the escort free of a second full-size net during capture presentation.
- Reward crops and the active favicon are runtime assets embedded by the exporter; archived variants are reference-only.
- Generated `release/` and `tmp/` files remain ignored.

## Verification record

- Focused model/heist and UI/export suites passed during implementation.
- Real Chrome Refreshed flows covered the opening surprise/packet/cap, net aim/catch/lift/shoulder carry/bounded exit, and pursuit-success card without console, page or request errors.
- `npm run verify`: 163/163 tests passed; cat, human, power-up and 60-frame chip assets validated; standalone export succeeded at 11,617,163 bytes.
- Final staged-diff audit passed with generated `release/` and ignored `tmp/` evidence excluded.
