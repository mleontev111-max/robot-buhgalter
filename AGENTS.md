# AGENTS.md — Robot-Buhgalter

These rules apply to every human or AI contributor working in this repository.

## Before any change

1. Read `README.md`.
2. Read `PROJECT_STATUS.md`.
3. Read the latest file in `checkpoints/`.
4. If the task touches production backend/recovery, read draft PR #3 and its current blocker.
5. Check `git status`, current branch and current HEAD before editing.
6. Confirm whether the task is frontend/local MVP work or production-backend work. Do not mix the two accidentally.

## Architecture boundary

- `server/index.mjs` is the local/legacy read-only sync server.
- It is **not** the current production backend.
- Current production backend source is being recovered/canonicalized in PR #3 under `server/production/`.
- `kolyman.ru` is the canonical public frontend domain.
- Live operational/server details are intentionally kept in private operational documentation and must not be copied into this public repository when they contain sensitive information.

## Never

- commit or paste passwords, marketplace API keys, tokens, private keys, `.env` files, database connection strings or secret recovery material;
- expose production PostgreSQL directly to the Internet;
- manually mutate production data as a shortcut;
- rebuild, remove, replace or restart the live production backend merely to test reproducibility;
- treat the old local sync server as production;
- merge or deploy recovery PR #3 before its Docker parity gate passes;
- change the `kolyman.ru` domain binding without explicit owner approval;
- weaken tests/lint/security checks just to make CI green;
- overwrite historical checkpoints to make current documentation look cleaner.

## Current production-backend gate

Before PR #3 can leave draft/merge readiness:

1. build a test-only `linux/amd64` image from the recovery branch;
2. keep the current live image/container untouched;
3. run Docker-mode PostgreSQL/HTTP integration tests against the newly built image;
4. verify `/health`, `/ready`, login, organizations, logout and revoked-session behavior;
5. record commit SHA, image tag and PASS/FAIL;
6. only then discuss merge and a separate controlled rollout.

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
6. update `PROJECT_STATUS.md` when current state, blocker or NEXT ACTION changes;
7. add a new checkpoint for a meaningful milestone instead of rewriting old checkpoints;
8. report commit SHA, checks performed, PASS/FAIL and blockers.

If something is unknown, write `MISSING` / `TO VERIFY` rather than guessing.
