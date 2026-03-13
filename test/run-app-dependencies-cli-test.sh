#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin"

cat > "$TMP_DIR/bin/docker" <<'EOF'
#!/bin/sh
RUNNING_STATE_FILE="${TEST_RUNNING_STATE_FILE:?}"
ALL_STATE_FILE="${TEST_ALL_STATE_FILE:?}"

if [ "$*" = 'compose ps --services --status running' ]; then
	if [ -f "$RUNNING_STATE_FILE" ]; then
		cat "$RUNNING_STATE_FILE"
	else
		printf '%s\n' 'postgres'
	fi
	exit 0
fi

if [ "$*" = 'compose ps --all --services' ]; then
	if [ -f "$ALL_STATE_FILE" ]; then
		cat "$ALL_STATE_FILE"
	else
		printf '%s\n' 'postgres'
	fi
	exit 0
fi

if [ "$*" = 'compose up --build -d postgres redis_exec' ]; then
	if [ "${FAIL_UP_PARTIAL:-0}" = '1' ]; then
		printf '%s\n' 'postgres' > "$RUNNING_STATE_FILE"
		printf '%s\n' 'redis_exec' >> "$RUNNING_STATE_FILE"
		printf '%s\n' 'postgres' > "$ALL_STATE_FILE"
		printf '%s\n' 'redis_exec' >> "$ALL_STATE_FILE"
		printf 'docker %s\n' "$*" >> "$TEST_LOG"
		exit 1
	fi

	if [ "${FAIL_UP_EXITED:-0}" = '1' ]; then
		printf '%s\n' 'postgres' > "$RUNNING_STATE_FILE"
		printf '%s\n' 'postgres' > "$ALL_STATE_FILE"
		printf '%s\n' 'redis_exec' >> "$ALL_STATE_FILE"
		printf 'docker %s\n' "$*" >> "$TEST_LOG"
		exit 1
	fi

	printf '%s\n' 'postgres' > "$RUNNING_STATE_FILE"
	printf '%s\n' 'redis_exec' >> "$RUNNING_STATE_FILE"
	printf '%s\n' 'postgres' > "$ALL_STATE_FILE"
	printf '%s\n' 'redis_exec' >> "$ALL_STATE_FILE"
	printf 'docker %s\n' "$*" >> "$TEST_LOG"
	exit 0
fi

if [ "$*" = 'compose stop redis_exec' ]; then
	printf '%s\n' 'postgres' > "$RUNNING_STATE_FILE"
	printf '%s\n' 'postgres' > "$ALL_STATE_FILE"
	printf 'docker %s\n' "$*" >> "$TEST_LOG"
	exit 0
fi

if [ "$*" = 'compose rm -f redis_exec' ]; then
  printf '%s\n' 'postgres'
  printf 'docker %s\n' "$*" >> "$TEST_LOG"
  exit 0
fi

printf 'docker %s\n' "$*" >> "$TEST_LOG"
exit 0
EOF

cat > "$TMP_DIR/bin/pnpm" <<'EOF'
#!/bin/sh
printf 'pnpm %s\n' "$*" >> "$TEST_LOG"
exit 0
EOF

cat > "$TMP_DIR/bin/bash" <<'EOF'
#!/bin/sh
printf 'bash %s\n' "$*" >> "$TEST_LOG"
exit 0
EOF

chmod +x "$TMP_DIR/bin/docker" "$TMP_DIR/bin/pnpm" "$TMP_DIR/bin/bash"

TEST_LOG="$TMP_DIR/calls.log"
TEST_RUNNING_STATE_FILE="$TMP_DIR/running-state.log"
TEST_ALL_STATE_FILE="$TMP_DIR/all-state.log"
OUTPUT_FILE="$TMP_DIR/output.log"

PATH="$TMP_DIR/bin:/bin:/usr/bin" \
TEST_LOG="$TEST_LOG" \
TEST_RUNNING_STATE_FILE="$TEST_RUNNING_STATE_FILE" \
TEST_ALL_STATE_FILE="$TEST_ALL_STATE_FILE" \
KLICKER_PLATFORM_OVERRIDE=mac \
/bin/sh "$ROOT_DIR/_run_app_dependencies.sh" --dry-run --profile graphql --no-proxy > "$OUTPUT_FILE" 2>&1

if ! grep -q 'Resolved plan:' "$OUTPUT_FILE"; then
  printf 'FAIL: expected resolved plan output\n' >&2
  exit 1
fi

if ! grep -q 'docker compose services: postgres redis_exec redis_cache hatchet' "$OUTPUT_FILE"; then
  printf 'FAIL: expected graphql dry-run services\n' >&2
  exit 1
fi

