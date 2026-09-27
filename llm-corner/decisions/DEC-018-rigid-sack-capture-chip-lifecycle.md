# DEC-018 - Payload-socket capture, billboard chip glow and pursuit rewards

Date: 2026-09-27
Status: ACCEPTED
Supersedes: DEC-017's stretched net targeting and indefinite completed-capture presentation; DEC-010's immediate Jetpack-route deletion

## Context

The hand-attached pursuit removed competing animation owners, but the renderer still forced an undersized net toward 18Bro. The one-unit hoop could not contain the roughly 1.30-unit head, the 0.98-unit sack could not contain the roughly 1.86-unit hero, and a world-down cat offset diverged from the sack whenever the prop rotated. The escort mixed an aim arm with a shoulder prop, placing the pole across his face. A user-supplied four-panel GPT Image reference established the desired sequence: raised chase, planted catch, vertical lift, then a shoulder carry while both officers leave.

The modeled chips used rotating geometric aura rings. From the gameplay camera those rings became large hard-edged shapes instead of the subtle glow requested. Pursuit success always awarded the same score and message. The project also needed a legible browser-tab mark.

## Decision

Keep each police net at one fixed scale and size it from the runtime hero envelope. The hoop radius is 0.76, the sack depth is 2.10, and a named `catch_net_payload_root` sits 1.96 units below the hoop. Local +Y follows the rigid shaft while local -Z is projected onto world down. 18Bro follows the payload socket position, remains upright with at most a six-degree swing, and never controls the prop scale.

Capture uses four explicit presentation stages:

1. chase locomotion continues while the acting hand raises the open net;
2. the catcher plants and closes the sack around 18Bro;
3. the hand and hoop lift while the bag remains vertical, with the turn delayed until 65% of the lift;
4. the carrier uses one shoulder-carry animation owner while the cat trails behind. The escort transfers his empty net to the outer hand and stows it outside all faces and the payload silhouette.

Both guards move at one pace during the bounded 3.25-second result-screen exit and then hide with 18Bro. Reset restores both model families and their default prop attachments.

Jetpack computes its reveal budget from remaining cruise time, base speed and only the overlap remaining on Speed Burst. Descent reveals no new route chips while visible chips remain collectible. Landing retires leftovers and resumes an ordinary grounded run.

Every chip keeps the shared tiny-to-1.24x entrance and 1.23x-to-zero retirement. Its aura is one procedural radial-gradient `THREE.Sprite`: camera-facing, non-spinning, linearly filtered and softly additive. Reduced Motion skips the bounce and pulse.

Successful net escapes use a deterministic reward based on chase seconds, attempts resolved and capped distance difficulty, rounded to 250 with a 10,000-point floor. Four themed tags rotate without immediate repeats. The code-rendered orange/green card and score addition use staged overshoot animation, with static Reduced Motion fallbacks.

The browser favicon is a generated 128x128 PNG with a flat chase silhouette. The full prompt and sources remain in ignored `tmp/imagegen/2026-09-27/favicon-chase/`; the selected runtime PNG is tracked and embedded byte-for-byte by the standalone exporter.

## Consequences

Capture geometry can be tested against the real hero envelope, payload socket, world-down sack axis, fixed hand grip and bounded exit. The prop no longer stretches or fights the human mixer.

Chips retain their modeled silhouette from every camera angle while receiving a restrained glow. Pursuit escapes reward longer and harder play without introducing nondeterminism. The favicon works in both modular and standalone releases without a network dependency.
