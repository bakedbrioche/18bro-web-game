# DEC-027 - Give the runner the full viewport and gate it on render readiness

Date: 2026-09-29
Status: ACCEPTED

## Context

The cabinet frame, duplicate mobile direction buttons, persistent top-bar record, and browser fullscreen toggle reduced the usable play area and made the phone layout feel like a game embedded inside a page. The first Refreshed load could also expose the menu before its active textures and GLB family were ready.

## Decision

Use the browser viewport as the game surface on desktop and mobile. Keep keyboard controls on desktop and direct four-direction canvas swipes on touch devices; remove the duplicate mobile direction buttons and the fullscreen control. Overlay status, HUD, hints, audio and help within safe-area-aware game layers. Keep Personal Best in Records and center menu, dialog, setting and record labels.

Show a first-load overlay using a 512 × 512 derivative of the current peeking-18Bro favicon source. Rotate original snack-preparation copy in the 18Bro Sticker treatment and fade only after scene textures, the selected model family, and a rendered animation frame are ready. Preserve Reduced Motion and WebGL-failure behavior. The standalone exporter embeds the exact loading asset and module.

## Consequences

The game has more usable space and one touch-control vocabulary. There is no separate fullscreen button because play already occupies `100dvh`; browser chrome remains under browser/OS control. Every future responsive change must exercise desktop, portrait and compact landscape layouts, including safe-area insets. Model-loading changes must keep the boot readiness promise and playable Original fallback bounded.
