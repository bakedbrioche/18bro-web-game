# DEC-025 - Publish immutable game images and let Caddy own the public edge

Date: 2026-09-28
Status: ACCEPTED

## Context

The game previously had no repeatable production host, container definition, CI gate, registry artifact, TLS owner, health check, or rollback identifier. Copying `dist/` manually would make the running files impossible to tie to a verified commit. The current contributor can administer the fork and its GHCR namespace but has pull-only access to the upstream repository.

## Decision

Package the authoritative `dist/` tree in a minimal Nginx image after `npm run verify`. Publish an immutable `sha-<commit>` tag and `latest` to the fork's GHCR namespace. Deploy the immutable tag through a GitHub Actions SSH job using a dedicated VPS account, a repository-stored private deployment key, and a pinned ED25519 host record. Use the job-scoped `GITHUB_TOKEN` for registry login rather than a long-lived package token.

Run Caddy as the only published edge container on ports 80, 443/TCP and 443/UDP. Keep Nginx private on the Compose network. Caddy serves the raw IP over HTTP for pre-DNS health checks and owns automatic certificates for `18bro.site` and `www.18bro.site` after DNS points to the VPS. Persist Caddy certificate state in named volumes. Store only the non-secret image URI in the server-side `.env` file.

## Consequences

Every running release maps to a tested Git commit and can be rolled back by selecting an older SHA tag. No project or VPS secret enters the image, repository, Compose file, or Actions log. The fork owns deployments until an upstream administrator deliberately copies the required secrets and takes ownership. DNS is the only manual launch step after the first healthy IP deployment.