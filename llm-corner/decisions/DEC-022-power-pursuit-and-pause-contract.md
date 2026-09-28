# DEC-022 - Keep pursuit outcomes and transient feedback on the gameplay clock

Date: 2026-09-28
Status: ACCEPTED

## Context

Mobility powers could start while the two-officer net pursuit remained active, a net strike bypassed the Shield collision contract, and browser pause stopped simulation while transient pickup/reward clocks and CSS animations continued. Refreshed police also sampled the deliberate Original 12 fps clock even though the Refreshed hero mixer advances every rendered frame. Power pickups used colored geometry but lacked the subtle camera-facing halo already established for chips.

## Decision

Treat Moped and Jetpack acquisition during an active, uncaught net pursuit as an immediate successful escape. Finish the existing deterministic pursuit controller once, retain its duration/attempt/difficulty reward calculation, record the mobility reason, schedule the next pursuit normally, and push the ordinary chase officers back.

Pass Shield state into the DOM-free pursuit controller at the strike boundary. A connecting shielded net emits a blocked-attempt event, consumes exactly one ordinary Shield charge through the same simulation helper as an obstacle, enters recovery, and never begins capture.

Transient in-run feedback uses gameplay presentation time. While paused, pickup cards, pursuit reward cards, score additions, banners, toasts and their CSS animations retain their current frame and remaining lifetime. Resume continues them rather than restarting or dismissing them.

Reuse one radial billboard texture for chips and per-type tinted power halos. Refreshed humans sample continuous render time to match the Refreshed hero mixer; Original characters retain the intentional 12 fps stepping.

## Consequences

The simulation remains DOM-free and deterministic, mobility escape rewards cannot double-award, and Shield/net behavior is covered at the controller boundary. Pause does not change score, popup state or feedback timing. Booster glow adds no rotating geometry, and shared sprite materials keep the entity pool bounded. Original and Refreshed preserve their distinct animation presentation.
