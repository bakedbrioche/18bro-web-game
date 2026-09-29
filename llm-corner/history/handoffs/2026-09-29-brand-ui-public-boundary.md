# 2026-09-29 - Brand UI polish and public runtime boundary

Branch: `feature/graphics-v2-pivot`
State: verified release candidate; commit, push and production deployment authorized.

## Changed

- Removed the ambiguous crescent footer control; Settings SFX and the `M` shortcut remain.
- Split the 18Bro wordmark into responsive individually animated glyphs using the smooth BUSTED wave, with static Reduced Motion behavior.
- Left-aligned Settings titles/descriptions and added a reusable accessible white/orange cat-tail tooltip to Models.
- Added a transparent generated ridged-chip HUD icon and one queued bounce for every collected chip value.
- Rebuilt the authored cap atlas with transparent background pixels so the cream crown is the only white backing and no rectangular decal edge appears.
- Extended the render-ready splash exit to a soft 1.05-second fade/lift/blur.
- Restricted public Nginx delivery to GET/HEAD, rejected ordinary asset navigation and cross-site hotlinks, added same-origin/noindex/CSP headers, removed raw-IP routing and made the game container read-only with tmpfs runtime directories.
- Defined the browser `dist/` tree as public runtime data and all source, secrets, management data and future admin APIs as a separate private boundary.

## Security facts

A public WebGL game cannot make downloaded runtime assets confidential. Normal browser navigation to a known asset now returns 404, but a custom client can still request data needed by a public player. Never place confidential art/source/configuration in `dist/`.

The 2026-09-29 external VPS audit found 22/80/443 reachable; 2377/7946/3000 were not externally reachable. Only Traefik publishes web ports. Unattended upgrades are enabled, Fail2Ban is inactive, and UFW/effective sshd policy could not be read by the restricted deploy account. Verify those controls from a root session before changing firewall or SSH access.

## Preserve

- UI image generation and cleanup provenance lives in ignored `tmp/imagegen/2026-09-29/ui-brand-polish/`; reviewed runtime PNGs live under `dist/assets/icons/`.
- The hero local manifest, aggregate art manifest and runtime model manifest must share exact GLB hash, size, triangle count and design revision.
- Direct-navigation/hotlink rules are abuse friction, never asset authentication.
- Do not put BasicAuth over the globally public game. Put future admin hosts behind VPN/OIDC/IP policy and authenticate machine APIs with scoped short-lived credentials or mTLS.
- Stop every local game/browser process after testing.

## Validation

- `npm run verify`: 194 tests, strict hero/human/power-up/chip validators and 12,477,823-byte standalone export.
- Production Docker image: read-only filesystem starts; page/health/same-origin image return 200; direct browser navigation and cross-site image requests return 404; POST returns 405; CSP/CORP/noindex headers are present.
- Software-WebGL Chrome: desktop 1440×900 and phone 390×844, render-ready loading, menu, Models tooltip, start, pause and resume passed with zero console errors, failed requests or viewport overflow.
- Chrome, Node server and Docker smoke container stopped; test ports confirmed clear.
