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
L='--filter=@klicker-uzh/mcp-lecturer'
T='--filter=@klicker-uzh/frontend-control'
R='--filter=@klicker-uzh/response-api'
W1='--filter=@klicker-uzh/hatchet-worker-general'
W2='--filter=@klicker-uzh/hatchet-worker-response-processor'

# selection|wants klicker-dev|wants klicker-local-mcp|wants klicker-workers|turbo filters|readiness apps
CASES="
full|yes|yes|yes||auth chat frontend-control frontend-manage frontend-pwa response-api
manage|yes|no|no|$B $A $M|auth frontend-manage
pwa|yes|no|no|$B $A $P|auth frontend-pwa
chat|yes|no|no|$B $A $C $P|auth chat frontend-pwa
live-quiz|yes|no|yes|$B $A $P $T $R $W1 $W2|auth frontend-control frontend-pwa response-api
ai|no|no|no|||
mcp|no|yes|no|||
email|no|no|no|||
chat,mcp|yes|yes|no|$B $A $C $P|auth chat frontend-pwa
mcp,chat|yes|yes|no|$B $A $C $P|auth chat frontend-pwa
chat,chat|yes|no|no|$B $A $C $P|auth chat frontend-pwa
manage,email|yes|no|no|$B $A $M|auth frontend-manage
ai,chat|yes|no|no|$B $A $C $P|auth chat frontend-pwa
chat,pwa|yes|no|no|$B $A $C $P|auth chat frontend-pwa
pwa,chat|yes|no|no|$B $A $C $P|auth chat frontend-pwa
chat,manage|yes|no|no|$B $A $C $P $M $L|auth chat frontend-pwa frontend-manage mcp-lecturer
manage,chat|yes|no|no|$B $A $C $P $M $L|auth chat frontend-pwa frontend-manage mcp-lecturer
"

while IFS='|' read -r selection wants_dev wants_mcp wants_workers want_filters want_readiness; do
  [ -n "$selection" ] || continue
  export DEVROUTER_PROFILE="$selection"

  if profile_wants klicker-dev; then
    [ "$wants_dev" = yes ] || fail "$selection must not select klicker-dev"
  else
    status=$?
    [ "$status" -eq 1 ] || fail "$selection: profile_wants failed unexpectedly ($status)"
    [ "$wants_dev" = no ] || fail "$selection must select klicker-dev"
  fi

  if profile_wants klicker-workers; then
    [ "$wants_workers" = yes ] || fail "$selection must not select klicker-workers"
  else
    status=$?
    [ "$status" -eq 1 ] || fail "$selection: worker selection failed unexpectedly ($status)"
    [ "$wants_workers" = no ] || fail "$selection must select klicker-workers"
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

# The resolver trims separator-adjacent whitespace because DEVROUTER_PROFILE
# may also be set manually during diagnosis.
export DEVROUTER_PROFILE='manage, pwa'
[ "$(profile_turbo_filters)" = "$B $A $M $P" ] ||
  fail 'separator-adjacent whitespace changed the merged profile'
[ "$(profile_readiness_apps)" = 'auth frontend-manage frontend-pwa' ] ||
  fail 'separator-adjacent whitespace changed merged readiness'

status=0
profile_wants unsupported-marker || status=$?
[ "$status" -eq 2 ] || fail "unknown marker must fail closed with exit 2 (got $status)"

# Sourceable resolver entry points preserve devrouter's fail-closed grammar.
for selection in '' ',manage' 'manage,' 'manage,,pwa' 'manage, ,pwa'; do
  export DEVROUTER_PROFILE="$selection"
  for resolver in profile_wants profile_turbo_filters profile_readiness_apps; do
    status=0
    if [ "$resolver" = profile_wants ]; then
      profile_wants klicker-dev >/dev/null || status=$?
    else
      "$resolver" >/dev/null || status=$?
    fi
    [ "$status" -eq 2 ] ||
      fail "malformed selection '$selection' was accepted by $resolver (got $status)"
  done
done

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
