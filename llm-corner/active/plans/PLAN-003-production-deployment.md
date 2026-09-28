# PLAN-003 - Containerized production deployment

Status: IN PROGRESS
Date: 2026-09-28
Owner: chief agent

## Outcome

Publish the verified static game to GHCR, deploy it to the Hostinger Ubuntu VPS through GitHub Actions, keep the server reproducible through Compose, and prepare automatic HTTPS for `18bro.site`.

## Steps

1. Add a minimal Nginx game image, local and production Compose definitions, Caddy edge configuration, and health checks.
2. Add CI that runs `npm run verify`, publishes immutable SHA and `latest` GHCR tags, deploys over pinned-key SSH, and checks the public VPS endpoint.
3. Bootstrap Docker Engine/Compose from Docker's signed Ubuntu 26.04 repository, create the restricted deployment account, and allow only SSH/HTTP/HTTPS through UFW.
4. Store only required deployment secrets in the fork repository, push the workflow, and trace its first run to a healthy deployment.
5. Verify the IP response, document rollback and DNS, then archive this plan with a release handoff.