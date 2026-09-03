#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_SCRIPT="$REPO_ROOT/util/dev-runtime.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  echo "[test-dev-runtime] FAIL: $*" >&2
  exit 1
}

assert_equal() {
  [ "$1" = "$2" ] || fail "expected '$1' to equal '$2'"
}

assert_not_equal() {
  [ "$1" != "$2" ] || fail "expected values to differ"
}

assert_exists() {
  [ -e "$1" ] || fail "expected path to exist: $1"
}

assert_absent() {
  [ ! -e "$1" ] || fail "expected path to be absent: $1"
}

write_file() {
  local path="$1"
  local content="$2"

  mkdir -p "$(dirname "$path")"
  printf '%s\n' "$content" >"$path"
}

ROOT="$TEST_ROOT/repo"
FAKE_BIN="$TEST_ROOT/bin"
INSTALL_LOG="$TEST_ROOT/install.log"
CURL_LOG="$TEST_ROOT/curl.log"
DOCKER_LOG="$TEST_ROOT/docker.log"
DOCKER_VOLUME_STATE="$TEST_ROOT/docker-volume-state"
NEXT_APPS=(auth chat frontend-control frontend-manage frontend-pwa)
VOLUME_NAME='klicker-uzh-pnpm-store-v1'
mkdir -p "$ROOT/node_modules" "$FAKE_BIN"

write_file "$ROOT/package.json" '{"packageManager":"pnpm@11.5.0"}'
write_file "$ROOT/pnpm-lock.yaml" 'lockfileVersion: 9'
write_file "$ROOT/pnpm-workspace.yaml" 'packages: [apps/*, packages/*]'
write_file "$ROOT/packages/example/package.json" '{"name":"example"}'

for app in "${NEXT_APPS[@]}"; do
  write_file "$ROOT/apps/$app/package.json" "{\"name\":\"$app\"}"
  write_file "$ROOT/apps/$app/next.config.mjs" 'export default {}'
done
write_file "$ROOT/apps/chat/src/app/api/example/route.ts" 'export const GET = true'
write_file "$ROOT/apps/auth/src/pages/index.tsx" 'export default true'

write_file "$FAKE_BIN/pnpm" '#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
  echo "11.5.0"
  exit 0
fi
if [ -n "${KLICKER_TEST_PNPM_FAIL_MATCH:-}" ] && [[ "$*" == *"$KLICKER_TEST_PNPM_FAIL_MATCH"* ]]; then
  exit 17
fi
printf "%s\n" "$*" >>"$KLICKER_TEST_INSTALL_LOG"'
write_file "$FAKE_BIN/flock" '#!/usr/bin/env bash
exit 0'
write_file "$FAKE_BIN/curl" '#!/usr/bin/env bash
url="${!#}"
printf "%s\n" "$url" >>"$KLICKER_TEST_CURL_LOG"
case "$url" in
  */api/chatbots/*) printf "401\tapplication/json" ;;
  http://localhost:7081/healthz) printf "200\ttext/plain; charset=utf-8" ;;
  */healthz) printf "200\tapplication/json" ;;
  *) printf "307\ttext/html" ;;
esac'
write_file "$FAKE_BIN/mkcert" '#!/usr/bin/env bash
[ "${1:-}" = "-CAROOT" ] || exit 1
printf "%s\n" "$KLICKER_TEST_MKCERT_CAROOT"'
write_file "$FAKE_BIN/docker" '#!/usr/bin/env bash
volume_action=""
volume_name_present=false
previous=""
for arg in "$@"; do
  if [ "$previous" = "volume" ]; then
    volume_action="$arg"
  fi
  case "$arg" in
    "$KLICKER_TEST_DOCKER_VOLUME_NAME"|"--name=$KLICKER_TEST_DOCKER_VOLUME_NAME")
      volume_name_present=true
      ;;
  esac
  previous="$arg"
done

