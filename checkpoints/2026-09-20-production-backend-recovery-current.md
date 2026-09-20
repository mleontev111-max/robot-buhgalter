# Checkpoint — production backend recovery current state

Date: 2026-09-20
Track: product
Checkpoint-Role: latest
Status: CURRENT / VERIFIED CONTINUATION
Supersedes: checkpoints/2026-09-08-production-backend-recovery-current.md

## What changed since the previous checkpoint

The Docker parity gate — the product track's ONE NEXT ACTION since 2026-08-27 —
**passed**. It is no longer a blocker, and it is no longer a manual step.

The previous checkpoint asked for: a test-only `linux/amd64` image built from
the exact current PR #3 head, the Docker-mode PostgreSQL/HTTP integration gate
run against that image, and full SHA, image tag, environment and PASS/FAIL
recorded. All of that exists now.

## Docker parity evidence

- **Verdict:** PASS
- **Commit:** `825acfe917bb149f6a727dc96533ba8c7fe2ec6a`
- **Image tag:** `robot-buhgalter-api:825acfe` (test-only; never pushed to any registry)
- **Environment:** GitHub-hosted `ubuntu-24.04` runner, native `linux/amd64`, no QEMU
- **Run:** https://github.com/mleontev111-max/robot-buhgalter/actions/runs/35495348571
- **Workflow:** `.github/workflows/docker-parity.yml`

Proven on that head, in order:

1. the image builds reproducibly from `Dockerfile.backend`;
2. its config matches every fact recorded from the live production image —
   `amd64`/`linux`, Alpine `3.23.x`, Node `v20.20.2`, `WORKDIR /app`, user
   `app`, `ENTRYPOINT ["docker-entrypoint.sh"]`, `CMD ["node",
   "server/production/index.mjs"]`, `EXPOSE 8788`;
3. the runtime image carries no dev dependencies — `npm ci --omit=dev` actually
   took effect (`vitest` is absent from the image);
4. `/health` responds (checked separately and without a database, since
   `/health` is deliberately DB-independent — `db.integration.mjs` covers
   `/ready` but not `/health`);
5. the full Docker-mode PostgreSQL/HTTP gate passes: `/ready` (real `SELECT 1`),
   login, organizations, logout, and the revoked session returning a real `401`.

Why it took three weeks: the gate needs a Docker Engine that can pull
`node:20.20.2-alpine3.23` and `postgres:16-alpine`, and the sandboxes working
this repository have had registry egress denied by policy (403 on
`production.cloudfront.docker.com`). Moving the gate into GitHub Actions closed
it without routing around that policy, and made it re-run automatically on every
pull request rather than depending on a human running a runbook.

## Durable in PR #3

- recovered production backend source and migrations under `server/production/`;
- auth/session/tenant/security helpers;
- locked runtime dependencies;
- deterministic `Dockerfile.backend` (`bee7919`);
- restored Vitest and passing unit tests (`706f06b`);
- local PostgreSQL integration checks passing;
- the Docker parity gate as CI (`825acfe`) and its recorded PASS (`ce3d1b0`).

Do not recreate any of this from memory to continue the project.

## Remaining blocker

**None technical.** Merge readiness is now a human decision, not a missing
proof. Merging PR #3 deploys nothing: production rollout is a separate,
explicitly controlled step.

## ONE NEXT ACTION

Decide merge readiness for PR #3 with the project owner: take it out of draft,
confirm ordinary CI, Project Ready Guard and the Docker Parity Gate are all
green on the same head, and merge. Do **not** deploy as part of that merge.

After merge, production rollout to Hetzner is a separate decision with its own
deployment checkpoint and a known rollback tag recorded before anything on the
server changes.

## Safety / stop condition

- do not rebuild, restart, replace or remove the live Hetzner production backend;
- do not run the parity test from the live production compose directory;
- do not mutate production PostgreSQL;
- do not change DNS, Caddy or UFW;
- do not treat merging PR #3 as a deployment;
- do not deploy without a recorded rollback tag and owner approval;
- do not copy secrets or `.env` values into Git, chat or logs.
