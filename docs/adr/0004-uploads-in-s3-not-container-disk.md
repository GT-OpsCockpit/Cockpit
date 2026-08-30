# ADR-0004 — Uploaded files live in S3-compatible storage, not the API container's disk

- **Status**: accepted
- **Date**: 2026-08-29
- **Scope**: system-wide (`apps/api` nameboard uploads, `StorageService`)

## Context

Nameboard uploads (`POST /trips/:ref/nameboard`) were written by Multer to
the `api` container's local filesystem, with no volume mounted — lost on
every redeploy, leaving `trip.nameboardUrl` pointing at nothing. This is the
last remaining non-persistence gap inherited from the legacy (whose whole
dataset lived in memory, see `docs/LEGACY_FEATURES.md` §11).

## Decision

A self-hosted MinIO service (S3-compatible) holds uploaded files, behind a
generic `StorageService` driven only by `S3_*` env vars — so a future move
to a real S3 provider is a config change, not a code change. The bucket
stays private; the API proxies reads through `NameboardController`
(excluded from the `/api` prefix) so the existing `/uploads/nameboards/<file>`
URL shape is unchanged — no frontend or DB change needed.

`setNameboard()` deletes the previous object on replacement (best-effort) —
a latent bug that predated this change (the old file was never cleaned up
on disk either).

## Consequences

- Any future upload feature (invoices, other attachments) goes through
  `StorageService`, not a fresh Multer-to-disk path.
- The `prod` Docker stage must ship whatever `StorageService` needs at
  runtime — this is also where the `@cockpit/shared` prod-image bug was
  found and fixed (the `prod` stage only copied `dist`, but `@cockpit/shared`
  ships raw TypeScript; fixed by copying `packages/shared/src` into the
  `prod` stage since Node 22 strips types at load time). Keep that in mind
  before trimming what a Docker stage copies.
- Local dev exposes MinIO's console on `:9001` (`minioadmin`/`minioadmin`)
  for debugging uploads directly.
