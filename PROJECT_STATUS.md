# PROJECT STATUS — Robot-Buhgalter

Updated: 2026-08-31

## Canonical repository state

- Branch: `main`
- Verified main before Project Ready docs: `57f9ccfb7c9d95f65109511b66f31f7f00562f46`
- Commit message: `docs(checkpoint): confirm tax test CI`
- CI for that HEAD: success
- GitHub Pages deploy for that HEAD: success
- Public frontend domain: **`https://kolyman.ru`**

The Project Ready documentation update itself is documentation-only and does not change application code, production containers, PostgreSQL or deployment configuration.

## What is verified on main

- React/Vite frontend builds successfully.
- `npm test`, `npm run lint`, and `npm run build` are required by CI.
- Tax regression tests are present and green in the latest verified checkpoint.
- `server/index.mjs` is a local/legacy read-only marketplace sync server.
- Current `main` still stores MVP application state in browser `localStorage`.

## Current production reality

The live Robot-Buhgalter architecture is ahead of `main`:

- a production backend exists;
- it uses PostgreSQL;
- it has authentication and tenant isolation;
- marketplace credentials are stored server-side in encrypted form;
- operational production details intentionally live outside this public repository.

Recovered production source is in draft PR #3:

`recovery/production-backend-2026-08-27`

Current reviewed PR head at the time of this status:

`bee7919529ce86c4cdad9b2b1d9fbae2e2f1e963`

Verified in PR #3:

- production source tree restored under `server/production/`;
- migrations restored;
- security/tenancy code restored;
- locked runtime dependencies restored;
- unit tests pass;
- local PostgreSQL integration tests pass;
- `Dockerfile.backend` has been restored with deterministic dependency installation.

## Main blocker

**Reproducible Docker parity is not yet proven.**

Before PR #3 can be treated as merge/deploy ready, a new test-only image must actually be built from Git and tested end-to-end against PostgreSQL over HTTP.

Do not infer readiness from source review or local-mode DB tests alone.

## Exact NEXT ACTION

Restore a reproducible Git-backed production build without touching the live service:

1. checkout/use recovery PR #3;
2. build a test-only `linux/amd64` Docker image;
3. do **not** replace/restart/rebuild the current live production backend;
4. run the Docker-mode PostgreSQL/HTTP integration test against the built image;
5. verify `/health`, `/ready`, `POST /auth/login`, `GET /v1/organizations`, logout and revoked-session `401` behavior;
6. record the exact Git commit SHA, image tag and PASS/FAIL result in the PR/checkpoint;
7. only after PASS decide whether PR #3 leaves draft and merges;
8. production rollout, if approved later, must be a separate controlled step with rollback.

## Source-of-truth boundaries

- **Current canonical source on main:** this repository.
- **Recovered production source pending canonicalization:** PR #3.
- **Public frontend domain:** root `CNAME` → `kolyman.ru`.
- **Live operational/server facts:** private operational documentation available to authorized maintainers; do not copy secrets or sensitive infrastructure details into this public repo.
- **Historical progress:** `checkpoints/`.

If these sources disagree, do not guess. Treat the mismatch as documentation/reproducibility work and resolve it explicitly.

## Safety rules

- Never commit or paste passwords, API keys, tokens, private keys, `.env` files or database connection strings.
- Never treat `server/index.mjs` as the current production backend.
- Never rebuild/remove/replace the live Robot-Buhgalter production image while reproducible Git-backed parity is unproven.
- Never merge/deploy PR #3 before the Docker parity gate passes.
- Never manually mutate production PostgreSQL as an onboarding shortcut.
- `kolyman.ru` is the canonical public frontend domain; do not change its binding without explicit owner approval.

## Verification commands for current main

```bash
npm ci
npm test
npm run lint
npm run build
```

For ordinary frontend/local MVP work these are the minimum completion gates. Production-backend work additionally follows the PR #3 integration gate described above.
