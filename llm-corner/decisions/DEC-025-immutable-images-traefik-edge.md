# DEC-025 - Publish immutable images behind a shared Traefik edge

Date: 2026-09-28
Status: ACCEPTED

## Context

The game previously had no repeatable production host, container definition, CI gate, registry artifact, TLS owner, health check, or rollback identifier. The same VPS will host more apps and games, so a proxy embedded only around 18Bro would become a routing and certificate-management bottleneck. The current contributor can administer the fork and its GHCR namespace but has pull-only access to the upstream repository.

## Decision

Package the authoritative `dist/` tree in a minimal Nginx image after `npm run verify`. Publish immutable `sha-<commit>` and convenience `latest` tags to the fork's GHCR namespace. Deploy the immutable tag through a GitHub Actions SSH job using a dedicated VPS account, a repository-stored private deployment key, and a pinned ED25519 host record. Use the job-scoped `GITHUB_TOKEN` for registry login.

Run Traefik v3.5 as a shared edge stack on ports 80, 443/TCP, and 443/UDP. Enable Docker discovery with `exposedByDefault=false`, keep application containers private on the external `proxy` network, and require explicit routing labels. Register 18Bro at `/game/`, redirect the missing trailing slash, strip the prefix before Nginx, and use an HTTP-01 Let's Encrypt resolver after DNS cutover. Persist certificate state in a named volume.

## Consequences

Every running game release maps to a tested commit and can be rolled back by selecting an older SHA tag. Future apps join the same private network and publish their own labels without taking ports 80/443 or changing a central route file. Docker socket discovery and `docker` group membership remain privileged boundaries. No project or VPS secret enters the image, repository, Compose labels, or Actions log. DNS is the only manual launch step after a healthy IP deployment.
