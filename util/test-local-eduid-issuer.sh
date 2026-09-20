#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="$REPO_ROOT/util/local-eduid-issuer.sh"
# shellcheck source=/dev/null
. "$HELPER"

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  echo "[test-local-eduid-issuer] FAIL: $*" >&2
  exit 1
}

HOSTS="$TEST_ROOT/hosts"
HOSTS_PRISTINE="$TEST_ROOT/hosts.pristine"
RESOLVED_LOOKUP="$TEST_ROOT/resolved-lookup"
FAILING_LOOKUP="$TEST_ROOT/failing-lookup"
FLAKY_LOOKUP="$TEST_ROOT/flaky-lookup"
FLAKY_COUNTER="$TEST_ROOT/flaky-counter"

printf '#!/usr/bin/env bash\nprintf "%%s\\n" "198.51.100.7 devrouter-traefik"\n' \
  >"$RESOLVED_LOOKUP"
# getent exits 2 without output when a name cannot be resolved.
printf '#!/usr/bin/env bash\nexit 2\n' >"$FAILING_LOOKUP"
printf '#!/usr/bin/env bash\nset -euo pipefail\ncount=0\nif [ -f "%s" ]; then count="$(cat "%s")"; fi\ncount=$((count + 1))\nprintf "%%s\\n" "$count" >"%s"\n[ "$count" -ge 3 ] || exit 2\nprintf "%%s\\n" "198.51.100.7 devrouter-traefik"\n' \
  "$FLAKY_COUNTER" "$FLAKY_COUNTER" "$FLAKY_COUNTER" >"$FLAKY_LOOKUP"
chmod +x "$RESOLVED_LOOKUP" "$FAILING_LOOKUP" "$FLAKY_LOOKUP"

# Every case points the helper at a throwaway hosts file, so a regression can
# never touch the real /etc/hosts of the machine running this test.
reset_case() {
  unset EDUID_CLIENT_SECRET LOCAL_EDUID_STATE LOCAL_EDUID_REASON
  export DEVROUTER_PROFILE=''
  export LOCAL_EDUID_HOSTS_FILE="$HOSTS"
  export LOCAL_EDUID_HOSTS_LOOKUP="$RESOLVED_LOOKUP"
  export LOCAL_EDUID_LOOKUP_ATTEMPTS=1
  export LOCAL_EDUID_LOOKUP_SLEEP_SECONDS=0
  printf '127.0.0.1\tlocalhost\n' >"$HOSTS"
  cp "$HOSTS" "$HOSTS_PRISTINE"
}

assert_state() {
  [ "$LOCAL_EDUID_STATE" = "$1" ] ||
    fail "$2: state '$LOCAL_EDUID_STATE' instead of '$1' (${LOCAL_EDUID_REASON})"
}

assert_hosts_untouched() {
  cmp -s "$HOSTS" "$HOSTS_PRISTINE" || fail "$1: rewrote the hosts file"
}

assert_host_maps_to() {
  # Compare the fields literally: a pattern would treat the dots as wildcards
  # and could accept a different host or address.
  local found
  found="$(awk -v host="$1" -v address="$2" '
    $2 == host { entries += 1; if ($1 == address) exact = 1 }
    END { printf "entries=%d exact=%d", entries, exact + 0 }
  ' "$HOSTS")"
  [ "$found" = 'entries=1 exact=1' ] ||
    fail "$3: hosts file does not map exactly one '$1' entry to '$2' ($found)"
}

# The plain-localhost fallback needs no hosts entry in either spelling.
for issuer in 'http://localhost:8090/default' 'http://127.0.0.1:8090/default'; do
  reset_case
  local_eduid_wire "$issuer"
  assert_state enabled "plain-localhost issuer $issuer"
  assert_hosts_untouched "plain-localhost issuer $issuer"
done

# A routed issuer resolves through Traefik and keeps unrelated entries.
reset_case
DEVROUTER_PROFILE='manage,eduid'
local_eduid_wire 'https://oidc.klicker.localhost/default'
assert_state enabled 'routed issuer'
assert_host_maps_to 'oidc.klicker.localhost' '198.51.100.7' 'routed issuer'
grep -q -E '^127\.0\.0\.1[[:space:]]+localhost$' "$HOSTS" ||
  fail 'routed issuer dropped an unrelated hosts entry'

# Repeated runs replace the previous mapping instead of appending duplicates.
printf '203.0.113.9 oidc.klicker.localhost\n203.0.113.9 oidc.klicker.other.localhost\n' \
  >>"$HOSTS"
