#!/usr/bin/env bash
# Reconstruct app prerequisites after replacing the application container.
# Role and database provisioning must already be complete. With the explicit
# initialization option, verify both disposable identities and empty databases
# before schema push and synthetic seeding; otherwise verify the existing schema.
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${KLICKER_DEVCONTAINER_ROOT:-/workspaces/klicker-uzh}"
HATCHET_TOKEN_FILE="${KLICKER_HATCHET_TOKEN_FILE:-/config/authdisabled-token}"

die() {
  echo "[recover-bootstrap] ERROR: $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || die "Required file is missing: $2"
}

write_secret_file() {
  local target="$1" content="$2" temporary

  temporary="$(mktemp "${target}.tmp.XXXXXX")" ||
    die "Unable to prepare runtime secret output."
  if ! printf '%s\n' "$content" >"$temporary" ||
    ! mv "$temporary" "$target"; then
    rm -f -- "$temporary"
    die "Unable to write runtime secret output."
  fi
}

capture_hatchet_token() {
  local token hatchet_env

  [ -s "$HATCHET_TOKEN_FILE" ] || return 0
  token="$(tr -d '[:space:]' <"$HATCHET_TOKEN_FILE")"
  [ -n "$token" ] || return 0

  hatchet_env="$ROOT/.devcontainer/.hatchet.env"
  write_secret_file "$hatchet_env" "HATCHET_CLIENT_TOKEN=$token"
  write_secret_file "$ROOT/packages/graphql/.env" "HATCHET_CLIENT_TOKEN=$token
HATCHET_CLIENT_HOST_PORT=hatchet:7077
HATCHET_CLIENT_TLS_STRATEGY=none
HATCHET_LOG_LEVEL=INFO"
  echo "[recover-bootstrap] Captured the existing Hatchet token."
}

verify_databases() {
  local require_empty=false
  if [ "${1:-}" = '--require-empty' ]; then
    require_empty=true
  fi
  require_file "$ROOT/packages/prisma/package.json" \
    'packages/prisma/package.json'
  (
    cd "$ROOT/packages/prisma"
    pnpm exec tsx -e "const requireEmpty = $require_empty
$(cat <<'TS'
import pg from "pg"
import {
  assertDisposableDatabaseIdentity,
  assertNoPostgresEnvironmentOverrides,
  disposableDatabaseIdentityQuery,
  validateDisposableDatabaseUrl,
} from "./src/disposableDatabase.ts"

assertNoPostgresEnvironmentOverrides()

const check = async (
  connectionString: string | undefined,
  database: "klicker_test" | "klicker_test_shadow"
) => {
  const validated = validateDisposableDatabaseUrl(connectionString, database)
  const client = new pg.Client({
    connectionString: validated,
    connectionTimeoutMillis: 10_000,
  })
  try {
    await client.connect()
    const identity = await client.query(disposableDatabaseIdentityQuery)
    assertDisposableDatabaseIdentity(identity.rows, database)
    if (requireEmpty) {
      const result = await client.query(`
        SELECT NOT (
          EXISTS (
            SELECT 1 FROM pg_catalog.pg_namespace
            WHERE nspname !~ '^pg_' AND nspname NOT IN ('public', 'information_schema')
          ) OR EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          ) OR EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          ) OR EXISTS (
            SELECT 1 FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
          ) OR EXISTS (
            SELECT 1 FROM pg_catalog.pg_extension WHERE extname <> 'plpgsql'
          ) OR EXISTS (SELECT 1 FROM pg_catalog.pg_largeobject_metadata)
            OR EXISTS (SELECT 1 FROM pg_catalog.pg_foreign_server)
            OR EXISTS (SELECT 1 FROM pg_catalog.pg_publication)
        ) AS empty
      `)
      if (result.rows.length !== 1 || result.rows[0]?.empty !== true) {
        throw new Error("Fresh initialization requires empty databases.")
      }
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function main() {
try {
  await check(process.env.DATABASE_URL, "klicker_test")
  await check(process.env.SHADOW_DATABASE_URL, "klicker_test_shadow")
} catch {
  console.error(
    requireEmpty
      ? "[recover-bootstrap] Fresh disposable database verification failed."
      : "[recover-bootstrap] Disposable database identity check failed."
  )
  process.exitCode = 1
}
}
void main()
TS
)"
  ) || die 'Marked disposable databases are not ready.'
}

verify_schema() {
  local status=0

  # Compare the complete Prisma-managed schema without replaying migrations
  # or changing either database. Raw engine diagnostics may contain URLs.
  (
    cd "$ROOT/packages/prisma"
    pnpm exec prisma migrate diff --config prisma.config.ts \
      --from-config-datasource --to-schema src/prisma/schema --exit-code \
      >/dev/null 2>&1
  ) || status=$?
  case "$status" in
    0) ;;
    2) die 'Retained application schema differs from the current Prisma schema; startup refused. No schema changes were applied.' ;;
    *) die 'Application schema comparison failed; startup refused. No schema changes were applied.' ;;
  esac
}

# Invalidate the old marker before resolving any other prerequisite. The
# application cannot start successfully while this run is incomplete.
bash "$SCRIPT_ROOT/../util/dev-runtime.sh" begin-bootstrap >/dev/null

ROOT="$(cd "$ROOT" && pwd)" || die 'Configured container root is unavailable.'
require_file "$ROOT/.devcontainer/devcontainer.env" \
  '.devcontainer/devcontainer.env'
require_file "$ROOT/util/dev-runtime.sh" 'util/dev-runtime.sh'

cd "$ROOT"

# Re-source the canonical environment so values containing '=' survive the
# container env-file handling. Sourced values stay in the process environment.
set -a
# shellcheck source=/dev/null
. "$ROOT/.devcontainer/devcontainer.env"
set +a

# Install explicitly before build or verification; retain the workspace's
# verifyDepsBeforeRun: error policy for every subsequent pnpm command.
export CI=true
umask 077

echo '[recover-bootstrap] Installing frozen dependencies.'
pnpm install --frozen-lockfile --prefer-offline
bash "$ROOT/util/dev-runtime.sh" stamp-dependencies

echo '[recover-bootstrap] Building workspace packages, backend, and LTI.'
pnpm exec turbo run build \
  --filter='./packages/*' \
  --filter=@klicker-uzh/backend-docker \
  --filter=@klicker-uzh/lti-service

echo '[recover-bootstrap] Ensuring required empty app environment files.'
for app in response-api hatchet-worker-general hatchet-worker-response-processor; do
  env_file="$ROOT/apps/$app/.env"
  if [ ! -e "$env_file" ] && [ ! -L "$env_file" ]; then
    : >"$env_file"
  fi
done

capture_hatchet_token
if [ "${1:-}" = '--initialize-new-disposable' ]; then
  verify_databases --require-empty
  pnpm --filter @klicker-uzh/prisma run prisma:push:raw
  pnpm --filter @klicker-uzh/prisma-data run seed:raw
elif [ "$#" -ne 0 ]; then
  die 'Unsupported recovery bootstrap argument.'
fi
verify_databases
verify_schema

echo '[recover-bootstrap] Bootstrap prerequisites are ready; publishing marker.'
bash "$ROOT/util/dev-runtime.sh" complete-bootstrap
