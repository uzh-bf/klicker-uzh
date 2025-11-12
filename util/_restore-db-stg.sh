#!/bin/sh

infisical run --env stg -- sh -c 'PGPASSWORD="$DATABASE_PASS" pg_restore --host="$DATABASE_HOST" --port=6432 --username="$DATABASE_USER" --dbname="$DATABASE_NAME" --no-owner --format="t" dump.tar'