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
printf "install\n" >>"$KLICKER_TEST_INSTALL_LOG"'
chmod +x "$FAKE_BIN/pnpm"

export PATH="$FAKE_BIN:$PATH"
export KLICKER_TEST_INSTALL_LOG="$INSTALL_LOG"
export KLICKER_DEV_RUNTIME_ROOT="$ROOT"
export KLICKER_DEV_RUNTIME_GIT_HEAD=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

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

if bash "$RUNTIME_SCRIPT" request-repair unsupported >/dev/null 2>&1; then
  fail 'unsupported repair target was accepted'
fi

echo '[test-dev-runtime] PASS'
