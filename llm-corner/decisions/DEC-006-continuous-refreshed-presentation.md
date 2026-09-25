# DEC-006 — Keep Refreshed presentation continuous

**Status:** Superseded by DEC-007
**Date:** 2026-09-23

## Context

The first authored hero preview displayed Original whenever the active state lacked a dedicated imported clip or used a special hat. This caused obvious model popping during the store exit, slide, impact, vehicle, jetpack and capture sequences. It also made customization appear broken. Model selection did not visibly affect the rest of the character cast.

## Decision

- A successfully loaded Refreshed selection stays visible through every gameplay and choreography state.
- Imported clips animate matching idle/run states. The stable procedural controller supplies additive poses for the remaining states and remains authoritative for world position, collision and attachments.
- Every fur and hat remains in the selected model family. Special hats follow the authored hat socket.
- Police, clerk, riders and crowds switch with the hero, using their existing bounded articulated rigs and a shared smooth Refreshed material family.
- Original is used only when the player selects it or the authored asset fails to load.
- Picture and font choices remain independent saved settings. Clear Retro uses viewport-resolution rendering without vertex snapping; Classic Pixel and Coarser retain the pixel-heavy modes. The 18Bro Sticker text treatment uses licensed/system font fallbacks and original CSS styling rather than an unlicensed official font.

## Consequences

The visual family no longer changes during a run, and customization is consistent. Procedural controllers remain present but hidden for the hero because they still provide choreography and prop transforms. A future authored animation library can replace additive poses one action at a time without changing saves or gameplay.
