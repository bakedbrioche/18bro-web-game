# DEC-004 — Use Blender source with validated GLB runtime assets

Status: ACCEPTED
Date: 2026-09-22
Decision by: operator and Codex

## Context

The current procedural characters are fast and reliable but do not provide the connected silhouettes, controlled topology, stable rigs, or authored animation needed for the desired PS1-inspired presentation. The game must remain a static, offline-capable web build, and the 24-hour release effort cannot depend on a live Blender or external service connection.

## Decision

Keep editable `.blend` files and small source textures under `art/`, export self-contained GLB files into `dist/assets/models/`, and check approved runtime assets into Git. Versioned Blender Python scripts and a Node validator enforce naming, rig, socket, clip, bounds, budget, hash, and no-external-resource requirements.

Vendor the Three.js r169 loader utilities used by the game, keep runtime loading CDN-free, and extend the standalone exporter to embed approved GLB data. Blender's official experimental MCP connection is an optional supervised authoring aid. Reviewed command-line scripts remain the reproducible path from source to release.

## Consequences

The repository will contain generated GLB runtime assets alongside their authored sources and provenance manifest. Changes to a model require source, export, validation, preview, and browser review. Shared imported geometry needs skeleton-safe cloning and reference-safe disposal. Large-file storage, compression, and texture transcoders are deferred until measured repository or delivery costs justify them.
