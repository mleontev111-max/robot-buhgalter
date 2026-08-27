# Production backend staging scaffold

This directory is the first production-oriented backend increment. It is intentionally separate from the legacy local sync proxy in `server/index.mjs`.

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

`npm run test:db` uses a disposable `postgres:16-alpine` container and removes it after checking migrations, RLS, roles, tenant foreign keys and operation idempotency. Set `ROBOT_BUHGALTER_TEST_IMAGE=robot-buhgalter-api:test` to include the built API image and database readiness endpoint in the check.

The scaffold stores the accounting ledger schema, but does not yet provide login/session issuance, accounting endpoints, frontend migration or background sync jobs. Those are deliberately not represented as complete.

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
