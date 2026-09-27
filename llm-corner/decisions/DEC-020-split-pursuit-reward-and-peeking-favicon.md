# DEC-020 - Join supplied chase profiles for pursuit success and use a peeking favicon

Date: 2026-09-28
Status: ACCEPTED
Supersedes: DEC-018's code-rendered pursuit card and chase-scene favicon

## Context

The first pursuit-success card was a generic orange/green panel. The user supplied a chase illustration and a layout sketch asking for an old-game profile-banner entrance: guard on the left, running 18Bro on the right, no VS mark, then one achievement card. The first browser favicon showed the complete guard/cat chase but became visually busy at tab size.

## Decision

Crop the user-supplied chase artwork into two local 256 × 256 source panels. CSS places them behind diagonal masks, slides them together over the first 0.53 seconds, adds a dark readability overlay and a restrained achievement aura, then reveals the existing non-repeating reward line and deterministic score. Saved and operating-system Reduced Motion show the assembled card without entrance motion. The images are embedded through `globalThis.__18BRO_UI_IMAGES__`; no runtime request leaves the release.

Preserve the earlier banner CSS at `art/ui/archive/pursuit-reward-v1.css`. Keep the supplied chase image, four-panel capture collage and Figma-style layout sketch in the ignored dated workbench for future iteration.

Use a 128 × 128 orange favicon containing only 18Bro's peeking forehead, ears and cap. Preserve the previous full chase icon at `art/ui/archive/favicon-chase-v1.png`. The standalone exporter embeds the exact active favicon bytes.

## Consequences

Pursuit success reads as a character achievement while the reward algorithm and accessibility label stay unchanged. Both current UI assets and previous variants remain available, and standalone delivery remains offline and deterministic.
