#!/usr/bin/env bash
# Host-side Playwright runner for KlickerUZH.
#
# Runs E2E specs from the host against whichever local runtime is reachable
# and maps all test URLs (plus the global-setup seed DATABASE_URL) to it:
#
#   linked       devrouter linked worktree   https://{app}.klicker.<workspace>.localhost
#   primary      devrouter primary checkout  https://{app}.klicker.localhost
#   devcontainer plain primary container     http://localhost:<port>
#   host         plain host-run apps          http://127.0.0.1:<port>
#
# Browser binaries and node_modules stay on the host (shared pnpm store and
# Playwright's platform cache), so nothing is ever downloaded into DevPods.
#
# Usage:
#   bash util/run-host-e2e.sh --print
#   bash util/run-host-e2e.sh --project=chromium tests/A-login.spec.ts
#   pnpm --filter @klicker-uzh/playwright test:host -- --project=chromium tests/A-login.spec.ts
#
# Environment overrides:
#   E2E_MODE=auto|linked|primary|devcontainer|host
#                                        force a runtime mode (default: auto)
#   E2E_WORKSPACE=<token>               linked-workspace token; see devrouter workspace ls
#   E2E_DATABASE_URL=...                full DATABASE_URL override
#   E2E_SKIP_INSTALL=1                  skip the host dependency bootstrap
#   E2E_NO_VERIFY=1                     skip reachability probes (mapping inspection only)
#
# Container-local dependencies remain inside the runtime and are exercised
# through the routed applications. Playwright itself always runs on the host.
# The existing Playwright global setup resets and reseeds DATABASE_URL; target
# only a disposable local test database.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_ENV_FILE="$REPO_ROOT/.devcontainer/devcontainer.env"

log() { printf '[host-e2e] %s\n' "$*"; }
die() { printf '[host-e2e] ERROR: %s\n' "$*" >&2; exit 1; }

PRINT=0
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --print) PRINT=1 ;;
    --) ;;
    *) ARGS+=("$1") ;;
  esac
  shift
done

# --- runtime detection ------------------------------------------------------

reachable() { curl -kfsS --max-time 4 -o /dev/null "$1" 2>/dev/null; }
compose_container() {
  docker ps \
    --filter "label=com.docker.compose.project.working_dir=$REPO_ROOT/.devcontainer" \
    --filter "label=com.docker.compose.service=$1" \
    --format '{{.Names}}' 2>/dev/null | head -1
}
compose_publishes_port() {
  local container
  container="$(compose_container "$1")"
  [[ -n "$container" ]] || return 1
  [[ -n "$(docker port "$container" "$2/tcp" 2>/dev/null)" ]]
}
NO_VERIFY="${E2E_NO_VERIFY:-0}"

GIT_COMMON="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir)"
IS_LINKED_WORKTREE=0
if [[ "$GIT_COMMON" != "$REPO_ROOT/.git" ]]; then
  IS_LINKED_WORKTREE=1
fi

MODE="${E2E_MODE:-auto}"
WORKSPACE="${E2E_WORKSPACE:-}"

if [[ -z "$WORKSPACE" && ( "$MODE" == linked || "$MODE" == auto ) && "$IS_LINKED_WORKTREE" == 1 ]]; then
  BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
  if [[ -z "$BRANCH" ]]; then
    die "cannot derive a workspace token from detached HEAD; set E2E_WORKSPACE (see: devrouter workspace ls)"
  fi
  WORKSPACE="${BRANCH//\//-}"
fi

case "$MODE" in
  auto)
    if [[ "$IS_LINKED_WORKTREE" == 1 ]]; then
      PROBE="https://api.klicker.${WORKSPACE}.localhost/healthz"
      if [[ "$NO_VERIFY" == 1 ]] || reachable "$PROBE"; then
        MODE=linked
      elif compose_publishes_port app 3002 && reachable http://localhost:3002; then
        MODE=devcontainer
      elif reachable http://127.0.0.1:3002; then
        MODE=host
      else
        die "linked workspace '$WORKSPACE' is not reachable at $PROBE
  start the runtime:   devrouter ensure .
  wrong token?         devrouter workspace ls  ->  E2E_WORKSPACE=<token>
  plain devcontainer:  E2E_MODE=devcontainer
  host-run apps:       E2E_MODE=host
  (long branch names can get truncated in the devrouter workspace token)"
      fi
    elif [[ "$NO_VERIFY" == 1 ]] || reachable https://api.klicker.localhost/healthz; then
      MODE=primary
    elif compose_publishes_port app 3002 && reachable http://localhost:3002; then
      MODE=devcontainer
    elif reachable http://127.0.0.1:3000/healthz || reachable http://127.0.0.1:3002; then
      MODE=host
    else
      die "no local runtime detected
  primary devcontainer:  devrouter ensure .
  plain devcontainer:    E2E_MODE=devcontainer
  host-run apps:         pnpm run dev:playwright  (then E2E_MODE=host)
  force a mode:          E2E_MODE=linked|primary|devcontainer|host"
    fi
    ;;
  linked)
    if [[ -z "$WORKSPACE" ]]; then
      die "E2E_MODE=linked needs a workspace token; set E2E_WORKSPACE (see: devrouter workspace ls)"
    fi
    if [[ "$NO_VERIFY" != 1 ]]; then
      reachable "https://api.klicker.${WORKSPACE}.localhost/healthz" \
        || die "linked workspace '$WORKSPACE' is not reachable; start it with: devrouter ensure ."
    fi
    ;;
  primary)
    if [[ "$NO_VERIFY" != 1 ]]; then
      reachable https://api.klicker.localhost/healthz \
        || die "primary devcontainer routes are not reachable; start them with: devrouter ensure ."
    fi
    ;;
  devcontainer)
    if [[ "$NO_VERIFY" != 1 ]]; then
      reachable http://localhost:3002 \
        || die "no Manage app on localhost:3002; start the primary devcontainer or choose another E2E_MODE"
    fi
    ;;
  host)
    if [[ "$NO_VERIFY" != 1 ]]; then
      reachable http://127.0.0.1:3002 \
        || die "no host-run Manage app on 127.0.0.1:3002; start one with: pnpm run dev:playwright"
    fi
    ;;
  *)
    die "E2E_MODE must be auto, linked, primary, devcontainer, or host"
    ;;