[ "$volume_name_present" = "true" ] || exit 2
if [ "$volume_action" = "inspect" ]; then
  [ -f "$KLICKER_TEST_DOCKER_VOLUME_STATE" ] || exit 1
  exit 0
fi
if [ "$volume_action" = "create" ]; then
  # A concurrent create and a genuine create failure both return non-zero;
  # initialize.sh distinguishes them by the follow-up inspect.
  if [ "${KLICKER_TEST_DOCKER_CREATE_RACE:-false}" = "true" ]; then
    touch "$KLICKER_TEST_DOCKER_VOLUME_STATE"
    exit 9
  fi
  [ "${KLICKER_TEST_DOCKER_CREATE_FAIL:-false}" != "true" ] || exit 9
  if [ ! -f "$KLICKER_TEST_DOCKER_VOLUME_STATE" ]; then
    touch "$KLICKER_TEST_DOCKER_VOLUME_STATE"
    printf "%s\n" "$KLICKER_TEST_DOCKER_VOLUME_NAME" >>"$KLICKER_TEST_DOCKER_LOG"
  fi
  exit 0
fi
exit 2'
chmod +x "$FAKE_BIN/pnpm" "$FAKE_BIN/flock" "$FAKE_BIN/curl" "$FAKE_BIN/mkcert" "$FAKE_BIN/docker"

export PATH="$FAKE_BIN:$PATH"
export KLICKER_TEST_INSTALL_LOG="$INSTALL_LOG"
export KLICKER_TEST_CURL_LOG="$CURL_LOG"
export KLICKER_TEST_DOCKER_LOG="$DOCKER_LOG"
export KLICKER_TEST_DOCKER_VOLUME_STATE="$DOCKER_VOLUME_STATE"
export KLICKER_TEST_DOCKER_VOLUME_NAME="$VOLUME_NAME"
export KLICKER_DEV_RUNTIME_ROOT="$ROOT"
export KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR="$TEST_ROOT/bootstrap-state"
export KLICKER_DEV_RUNTIME_GIT_HEAD=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

INIT_ROOT="$TEST_ROOT/init-repo/.devcontainer"
MKCERT_CAROOT="$TEST_ROOT/mkcert"
mkdir -p "$INIT_ROOT" "$MKCERT_CAROOT"
cp "$REPO_ROOT/.devcontainer/initialize.sh" "$INIT_ROOT/initialize.sh"
write_file "$MKCERT_CAROOT/rootCA.pem" 'test CA'
export KLICKER_TEST_MKCERT_CAROOT="$MKCERT_CAROOT"

if bash "$RUNTIME_SCRIPT" require-bootstrap >/dev/null 2>&1; then
  fail 'missing bootstrap completion marker was accepted'
fi
bash "$RUNTIME_SCRIPT" complete-bootstrap >/dev/null
bash "$RUNTIME_SCRIPT" require-bootstrap
assert_equal \
  "$(cat "$KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR/bootstrap-complete")" \
  'klicker-devcontainer-bootstrap-v1'
write_file "$KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR/bootstrap-complete" 'wrong-bootstrap-token'
if bash "$RUNTIME_SCRIPT" require-bootstrap >/dev/null 2>&1; then
  fail 'malformed bootstrap completion marker was accepted'
fi
bash "$RUNTIME_SCRIPT" complete-bootstrap >/dev/null
bash "$RUNTIME_SCRIPT" begin-bootstrap >/dev/null
assert_absent "$KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR/bootstrap-complete"
if bash "$RUNTIME_SCRIPT" require-bootstrap >/dev/null 2>&1; then
  fail 'invalidated bootstrap completion marker was accepted'
fi
write_file "$TEST_ROOT/outside-bootstrap-marker" 'klicker-devcontainer-bootstrap-v1'
ln -s "$TEST_ROOT/outside-bootstrap-marker" \
  "$KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR/bootstrap-complete"
if bash "$RUNTIME_SCRIPT" require-bootstrap >/dev/null 2>&1; then
  fail 'symlinked bootstrap completion marker was accepted'
