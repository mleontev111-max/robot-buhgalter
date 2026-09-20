# Production backend staging scaffold

This directory is the production-oriented backend recovered for canonicalization in PR #3. It is intentionally separate from the legacy local sync proxy in `server/index.mjs`.

## Security invariants

- Every business record is scoped by `organization_id`.
- API access requires an unexpired opaque bearer session stored only as a SHA-256 hash.
- Membership and role are checked before organization-scoped queries.
- PostgreSQL RLS applies the same membership boundary as defense in depth.
- Composite tenant foreign keys prevent cross-organization relationships.
- Marketplace credentials are encrypted with AES-256-GCM and are never returned by list/create endpoints.
- Account creation and future secret changes must write an audit event.
- There is no in-memory or localStorage fallback when production configuration is absent.

## Required runtime configuration

```text
DATABASE_URL=postgresql://...
CREDENTIALS_ENCRYPTION_KEY=<32 random bytes encoded as base64>
DATABASE_SSL=require
PORT=8788
```

Generate the encryption key with a secrets manager or `openssl rand -base64 32`. Store it outside Git. Losing it makes credentials unrecoverable; leaking it requires rotating all marketplace secrets.

The PostgreSQL driver is pinned in both the root development lockfile and the isolated backend lockfile. For local development run:

```text
npm run db:migrate
npm run server:production
```

`npm run test:db` uses a disposable `postgres:16-alpine` container and removes it after checking migrations, RLS, roles, tenant foreign keys and operation idempotency. Set `ROBOT_BUHGALTER_TEST_IMAGE=robot-buhgalter-api:test` to include the built API image and database readiness/API checks in the test.

## Implemented backend scope

The recovered backend already provides:

- `GET /health`;
- `GET /ready` with a real PostgreSQL readiness query;
- `POST /auth/login` with rate limiting and opaque 12-hour server-side sessions;
- authenticated `/v1/*` routes;
- `POST /v1/auth/logout` with session revocation;
- `GET /v1/organizations`;
- marketplace-account list/create routes under an organization;
- PostgreSQL migrations, tenant isolation/RLS and encrypted marketplace credentials.

The backend should **not** be represented as having completed the whole product migration. Frontend migration from browser `localStorage`, complete accounting API coverage, production frontend-to-API routing and background sync jobs remain separate/incomplete work unless a later verified checkpoint says otherwise.

Production migrations must use a separate migration/owner connection. The runtime `robot_buhgalter_app` role receives only the grants in `sql/app-role-grants.sql` and must not own or alter the schema.

## Initial owner and sessions

After migrations, the initial owner can be created exactly once with the migration/owner connection:

```text
BOOTSTRAP_EMAIL=...
BOOTSTRAP_PASSWORD=...
BOOTSTRAP_DISPLAY_NAME=...
BOOTSTRAP_ORGANIZATION_NAME=...
BOOTSTRAP_LEGAL_FORM=ip
npm run auth:bootstrap
```

The password must be supplied through a protected process environment or secret mechanism, never committed or written to shell history. Bootstrap refuses to run after any user exists. Runtime login is `POST /auth/login`; it returns an opaque 12-hour bearer token once. `POST /v1/auth/logout` revokes its server-side session. The frontend must not persist the bearer token in `localStorage`.

## Recovery merge gate

Source/unit/local-DB verification is not enough to merge or deploy PR #3. The remaining gate is to build a **test-only** `linux/amd64` image from the current PR HEAD and run the Docker-mode PostgreSQL/HTTP integration test against that built image. Do not replace or rebuild the current live production container as part of this test.
