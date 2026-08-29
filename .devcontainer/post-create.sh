#!/usr/bin/env bash
# Runs once when the dev container is created. Installs deps, builds the
# workspace packages the apps import, prepares the DB, and picks up the Hatchet
# token. Every routed app plus the two Hatchet workers.
ROOT="${KLICKER_DEVCONTAINER_ROOT:-/workspaces/klicker-uzh}"
HATCHET_TOKEN_FILE="${KLICKER_HATCHET_TOKEN_FILE:-/config/authdisabled-token}"
set -euo pipefail
bash "$ROOT/util/dev-runtime.sh" begin-bootstrap
cd "$ROOT"

# DevPod truncates env_file values at '=' (a URL ...?schema=public arrives as
# ...?schema). Re-source the canonical env file so values with '=' are intact. (GOTCHAS #1)
set -a
. "$ROOT/.devcontainer/devcontainer.env"
set +a

# No-TTY pnpm hardening: CI=true auto-confirms a stale node_modules purge;
# verify-deps-before-run=false stops implicit installs hanging on stdin. (GOTCHAS #18)
export CI=true
export npm_config_verify_deps_before_run=false

# Retry a command through transient failures (e.g. fresh-Postgres warmup);
# print a clear error and return non-zero if it never succeeds (caller `|| exit 1`).
# Usage: retry <attempts> <label> <cmd...>   (5s between attempts)
retry() {
  local attempts=$1 label=$2 i; shift 2
  for i in $(seq 1 "$attempts"); do
    if "$@"; then return 0; fi
    echo "[post-create] ${label} attempt ${i}/${attempts} failed; retrying in 5s..." >&2
    sleep 5
  done
  echo "[post-create] ERROR: ${label} never succeeded" >&2
  return 1
}

echo "[post-create] Installing dependencies (pnpm)..."
pnpm install --prefer-offline --no-frozen-lockfile
bash ./util/dev-runtime.sh stamp-dependencies

# Build the workspace PACKAGES (graphql, prisma, util, markdown, transactional,
# types, i18n, ...) the apps import — turbo orders them by their dep graph, and
# prisma's build runs `prisma generate`. ALSO pre-build backend-docker: its dev
# is `rollup --watch` + `nodemon` in PARALLEL, and nodemon launches
# dist/index.js immediately — if rollup hasn't emitted it yet, nodemon crashes
# with MODULE_NOT_FOUND and waits, so the API never comes up. Pre-building means
# dist/index.js exists before `turbo dev` starts. The Next apps use `next dev`
# (compile on the fly) so they are NOT pre-built. (GOTCHAS: build the graph
# before any dev server.)
echo "[post-create] Building workspace packages + backend (turbo)..."
pnpm exec turbo run build --filter='./packages/*' --filter=@klicker-uzh/backend-docker --filter=@klicker-uzh/lti-service

# Prepare the database. klicker's prisma:reset prompts (and the non-interactive
# variants wrap Infisical), so call prisma directly with --force. A brand-new
# Postgres volume has a short warmup where it emits an empty search_path (42601)
# even though pg_isready is healthy — retry. (GOTCHAS #12)
echo "[post-create] Resetting + pushing Prisma schema (retrying through DB warmup)..."
retry 12 "prisma reset/push" bash -c '
  pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force \
  && pnpm --filter @klicker-uzh/prisma run prisma:push:raw' || exit 1

echo "[post-create] Seeding test data (lecturer/abcd, testuser1..50/abcdabcd)..."
retry 5 "prisma-data seed" pnpm --filter @klicker-uzh/prisma-data run seed:raw || exit 1

# response-api uses `tsx --watch --env-file=.env`; both Hatchet workers use
# nodemon with `node --env-file .env`. Node 24 HARD-ERRORS if .env is missing
# (it's --env-file, not --env-file-if-exists). We keep no per-app .env contents
# in the container — every var comes from the inherited container env
# (devcontainer.env). Seed an EMPTY .env in each dir so the runners resolve the
# file; empty adds nothing, so the container env wins. (Copying .env.example
# would wrongly override the compose-DNS hosts with localhost.) touch is
# idempotent and never clobbers existing contents. (GOTCHAS #28)
echo "[post-create] Seeding empty per-app .env files (dev runners need the file present)..."
for app in response-api hatchet-worker-general hatchet-worker-response-processor; do
  touch "$ROOT/apps/${app}/.env"
done

# Hatchet client token — automatically created by hatchet-lite-dev at the path
# configured by HATCHET_TOKEN_FILE.
# The backend's HatchetClient.init runs at MODULE LOAD (not lazy), so the backend
# CRASHES at boot without it — capture it here so post-start sources it before
# turbo dev.
echo "[post-create] Waiting for the Hatchet client token ($HATCHET_TOKEN_FILE)..."
HATCHET_ENV="$ROOT/.devcontainer/.hatchet.env"
: > "$HATCHET_ENV"
for attempt in $(seq 1 30); do
  if [ -s "$HATCHET_TOKEN_FILE" ]; then
    TOKEN=$(tr -d '[:space:]' < "$HATCHET_TOKEN_FILE")
    echo "HATCHET_CLIENT_TOKEN=${TOKEN}" > "$HATCHET_ENV"
    echo "[post-create] Hatchet token captured from $HATCHET_TOKEN_FILE."

    # Populate packages/graphql/.env for Vitest
    cat <<EOF > "$ROOT/packages/graphql/.env"
HATCHET_CLIENT_TOKEN=${TOKEN}
HATCHET_CLIENT_HOST_PORT=hatchet:7077
HATCHET_CLIENT_TLS_STRATEGY=none
HATCHET_LOG_LEVEL=INFO
EOF
    echo "[post-create] Wrote Hatchet token to packages/graphql/.env"
    break
  fi
  sleep 1
done
if [ ! -s "$HATCHET_ENV" ]; then
  echo "[post-create] WARNING: /config/authdisabled-token not present yet; backend will wait for post-start or container env." >&2
fi

echo "[post-create] Bootstrap steps succeeded; publishing completion marker."
bash "$ROOT/util/dev-runtime.sh" complete-bootstrap
