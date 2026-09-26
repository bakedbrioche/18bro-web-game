# DEC-013 - Readable chip routes and stable vertical camera tracking

**Date:** 2026-09-26
**Status:** ACCEPTED

## Context

Ordinary street rewards repeatedly appeared as four chips in one lane, so broad streets felt mechanical even when hazards varied. Moon Boots crossed a height threshold that changed camera pitch at the jump apex. The active Magnet remained low beside the body, Shield charge marks were too small and vanished abruptly, and the BUSTED wave moved one glyph at a time.

## Decision

- Ordinary ground rewards use deterministic seeded sequences of three to six chips. Length weights are `3:1, 4:3, 5:3, 6:1`; straight, lateral and three-lane weave patterns alternate without repeating the same pattern/start-lane pair immediately. Obstacle rows cross the known safe lane at their central chips, and spacing remains reachable at current speed.
- Three-Paw Guard lasts fifteen seconds and retains three charges. Its large four-toe badges sit 120 degrees apart, orbit once every three seconds, and shatter/fade when consumed.
- Active Magnet presentation raises one real arm about 40 degrees and keeps the U upright at its lower bridge. Original uses its ordinary pose reset; Refreshed uses cached AnimationMixer variants that replace only the left arm-chain quaternion tracks. Runtime effect code never writes imported bones.
- Moon Boots and Jetpack lift camera position and look target by the same amount. Their viewing pitch therefore stays constant through vertical travel. Ordinary jumps keep the smaller existing camera response.
- The BUSTED word uses overlapping adjacent-glyph scaling across an approximately 1.6-second sweep. The Blender-rendered result chip spins with CSS transforms. Saved and operating-system reduced-motion preferences disable both loops.

## Consequences

Routes remain reproducible and safe while looking less predictable. The extra held-animation actions are created once per loaded hero and released with its mixer. Shield shards add a small bounded geometry/material cost per hero. Visual changes require real-browser review in addition to deterministic tests.
