# PLAN-003 - Containerized production deployment

Status: COMPLETE
Date: 2026-09-28
Owner: chief agent

## Outcome

Publish the verified static game to GHCR, deploy it to the Hostinger Ubuntu VPS through GitHub Actions, operate one shared Traefik edge for future services, and serve 18Bro at `/game/` with automatic HTTPS after DNS cutover.

## Steps

1. Add a minimal Nginx game image, local Compose definition, shared Traefik Compose definition, private production service definition, and health checks.
2. Add CI that runs `npm run verify`, publishes immutable SHA and `latest` GHCR tags, deploys over pinned-key SSH, and checks `/game/healthz`.
3. Bootstrap Docker Engine/Compose from Docker's signed Ubuntu 26.04 repository, create the restricted deployment account, and allow only SSH/HTTP/HTTPS through UFW.
4. Store only required deployment secrets in the fork repository, push the workflow, and trace its first run to a healthy deployment.
5. Verify IP path routing, document rollback and DNS, then archive this plan with a release handoff.

## Result

The game is deployed from immutable GHCR images to the Hostinger VPS through GitHub Actions. A shared Traefik v3.6 edge owns ports 80 and 443, and the private Nginx game container is registered at `/game/`. IP routing and health checks are live; automatic HTTPS is ready and waits only for `18bro.site` DNS to point to the VPS.
