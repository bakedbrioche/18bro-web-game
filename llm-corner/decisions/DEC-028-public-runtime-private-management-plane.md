# DEC-028 - Keep the browser runtime public and isolate the management plane

Date: 2026-09-29
Status: ACCEPTED

## Context

18Bro is intended for unrestricted public play. A browser must download its JavaScript, GLB models, textures, fonts, audio and UI images before it can render the game. A player can therefore recover every shipped byte from browser developer tools or cache, even when direct address-bar navigation, directory listing, CORS, Fetch Metadata, referrer checks, robots rules, filename hashing or obfuscation are used.

The server also contains private operational material that must never share that exposure: source art, Blender files, repository history, environment files, keys, Dokploy data, Traefik state and future administrative APIs.

## Decision

Treat the contents of the shipped `dist/` browser runtime as public and treat everything outside that minimal runtime as private. The production image copies only `dist/` and the reviewed Nginx configuration. It accepts only GET and HEAD, has no directory listing, rejects dotfiles, emits a same-origin resource policy and restrictive CSP, marks assets noindex, and returns 404 for ordinary top-level asset navigation and cross-site browser hotlinks. Those last checks are convenience and abuse controls; they are not authentication and must never be described as confidentiality.

Keep the game container private behind the exact `18bro.site` Traefik host and `/game` path. Run its filesystem read-only with isolated temporary Nginx directories, no host port and a PID cap. Keep deployment credentials in GitHub secrets, pin the SSH host key and deploy immutable image tags.

Keep management access separate from public play. Human administration should move behind Tailscale, a fixed administrator-IP allowlist, or Cloudflare Access/OIDC. Machine-to-machine endpoints must authenticate every request with short-lived scoped tokens or mTLS. A BasicAuth guard is suitable for a private preview or admin route, but placing it over `/game/**` would make the game private and still would not stop an authenticated player from saving downloaded assets.

## Consequences

- Public release remains frictionless, and same-origin runtime loading continues to work.
- Directly opening a known asset in a normal modern browser is discouraged, but a custom client can still request public runtime files. This is expected, not a security defect.
- Confidential or high-value source must remain outside `dist/`; changing a filename or bundling it does not make it private.
- Future admin/API services require their own route, identity, authorization and audit design before exposure.
- Hiding the VPS origin itself requires a trusted edge such as Cloudflare proxy or an outbound Cloudflare Tunnel plus an origin firewall; exact Host routing alone is not identity.
