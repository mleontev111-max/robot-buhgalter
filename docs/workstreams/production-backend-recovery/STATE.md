# Workstream State — production backend recovery

Workstream: production_backend_recovery
Workstream-State: current
Date: 2026-09-20
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
database, no registry push. The gate re-runs automatically on every pull
request, so parity cannot silently rot before merge — or after it.

### Gate trigger fix (2026-09-20)

As first written, `docker-parity.yml` fired on both `pull_request` and `push`
to this branch. Both events carry the same head SHA and share the workflow's
concurrency group, so one of the two was always cancelled — and the cancelled
run stayed on the head as a non-successful check. That is why PR #3 reported
`mergeable_state: unstable` while CI, Project Ready Guard and the parity gate
were all green. `push` is now scoped to `main`, matching `ci.yml` and
`project-ready.yml`; `pull_request` alone covers this branch.

## Current blocker

None technical. Merge readiness is now a human decision, not a missing proof.

## ONE NEXT ACTION

Decide merge readiness for PR #3 with the owner: take it out of draft, confirm
ordinary CI, Project Ready Guard and the Docker Parity Gate are green on the
same head, and merge.

Production rollout stays a **separate** controlled decision after merge — with a
known rollback tag and an explicit deployment checkpoint. Merging this PR does
not deploy anything.

### Gate made self-evidencing (2026-09-20)

Reading the gate's own log turned up a weakness in it. The HTTP phase of
`db.integration.mjs` — the part that actually drives the built image — only
runs when `ROBOT_BUHGALTER_TEST_IMAGE` is set, and every `docker` call inside
it captures its own output. So the phase produced no log output at all, and a
run that silently degraded to a plain PostgreSQL test would have looked
identical to a real parity run and still reported PASS.

Verified from the logs that it did in fact run on every gate execution so far
(the env var is set by the workflow, and there is no silent-skip path once the
branch is entered). The weakness was that nothing *proved* it from the record.

Now it does:

- `db.integration.mjs` prints `HTTP gate: /ready OK ...` and `HTTP gate: login,
  organizations, logout and revoked-session 401 OK` when the phase runs, and
  prints an explicit `HTTP gate: SKIPPED — ... does NOT prove Docker parity`
  when the image is absent in docker mode;
- the workflow greps for both markers and fails the job if either is missing,
  so a degraded run can no longer be recorded as proven parity.

### Main state-layer catch-up (2026-09-20)

Previously flagged here as needing a separate change on `main`: the product
track's `PROJECT_STATE.json` entry and
`checkpoints/2026-09-08-production-backend-recovery-current.md` both still
described the parity gate as the open blocker.

That catch-up is now carried **by this PR** instead of by a separate change to
`main`, which keeps the state layer and the work it describes in one atomic
merge and avoids a window where `main` claims a blocker that no longer exists:

- `checkpoints/2026-09-20-production-backend-recovery-current.md` — new current
  product checkpoint carrying the parity evidence;
- `checkpoints/2026-09-08-production-backend-recovery-current.md` — marked
  superseded, kept as the record of what the gate demanded;
- `PROJECT_STATE.json` / `CHECKPOINT_INDEX.json` — product track repointed at
  the new checkpoint, `one_next_action` moved from "prove parity" to "decide
  merge readiness".

`.github/workflows/docker-parity.yml` was added to this workstream's
`scope_paths` so a future edit to the gate marks this file stale instead of
passing unnoticed.

## Safety / stop condition

- do not rebuild, replace, restart or remove the live Hetzner production backend;
- do not run the parity test from the live production compose directory;
- do not mutate production PostgreSQL;
- do not change DNS, Caddy or UFW as part of this gate;
- do not treat merging PR #3 as a deployment — it deploys nothing;
- do not deploy without owner approval and a recorded rollback tag;
- do not copy secrets or `.env` values into Git/chat/logs.
