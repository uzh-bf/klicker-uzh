#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RECOVERY_SCRIPT="$REPO_ROOT/.devcontainer/recover-bootstrap.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  echo "[test-recover-bootstrap] FAIL: $*" >&2
  exit 1
}

assert_equal() {
  [ "$1" = "$2" ] || fail "expected '$1' to equal '$2'"
}

assert_absent() {
  [ ! -e "$1" ] || fail "expected path to be absent: $1"
}

assert_contains() {
  grep -Fq -- "$2" "$1" || fail "expected '$2' in $1"
}

write_file() {
  local path="$1" content="$2"

  mkdir -p "$(dirname "$path")"
  printf '%s\n' "$content" >"$path"
}

ROOT="$TEST_ROOT/repo"
FAKE_BIN="$TEST_ROOT/bin"
COMMAND_LOG="$TEST_ROOT/commands.log"
OUTPUT_LOG="$TEST_ROOT/recovery-output.log"
MARKER_DIR="$TEST_ROOT/bootstrap-state"
TOKEN_FILE="$TEST_ROOT/hatchet-token"
mkdir -p \
  "$ROOT/.devcontainer" \
  "$ROOT/apps/response-api" \
  "$ROOT/apps/hatchet-worker-general" \
  "$ROOT/apps/hatchet-worker-response-processor" \
  "$ROOT/packages/graphql" \
  "$ROOT/node_modules" \
  "$FAKE_BIN"

write_file "$ROOT/package.json" '{"packageManager":"pnpm@11.5.0"}'
write_file "$ROOT/pnpm-lock.yaml" 'lockfileVersion: 9'
write_file "$ROOT/pnpm-workspace.yaml" 'packages: [apps/*, packages/*]'
write_file "$ROOT/apps/response-api/package.json" '{"name":"response-api"}'
write_file "$ROOT/apps/hatchet-worker-general/package.json" '{"name":"hatchet-worker-general"}'
write_file "$ROOT/apps/hatchet-worker-response-processor/package.json" '{"name":"hatchet-worker-response-processor"}'
write_file "$ROOT/packages/graphql/package.json" '{"name":"@klicker-uzh/graphql"}'
write_file "$ROOT/packages/prisma/package.json" '{"name":"@klicker-uzh/prisma"}'
write_file "$ROOT/.devcontainer/devcontainer.env" 'DATABASE_URL=postgres://klicker_test:klicker@synthetic/klicker_test
SHADOW_DATABASE_URL=postgres://klicker_test:klicker@synthetic/klicker_test_shadow'
cp "$REPO_ROOT/util/dev-runtime.sh" "$ROOT/util-dev-runtime.sh"
mkdir -p "$ROOT/util"
mv "$ROOT/util-dev-runtime.sh" "$ROOT/util/dev-runtime.sh"
cp "$RECOVERY_SCRIPT" "$ROOT/.devcontainer/recover-bootstrap.sh"
write_file "$TOKEN_FILE" 'synthetic-hatchet-token'

cat >"$FAKE_BIN/pnpm" <<'FAKE_PNPM'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  --filter)
    case "${4:-}" in
      prisma:push:raw) echo push >>"$KLICKER_TEST_COMMAND_LOG" ;;
      seed:raw) echo seed >>"$KLICKER_TEST_COMMAND_LOG" ;;
      *) exit 42 ;;
    esac
    exit 0
    ;;
  install)
    [ "${2:-}" = --frozen-lockfile ] || exit 31
    [ "${3:-}" = --prefer-offline ] || exit 32
    printf "%s\n" install >>"$KLICKER_TEST_COMMAND_LOG"
    [ "${KLICKER_TEST_FAIL_AT:-}" != install ] || exit 49
    exit 0
    ;;
  exec)
    case "${2:-}" in
      turbo)
        [ "${3:-}" = run ] && [ "${4:-}" = build ] || exit 33
        [ "${5:-}" = '--filter=./packages/*' ] || exit 36
        [ "${6:-}" = '--filter=@klicker-uzh/backend-docker' ] || exit 37
        [ "${7:-}" = '--filter=@klicker-uzh/lti-service' ] || exit 38
        printf "%s\n" build >>"$KLICKER_TEST_COMMAND_LOG"
        [ "${KLICKER_TEST_FAIL_AT:-}" != build ] || exit 50
        exit 0
        ;;
      tsx)
        [ "${3:-}" = '-e' ] || exit 40
        if [ "${KLICKER_RECOVERY_IDENTITY_ONLY:-}" = 1 ]; then
          echo identity >>"$KLICKER_TEST_COMMAND_LOG"
          [ "${KLICKER_TEST_FAIL_IDENTITY:-}" != 1 ] || exit 43
          exit 0
        fi
        case "${KLICKER_TEST_SCHEMA_STATE:-missing}" in
          missing)
            printf "%s\n" verify-missing-schema >>"$KLICKER_TEST_COMMAND_LOG"
            exit 1
            ;;
          push-compatible)
            printf "%s\n" verify-push-compatible >>"$KLICKER_TEST_COMMAND_LOG"
            exit 0
            ;;
          *)
            exit 39
            ;;
        esac
        ;;
      *)
        exit 34
        ;;
    esac
    ;;
  *)
    exit 35
    ;;
