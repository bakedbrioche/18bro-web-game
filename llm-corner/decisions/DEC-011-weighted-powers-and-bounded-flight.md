# DEC-011 — Bound flight to airtime and weight power-up pacing

Date: 2026-09-26
Status: ACCEPTED
Supersedes: DEC-010 where it ties Jetpack completion to the final chip and uses a uniform shuffled power bag; DEC-009 where Shield absorbs one hit

## Context

A Jetpack route could outlive the visible flight, especially when Speed Burst changed travel timing, leaving route chips after landing and occasionally carrying buffered vertical state into a super-jump. Uniform seven-item bags also made powerful effects predictable and as common as utility pickups. Shield presentation and gameplay disagreed with the requested three-life design.

Public Subway Surfers references describe random on-track powers, Jetpack-only airborne coin rows, a landing at the end of the flight, and ground coins remaining outside airborne magnet collection, but they do not publish numeric spawn weights. Our distribution therefore needs to be explicit project balancing rather than an alleged copy of unpublished values.

## Decision

- Jetpack has one fixed ten-second lifecycle. Its planned route reveals a rolling window of six to eight chips only after lift-off; every route chip stays above ground. Existing ordinary chips are removed at activation, ordinary chip rows are suppressed during flight, and Magnet cannot pull ground chips while airborne.
- Expiry clears every outstanding flight-route chip and all vertical, roof, slide and buffered-jump state before returning directly to run. Speed Burst cannot extend Jetpack.
- Shield lasts ten seconds and starts with exactly three charges. Every protected collision consumes one charge and emits the remaining count. The third collision depletes the power. Rendering shows the same count as three four-toe paw shields on a clockwise equatorial stripe.
- Eligible power rows occur every eight encounter rows at offset three. Weighted selection is `magnet 30`, `moon 24`, `speedburst 16`, `doublechips 13`, `moped 8`, `shield 5`, `jetpack 4`. The previous kind is excluded from the next draw, so immediate repeats remain impossible.
- The constants are exported from the DOM-free simulation and covered by deterministic distribution, lifecycle and stacking tests.

## Consequences

Power-ups are less frequent, common utility effects still appear often, and the two strongest protection/flight effects are rare. Excluding the previous result slightly changes the realized percentages from their raw weights; ordering and rarity remain stable. Old saves need no migration because the table, charges and flight route exist only in an active run.
