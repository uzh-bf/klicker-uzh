#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESET_SQL="$(cd "$SCRIPT_DIR/.." && pwd)/reset-stg-owned-objects.sql"
CONTAINER_NAME="klicker-refresh-reset-test-${RANDOM}-$$"
POSTGRES_IMAGE="${POSTGRES_TEST_IMAGE:-postgres:17-alpine}"

skip() {
  printf '1..1\n'
  printf 'ok 1 - owner-safe reset SQL integration # SKIP %s\n' "$1"
  exit 0
}

command -v docker >/dev/null 2>&1 || skip 'docker is unavailable'
docker info >/dev/null 2>&1 || skip 'docker daemon is unavailable'
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 \
  || skip "$POSTGRES_IMAGE is not available locally (test does not pull images)"
[[ -r "$RESET_SQL" ]] || {
  printf 'not ok 1 - reset SQL is unreadable\n' >&2
  exit 1
}

cleanup() {
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=synthetic-integration-password \
  "$POSTGRES_IMAGE" >/dev/null

ready=false
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || {
  printf 'not ok 1 - disposable PostgreSQL did not become ready\n' >&2
  exit 1
}

docker exec -i "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 \
  -U postgres -d postgres >/dev/null <<'SQL'
ALTER SCHEMA public OWNER TO postgres;
CREATE ROLE refresh_app LOGIN;
CREATE ROLE schema_observer;
GRANT USAGE, CREATE ON SCHEMA public TO refresh_app;
GRANT USAGE ON SCHEMA public TO schema_observer;
CREATE TABLE public.admin_sentinel (id integer PRIMARY KEY);
SET ROLE refresh_app;
CREATE TYPE public.refresh_state AS ENUM ('ready', 'done');
CREATE SEQUENCE public.refresh_sequence;
CREATE TABLE public.refresh_table (
  id integer DEFAULT nextval('public.refresh_sequence'),
  state public.refresh_state NOT NULL
);
CREATE VIEW public.refresh_view AS SELECT id FROM public.refresh_table;
CREATE MATERIALIZED VIEW public.refresh_materialized AS
  SELECT count(*) AS row_count FROM public.refresh_table;
CREATE FUNCTION public.refresh_function(value integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT value + 1';
RESET ROLE;
SQL

docker exec -i "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 \
  -U refresh_app -d postgres -f - <"$RESET_SQL" >/dev/null

result="$(
  docker exec -i "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 \
    -U postgres -d postgres -At -F '|' <<'SQL'
SELECT
  pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'public')),
  has_schema_privilege('schema_observer', 'public', 'USAGE'),
  to_regclass('public.admin_sentinel') IS NOT NULL,
  (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND pg_get_userbyid(c.relowner) = 'refresh_app'
  ),
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_get_userbyid(p.proowner) = 'refresh_app'
  ),
  (
    SELECT count(*)
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND pg_get_userbyid(t.typowner) = 'refresh_app'
      AND t.typrelid = 0
  );
SQL
)"

printf '1..1\n'
if [[ "$result" == 'postgres|t|t|0|0|0' ]]; then
  printf 'ok 1 - reset removes app-owned objects and preserves schema owner, grants, and admin objects\n'
else
  printf 'not ok 1 - unexpected post-reset state: %s\n' "$result" >&2
  exit 1
fi
