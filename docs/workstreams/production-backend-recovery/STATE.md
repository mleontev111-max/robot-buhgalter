# Workstream State — production backend recovery

Workstream: production_backend_recovery
Workstream-State: current
Date: 2026-09-08
Branch: `recovery/production-backend-2026-08-27`
Pull Request: #3

## Durable work already present

- recovered production backend source under `server/production/`;
- PostgreSQL migrations, tenancy/RLS and security helpers;
- login/session/logout and organization routes;
- deterministic `Dockerfile.backend` for linux/amd64;
- locked production runtime dependencies;
- unit tests passing;
- local PostgreSQL integration checks passing.

These are durable PR #3 work and must not be reconstructed from memory before continuation.

## Current blocker

Reproducible Docker parity has **not** yet been proven for the exact current PR head. Root CI, source review, unit tests and local-mode database tests do not prove merge/deployment readiness.

## ONE NEXT ACTION

Resolve the exact current PR #3 HEAD from GitHub, build a **test-only** `linux/amd64` image from that exact head, and run the Docker-mode PostgreSQL/HTTP integration test against the built image. Record full commit SHA, image tag, test environment and PASS/FAIL.

Verify at least `/health`, `/ready`, login, organizations, logout and revoked-session `401` behavior.

Only after PASS may merge readiness be considered. Production rollout is a separate decision.

## Safety / stop condition

- do not rebuild, replace, restart or remove the live Hetzner production backend;
- do not run the parity test from the live production compose directory;
- do not mutate production PostgreSQL;
- do not change DNS, Caddy or UFW as part of this gate;
- do not merge or deploy PR #3 until Docker parity passes;
- do not copy secrets or `.env` values into Git/chat/logs.
