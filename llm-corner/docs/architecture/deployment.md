# Production deployment

The production game is the editable `dist/` tree packaged by `Dockerfile` into an Nginx image. GitHub Actions publishes an immutable `sha-<commit>` tag used by the VPS and a convenience `latest` tag. The VPS never builds from a mutable checkout.

A shared Traefik edge owns ports 80 and 443 for this game and future services. 18Bro registers itself through Docker labels at the canonical path `/game/`; Traefik strips `/game` before forwarding to the private Nginx container.

```mermaid
flowchart LR
  P[Push deployment branch] --> V[npm run verify]
  V --> B[Build Nginx image]
  B --> G[GHCR sha tag]
  G --> S[SSH deployment]
  S --> T[Shared Traefik edge]
  T -->|/game/| N[Private 18Bro Nginx]
```

## Files

- `Dockerfile` and `.dockerignore`: minimal static image and a build context containing only `dist/` plus Nginx configuration.
- `docker-compose.yml`: local Docker review at `http://localhost:4173`.
- `docker-compose.proxy.yml`: shared Traefik v3.6 edge, Docker discovery, ports 80/443, HTTP/3, health check, and persistent Let's Encrypt state.
- `docker-compose.prod.yml`: immutable GHCR game image, private `proxy` network membership, and all `/game` HTTP/HTTPS routing labels.
- `deploy/nginx.conf`: correct `.mjs` and `.glb` MIME types, GET/HEAD-only delivery, casual direct-navigation and hotlink rejection, security/noindex headers, gzip, SPA fallback, and `/healthz`.
- `.github/workflows/deploy-production.yml`: verify, publish, pinned-key SSH update, proxy/game container waits, and internal/external `/game/healthz` checks.

## GitHub configuration

The workflow requires repository secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`. `VPS_SSH_KEY` is the private half of the authorized deployment key. `VPS_KNOWN_HOSTS` pins the VPS ED25519 host key; the workflow never performs an unverified live `ssh-keyscan`. GHCR authentication uses the job-scoped `GITHUB_TOKEN`, so no long-lived registry token is stored.

This project currently deploys from `tarasenkofedor/18bro-web-game`, which owns the feature branch and GHCR package. The authenticated account has pull-only access to `bakedbrioche/18bro-web-game`; after the upstream maintainer merges the pull request, they must add the same four secrets if upstream `main` should become the deployment owner.

## Shared edge and future services

The restricted deployment account owns `/opt/traefik` and `/opt/18bro`. The external Docker network is named `proxy`. Traefik sets `exposedByDefault=false`, so containers are private unless they explicitly opt in with `traefik.enable=true`.

Future app Compose projects should join the existing network:

```yaml
networks:
  proxy:
    external: true
