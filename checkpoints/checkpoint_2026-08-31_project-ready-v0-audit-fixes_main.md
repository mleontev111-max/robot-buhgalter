# CHECKPOINT — Project Ready v0 audit fixes

Date: 2026-08-31
Branch: `main`

## Purpose

Close only the concrete onboarding defects found by the independent read-only audit after Project Ready v0 documentation was added.

No production deployment, PostgreSQL data, DNS, Caddy, UFW or live Docker service is changed by this checkpoint.

## Audit findings addressed

1. Local frontend/CORS mismatch:
   - `vite.config.ts` uses port `3000`;
   - legacy `server/index.mjs` previously defaulted CORS to `5173`;
   - canonical local frontend port is now documented as `3000` and legacy default CORS is aligned to it.

2. Moving PR SHA in living status docs:
   - `PROJECT_STATUS.md` and `AGENTS.md` now require reading the current PR #3 HEAD directly from GitHub;
   - moving branch/PR SHAs are not hardcoded in living status files;
   - dated checkpoints may record exact historical SHAs.

3. Production operational source of truth:
   - exact authorized documentation location is now explicit:
     - `mleontev111-max/thechai_space/docs/server/ROBOT_BUHGALTER_PRODUCTION.md`;
     - `mleontev111-max/thechai_space/docs/server/SERVER_MAP.md`;
     - `mleontev111-max/thechai_space/docs/server/RUNBOOK.md`.
   - secrets remain outside Git.

4. Recovery backend README drift:
   - production recovery documentation is being updated in PR #3 to reflect that login/session issuance already exists;
   - frontend migration and background sync remain incomplete/not claimed complete.

## Observed recovery PR state at audit time

- PR #3: open, draft, mergeable.
- Observed HEAD during this audit: `34ee5e0f4cda8dec11ff8d008d707007b5c64cd6`.
- This SHA is historical evidence for this checkpoint only. Current work must always re-read the PR head from GitHub.

## Exact NEXT ACTION remains unchanged

Close the Docker parity gate on a developer machine or CI with working Docker Engine and registry pull access:

1. read the current PR #3 HEAD;
2. build test-only `linux/amd64` image from that exact SHA;
3. keep the live production image/container untouched;
4. run Docker-mode PostgreSQL/HTTP integration;
5. verify `/health`, `/ready`, login, organizations, logout and revoked-session `401`;
6. record full SHA, image tag, environment and PASS/FAIL;
7. only after PASS consider PR readiness/merge;
8. any production rollout is a separate controlled step with rollback.

## Safety

- `kolyman.ru` remains the canonical public frontend domain.
- `server/index.mjs` remains legacy/local only.
- Do not rebuild or replace the current production backend as part of the parity test.
- Do not change DNS/Caddy/UFW or neighboring services for this gate.
- Do not expose or commit secrets.