esac

# --- URL and database mapping -----------------------------------------------

case "$MODE" in
  linked)
    URL_STUDENT="https://pwa.klicker.${WORKSPACE}.localhost"
    URL_MANAGE="https://manage.klicker.${WORKSPACE}.localhost"
    URL_CONTROL="https://control.klicker.${WORKSPACE}.localhost"
    URL_CHAT="https://chat.klicker.${WORKSPACE}.localhost"
    URL_AUTH="https://auth.klicker.${WORKSPACE}.localhost"
    APP_ORIGIN_AUTH="${URL_AUTH}"
    COOKIE_DOMAIN="klicker.${WORKSPACE}.localhost"
    DB_ROUTE_HOST="db.klicker.${WORKSPACE}.localhost"
    ;;
  primary)
    URL_STUDENT="https://pwa.klicker.localhost"
    URL_MANAGE="https://manage.klicker.localhost"
    URL_CONTROL="https://control.klicker.localhost"
    URL_CHAT="https://chat.klicker.localhost"
    URL_AUTH="https://auth.klicker.localhost"
    APP_ORIGIN_AUTH="${URL_AUTH}"
    COOKIE_DOMAIN="klicker.localhost"
    DB_ROUTE_HOST="db.klicker.localhost"
    ;;
  devcontainer)
    URL_STUDENT="http://localhost:3001"
    URL_MANAGE="http://localhost:3002"
    URL_CONTROL="http://localhost:3003"
    URL_CHAT="http://localhost:3004"
    URL_AUTH="http://localhost:3010"
    APP_ORIGIN_AUTH="${URL_AUTH}"
    COOKIE_DOMAIN="localhost"
    DB_HOSTPORT="localhost:5432"
    DB_PARAMS=""
    ;;
  host)
    URL_STUDENT="http://127.0.0.1:3001"
    URL_MANAGE="http://127.0.0.1:3002"
    URL_CONTROL="http://127.0.0.1:3003"
    URL_CHAT="http://127.0.0.1:3004"
    URL_AUTH="http://127.0.0.1:3010"
    DB_HOSTPORT="127.0.0.1:5432"
    DB_PARAMS=""
    ;;
esac
URL_STUDENT_LOGIN="${URL_STUDENT}/login"

# --- seed database target ---------------------------------------------------
#
# node-postgres cannot send libpq's sslnegotiation=direct handshake, so the
# Traefik SNI-routed db.*.localhost URL deadlocks its TLS negotiation (the
# routed URL stays correct for psql/libpq tooling). The workspace Postgres is
# a plain container, and OrbStack exposes containers to the host as
# <container>.orb.local — connect there directly instead.
DB_HOSTPORT=""
DB_PARAMS=""
DATABASE_URL_OVERRIDE="${E2E_DATABASE_URL:-}"
if [[ -n "$DATABASE_URL_OVERRIDE" ]]; then
  DB_HOSTPORT="(override)"
elif [[ "$MODE" == linked || "$MODE" == primary ]]; then
  POSTGRES_CONTAINER="$(compose_container postgres)"
  if [[ -n "$POSTGRES_CONTAINER" ]]; then
    DB_HOSTPORT="${POSTGRES_CONTAINER}.orb.local:5432"
    if [[ "$NO_VERIFY" != 1 ]] \
      && command -v nc >/dev/null 2>&1 \
      && ! nc -z -w 3 "${POSTGRES_CONTAINER}.orb.local" 5432 \
        >/dev/null 2>&1; then
      die "workspace Postgres is not reachable at $DB_HOSTPORT
  OrbStack exposes this address automatically; on another Docker runtime,
  set E2E_DATABASE_URL to a host-reachable disposable PostgreSQL database"
    fi
  else
    die "workspace Postgres container not found
  the routed database URL at ${DB_ROUTE_HOST} requires libpq direct TLS,
  which Node Postgres cannot negotiate; set E2E_DATABASE_URL to a
  host-reachable PostgreSQL endpoint instead"
  fi