fi
bash "$RUNTIME_SCRIPT" begin-bootstrap >/dev/null
bash "$RUNTIME_SCRIPT" complete-bootstrap >/dev/null
bash "$RUNTIME_SCRIPT" require-bootstrap

assert_before() {
  local file="$1" earlier="$2" later="$3" earlier_line later_line

  earlier_line="$(grep -nF -m1 "$earlier" "$file" | cut -d: -f1 || true)"
  later_line="$(grep -nF -m1 "$later" "$file" | cut -d: -f1 || true)"
  [ -n "$earlier_line" ] || fail "expected line in $file: $earlier"
  [ -n "$later_line" ] || fail "expected line in $file: $later"
  [ "$earlier_line" -lt "$later_line" ] || \
    fail "expected '$earlier' before '$later' in $file"
}

last_semantic_line() {
  awk '$0 !~ /^[[:space:]]*($|#)/ { line = $0 } END { print line }' "$1"
}

assert_before \
  "$REPO_ROOT/.devcontainer/post-create.sh" \
  'bash "$SCRIPT_ROOT/util/dev-runtime.sh" begin-bootstrap' \
  'ROOT="$(cd "$ROOT" && pwd)"'
assert_equal \
  "$(last_semantic_line "$REPO_ROOT/.devcontainer/post-create.sh")" \
  'bash "$ROOT/util/dev-runtime.sh" complete-bootstrap'
assert_before \
  "$REPO_ROOT/.devcontainer/post-start.sh" \
  'ROOT="$(cd "$ROOT" && pwd)"' \
  'bash "$ROOT/util/dev-runtime.sh" require-bootstrap'
assert_equal \
  "$(grep -Fc '/workspaces/klicker-uzh' "$REPO_ROOT/.devcontainer/post-start.sh")" \
  '1'
grep -Fq '"waitFor": "postCreateCommand"' \
  "$REPO_ROOT/.devcontainer/devcontainer.json" || \
  fail 'devcontainer does not wait for postCreateCommand'

mkdir -p \
  "$ROOT/.devcontainer" \
  "$ROOT/apps/response-api" \
  "$ROOT/apps/hatchet-worker-general" \
  "$ROOT/apps/hatchet-worker-response-processor" \
  "$ROOT/packages/graphql" \
  "$ROOT/util"
write_file "$ROOT/.devcontainer/devcontainer.env" ''
cp "$RUNTIME_SCRIPT" "$ROOT/util/dev-runtime.sh"
bash "$RUNTIME_SCRIPT" complete-bootstrap >/dev/null
if KLICKER_DEVCONTAINER_ROOT="$TEST_ROOT/missing-root" \
  bash "$REPO_ROOT/.devcontainer/post-create.sh" >/dev/null 2>&1; then
  fail 'post-create accepted a missing configured root'
fi
assert_absent "$KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR/bootstrap-complete"

bash "$RUNTIME_SCRIPT" complete-bootstrap >/dev/null
if KLICKER_DEVCONTAINER_ROOT="$ROOT" \
  KLICKER_HATCHET_TOKEN_FILE="$TEST_ROOT/missing-hatchet-token" \
  KLICKER_TEST_PNPM_FAIL_MATCH='exec turbo' \
  bash "$REPO_ROOT/.devcontainer/post-create.sh" >/dev/null 2>&1; then
  fail 'post-create ignored a failing middle bootstrap step'
fi
assert_absent "$KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR/bootstrap-complete"
: > "$INSTALL_LOG"
rm -f "$ROOT/node_modules/.klicker-dependency-fingerprint"
write_file "$TEST_ROOT/hatchet-token" 'synthetic-test-token'
bash "$RUNTIME_SCRIPT" begin-bootstrap >/dev/null
(
  cd "$TEST_ROOT"
  KLICKER_DEVCONTAINER_ROOT='repo' \
    KLICKER_HATCHET_TOKEN_FILE="$TEST_ROOT/hatchet-token" \
    bash "$REPO_ROOT/.devcontainer/post-create.sh" >/dev/null
)
assert_exists "$ROOT/.devcontainer/.hatchet.env"
grep -Fq 'HATCHET_CLIENT_TOKEN=synthetic-test-token' \
  "$ROOT/.devcontainer/.hatchet.env" || \
  fail 'relative post-create root wrote the Hatchet environment incorrectly'
