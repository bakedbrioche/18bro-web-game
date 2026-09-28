# 2026-09-29 - Fair routes, full-viewport loading and live TLS

Branch: `feature/graphics-v2-pivot`
State: verified release candidate; commit, push, and production deployment authorized.

## Changed

- A normal or Moon Boots jump at the net strike boundary now dodges the net.
- Pursuit and Jetpack landing safety reserve future generated lanes and never delete visible hazards.
- Ordinary ground chips, cars and obstacles continue during Jetpack. Ground chips cannot be collected in the air, and the planned landing reconnects to a reachable street lane.
- Obstacle-row chip trails remain on their computed safe lane; power pickups defer out of chip/hazard rows.
- Power selection excludes both of the two previously spawned kinds.
- Refreshed is the default model family while explicit Original saves remain valid.
- The user-supplied cap mark is one curved runtime decal and one embedded authored-atlas decal, with source/hash/rights notes under `art/references/`.
- Desktop and mobile now use a borderless `100dvh` game surface. Mobile keeps direct swipes and removes duplicate direction buttons; Personal Best moved to Records; fullscreen and unused theme controls are absent.
- A safe-area-aware first-load overlay uses a 512-pixel peeking-18Bro asset, rotates Sticker-style copy, and leaves only after textures, Refreshed GLBs, and a rendered frame are ready.

## Operations

- `https://18bro.site/game/` and `/game/healthz` have a valid Traefik/Let's Encrypt certificate.
- Dokploy is available with valid HTTPS at `https://dokploy.18bro.site/`; the `sslip.io` URL remains an emergency fallback.
- `dokploy A 31.97.47.189` is live. Raise its TTL from the cutover value to 14400 after the validation window.
- Existing `18bro` and `traefik-edge` stacks are visible under Dokploy's Docker page because they are external Compose projects. A later controlled migration is required before Dokploy may own deployments.

## Preserve

- Existing hazards are immutable encounter facts; safety changes future rows or net targeting.
- Airborne Jetpack collection accepts only `flightTrail` chips.
- A scheduled power row must not overlap a chip section or same-lane hazard.
- Keep explicit saved model choices and Refreshed load-failure fallback.
- Do not create a second Dokploy-owned game while GitHub Actions still controls `/opt/18bro`.

## Validation

- `npm run verify`: 187/187 tests, strict character/power-up validators and 11,930,248-byte standalone export.
- Software-WebGL Chrome: desktop 1440×900, phone 390×844, compact landscape 844×390, menu → run → pause/resume, and slow-network boot readiness all passed with zero console/request/WebGL errors.
- Test server and isolated Chrome/debug profile stopped; ports 4173 and 9223 confirmed clear.
