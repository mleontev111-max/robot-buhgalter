# PROJECT STATUS — Robot-Buhgalter

Updated: 2026-08-31

## Canonical repository state

- Branch: `main`
- Public frontend domain: **`https://kolyman.ru`**
- Current exact `main` HEAD must be read from GitHub (`git rev-parse HEAD` / branch page), not copied into this living status file.
- Current CI/Pages result must likewise be checked against that HEAD in GitHub Actions.

Historical commit SHAs belong in dated checkpoints. This file describes the current state and should not become stale just because another documentation commit or PR commit lands.

## What is verified on main

- React/Vite frontend builds successfully under the current CI gate.
- `npm test`, `npm run lint`, and `npm run build` are required checks.
- Tax regression tests are present.
- `vite.config.ts` uses local frontend port `3000`.
- `server/index.mjs` is a local/legacy read-only marketplace sync server on `8787` and its default CORS is aligned to local frontend port `3000`.
- Current `main` still stores MVP application state in browser `localStorage`.

## Current production reality

The live Robot-Buhgalter architecture is ahead of `main`:

- a production backend exists;
- it uses PostgreSQL;
- it has authentication and tenant isolation;
- marketplace credentials are stored server-side in encrypted form.

Recovered production source is in draft PR #3:

`recovery/production-backend-2026-08-27`

**Do not hardcode the PR head here.** Before any recovery/build work, open PR #3 and use its current GitHub HEAD. Dated checkpoints may record the exact SHA that was verified at that time.

Verified capabilities in PR #3 include:

- production source tree under `server/production/`;
- migrations;
- security/tenancy code;
- locked runtime dependencies;
- login/session/logout and organization API;
- unit tests;
- local PostgreSQL integration tests;
- restored `Dockerfile.backend` with deterministic dependency installation.

## Main blocker

**Reproducible Docker parity is not yet proven.**

Before PR #3 can be treated as merge/deploy ready, a new test-only image must actually be built from the current PR HEAD and tested end-to-end against PostgreSQL over HTTP.

Do not infer readiness from source review, root CI, unit tests or local-mode DB tests alone.

## Exact NEXT ACTION

Close the Docker parity gate without touching the live service:

1. open PR #3 and record its current full HEAD SHA;
2. build a test-only `linux/amd64` Docker image from that exact HEAD;
3. do **not** replace/restart/rebuild the current live production backend;
4. run the Docker-mode PostgreSQL/HTTP integration test against the built image;
5. verify `/health`, `/ready`, `POST /auth/login`, `GET /v1/organizations`, logout and revoked-session `401` behavior;
6. record full SHA, image tag, test environment and PASS/FAIL in PR/checkpoint;
7. only after PASS decide whether PR #3 leaves draft and merges;
8. production rollout, if approved later, is a separate controlled step with rollback.

## Production operational source of truth

Authorized maintainers must use these exact private documents in `mleontev111-max/thechai_space`:

- `docs/server/ROBOT_BUHGALTER_PRODUCTION.md` — Robot production backend facts;
- `docs/server/SERVER_MAP.md` — current Hetzner/server map;
- `docs/server/RUNBOOK.md` — operating/recovery procedures.

These are operational documentation, not a place for secrets. Passwords, tokens, private keys, `.env`, database credentials/connection strings and recovery secret material must remain outside Git.

Before any production change, re-check the live server. A dated server snapshot is historical evidence, not proof that nothing changed later.

## Production PostgreSQL location

The onboarding-safe physical/runtime location is intentionally documented here so a new contributor does not have to guess:

- host: shared Hetzner server with hostname `ai-vpn`;
- PostgreSQL container: `project2-postgres`;
- PostgreSQL major version: `16` (last operational verification recorded 16.15);
- Docker network: `apps-net`;
- database port: internal `5432/tcp` only;
- PostgreSQL has **no public host port** and must never be exposed directly to the Internet;
- Robot production API reaches PostgreSQL over the private Docker network; the API container is `robot-buhgalter-api-1` and is bound to host localhost on `127.0.0.1:8788`.

The database name, usernames, passwords and full `DATABASE_URL` are not duplicated in Git. If one of those values is required for authorized production work, obtain it through the production secret acquisition procedure below. Before a risky production change, re-verify the current container/network names against the private `SERVER_MAP.md` and the live host rather than assuming a dated fact is still current.

## Production secret acquisition procedure

Production secret **values are never stored in GitHub**. The canonical live runtime secret source for Robot-Buhgalter is the server-side environment file:

`/opt/apps/robot-buhgalter/.env`

on the shared Hetzner host `ai-vpn`. The compose file is `/opt/apps/robot-buhgalter/compose.yml`.

For the recovered production backend, runtime configuration names include `DATABASE_URL`, `CREDENTIALS_ENCRYPTION_KEY`, `DATABASE_SSL` and `PORT`. `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD`, `BOOTSTRAP_DISPLAY_NAME`, `BOOTSTRAP_ORGANIZATION_NAME` and `BOOTSTRAP_LEGAL_FORM` are only for an explicitly approved initial-owner bootstrap; they are not routine onboarding secrets.

Authorized contributor procedure:

1. obtain explicit owner approval for production access;
2. obtain owner-approved SSH-key access to `ai-vpn` (normal admin path is the `mihail` account with `sudo`) rather than asking for secrets to be pasted into GitHub, chat, email or a checkpoint;
3. on the host, inspect only the specific required variable/value from `/opt/apps/robot-buhgalter/.env` or the running service configuration; do **not** copy or print the whole `.env` into logs/chat;
4. keep any required value only in the approved local/process secret mechanism and redact it from diagnostics;
5. if SSH/production access has not been granted, stop and ask the project owner to grant access. Do not invent replacement production credentials, rotate secrets, or create a new production database as an onboarding shortcut.

Marketplace API credentials already stored by the production application are encrypted in PostgreSQL and are **not** distributed to contributors as onboarding secrets. Use the application/backend credential-management flow; do not extract them from the database merely to start development.

## Source-of-truth boundaries

- **Current canonical frontend/main source:** this repository `main`.
- **Recovered production source pending canonicalization:** current PR #3 HEAD.
- **Public frontend domain:** root `CNAME` → `kolyman.ru`.
- **Live production/server facts:** exact private documents listed above.
- **Historical verified states:** dated files under `checkpoints/`.

If these sources disagree, do not guess. Mark `INCONSISTENT` / `TO VERIFY` and resolve the discrepancy before a risky change.

## Safety rules

- Never commit or paste passwords, API keys, tokens, private keys, `.env` files or database connection strings.
- Never treat `server/index.mjs` as the current production backend.
- Never rebuild/remove/replace the live Robot-Buhgalter production image while reproducible Git-backed parity is unproven.
- Never merge/deploy PR #3 before the Docker parity gate passes.
- Never manually mutate production PostgreSQL as an onboarding shortcut.
- Never change DNS/Caddy/UFW during the recovery parity gate.
- `kolyman.ru` is the canonical public frontend domain; do not change its binding without explicit owner approval.

## Verification commands for current main

```bash
npm ci
npm test
npm run lint
npm run build
```

For ordinary frontend/local MVP work these are the minimum completion gates. Production-backend work additionally follows the current PR #3 integration gate described above.