elif [[ "$MODE" == devcontainer ]]; then
  DB_HOSTPORT="localhost:5432"
else
  DB_HOSTPORT="127.0.0.1:5432"
fi

# Credentials and database name come from the committed dev-only env file, so
# this script never duplicates them; only the host:port and TLS mode change.
if [[ -n "$DATABASE_URL_OVERRIDE" ]]; then
  DATABASE_URL="$DATABASE_URL_OVERRIDE"
else
  DB_TEMPLATE="$(grep -E '^DATABASE_URL=' "$DEV_ENV_FILE" | head -1 | cut -d= -f2-)"
  if [[ ! "$DB_TEMPLATE" =~ ^postgres(ql)?://([^:/@]+):([^@/]+)@[^/]+/(.+)$ ]]; then
    die "cannot parse DATABASE_URL from $DEV_ENV_FILE"
  fi
  DB_USER="${BASH_REMATCH[2]}"
  DB_PASS="${BASH_REMATCH[3]}"
  DB_NAME="${BASH_REMATCH[4]}"
  DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOSTPORT}/${DB_NAME}${DB_PARAMS}"
fi

APP_SECRET="$(grep -E '^APP_SECRET=' "$DEV_ENV_FILE" | head -1 | cut -d= -f2-)"
if [[ -z "$APP_SECRET" ]]; then
  APP_SECRET=abcd
fi

if [[ "$PRINT" == 1 ]]; then
  log "mode:          $MODE"
  log "workspace:     ${WORKSPACE:-(none)}"
  log "URL_STUDENT:   $URL_STUDENT"
  log "URL_MANAGE:    $URL_MANAGE"
  log "URL_CONTROL:   $URL_CONTROL"
  log "URL_CHAT:      $URL_CHAT"
  log "URL_AUTH:      $URL_AUTH"
  log "APP_ORIGIN_AUTH: ${APP_ORIGIN_AUTH:-(default http://127.0.0.1:3010)}"
  log "COOKIE_DOMAIN:   ${COOKIE_DOMAIN:-(origin-only cookies)}"
  if [[ -n "$DATABASE_URL_OVERRIDE" ]]; then
    log "DATABASE_URL:  (from E2E_DATABASE_URL; value hidden)"
  else
    log "DATABASE_URL:  postgres://${DB_USER}:***@${DB_HOSTPORT}/${DB_NAME}${DB_PARAMS}"
  fi
  log "APP_SECRET:    (from devcontainer.env)"
  log "skip probes:   $NO_VERIFY"
  exit 0
fi

export URL_STUDENT URL_STUDENT_LOGIN URL_MANAGE URL_CONTROL URL_CHAT URL_AUTH
export APP_ORIGIN_AUTH COOKIE_DOMAIN
export PLAYWRIGHT_BASE_URL="$URL_STUDENT"
export DATABASE_URL APP_SECRET

# --- host bootstrap ---------------------------------------------------------

if command -v volta >/dev/null 2>&1; then
  PNPM=(volta run pnpm)
else
  PNPM=(pnpm)
fi

if [[ "${E2E_SKIP_INSTALL:-0}" != 1 ]]; then
  if [[ ! -d "$REPO_ROOT/node_modules/@playwright" && ! -d "$REPO_ROOT/playwright/node_modules/@playwright/test" ]]; then
    log "host node_modules missing -> filtered install (one-time per worktree; shared pnpm store)"
    (cd "$REPO_ROOT" && "${PNPM[@]}" install --filter '@klicker-uzh/playwright...' --frozen-lockfile)
  fi
  if [[ ! -f "$REPO_ROOT/packages/prisma/dist/index.js" || ! -d "$REPO_ROOT/packages/prisma/src/prisma/client" ]]; then
    log "building @klicker-uzh/prisma and @klicker-uzh/types (needed by global-setup seeding)"
    (cd "$REPO_ROOT" && "${PNPM[@]}" --filter '@klicker-uzh/prisma' run build)
    (cd "$REPO_ROOT" && "${PNPM[@]}" --filter '@klicker-uzh/types' run build)
  fi
  # Headless Chromium launches the smaller headless shell; --only-shell avoids
  # the full Chrome-for-Testing download. A --headed run needs the full
  # browser once: pnpm --filter @klicker-uzh/playwright exec playwright install chromium
  log "ensuring host headless Chromium (shared Playwright browser cache)"
  (cd "$REPO_ROOT" && "${PNPM[@]}" --filter '@klicker-uzh/playwright' exec playwright install --only-shell chromium)
fi

# --- run --------------------------------------------------------------------

log "mode=$MODE workspace=${WORKSPACE:-(none)} manage=$URL_MANAGE db=${DB_HOSTPORT}"
log "global setup will reset and reseed the mapped local database"
(cd "$REPO_ROOT" && "${PNPM[@]}" --filter '@klicker-uzh/playwright' exec playwright test ${ARGS[@]+"${ARGS[@]}"})
