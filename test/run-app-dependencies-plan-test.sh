#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=/dev/null
source "$ROOT_DIR/util/_app_dependencies_lib.sh"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_eq() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  if [[ "$expected" != "$actual" ]]; then
    fail "$label: expected '$expected', got '$actual'"
  fi
}

assert_plan() {
  local mode="$1"
  local profile="$2"
  local apps="$3"
  local services="$4"
  local skip_build="$5"
  local skip_prisma="$6"
  local skip_schema_sync="$7"
  local no_proxy="$8"

  KLICKER_PLATFORM_OVERRIDE=mac resolve_run_app_dependencies_plan \
    "$mode" \
    "$profile" \
    "$apps" \
    "$services" \
    "$skip_build" \
    "$skip_prisma" \
    "$skip_schema_sync" \
    "$no_proxy"
}

assert_plan local '' '' '' false false false false
assert_eq 'postgres redis_exec redis_assessment redis_cache reverse_proxy_macos hatchet' "$PLAN_COMPOSE_SERVICES" 'default compose services'
assert_eq 'yes' "$PLAN_HAS_CONTEXT" 'default has context'
assert_eq 'yes' "$PLAN_SHOULD_SYNC_SCHEMA" 'default schema sync'
assert_eq 'yes' "$PLAN_SHOULD_CREATE_SSL" 'default ssl certs'
assert_eq 'yes' "$PLAN_SHOULD_CREATE_HATCHET_TOKEN" 'default hatchet token'
assert_eq 'setup' "$PLAN_PRISMA_ACTION" 'default prisma action'
assert_eq 'prompt' "$PLAN_BUILD_ACTION" 'default build action'

assert_plan local 'graphql' '' '' false false false false
assert_eq 'postgres redis_exec redis_cache hatchet' "$PLAN_COMPOSE_SERVICES" 'graphql compose services'
assert_eq 'yes' "$PLAN_HAS_CONTEXT" 'graphql has context'
assert_eq 'no' "$PLAN_SHOULD_CREATE_SSL" 'graphql ssl certs'
assert_eq 'graphql' "$PLAN_HATCHET_TOKEN_KIND" 'graphql token kind'
assert_eq 'setup' "$PLAN_PRISMA_ACTION" 'graphql prisma action'
assert_eq 'prompt' "$PLAN_BUILD_ACTION" 'graphql build action'

assert_plan local '' 'backend,response-api' '' false false false false
assert_eq 'postgres redis_exec redis_cache hatchet' "$PLAN_COMPOSE_SERVICES" 'backend aliases compose services'
assert_eq 'graphql' "$PLAN_HATCHET_TOKEN_KIND" 'backend aliases use graphql token kind'

assert_plan local '' 'manage' 'redis_assessment' true true true true
assert_eq 'postgres redis_exec redis_assessment redis_cache hatchet' "$PLAN_COMPOSE_SERVICES" 'union services without proxy'
assert_eq 'no' "$PLAN_SHOULD_SYNC_SCHEMA" 'skip schema sync'
assert_eq 'no' "$PLAN_SHOULD_CREATE_SSL" 'skip ssl when proxy removed'
assert_eq 'none' "$PLAN_PRISMA_ACTION" 'skip prisma'
assert_eq 'skipped' "$PLAN_BUILD_ACTION" 'skip build'

assert_plan cypress '' '' 'postgres,hatchet' false false false false
assert_eq 'postgres hatchet' "$PLAN_COMPOSE_SERVICES" 'cypress selected services'
assert_eq 'yes' "$PLAN_SHOULD_CREATE_HATCHET_TOKEN" 'cypress hatchet token'
assert_eq 'cypress' "$PLAN_HATCHET_TOKEN_KIND" 'cypress token kind'
assert_eq 'reset' "$PLAN_PRISMA_ACTION" 'cypress prisma action'
assert_eq 'none' "$PLAN_BUILD_ACTION" 'service-only build action'

printf 'PASS: run-app-dependencies plan resolution\n'
