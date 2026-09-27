# DEC-016 - Use one spaced chip trail and an attached readable net capture

**Date:** 2026-09-27
**Status:** ACCEPTED
**Refines:** DEC-015 pickup cadence and net presentation

## Context

The simultaneous three-lane 5–8-chip formations accepted in DEC-015 filled the road with overlapping gold silhouettes and removed route-reading decisions. The net warning also resolved too quickly during live play, while the caught prop could appear detached because capture switched from the officer's hand-held net to a separate world-space model.

## Decision

- Schedule one deterministic non-crossing chip trail every 55–80 metres. Each section uses the existing weighted 3–6-chip straight, lateral or weave planner; a jump row uses its five-chip arc as the section instead of stacking another line.
- Keep Jetpack as the exclusive chip planner while airborne and retain bounded pooled metadata for each section.
- Scale each police-net telegraph from five seconds early in a run to three seconds at capped difficulty. Its flicker accelerates within that same window.
- Keep the selected officer's net attached to the hand/socket for the whole strike and capture. The guard catches, lifts, turns, rests the stick at the shoulder and retreats backward while the hoop carries the cat.
- Allow Enter to skip the opening only during its first 1.5 seconds. Later presses leave the cutscene running to completion.

## Consequences

Chip rewards remain frequent enough to guide play without covering every lane or crossing another trail. Net attacks provide a readable reaction window at every difficulty. Capture has one prop owner and therefore cannot drift independently of the guard. Tests cover deterministic spacing, non-overlap, warning bounds, attached ownership, stable capture transforms and the cutscene lock.
