# DEC-002 — Use the Node static server for local modules

Status: ACCEPTED
Date: 2026-09-22
Decision by: operator and Codex

## Context

The previous `python3 -m http.server` command was unavailable in the operator’s terminal. `uv run -m http.server` served `.mjs` files as `text/plain`, so Chrome rendered the menu HTML but rejected every game module under strict MIME checking.

## Decision

Use the dependency-free `server.mjs` for both `npm start` and `npm run dev`. It serves `dist/`, maps `.mjs` to `text/javascript`, prevents path traversal, disables caching during development, and keeps port 4173.

## Consequences

Local development needs Node/npm but no Python or installed packages. The server is intentionally static and local-development-only; hosting continues to publish `dist/` through `.openai/hosting.json`.