bash "$RUNTIME_SCRIPT" require-bootstrap >/dev/null
: > "$INSTALL_LOG"
rm -f "$ROOT/node_modules/.klicker-dependency-fingerprint"

post_start_status=0
post_start_output="$(
  cd "$TEST_ROOT"
  KLICKER_DEVCONTAINER_ROOT='repo' \
    bash "$REPO_ROOT/.devcontainer/post-start.sh" 2>&1
)" || post_start_status=$?
[ "$post_start_status" -ne 0 ] || fail 'post-start bypassed the process-helper gate'
process_helper_error='Run devrouter ensure to start this managed application process.'
[[ "$post_start_output" == *"$process_helper_error"* ]] || \
  fail 'post-start did not use the configured root before its process-helper gate'

bash "$INIT_ROOT/initialize.sh"
bash "$INIT_ROOT/initialize.sh"
assert_equal "$(wc -l <"$DOCKER_LOG" | tr -d ' ')" '1'
assert_equal "$(cat "$INIT_ROOT/certs/rootCA.pem")" 'test CA'
assert_exists "$DOCKER_VOLUME_STATE"
rm -f "$DOCKER_VOLUME_STATE"
if KLICKER_TEST_DOCKER_CREATE_FAIL=true bash "$INIT_ROOT/initialize.sh" \
  >/dev/null 2>&1; then
  fail 'initializer ignored a Docker volume creation failure'
fi
rm -f "$DOCKER_VOLUME_STATE"
if ! KLICKER_TEST_DOCKER_CREATE_RACE=true bash "$INIT_ROOT/initialize.sh" \
  >/dev/null 2>&1; then
  fail 'initializer did not tolerate a concurrent Docker volume creation'
fi
assert_exists "$DOCKER_VOLUME_STATE"

base_fingerprint="$(bash "$RUNTIME_SCRIPT" fingerprint)"
write_file "$ROOT/apps/chat/src/app/api/example/route.ts" 'export const GET = false'
content_fingerprint="$(bash "$RUNTIME_SCRIPT" fingerprint)"
assert_equal "$base_fingerprint" "$content_fingerprint"

write_file "$ROOT/apps/chat/src/app/api/added/route.ts" 'export const GET = true'
path_fingerprint="$(bash "$RUNTIME_SCRIPT" fingerprint)"
assert_not_equal "$base_fingerprint" "$path_fingerprint"

write_file "$ROOT/apps/chat/next.config.mjs" 'export default { reactStrictMode: true }'
config_fingerprint="$(bash "$RUNTIME_SCRIPT" fingerprint)"
assert_not_equal "$path_fingerprint" "$config_fingerprint"

bash "$RUNTIME_SCRIPT" ensure-dependencies >/dev/null
bash "$RUNTIME_SCRIPT" ensure-dependencies >/dev/null
assert_equal "$(wc -l <"$INSTALL_LOG" | tr -d ' ')" '1'
read -ra install_args <<<"$(sed -n '1p' "$INSTALL_LOG")"
assert_equal "${install_args[0]}" 'install'
has_frozen_lockfile=false
has_prefer_offline=false
for arg in "${install_args[@]}"; do
  case "$arg" in
    --frozen-lockfile) has_frozen_lockfile=true ;;
    --prefer-offline) has_prefer_offline=true ;;
  esac
done
assert_equal "$has_frozen_lockfile" 'true'
assert_equal "$has_prefer_offline" 'true'

write_file "$ROOT/pnpm-lock.yaml" 'lockfileVersion: 9.1'
bash "$RUNTIME_SCRIPT" ensure-dependencies >/dev/null
assert_equal "$(wc -l <"$INSTALL_LOG" | tr -d ' ')" '2'