if [ -s "$TEST_LOG" ]; then
  printf 'FAIL: expected dry-run without side effects\n' >&2
  cat "$TEST_LOG" >&2
  exit 1
fi

: > "$TEST_LOG"

PATH="$TMP_DIR/bin:/bin:/usr/bin" \
TEST_LOG="$TEST_LOG" \
TEST_RUNNING_STATE_FILE="$TEST_RUNNING_STATE_FILE" \
TEST_ALL_STATE_FILE="$TEST_ALL_STATE_FILE" \
KLICKER_PLATFORM_OVERRIDE=mac \
/bin/sh "$ROOT_DIR/_run_app_dependencies.sh" --services postgres,redis_exec --skip-prisma --skip-schema-sync > "$OUTPUT_FILE" 2>&1

if ! grep -q 'docker compose up --build -d postgres redis_exec' "$TEST_LOG"; then
  printf 'FAIL: expected selective docker compose up\n' >&2
  cat "$TEST_LOG" >&2
  exit 1
fi

if grep -q 'docker compose stop postgres redis_exec' "$TEST_LOG"; then
  printf 'FAIL: cleanup should not stop already running postgres\n' >&2
  cat "$TEST_LOG" >&2
  exit 1
fi

if ! grep -q 'docker compose stop redis_exec' "$TEST_LOG"; then
  printf 'FAIL: cleanup should stop only newly started services\n' >&2
  cat "$TEST_LOG" >&2
  exit 1
fi

: > "$TEST_LOG"

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" TEST_RUNNING_STATE_FILE="$TEST_RUNNING_STATE_FILE" TEST_ALL_STATE_FILE="$TEST_ALL_STATE_FILE" FAIL_UP_PARTIAL=1 KLICKER_PLATFORM_OVERRIDE=mac /bin/sh "$ROOT_DIR/_run_app_dependencies.sh" --services postgres,redis_exec --skip-prisma --skip-schema-sync > "$OUTPUT_FILE" 2>&1; then
  printf 'FAIL: partial docker compose failure should bubble up\n' >&2
  exit 1
fi

if ! grep -q 'docker compose stop redis_exec' "$TEST_LOG"; then
  printf 'FAIL: partial startup failure should still cleanup newly started services\n' >&2
  cat "$TEST_LOG" >&2
  exit 1
fi

: > "$TEST_LOG"

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" TEST_RUNNING_STATE_FILE="$TEST_RUNNING_STATE_FILE" TEST_ALL_STATE_FILE="$TEST_ALL_STATE_FILE" FAIL_UP_EXITED=1 KLICKER_PLATFORM_OVERRIDE=mac /bin/sh "$ROOT_DIR/_run_app_dependencies.sh" --services postgres,redis_exec --skip-prisma --skip-schema-sync > "$OUTPUT_FILE" 2>&1; then
  printf 'FAIL: exited partial docker compose failure should bubble up\n' >&2
  exit 1
fi

if ! grep -q 'docker compose rm -f redis_exec' "$TEST_LOG"; then
  printf 'FAIL: exited partial startup failure should cleanup newly created services\n' >&2
  cat "$TEST_LOG" >&2
  exit 1
fi

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" TEST_RUNNING_STATE_FILE="$TEST_RUNNING_STATE_FILE" TEST_ALL_STATE_FILE="$TEST_ALL_STATE_FILE" KLICKER_PLATFORM_OVERRIDE=mac /bin/sh "$ROOT_DIR/_run_app_dependencies.sh" --profile invalid > "$OUTPUT_FILE" 2>&1; then
  printf 'FAIL: invalid profile should fail\n' >&2
  exit 1
fi

if ! grep -q 'Error: unknown profile: invalid' "$OUTPUT_FILE"; then
  printf 'FAIL: expected invalid profile error output\n' >&2
  cat "$OUTPUT_FILE" >&2
  exit 1
fi

if PATH="$TMP_DIR/bin:/bin:/usr/bin" TEST_LOG="$TEST_LOG" TEST_RUNNING_STATE_FILE="$TEST_RUNNING_STATE_FILE" TEST_ALL_STATE_FILE="$TEST_ALL_STATE_FILE" KLICKER_PLATFORM_OVERRIDE=mac /bin/sh "$ROOT_DIR/_run_app_dependencies.sh" --profile > "$OUTPUT_FILE" 2>&1; then
  printf 'FAIL: missing profile value should fail\n' >&2
  exit 1
fi

if ! grep -q 'Missing value for --profile' "$OUTPUT_FILE"; then
  printf 'FAIL: expected missing profile value message\n' >&2
  cat "$OUTPUT_FILE" >&2
  exit 1
fi

printf 'PASS: run-app-dependencies dry-run cli\n'
