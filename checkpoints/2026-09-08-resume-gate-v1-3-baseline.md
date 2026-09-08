# Checkpoint — Resume Gate v1.3 rollout baseline

Date: 2026-09-08
Status: rollout candidate
Main baseline: `fcadd123d07b54c091079a25326f48eeb574affc`

## Current product state

Current `main` frontend is Project Ready normalized. Live production architecture is ahead of main; recovered production backend work is durable in draft PR #3 on `recovery/production-backend-2026-08-27`.

Observed PR #3 head during rollout: `dc6674216d7f0540a0c75f263a89605b332eba96`.

Already durable in PR #3:
- recovered production backend source and migrations;
- auth/session/tenant/security helpers;
- locked runtime dependencies;
- deterministic `Dockerfile.backend`;
- unit tests passing;
- local PostgreSQL integration checks passing.

## ONE NEXT ACTION — product

Close Docker parity without touching live production: re-read the exact current PR #3 head, build a test-only `linux/amd64` image from that exact head, run Docker-mode PostgreSQL/HTTP integration checks (`/health`, `/ready`, login, organizations, logout, revoked-session `401`), and record SHA/image/environment/PASS or FAIL. Only after PASS may merge readiness be considered.

## Safety

Do not rebuild/restart/replace the live Hetzner backend, do not mutate production PostgreSQL, and do not change DNS/Caddy/UFW during this gate.

## Resume-system continuation

After v1.3 merges to main, synchronize the resume layer into PR #3, create `docs/workstreams/production-backend-recovery/STATE.md` at the current branch head, make the exact-head Project Ready/Resume Guard green, then run a clean-room resume test.
