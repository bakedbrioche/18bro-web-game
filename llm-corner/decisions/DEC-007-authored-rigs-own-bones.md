# DEC-007 — Authored rigs exclusively own their bones

**Status:** Accepted
**Date:** 2026-09-24

## Context

The first Refreshed adapter played imported idle/run clips and then multiplied procedural rotations into the imported bones. Constant animation samples were not re-applied by Three.js after those external writes, so rotations accumulated. The visible result was twitching, broken limbs at game over, and old-model poses appearing during jumps, slides and customization. Police, cashier and crowds were only the Original meshes with smoother materials.

## Decision

- A Three.js `AnimationMixer` is the only code allowed to write imported rig bones.
- Gameplay and choreography own world position and yaw. Capture may apply an explicit whole-root fall transform; it never mutates imported bones.
- The hero ships complete authored clips for idle, run, walk, jump, fall, slide, stumble, ride, jetpack, snack, celebrate, caught and carry.
- A separate authored human GLB supplies police, cashier, rider and pedestrian role meshes plus their complete clips. Refreshed loads the cat and human templates atomically.
- Hats, packet, jetpack and shield attach to the active authored rig or its root. Cosmetic changes never select the Original visual family.
- Original remains a saved user choice and the safe asset-load fallback.

## Consequences

Animation changes can cross-fade without bone drift, and a fixed sampled pose remains stable across repeated frames. Human pools retain their existing bounded world controllers while each visible Refreshed actor owns an independent cloned skeleton. New imported animations must key every deform bone, begin at time zero, remain in place and pass clip-to-idle reset tests.
