#!/bin/sh
set -e

# Ensure the data directory exists (named volume may be empty on first run)
mkdir -p "$(dirname "$DB_PATH")"

# Seed is fully idempotent: INSERT OR IGNORE on reference data,
# user-count guard on the admin user, and never deletes existing rows.
echo "🌱 Running database seed (idempotent) against $DB_PATH"
node server/db/seed.js

exec "$@"