for app in "${NEXT_APPS[@]}"; do
  write_file "$ROOT/apps/$app/.next/dev/cache.bin" 'development cache'
  write_file "$ROOT/apps/$app/.next/production.bin" 'production cache'
done

runtime_fingerprint="$(bash "$RUNTIME_SCRIPT" fingerprint)"
bash "$RUNTIME_SCRIPT" start "$runtime_fingerprint" 0 -- true
for app in "${NEXT_APPS[@]}"; do
  assert_exists "$ROOT/apps/$app/.next/dev/cache.bin"
  assert_exists "$ROOT/apps/$app/.next/production.bin"
done

bash "$RUNTIME_SCRIPT" request-repair chat >/dev/null
assert_equal "$(bash "$RUNTIME_SCRIPT" generation)" '1'
write_file "$ROOT/apps/chat/.next/dev/cache.bin" 'stale development cache'
bash "$RUNTIME_SCRIPT" start "$runtime_fingerprint" 1 -- true
assert_absent "$ROOT/apps/chat/.next"
assert_exists "$ROOT/apps/auth/.next/production.bin"
assert_absent "$ROOT/.devcontainer/.runtime/next-repair-request"

write_file "$TEST_ROOT/outside-cache/marker" 'must survive'
ln -s "$TEST_ROOT/outside-cache" "$ROOT/apps/chat/.next"
bash "$RUNTIME_SCRIPT" request-repair chat >/dev/null
assert_equal "$(bash "$RUNTIME_SCRIPT" generation)" '2'
if bash "$RUNTIME_SCRIPT" start "$runtime_fingerprint" 2 -- true >/dev/null 2>&1; then
  fail 'symlinked cache was accepted'
fi
assert_exists "$TEST_ROOT/outside-cache/marker"
assert_exists "$ROOT/.devcontainer/.runtime/next-repair-request"

if bash "$RUNTIME_SCRIPT" request-repair unsupported >/dev/null 2>&1; then
  fail 'unsupported repair target was accepted'
fi
if bash "$RUNTIME_SCRIPT" request-repair response-api >/dev/null 2>&1; then
  fail 'non-Next.js readiness target was accepted for cache repair'
fi

# A stale pass can cover several apps at once: every requested app receives a
# full .next repair in one start, untouched apps keep their production output,
# and repeated requests for the same app stay deduplicated.
rm -f "$ROOT/apps/chat/.next"
rm -f "$ROOT/.devcontainer/.runtime/next-repair-request"
for app in "${NEXT_APPS[@]}"; do
  write_file "$ROOT/apps/$app/.next/dev/cache.bin" 'development cache'
  write_file "$ROOT/apps/$app/.next/production.bin" 'production cache'
done

bash "$RUNTIME_SCRIPT" request-repair frontend-manage >/dev/null
bash "$RUNTIME_SCRIPT" request-repair chat >/dev/null
bash "$RUNTIME_SCRIPT" request-repair chat >/dev/null
assert_equal "$(bash "$RUNTIME_SCRIPT" generation)" '5'
assert_equal \
  "$(LC_ALL=C sort "$ROOT/.devcontainer/.runtime/next-repair-request" | tr '\n' ' ')" \
  'chat frontend-manage '
bash "$RUNTIME_SCRIPT" start "$runtime_fingerprint" 5 -- true
assert_absent "$ROOT/apps/chat/.next"
assert_absent "$ROOT/apps/frontend-manage/.next"
assert_exists "$ROOT/apps/auth/.next/production.bin"
assert_exists "$ROOT/apps/frontend-pwa/.next/production.bin"
assert_absent "$ROOT/.devcontainer/.runtime/next-repair-request"

