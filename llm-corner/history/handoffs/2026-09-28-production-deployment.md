# Production deployment handoff

Date: 2026-09-28
Branch: `feature/graphics-v2-pivot`
Production image commit: `ff59f02`
Successful GitHub Actions run: `36471698137`

## Shipped

- A minimal Nginx image serves the editable `dist/` application and exposes `/healthz`.
- GitHub Actions runs `npm run verify`, publishes immutable SHA and `latest` images to GHCR, deploys over pinned-key SSH, and verifies the remote route.
- One shared Traefik v3.6 edge owns ports 80 and 443 on the VPS. The game container stays private on the external `proxy` network and is registered at `/game/`.
- The VPS uses a restricted `deploy` account, Docker Engine with Compose, and UFW rules limited to SSH, HTTP, HTTPS, and HTTP/3.
- Repository deployment secrets contain the VPS host, deployment user, private key, and pinned host key. No production secret is committed.
- The prior Caddy edge and its retired Docker resources were removed.

## Verified state

- `npm run verify`: 176 tests and all strict asset/export validators passed; standalone export size was 11,560,152 bytes.
- GitHub Actions run `36471698137` completed successfully.
- `http://31.97.47.189/game` redirects to `/game/`.
- `http://31.97.47.189/game/` and `/game/healthz` return 200; module and GLB MIME types are correct.
- A forced `Host: 18bro.site` request redirects HTTP traffic to `https://18bro.site/game/`.
- Traefik and the game container are healthy. Local development port 4173 is clear.

## Remaining operator action

DNS still points `18bro.site` to the retired address `2.57.91.91`. Change the apex A record to `31.97.47.189` and keep `www` as a CNAME to `18bro.site`. Traefik will obtain the Let's Encrypt certificate automatically after propagation; no application redeploy is required.

The canonical production route is `https://18bro.site/game/`. The root path remains free for future services. Current deployment, rollback, secret, and DNS procedures live in `llm-corner/docs/architecture/deployment.md`; rationale lives in `llm-corner/decisions/DEC-025-traefik-game-subpath.md`.
