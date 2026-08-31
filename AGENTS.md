# AGENTS.md — Robot-Buhgalter

These rules apply to every human or AI contributor working in this repository.

## Before any change

1. Read `README.md`.
2. Read `PROJECT_STATUS.md`.
3. Read the latest file in `checkpoints/`.
4. If the task touches production backend/recovery, read draft PR #3 and check its **current GitHub HEAD**; do not trust a stale SHA copied into a living status file.
5. For live/server work, read the exact private operational docs listed below.
6. Check `git status`, current branch and current HEAD before editing.
7. Confirm whether the task is frontend/local MVP work or production-backend work. Do not mix the two accidentally.

## Architecture boundary

- `server/index.mjs` is the local/legacy read-only sync server on port `8787`.
- It is **not** the current production backend.
- Local frontend canonical port is `3000` from `vite.config.ts`.
- Current production backend source is being recovered/canonicalized in PR #3 under `server/production/`.
- `kolyman.ru` is the canonical public frontend domain.

## Production operational source of truth

For authorized maintainers, use the private repository `mleontev111-max/thechai_space`:

- `docs/server/ROBOT_BUHGALTER_PRODUCTION.md`
- `docs/server/SERVER_MAP.md`
- `docs/server/RUNBOOK.md`

These files document operational facts only. Never copy secrets from a server, local `.env`, password manager, keychain or backup into Git/chat.

A dated server snapshot must be re-verified before a production change.

## Never

- commit or paste passwords, marketplace API keys, tokens, private keys, `.env` files, database connection strings or secret recovery material;
- expose production PostgreSQL directly to the Internet;
- manually mutate production data as a shortcut;
- rebuild, remove, replace or restart the live production backend merely to test reproducibility;
- treat the old local sync server as production;
- merge or deploy recovery PR #3 before its Docker parity gate passes;
- run the recovery parity test through `docker compose up` in the live Hetzner production directory;
- change DNS, Caddy or UFW as part of the Docker parity gate;
- change the `kolyman.ru` domain binding without explicit owner approval;
- touch neighboring `n8n` or `amnezia-awg2` services unless the task explicitly targets them;
- weaken tests/lint/security checks just to make CI green;
- overwrite historical checkpoints to make current documentation look cleaner.

## Current production-backend gate

Before PR #3 can leave draft/merge readiness:

1. read its current full HEAD SHA from GitHub;
2. build a test-only `linux/amd64` image from that exact HEAD;
3. keep the current live image/container untouched;
4. run Docker-mode PostgreSQL/HTTP integration tests against the newly built image;
5. verify `/health`, `/ready`, login, organizations, logout and revoked-session behavior;
6. record full commit SHA, image tag, environment and PASS/FAIL;
7. only then discuss merge and a separate controlled rollout.

## Verification before finishing ordinary code work

```bash
npm test
npm run lint
npm run build
```

If production backend changed, also run the relevant `server/production` tests and the Docker parity/integration gate when the task requires it.

## Session completion protocol

Before declaring work complete:

1. review `git diff`;
2. run the required checks;
3. keep unrelated work out of the commit;
4. commit logical changes;
5. push the branch/commit to GitHub rather than leaving important work only on one computer;
6. update `PROJECT_STATUS.md` when current state, blocker or NEXT ACTION changes, but do not hardcode moving PR/branch SHAs there;
7. add a new checkpoint for a meaningful milestone instead of rewriting old checkpoints;
8. report commit SHA, checks performed, PASS/FAIL and blockers.

If something is unknown, write `MISSING` / `TO VERIFY` / `INCONSISTENT` rather than guessing.