esac
FAKE_PNPM
chmod +x "$FAKE_BIN/pnpm"

export PATH="$FAKE_BIN:$PATH"
export KLICKER_TEST_COMMAND_LOG="$COMMAND_LOG"
export KLICKER_DEVCONTAINER_ROOT="$ROOT"
export KLICKER_DEV_RUNTIME_ROOT="$ROOT"
export KLICKER_DEV_RUNTIME_BOOTSTRAP_STATE_DIR="$MARKER_DIR"
export KLICKER_HATCHET_TOKEN_FILE="$TOKEN_FILE"

mkdir -p "$MARKER_DIR"
for failure_stage in install build; do
  : >"$COMMAND_LOG"
  write_file "$MARKER_DIR/bootstrap-complete" 'klicker-devcontainer-bootstrap-v1'
  if KLICKER_TEST_FAIL_AT="$failure_stage" KLICKER_TEST_SCHEMA_STATE=push-compatible \
    bash "$ROOT/.devcontainer/recover-bootstrap.sh" >"$OUTPUT_LOG" 2>&1; then
    fail "recovery succeeded after $failure_stage failed"
  fi
  assert_absent "$MARKER_DIR/bootstrap-complete"
done
: >"$COMMAND_LOG"
write_file "$MARKER_DIR/bootstrap-complete" 'klicker-devcontainer-bootstrap-v1'
set +e
KLICKER_TEST_SCHEMA_STATE=missing \
  bash "$ROOT/.devcontainer/recover-bootstrap.sh" >"$OUTPUT_LOG" 2>&1
failure_status=$?
set -e
assert_equal "$failure_status" '1'
assert_absent "$MARKER_DIR/bootstrap-complete"
assert_equal "$(tr '\n' ' ' <"$COMMAND_LOG")" \
  'install build verify-missing-schema '
if grep -E '^(reset|push|seed|migrate)$' "$COMMAND_LOG" >/dev/null; then
  fail 'database-changing command was executed during failed recovery'
fi

: >"$COMMAND_LOG"
write_file "$ROOT/apps/hatchet-worker-general/.env" 'existing-worker-env'
write_file "$ROOT/apps/hatchet-worker-response-processor/.env" 'existing-processor-env'
write_file "$ROOT/packages/graphql/.env" 'existing-graphql-env'
rm -f "$ROOT/apps/response-api/.env"
KLICKER_TEST_SCHEMA_STATE=push-compatible \
  bash "$ROOT/.devcontainer/recover-bootstrap.sh" >"$OUTPUT_LOG" 2>&1

assert_contains "$MARKER_DIR/bootstrap-complete" \
  'klicker-devcontainer-bootstrap-v1'
assert_equal "$(tr '\n' ' ' <"$COMMAND_LOG")" \
  'install build verify-push-compatible '
assert_equal "$(cat "$ROOT/apps/hatchet-worker-general/.env")" 'existing-worker-env'
assert_equal "$(cat "$ROOT/apps/hatchet-worker-response-processor/.env")" \
  'existing-processor-env'
assert_equal "$(wc -c <"$ROOT/apps/response-api/.env" | tr -d ' ')" '0'
assert_contains "$ROOT/.devcontainer/.hatchet.env" \
  'HATCHET_CLIENT_TOKEN=synthetic-hatchet-token'
assert_contains "$ROOT/packages/graphql/.env" \
  'HATCHET_CLIENT_TOKEN=synthetic-hatchet-token'
if grep -Fq 'synthetic-hatchet-token' "$OUTPUT_LOG"; then
  fail 'Hatchet token was printed during recovery'
fi
if grep -E '^(reset|push|seed|migrate)$' "$COMMAND_LOG" >/dev/null; then
  fail 'database-changing command was executed during successful recovery'
fi

: >"$COMMAND_LOG"
KLICKER_TEST_SCHEMA_STATE=push-compatible bash "$ROOT/.devcontainer/recover-bootstrap.sh" --initialize-new-disposable >"$OUTPUT_LOG" 2>&1
assert_equal "$(tr '\n' ' ' <"$COMMAND_LOG")" 'install build identity push seed verify-push-compatible '
: >"$COMMAND_LOG"
if KLICKER_TEST_FAIL_IDENTITY=1 KLICKER_TEST_SCHEMA_STATE=push-compatible bash "$ROOT/.devcontainer/recover-bootstrap.sh" --initialize-new-disposable >"$OUTPUT_LOG" 2>&1; then
  fail 'initialization continued with failed identity'
fi
assert_equal "$(tr '\n' ' ' <"$COMMAND_LOG")" 'install build identity '
assert_absent "$MARKER_DIR/bootstrap-complete"
echo '[test-recover-bootstrap] PASS'
