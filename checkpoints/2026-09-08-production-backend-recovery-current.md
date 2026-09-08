# Checkpoint — production backend recovery current state

Date: 2026-09-08
Track: product
Checkpoint-Role: latest
Status: CURRENT / VERIFIED CONTINUATION

## Current merged-main baseline

Canonical `main` baseline for this checkpoint:

`fcadd123d07b54c091079a25326f48eeb574affc`

The public/local frontend remains in `main`. The recovered production backend is important durable work that is **not merged to main** and lives in draft PR #3 on branch `recovery/production-backend-2026-08-27`.

Observed PR #3 head during this rollout:

`dc6674216d7f0540a0c75f263a89605b332eba96`

Always re-read the exact current PR head from GitHub before acting; this observed SHA is evidence, not a permanently moving pointer.

## Already durable in PR #3

- recovered production backend source and migrations under `server/production/`;
- auth/session/tenant/security helpers;
- locked runtime dependencies;
- deterministic `Dockerfile.backend`;
- unit tests passing;
- local PostgreSQL integration checks passing.

Do not recreate those items from memory merely to continue the project.

## Remaining blocker

Reproducible Docker parity has not yet been proven on the exact current PR head. Source review, root CI, unit tests and local-mode DB tests are not sufficient evidence for merge/deploy readiness.

## ONE NEXT ACTION

Open PR #3 and resolve its exact current full HEAD SHA. Build a **test-only** `linux/amd64` Docker image from that exact head, then run the Docker-mode PostgreSQL/HTTP integration gate against the built image and record full SHA, image tag, test environment and PASS/FAIL.

Verify at least `/health`, `/ready`, login, organizations, logout and revoked-session `401` behavior. Only after PASS may merge readiness be considered.

## Safety / stop condition

- do not rebuild, restart, replace or remove the live Hetzner production backend;
- do not run the parity test from the live production compose directory;
- do not mutate production PostgreSQL;
- do not change DNS, Caddy or UFW during this gate;
- do not merge or deploy PR #3 before Docker parity passes;
- production rollout, if later approved, is a separate controlled step.
