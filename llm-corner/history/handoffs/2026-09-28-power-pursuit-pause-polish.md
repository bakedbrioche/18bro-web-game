# 2026-09-28 - Power, pursuit and pause polish

Author: Codex
Branch: feature/graphics-v2-pivot
Commit: feat: align pursuits powers and pause feedback

## State of the world

Moped or Jetpack acquisition now ends an active net pursuit as a scored escape through the existing deterministic reward formula. A net that connects while Three-Paw Guard is active consumes one of its three charges and returns the pursuit to recovery. Popup clocks and animations freeze while the game is paused and resume from the same frame.

All seven booster pickups now carry a subtle camera-facing halo tinted to their identity. Refreshed guards use continuous animation sampling like the Refreshed cat; Original retains deliberate 12 fps stepping. The previously reviewed packet, surprise expression, cap badge and sleepy favicon corrections are included in the same authorized closeout.

## Shipped

- One-shot Moped/Jetpack pursuit escape with reasoned reward events and normal rescheduling.
- Shielded net blocks with shared charge consumption and no capture transition.
- Pause-safe pickup, reward, score-addition, banner and toast lifetimes plus frozen CSS animation state.
- Shared radial sprite texture for gold chips and seven color-coded booster halos.
- Continuous Refreshed human cadence with Original cadence preserved.
- Closed manifold chip packet, measured existing-eye surprise, shallow seven/ELEVEN cap badge and calm peeking favicon.

## Landmines for the next session

- Do not award mobility escape outside the pursuit controller; the controller owns the one success event.
- Resolve Shield at the strike boundary. Starting capture and trying to undo it later breaks animation and state ownership.
- Do not decrement transient UI clocks or advance their CSS animations while `game.state === 'PAUSED'`.
- Booster halos are sprites that share one radial texture. Avoid per-frame material allocation.
- `release/` browser evidence and `tmp/` reference sources remain ignored.

## Verification record

- Full Node suite: 170/170 tests passed.
- All character, power-up and 60-frame chip assets validated.
- Standalone export succeeded.
- Real Chrome: menu to Refreshed run, pickup popup pause/resume, eligible-pursuit Moped escape reward and Shield halo rendering passed with no console, page or request errors.
