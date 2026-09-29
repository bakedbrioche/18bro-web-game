# DEC-029 - Keep brand motion responsive and contextual help reusable

Date: 2026-09-29
Status: ACCEPTED

## Context

The full-viewport layout exposed three presentation problems: the combined 18Bro wordmark could overlap on narrow phones, centered Settings descriptions were harder to scan, and generic symbol controls did not explain their purpose. The top-left chip count also used placeholder art unrelated to the in-world collectible.

## Decision

Build the main wordmark from five individually animated glyphs inside a container-query-sized flex line. Reuse the smooth BUSTED wave, preserve color identity and make Reduced Motion static. Left-align Settings row titles and descriptions while retaining centered dialog-level navigation and actions.

Use one accessible cat-tail question-mark tooltip component for contextual notes. It must expose its content through `aria-describedby`, keyboard focus and `aria-expanded`; hover/focus rotates the tail toward the right and changes white to orange. Use the same source as a CSS mask so color states do not require duplicate images.

Use a transparent static render of the real ridged chip for the HUD. Keep one image node and queue one bounded bounce for each collected chip value; pause freezes the motion and Reduced Motion disables it. Remove the ambiguous crescent footer control; Settings remains the visual SFX control and `M` remains the keyboard mute shortcut.

Let the first-load screen exit through a 1.05-second opacity, lift, scale and blur transition after render readiness. Its dismissal timer and CSS duration share one tested constant.

## Consequences

The responsive logo remains readable from compact phones through desktop without a special mobile wordmark. Settings copy follows a stable left edge. Future contextual help and generated UI art inherit one accessibility and provenance pattern. This decision overrides only DEC-027's instruction to center Settings labels; the full-viewport and render-readiness decisions remain active.
