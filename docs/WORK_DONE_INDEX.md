# WORK DONE INDEX — historical lookup

Use this file to answer **“did we already do this?”** quickly. It is not the source for the current ONE NEXT ACTION; current work starts at `START_HERE_FOR_AI.md`.

| Area | Durable evidence | Integration state |
|---|---|---|
| Frontend/main | Project Ready normalized; ordinary gate is test + lint + build | `main` |
| Production backend recovery | Source tree, migrations, auth/tenancy/security helpers recovered | unmerged PR #3 |
| Production backend tests | Unit tests + local PostgreSQL integration pass | unmerged PR #3 |
| Docker reproducibility | `Dockerfile.backend` restored with deterministic dependency install | unmerged PR #3 |
| Docker parity | **NOT DONE** — exact-head image build + Docker-mode HTTP/PostgreSQL E2E still required | blocker before PR #3 merge |

## Do not rebuild by default

Do not re-recover the production backend, rewrite migrations, or recreate the already-restored Dockerfile just to remember what happened. Resume from PR #3 and its registered workstream state. The next missing proof is Docker parity, not source recovery.