assert_equal \
  "$(bash "$RUNTIME_SCRIPT" classify-response auth-json 401 'application/json; charset=utf-8')" \
  'ready: HTTP 401 application/json; charset=utf-8'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response auth-json 404 'text/html; charset=utf-8'
)" || classification_status=$?
assert_equal "$classification_status" '20'
assert_equal "$classification_output" 'stale: HTTP 404 text/html; charset=utf-8'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response auth-json 500 application/json
)" || classification_status=$?
assert_equal "$classification_status" '22'
assert_equal "$classification_output" 'unexpected: HTTP 500 application/json'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response auth-json 404 application/json
)" || classification_status=$?
assert_equal "$classification_status" '22'
assert_equal "$classification_output" 'unexpected: HTTP 404 application/json'

assert_equal \
  "$(bash "$RUNTIME_SCRIPT" classify-response html-shell 200 'text/html; charset=utf-8')" \
  'ready: HTTP 200 text/html; charset=utf-8'
assert_equal \
  "$(bash "$RUNTIME_SCRIPT" classify-response html-shell 307 'text/html')" \
  'ready: HTTP 307 text/html'
assert_equal \
  "$(bash "$RUNTIME_SCRIPT" classify-response html-shell 307 '')" \
  'ready: HTTP 307 redirect'
assert_equal \
  "$(bash "$RUNTIME_SCRIPT" classify-response health-json 200 'application/json; charset=utf-8')" \
  'ready: HTTP 200 application/json; charset=utf-8'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response health-json 404 'text/html'
)" || classification_status=$?
assert_equal "$classification_status" '22'
assert_equal "$classification_output" 'unexpected: HTTP 404 text/html'

assert_equal \
  "$(bash "$RUNTIME_SCRIPT" classify-response health-text 200 'text/plain; charset=utf-8')" \
  'ready: HTTP 200 text/plain; charset=utf-8'

# The stale Next.js classification must not apply to text probes: a 404
# from the lecturer MCP health endpoint is unexpected, not stale.
classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response health-text 404 'text/html'
)" || classification_status=$?
assert_equal "$classification_status" '22'
assert_equal "$classification_output" 'unexpected: HTTP 404 text/html'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response html-shell 404 'text/html'
)" || classification_status=$?
assert_equal "$classification_status" '20'
assert_equal "$classification_output" 'stale: HTTP 404 text/html'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response html-shell 500 'text/html'
)" || classification_status=$?
assert_equal "$classification_status" '22'
assert_equal "$classification_output" 'unexpected: HTTP 500 text/html'

classification_status=0
classification_output="$(
  bash "$RUNTIME_SCRIPT" classify-response html-shell 200 'application/json'
)" || classification_status=$?
assert_equal "$classification_status" '22'
assert_equal "$classification_output" 'unexpected: HTTP 200 application/json'

if bash "$RUNTIME_SCRIPT" classify-response unknown-mode 200 'text/html' >/dev/null 2>&1; then
  fail 'unknown probe mode was accepted'
fi
if bash "$RUNTIME_SCRIPT" probe-app unsupported >/dev/null 2>&1; then
  fail 'app without a probe contract was accepted'
fi

: >"$CURL_LOG"
READINESS_APPS=response-api bash "$RUNTIME_SCRIPT" doctor >/dev/null
assert_equal "$(cat "$CURL_LOG")" 'http://localhost:7078/healthz'

: >"$CURL_LOG"
READINESS_APPS='response-api mcp-lecturer' bash "$RUNTIME_SCRIPT" doctor >/dev/null
assert_equal "$(cat "$CURL_LOG")" $'http://localhost:7078/healthz\nhttp://localhost:7081/healthz'

: >"$CURL_LOG"
READINESS_APPS='' bash "$RUNTIME_SCRIPT" doctor >/dev/null
[ ! -s "$CURL_LOG" ] || fail 'capability-only doctor probed an unselected app'

: >"$CURL_LOG"
unset READINESS_APPS
bash "$RUNTIME_SCRIPT" doctor >/dev/null
assert_equal "$(wc -l <"$CURL_LOG" | tr -d ' ')" '6'

echo '[test-dev-runtime] PASS'