```

They then register their own host or path through Traefik labels. Only the shared proxy publishes host ports; application containers use `expose` on the private network. Do not launch another reverse proxy on ports 80/443.

Traefik mounts the Docker socket read-only for discovery. Treat write access to `docker-compose.proxy.yml` and membership in the `docker` group as administrator-level access.

## Public runtime and private server boundary

A globally playable browser game cannot keep its shipped JavaScript, GLB, PNG, CSS, font or audio files confidential: the player browser must receive them and can save them from DevTools or cache. `dist/` is therefore the deliberately public runtime boundary. Source Blender files, editable art, `.git`, `.env*`, SSH keys, Dokploy state and Traefik ACME data must never enter the image. The Docker build context allowlist and `COPY dist/` rule enforce that separation.

Nginx accepts only GET and HEAD, disables directory listing, rejects dotfiles, sends CSP/CORP/no-sniff/noindex headers and returns 404 for ordinary browser top-level asset navigation and cross-site browser hotlinks. Fetch Metadata and `Accept` are spoofable, so these rules reduce casual browsing, indexing and third-party embedding; they do not authenticate a custom HTTP client. `robots.txt` is indexing guidance, not access control.

The game container has no host port, runs with `no-new-privileges`, a read-only root filesystem, tmpfs-only Nginx runtime directories and a PID cap. Only exact `18bro.site`/`www.18bro.site` Traefik routes serve `/game`; the former host-agnostic raw-IP router is removed.

For a private review, put BasicAuth or OIDC on the complete `/game/**` route and accept that authenticated reviewers can still copy downloaded assets. For future administration, use a separate host behind Tailscale, a fixed admin-IP allowlist or Cloudflare Access. Authenticate machine APIs with short-lived scoped OIDC/JWT tokens or mTLS; CORS, Origin, Host and Referer are never credentials. See `DEC-028-public-runtime-private-management-plane.md`.

## Live VPS security snapshot (2026-09-29)

A read-only external audit found ports 22, 80 and 443 reachable. Ports 2377, 7946 and 3000 were not externally reachable even though the single-node Dokploy Docker Swarm listens locally on 2377/7946. Only Traefik publishes host web ports; the 18Bro container exposes private port 80 and Dokploy exposes private port 3000 through Docker networking. Unattended upgrades are enabled. Fail2Ban is inactive. The restricted deploy account cannot read UFW or effective `sshd` policy, so those controls remain unverified from the repository account.

Highest-value host follow-up: verify the Hostinger firewall and effective SSH policy as root, keep 2377/7946/3000 closed, move SSH and Dokploy behind Tailscale or a fixed admin-IP policy, disable SSH passwords/root login, and enable Fail2Ban or CrowdSec. Do these as a scheduled access change with a second live session so a firewall mistake cannot lock out the operator.

The current GitHub deployment uses a pinned SSH host key, repository secrets, a job-scoped token and immutable SHA tags. A stronger later design uses a protected GitHub production Environment and a small deploy endpoint that validates GitHub OIDC and accepts only an approved image digest, or an ephemeral Tailscale GitHub node. Do not expose an unauthenticated POST deploy webhook.

Official operational references: [Dokploy production hardening](https://docs.dokploy.com/docs/core/guides/production-hardening), [Dokploy account security](https://docs.dokploy.com/docs/core/account-security), [Docker daemon protection](https://docs.docker.com/engine/security/protect-access/), [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc), and [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
## Operations

The workflow uploads the two production Compose definitions, writes only the immutable image URI to `/opt/18bro/.env`, pulls the image, and runs both stacks with `--wait`.

Inspect production with:

```sh
cd /opt/traefik
docker compose ps
docker compose logs --tail=200 traefik

cd /opt/18bro
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 game

curl --fail --header 'Host: 18bro.site' http://127.0.0.1/game/healthz
```

Rollback by replacing `IMAGE=` in `/opt/18bro/.env` with an earlier `ghcr.io/tarasenkofedor/18bro-web-game:sha-<commit>` tag, then run:

```sh
cd /opt/18bro
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --wait
```

## Domain

The canonical game URL is `https://18bro.site/game/`. Keep one apex `A` record for `@` pointed to the VPS IPv4 address and one `CNAME` record for `www` pointed to `18bro.site`. Remove conflicting apex or `www` A/AAAA/CNAME records. Traefik begins certificate issuance automatically when public DNS resolves to the VPS and ports 80 and 443 reach it. Do not add an AAAA record unless the VPS has a configured public IPv6 address.

Use TTL 300 during cutover so corrections propagate quickly. After HTTPS and both hostnames are stable, raise the TTL to Hostinger's normal 14400-second value. A very low value such as 50 seconds adds DNS traffic without helping normal steady-state operation.

## Live TLS and Dokploy visibility

DNS for `18bro.site` now resolves to `31.97.47.189`. Traefik's ACME resolver has issued the production certificate, and both `https://18bro.site/game/` and `https://18bro.site/game/healthz` complete normal certificate verification. A browser that cached the earlier failed state may need a hard refresh or a new tab; the server-side fix is complete.

Dokploy v0.30.7 is available at the canonical `https://dokploy.18bro.site/` URL with valid HTTPS; `https://dokploy.31-97-47-189.sslip.io/` remains an emergency fallback. Hostinger currently has this record:

- Type: `A`
- Name: `dokploy`
- Value: `31.97.47.189`
- TTL: `300` during the validation window, then `14400` for steady state

The game and shared Traefik edge were created by Docker Compose before Dokploy and are therefore Docker-engine resources rather than Dokploy database projects. They are visible in Dokploy's **Docker** page as Compose projects `18bro` (working directory `/opt/18bro`) and `traefik-edge` (working directory `/opt/traefik`), but they do not increment the Projects/Services cards.

Do not create a second Dokploy-owned copy while GitHub Actions still runs `docker compose` over SSH. To make 18Bro a native Dokploy project, schedule one ownership migration: create/import a Compose service using the existing immutable GHCR image and external `proxy` network, stop the direct-SSH Compose project, then change the GitHub workflow to call Dokploy's deployment hook/API. Only one controller may own the production container. Dokploy should consume the existing shared Traefik edge rather than bind another proxy to ports 80/443.
