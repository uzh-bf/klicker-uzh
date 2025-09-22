#!/bin/sh

# Run doppler secrets first to ensure we have the environment loaded
eval $(doppler secrets download --no-file --format env --config stg)

PGPASSWORD="${DATABASE_PASS}" pg_restore --host="${DATABASE_HOST}" --port=5432 --user="${DATABASE_USER}" --dbname="${DATABASE_NAME}" --no-owner --format="t" dump.tar
