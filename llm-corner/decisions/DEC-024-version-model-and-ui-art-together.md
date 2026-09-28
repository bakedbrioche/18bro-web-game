# DEC-024 - Treat power-up geometry and rendered UI art as one versioned asset

Date: 2026-09-28
Status: ACCEPTED

## Context

The revision-5 Magnet technically used the requested colors, but its joined block-like profile did not read as a horseshoe in the pickup or rear gameplay view. The wearable also inherited the pickup's gold zap even though the zap belongs only to the world pickup. Reusing the same PNG URL let a browser briefly show a generic fallback while the revised image decoded. The cap identity had a separate structural defect: non-planar colored n-gons crossed the curved crown during Blender triangulation, producing clipped shards and a detached-looking mark in oblique views.

## Decision

Advance the authored power-up asset to revision 6. Build both Magnet roots from sampled analytic U curves with rounded elliptical cross-sections, blue on the player's left, red on the right, and symmetric neutral-gray poles. Keep one substantial gold zap on `powerup_magnet`; `wearable_magnet` has no zap geometry. Preserve the lower-bridge carry-socket pivot and mirror the same identity in the Original fallback.

Treat a pickup model and its rendered UI image as one deliverable. A model revision must regenerate its 256 px transparent render, update hash/byte metadata, pass the asset validator, embed the exact PNG in the standalone export, and be inspected in the live pickup popup plus persistent sidebar. Runtime preloads all seven authored renders and versions modular icon URLs so a newly revised asset cannot expose a stale cache entry or loading glyph during normal play.

Use the cap's existing cream crown as the only backing. The mascot mark is six shallow surface-projected colored elements: one orange lozenge, one curved red 7, three green marks, and one centered red lower mark. Authored geometry uses explicit front-wound triangles on the curved surface; Original uses the same geometric arrangement. Neither model adds a white badge or text mesh.

## Consequences

Pickup and held Magnet silhouettes now communicate the same power while retaining their different zap rules. UI renders cannot be accepted independently from their source models. The cap mark remains readable in front, three-quarter, side, and gameplay views without floating geometry. Revision 6 increases the power-up GLB to 12,971 triangles and 583,788 bytes, while the hero remains inside its strict budget at 3,982 triangles and 883,316 bytes.