# DEC-017 — Double chip cadence and give net capture one animation owner

Date: 2026-09-27
Status: ACCEPTED
Supersedes: the 55–80-metre cadence in DEC-016; all other DEC-016 constraints remain active

## Context

The first spaced-trail correction removed overlapping three-lane chip heaps, but one trail every 55–80 metres left long stretches without a reward decision. The police nets also remained visually unreliable: both props could read as inward-facing or crossed, the running mixer and procedural pursuit code competed for the selected arm, and the ordinary capture renderer wrote to the same guard and cat roots after the net renderer.

## Decision

Schedule one deterministic 3–6-chip trail every 28–36 metres. Preserve a single section scheduler, a single active trail, weighted straight/lateral/weave paths, unique route indices and jump-arc substitution. Debug seek derives its section index from the same cadence range so previewed routes match normal play.

Mirror the two nets to their inward hands and stable carry sockets. For Refreshed humans, derive left/right ready and aim clips from the chase clip: copy every non-selected-arm track unchanged and replace only the acting arm, hand and socket tracks. Blend ready to aim over the full 3–5-second telegraph so the legs keep the ordinary chase cadence while the net hand rises independently. Original humans receive the equivalent post-gait arm override.

While a net catch is active, the pursuit renderer exclusively owns the cat, acting guard and attached net transforms. The normal crash-capture renderer does not run for that event. The same attached prop performs strike, enclosure, lift, turn and shoulder carry. A completed caught snapshot remains in its final carry presentation until the result flow resets the scene.

## Consequences

Chip decisions occur more than twice as often without bringing back parallel heaps or crossing lanes. The maximum section spacing remains longer than a six-chip trail, so neighboring sections do not overlap.

The net animation has one owner per bone/root in each frame. Its mirrored attachment and mixer-owned arm layer remain compatible with Original and Refreshed families, reduced motion and the DOM-free pursuit snapshot.