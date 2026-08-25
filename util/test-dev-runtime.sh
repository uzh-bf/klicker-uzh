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
DOCKER_LOG="$TEST_ROOT/docker.log"
DOCKER_VOLUME_STATE="$TEST_ROOT/docker-volume-state"
NEXT_APPS=(auth chat frontend-control frontend-manage frontend-pwa)
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
printf "%s\n" "$*" >>"$KLICKER_TEST_INSTALL_LOG"'
write_file "$FAKE_BIN/flock" '#!/usr/bin/env bash
exit 0'
write_file "$FAKE_BIN/mkcert" '#!/usr/bin/env bash
[ "${1:-}" = "-CAROOT" ] || exit 1
printf "%s\n" "$KLICKER_TEST_MKCERT_CAROOT"'
write_file "$FAKE_BIN/docker" '#!/usr/bin/env bash
if [ "$1 $2" = "volume inspect" ]; then
  [ "$3" = "klicker-uzh-pnpm-store-v1" ] || exit 2
  [ -f "$KLICKER_TEST_DOCKER_VOLUME_STATE" ]
  exit
fi
if [ "$1 $2" = "volume create" ]; then
  [ "$3" = "klicker-uzh-pnpm-store-v1" ] || exit 2
  [ "${KLICKER_TEST_DOCKER_CREATE_FAIL:-false}" != "true" ] || exit 9
  touch "$KLICKER_TEST_DOCKER_VOLUME_STATE"
  printf "%s\n" "$3" >>"$KLICKER_TEST_DOCKER_LOG"
  exit 0
fi
exit 2'
chmod +x "$FAKE_BIN/pnpm" "$FAKE_BIN/flock" "$FAKE_BIN/mkcert" "$FAKE_BIN/docker"

export PATH="$FAKE_BIN:$PATH"
export KLICKER_TEST_INSTALL_LOG="$INSTALL_LOG"
export KLICKER_TEST_DOCKER_LOG="$DOCKER_LOG"
export KLICKER_TEST_DOCKER_VOLUME_STATE="$DOCKER_VOLUME_STATE"
export KLICKER_DEV_RUNTIME_ROOT="$ROOT"
export KLICKER_DEV_RUNTIME_GIT_HEAD=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

INIT_ROOT="$TEST_ROOT/init-repo/.devcontainer"
MKCERT_CAROOT="$TEST_ROOT/mkcert"
mkdir -p "$INIT_ROOT" "$MKCERT_CAROOT"
cp "$REPO_ROOT/.devcontainer/initialize.sh" "$INIT_ROOT/initialize.sh"
write_file "$MKCERT_CAROOT/rootCA.pem" 'test CA'
export KLICKER_TEST_MKCERT_CAROOT="$MKCERT_CAROOT"

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

grep -Fq 'pnpm install --prefer-offline --no-frozen-lockfile' \
  "$REPO_ROOT/.devcontainer/post-create.sh" ||
  fail 'post-create does not prefer the shared pnpm store'

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
assert_equal "$(sed -n '1p' "$INSTALL_LOG")" 'install --frozen-lockfile --prefer-offline'

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
  assert_absent "$ROOT/apps/$app/.next/dev"
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
if bash "$RUNTIME_SCRIPT" start "$runtime_fingerprint" 1 -- true >/dev/null 2>&1; then
  fail 'symlinked cache was accepted'
fi
assert_exists "$TEST_ROOT/outside-cache/marker"

if bash "$RUNTIME_SCRIPT" request-repair unsupported >/dev/null 2>&1; then
  fail 'unsupported repair target was accepted'
fi

# A stale pass can cover several apps at once: every requested app receives a
# full .next repair in one start, untouched apps keep their production output,
# and repeated requests for the same app stay deduplicated.
rm -f "$ROOT/apps/chat/.next"
for app in "${NEXT_APPS[@]}"; do
  write_file "$ROOT/apps/$app/.next/dev/cache.bin" 'development cache'
  write_file "$ROOT/apps/$app/.next/production.bin" 'production cache'
done

bash "$RUNTIME_SCRIPT" request-repair frontend-manage >/dev/null
bash "$RUNTIME_SCRIPT" request-repair chat >/dev/null
bash "$RUNTIME_SCRIPT" request-repair chat >/dev/null
assert_equal "$(bash "$RUNTIME_SCRIPT" generation)" '4'
assert_equal \
  "$(LC_ALL=C sort "$ROOT/.devcontainer/.runtime/next-repair-request" | tr '\n' ' ')" \
  'chat frontend-manage '
bash "$RUNTIME_SCRIPT" start "$runtime_fingerprint" 4 -- true
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

echo '[test-dev-runtime] PASS'
