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

## Docker parity gate — PASSED 2026-09-20

The blocker that stood from 2026-08-27 is cleared. Evidence:

- Commit under test (exact PR head): `825acfe917bb149f6a727dc96533ba8c7fe2ec6a`
- Image tag: `robot-buhgalter-api:825acfe` (test-only, never pushed to any registry)
- Environment: GitHub-hosted `ubuntu-24.04` runner, native linux/amd64 (no QEMU)
- Run: <https://github.com/mleontev111-max/robot-buhgalter/actions/runs/35495348571> — conclusion `success`
- Workflow: `.github/workflows/docker-parity.yml` (`825acfe`)

What that run proved, on that exact head:

- the image builds reproducibly from `Dockerfile.backend` (`npm ci --omit=dev`
  from the lockfile, no copied `node_modules`);
- image config matches the facts recorded from the live production image:
  `amd64`/`linux`, Alpine 3.23.x, Node `v20.20.2`, `WORKDIR /app`, user `app`,
  `ENTRYPOINT ["docker-entrypoint.sh"]`,
  `CMD ["node","server/production/index.mjs"]`, `EXPOSE 8788`;
- the runtime image carries no dev dependencies (vitest absent — `--omit=dev`
  actually took effect);
- `/health` responds on the built image;
- the Docker-mode PostgreSQL/HTTP gate passes against the built image:
  `/ready` (real `SELECT 1`), `POST /auth/login`, `GET /v1/organizations`,
  `POST /v1/auth/logout`, and the revoked session returning a real `401`.

Nothing outside the ephemeral runner was touched: no Hetzner, no production
database, no registry push. The gate now re-runs automatically on every future
push to this branch, so parity cannot silently rot before merge.

## Current blocker

None technical. Merge readiness is now a human decision, not a missing proof.

## ONE NEXT ACTION

Decide merge readiness for PR #3 with the owner: take it out of draft, confirm
ordinary CI and Project Ready Guard are green on the same head, and merge.

Production rollout stays a **separate** controlled decision after merge — with a
known rollback tag and an explicit deployment checkpoint. Merging this PR does
not deploy anything.

Note: `PROJECT_STATE.json` on `main` still carries the pre-gate
`one_next_action` for the product track ("Close the Docker parity gate..."), and
`checkpoints/2026-09-08-production-backend-recovery-current.md` still describes
the gate as the remaining blocker. Those live on `main` and need a separate
change there to catch up — this file and `ACTIVE_WORK.json` on this branch are
current.

## Safety / stop condition

- do not rebuild, replace, restart or remove the live Hetzner production backend;
- do not run the parity test from the live production compose directory;
- do not mutate production PostgreSQL;
- do not change DNS, Caddy or UFW as part of this gate;
- do not merge or deploy PR #3 until Docker parity passes;
- do not copy secrets or `.env` values into Git/chat/logs.