cp "$HOSTS" "$HOSTS_PRISTINE"
local_eduid_wire 'https://oidc.klicker.localhost/default'
assert_state enabled 'repeated routed issuer'
assert_host_maps_to 'oidc.klicker.localhost' '198.51.100.7' 'repeated routed issuer'
grep -q -E '^203\.0\.113\.9[[:space:]]+oidc\.klicker\.other\.localhost$' "$HOSTS" ||
  fail 'repeated routed issuer dropped another checkout-host entry'

# Bounded retries absorb a lookup that only answers after the first attempt.
reset_case
rm -f "$FLAKY_COUNTER"
LOCAL_EDUID_HOSTS_LOOKUP="$FLAKY_LOOKUP" LOCAL_EDUID_LOOKUP_ATTEMPTS=3
local_eduid_wire 'https://oidc.klicker.retry.localhost/default'
assert_state enabled 'retried lookup'
assert_host_maps_to 'oidc.klicker.retry.localhost' '198.51.100.7' 'retried lookup'

# An exhausted lookup degrades instead of terminating a `set -e` caller, and
# leaves the hosts file alone. This is the regression guard for the startup
# abort that a failing lookup used to cause.
reset_case
lookup_status=0
lookup_output="$(DEVROUTER_PROFILE='full' \
  LOCAL_EDUID_HOSTS_FILE="$HOSTS" \
  LOCAL_EDUID_HOSTS_LOOKUP="$FAILING_LOOKUP" \
  LOCAL_EDUID_LOOKUP_ATTEMPTS=1 \
  LOCAL_EDUID_LOOKUP_SLEEP_SECONDS=0 \
  bash -c '
    set -euo pipefail
    . "$1"
    local_eduid_wire "https://oidc.klicker.localhost/default"
    printf "state=%s\n" "$LOCAL_EDUID_STATE"
    printf "reason=%s\n" "$([ -n "$LOCAL_EDUID_REASON" ] && echo set || echo empty)"
    echo "startup-continued"
  ' _ "$HELPER")" || lookup_status=$?
# A regression would end the sub-shell early, so report it here instead of
# letting the test's own set -e stop before the assertions below.
[ "$lookup_status" -eq 0 ] ||
  fail "exhausted lookup terminated the caller (exit $lookup_status): $lookup_output"
case "$lookup_output" in
  *state=disabled*) ;;
  *) fail "exhausted lookup must disable the mock, got: $lookup_output" ;;
esac
case "$lookup_output" in
  *reason=set*) ;;
  *) fail "disabled mock must report a reason, got: $lookup_output" ;;
esac
case "$lookup_output" in
  *startup-continued*) ;;
  *) fail "exhausted lookup aborted a set -e caller, got: $lookup_output" ;;
esac
assert_hosts_untouched 'exhausted lookup'

# An unusable hosts file degrades the same way instead of aborting.
reset_case
LOCAL_EDUID_HOSTS_FILE="$TEST_ROOT"
DEVROUTER_PROFILE='full'
local_eduid_wire 'https://oidc.klicker.localhost/default'
assert_state disabled 'unusable hosts file'

# A configured provider always wins, and no hosts entry is prepared for it.
reset_case
DEVROUTER_PROFILE='full'
EDUID_CLIENT_SECRET='configured-by-the-deployment'
local_eduid_wire 'https://oidc.klicker.localhost/default'
assert_state external 'configured provider'
assert_hosts_untouched 'configured provider'

# Selections outside the mock and malformed input stay distinguishable.
reset_case
DEVROUTER_PROFILE='manage,pwa'
local_eduid_wire 'https://oidc.klicker.localhost/default'
assert_state not-selected 'application profile'
assert_hosts_untouched 'application profile'

reset_case
DEVROUTER_PROFILE='manage,'
local_eduid_wire 'https://oidc.klicker.localhost/default'
assert_state invalid 'malformed selection'
assert_hosts_untouched 'malformed selection'

reset_case
DEVROUTER_PROFILE='eduid'
local_eduid_wire 'http://oidc.example.com:8090/default'
assert_state disabled 'unsupported issuer'
assert_hosts_untouched 'unsupported issuer'

# Selection detection: unset means the devrouter default (`full`).
while IFS='|' read -r selection status; do
  export DEVROUTER_PROFILE="$selection"
  got=0
  local_eduid_selection_selects_mock || got=$?
  [ "$got" -eq "$status" ] ||
    fail "selection '$selection': got status $got instead of $status"
done <<'CASES'
|0
full|0
eduid|0
manage,eduid|0
eduid,ai|0
manage|1
manage,pwa|1
playwright|1
manage,|2
,manage|2
manage,,pwa|2
CASES

echo '[test-local-eduid-issuer] PASS'
