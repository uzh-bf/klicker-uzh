#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin"

cat > "$TMP_DIR/bin/docker" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == 'compose ps --services --status running' ]]; then
  printf 'docker %s\n' "$*" >> "$TEST_LOG"
  if [[ "${COMPOSE_RUNNING_SERVICES+x}" == 'x' ]]; then
    printf '%s\n' "$COMPOSE_RUNNING_SERVICES"
  else
    printf '%s\n' 'reverse_proxy_macos'
  fi
  exit 0
fi

printf 'docker %s\n' "$*" >> "$TEST_LOG"
exit 0
EOF

cat > "$TMP_DIR/bin/nc" <<'EOF'
#!/usr/bin/env bash
printf 'nc %s\n' "$*" >> "$TEST_LOG"
exit 0
EOF

cat > "$TMP_DIR/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "$TEST_LOG"
exit 0
EOF

chmod +x "$TMP_DIR/bin/docker" "$TMP_DIR/bin/nc" "$TMP_DIR/bin/curl"

TEST_LOG="$TMP_DIR/calls.log"

PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" /bin/sh "$ROOT_DIR/_down.sh" --services 'postgres,hatchet' >/dev/null

if ! grep -q 'docker compose stop postgres hatchet' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: expected targeted docker compose stop' >&2
  exit 1
fi

if ! grep -q 'docker compose rm -f postgres hatchet' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: expected targeted docker compose rm' >&2
  exit 1
fi

: > "$TEST_LOG"

PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" TIMEOUT_SECONDS=1 CHECK_INTERVAL=1 bash "$ROOT_DIR/.github/scripts/wait-for-infra.sh" --services 'redis_cache hatchet' >/dev/null

if grep -q 'nc -z localhost 5432' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should not check postgres' >&2
  exit 1
fi

if ! grep -q 'nc -z localhost 6380' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should check redis cache' >&2
  exit 1
fi

if ! grep -q 'curl -s -f http://localhost:8888/healthz' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should check hatchet http' >&2
  exit 1
fi

if ! grep -q 'nc -z localhost 7077' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should check hatchet grpc' >&2
  exit 1
fi

: > "$TEST_LOG"

PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" TIMEOUT_SECONDS=1 CHECK_INTERVAL=1 bash "$ROOT_DIR/.github/scripts/wait-for-infra.sh" --services 'reverse_proxy_macos' >/dev/null

if ! grep -q 'docker compose ps --services --status running' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should verify proxy compose service is running' >&2
  exit 1
fi

if ! grep -q 'nc -z localhost 80' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should check proxy http port' >&2
  exit 1
fi

if ! grep -q 'nc -z localhost 443' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should check proxy https port' >&2
  exit 1
fi

: > "$TEST_LOG"

PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" COMPOSE_RUNNING_SERVICES=$'postgres\nreverse_proxy_macos\nhatchet' TIMEOUT_SECONDS=1 CHECK_INTERVAL=1 bash "$ROOT_DIR/.github/scripts/wait-for-infra.sh" --services 'reverse_proxy_macos' >/dev/null

if ! grep -q 'docker compose ps --services --status running' "$TEST_LOG"; then
  printf '%s\n' 'FAIL: wait-for-infra should handle newline-delimited compose service output' >&2
  exit 1
fi

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" COMPOSE_RUNNING_SERVICES='' TIMEOUT_SECONDS=1 CHECK_INTERVAL=1 bash "$ROOT_DIR/.github/scripts/wait-for-infra.sh" --services 'reverse_proxy_macos' >/dev/null 2>"$TMP_DIR/proxy-error.log"; then
  printf '%s\n' 'FAIL: wait-for-infra should fail when proxy compose service is not running' >&2
  exit 1
fi

if ! grep -q 'Proxy compose service reverse_proxy_macos is not running' "$TMP_DIR/proxy-error.log"; then
  printf '%s\n' 'FAIL: expected proxy compose service error message' >&2
  cat "$TMP_DIR/proxy-error.log" >&2
  exit 1
fi

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" /bin/sh "$ROOT_DIR/_down.sh" --services >/dev/null 2>"$TMP_DIR/down-error.log"; then
  printf '%s\n' 'FAIL: _down.sh should fail on missing --services value' >&2
  exit 1
fi

if ! grep -q 'Missing value for --services' "$TMP_DIR/down-error.log"; then
  printf '%s\n' 'FAIL: _down.sh should print missing services value message' >&2
  cat "$TMP_DIR/down-error.log" >&2
  exit 1
fi

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" bash "$ROOT_DIR/.github/scripts/wait-for-infra.sh" --services >/dev/null 2>"$TMP_DIR/wait-error.log"; then
  printf '%s\n' 'FAIL: wait-for-infra should fail on missing --services value' >&2
  exit 1
fi

if ! grep -q 'Missing value for --services' "$TMP_DIR/wait-error.log"; then
  printf '%s\n' 'FAIL: wait-for-infra should print missing services value message' >&2
  cat "$TMP_DIR/wait-error.log" >&2
  exit 1
fi

printf '%s\n' 'PASS: targeted down and wait-for-infra'
