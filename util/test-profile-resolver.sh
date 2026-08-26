#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
. "$REPO_ROOT/util/profile-resolver.sh"

fail() {
  echo "[test-profile-resolver] FAIL: $*" >&2
  exit 1
}

B='--filter=@klicker-uzh/backend-docker'
A='--filter=@klicker-uzh/auth'
M='--filter=@klicker-uzh/frontend-manage'
P='--filter=@klicker-uzh/frontend-pwa'
C='--filter=@klicker-uzh/chat'
T='--filter=@klicker-uzh/frontend-control'
R='--filter=@klicker-uzh/response-api'
W1='--filter=@klicker-uzh/hatchet-worker-general'
W2='--filter=@klicker-uzh/hatchet-worker-response-processor'

# selection|wants klicker-dev|wants klicker-local-mcp|turbo filters|readiness apps
CASES="
full|yes|yes||auth chat frontend-control frontend-manage frontend-pwa response-api
manage|yes|no|$B $A $M|auth frontend-manage
pwa|yes|no|$B $A $P|auth frontend-pwa
chat|yes|no|$B $A $C $P|auth chat frontend-pwa
live-quiz|yes|no|$B $A $P $T $R $W1 $W2|auth frontend-control frontend-pwa response-api
ai|no|no|||
mcp|no|yes|||
email|no|no|||
chat,mcp|yes|yes|$B $A $C $P|auth chat frontend-pwa
mcp,chat|yes|yes|$B $A $C $P|auth chat frontend-pwa
chat,chat|yes|no|$B $A $C $P|auth chat frontend-pwa
manage,email|yes|no|$B $A $M|auth frontend-manage
ai,chat|yes|no|$B $A $C $P|auth chat frontend-pwa
chat,pwa|yes|no|$B $A $C $P|auth chat frontend-pwa
pwa,chat|yes|no|$B $A $C $P|auth chat frontend-pwa
"

while IFS='|' read -r selection wants_dev wants_mcp want_filters want_readiness; do
  [ -n "$selection" ] || continue
  export DEVROUTER_PROFILE="$selection"
  eval "want_filters=\"$want_filters\""
  eval "want_readiness=\"$want_readiness\""

  if profile_wants klicker-dev; then
    [ "$wants_dev" = yes ] || fail "$selection must not select klicker-dev"
  else
    status=$?
    [ "$status" -eq 1 ] || fail "$selection: profile_wants failed unexpectedly ($status)"
    [ "$wants_dev" = no ] || fail "$selection must select klicker-dev"
  fi

  if profile_wants klicker-local-mcp; then
    [ "$wants_mcp" = yes ] || fail "$selection must not select klicker-local-mcp"
  else
    status=$?
    [ "$status" -eq 1 ] || fail "$selection: profile_wants failed unexpectedly ($status)"
    [ "$wants_mcp" = no ] || fail "$selection must select klicker-local-mcp"
  fi

  got_filters="$(profile_turbo_filters)"
  got_readiness="$(profile_readiness_apps)"
  [ "$got_filters" = "$want_filters" ] || fail "$selection filters: got '$got_filters' want '$want_filters'"
  [ "$got_readiness" = "$want_readiness" ] || fail "$selection readiness: got '$got_readiness' want '$want_readiness'"
done <<<"$CASES"

# Unknown components fail closed with exit 2 from every resolver entry point.
export DEVROUTER_PROFILE="chat,does-not-exist"
status=0
profile_wants klicker-dev || status=$?
[ "$status" -eq 2 ] || fail "unknown selection must fail closed with exit 2 (got $status)"
status=0
profile_turbo_filters >/dev/null || status=$?
[ "$status" -eq 2 ] || fail "unknown selection filters must exit 2 (got $status)"
status=0
profile_readiness_apps >/dev/null || status=$?
[ "$status" -eq 2 ] || fail "unknown selection readiness must exit 2 (got $status)"

echo '[test-profile-resolver] PASS'
