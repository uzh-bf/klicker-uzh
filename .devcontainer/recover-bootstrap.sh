#!/usr/bin/env bash
# Reconstruct app prerequisites after replacing the application container.
# Role and database provisioning must already be complete. With the explicit
# initialization option, verify both disposable identities before schema push
# and synthetic seeding; otherwise only verify the existing schema.
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
  require_file "$ROOT/packages/prisma/package.json" \
    'packages/prisma/package.json'
  (
    cd "$ROOT/packages/prisma"
    pnpm exec tsx -e "$(cat <<'TS'
import pg from "pg"
import {
  assertDisposableDatabaseIdentity,
  assertNoPostgresEnvironmentOverrides,
  disposableDatabaseIdentityQuery,
  validateDisposableDatabaseUrl,
} from "./src/disposableDatabase.ts"

assertNoPostgresEnvironmentOverrides()

const requiredSchemaColumns = [
  { table_name: "User", column_name: "id" },
  { table_name: "User", column_name: "email" },
  { table_name: "User", column_name: "shortname" },
  { table_name: "User", column_name: "betaEnabled" },
  { table_name: "Course", column_name: "id" },
  { table_name: "Course", column_name: "name" },
  { table_name: "Course", column_name: "ownerId" },
  { table_name: "Course", column_name: "isGamificationEnabled" },
  { table_name: "Participant", column_name: "id" },
  { table_name: "Participant", column_name: "username" },
  { table_name: "Element", column_name: "id" },
  { table_name: "Element", column_name: "ownerId" },
]

const check = async (
  connectionString: string | undefined,
  database: "klicker_test" | "klicker_test_shadow",
  requireSchema: boolean
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

    if (requireSchema) {
      const schema = await client.query({
        text: `
          SELECT required.table_name, required.column_name
          FROM jsonb_to_recordset($2::jsonb)
            AS required(table_name text, column_name text)
          LEFT JOIN information_schema.columns AS available
            ON available.table_schema = $1
           AND available.table_name = required.table_name
           AND available.column_name = required.column_name
          WHERE available.table_name IS NULL
          ORDER BY required.table_name, required.column_name`,
        values: ["public", JSON.stringify(requiredSchemaColumns)],
      })
      if (schema.rows.length !== 0) {
        throw new Error("Application schema is not ready")
      }
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function main() {
try {
  await check(process.env.DATABASE_URL, "klicker_test", process.env.KLICKER_RECOVERY_IDENTITY_ONLY !== "1")
  await check(process.env.SHADOW_DATABASE_URL, "klicker_test_shadow", false)
} catch {
  console.error(
    "[recover-bootstrap] Disposable database identity or schema readiness check failed."
  )
  process.exitCode = 1
}
}
void main()
TS
)"
  ) || die 'Marked disposable databases or the application schema are not ready.'
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

export CI=true
export npm_config_verify_deps_before_run=false
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
  KLICKER_RECOVERY_IDENTITY_ONLY=1 verify_databases
  pnpm --filter @klicker-uzh/prisma run prisma:push:raw
  pnpm --filter @klicker-uzh/prisma-data run seed:raw
elif [ "$#" -ne 0 ]; then
  die 'Unsupported recovery bootstrap argument.'
fi
verify_databases

echo '[recover-bootstrap] Bootstrap prerequisites are ready; publishing marker.'
bash "$ROOT/util/dev-runtime.sh" complete-bootstrap
