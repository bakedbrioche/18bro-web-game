# DEC-009 — Visible power identity and complete sky routes

**Status:** Accepted
**Date:** 2026-09-25

This decision supersedes DEC-008 only where that record describes Moon Boots and incremental Jetpack trail scheduling.

## Context

Moon Boots and the chip magnet existed only as timers after pickup, Moon Boots mixed jumping with unrelated speed and score effects, and Jetpack generated chips close to the player instead of revealing a route through the sky. The shield used white particles that read as smoke rather than protection. These gaps made pickups hard to read and weakened the connection between the prop, the cat and the gameplay effect.

## Decision

- Active equipment remains visible on both model families. The magnet attaches to a paw; Moon Boots attach to both animated feet. Cosmetics continue to apply to the selected family independently.
- Moon Boots grant a dedicated high jump that clears the tallest current obstacle. They do not add speed, score or invulnerability.
- A separate blue `speedburst` pickup owns the temporary speed increase, its authored Blender prop, icon, aura, HUD card and timer.
- Jetpack creates its complete connected airborne chip route at activation. Its length is derived from the flight duration and current speed, and collecting the final route chip ends the flight. A short bounded timeout prevents missed chips from retaining flight forever.
- Jetpack tubes show layered flame, ring and particle thrust. The shield uses a translucent energy shell with flickering regions and a rotating orbit of nine paw-marked hearts; it does not emit an ambient white trail.
- Pickup roots and wearable nodes live together in the reproducible power-up GLB. Wearables are named independently so they are not counted or spawned as pickups.

## Consequences

The power-up asset contract expands to seven pickup roots and three attachment nodes. The deterministic player state records the gravity and apex selected when a jump begins, so an expiring Moon Boots timer cannot change an active arc. Existing saves need no migration because active powers and jump state are run-local. Original remains the procedural fallback while Refreshed uses Blender-authored wearables.
