#!/bin/sh
set -eu

# Fail fast with a clear message instead of a raw stack trace from
# security.mjs/db.mjs deep inside the app if required runtime
# configuration is missing. Does NOT run migrations here on purpose:
# migrations need a separate migration/owner DB connection, not the
# restricted runtime role in DATABASE_URL (see server/production/README.md).
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${CREDENTIALS_ENCRYPTION_KEY:?CREDENTIALS_ENCRYPTION_KEY is required}"

exec "$@"
