# DEC-023 - Preserve pursuit world pressure and version power-up identity

Date: 2026-09-28
Status: ACCEPTED

## Context

The net-pursuit safety adapter repeatedly deactivated nearby hazards in one lane and rewrote future encounter patterns while police were present. Players saw cars and barriers disappear exactly when the chase was meant to become more demanding. Pause already froze transient feedback clocks, but reward cards, pickup cards and developer visuals used higher stacking layers than the pause modal. The authored Magnet and Moon Boots also retained revision-4 shapes that no longer matched the requested red/blue Magnet and sneaker direction, while Original still carried even older procedural equipment.

## Decision

An active pursuit never grants permission to remove an existing world entity or mutate the ordinary obstacle/car pattern. Pursuit safety metadata remains a deterministic telegraph contract, but the player solves the combined net and road pressure through normal movement, Shield, Moped or Jetpack. Any future despawn rule must name its trigger and lifecycle explicitly.

The pause panel is the top interactive in-game layer. Transient pickup, reward, score, toast and debug visuals keep their paused frame and remaining lifetime underneath it, then continue after resume.

Record the Magnet and Moon Boots redesign as power-up asset revision 5. One reproducible Blender geometry module owns the Refreshed pickup and wearable meshes; validated metadata fixes the Magnet to blue-left/red-right halves, two aligned gray ends, one gold zap and no side zaps, and fixes Moon Boots to wingless layered mid-top sneakers with contained green-left/red-right heel arrows. Original procedural equipment mirrors the same identity so changing model families cannot restore obsolete equipment.

## Consequences

Police pursuits retain the same bounded entity pool and deterministic spawn stream as ordinary play, but no longer become artificially empty near the cat. Pause has an unambiguous visual owner without discarding feedback. The power-up GLB, icons, manifests, fallback geometry and tests advance together; the five visually unchanged booster icons remain byte-stable rather than entering the commit as encoding-only churn.
