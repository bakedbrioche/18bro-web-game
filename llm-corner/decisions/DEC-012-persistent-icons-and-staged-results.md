# DEC-012 — Keep runtime icons persistent and stage run results

Date: 2026-09-26
Status: ACCEPTED

## Context

The HUD rebuilt its complete power list with `innerHTML` roughly ten times per second. That repeatedly destroyed and recreated image elements, so decoding could be aborted around pause/resume and both HUD and pickup-card art appeared broken. The result panel exposed every value at once, sat left of center, and used no authored chip image.

## Decision

- Active power cards are keyed persistent DOM nodes. Their PNG is assigned once, retained through pause/resume, and paired with a power-specific glyph fallback if loading fails. The pickup notice uses the same loader.
- The BUSTED card is centered. It reveals the stamp, copy/divider, Score, Personal Best, Distance and Chips Banked rows in order, counts numeric values from zero over three seconds, then reveals the final divider and controls.
- BUSTED uses separate character spans for an optional repeating wave. `RESULT_WAVE_ENABLED` is the single code switch. In-game Reduced Motion and the operating-system preference disable the wave and resolve the sequence immediately.
- The Chips Banked row uses `dist/assets/icons/chip.png`, rendered from original 3D saddle-chip geometry by `scripts/blender/create_chip_icon.py`. Its `.blend`, hash manifest and validator are tracked. The standalone exporter embeds non-power-up UI PNGs in `globalThis.__18BRO_UI_IMAGES__`.
- Enter during the sequence completes the reveal first; it cannot start another run before the controls appear.

## Consequences

Pause/resume no longer churns image decoders, the result sequence remains keyboard accessible, and the modular and standalone builds display the same authored chip render. Result timing tests use the constants rather than waiting in real time.
