#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
OLAT_TEST_WORKSPACE=$(cd -- "$SCRIPT_DIR/../.." && pwd -P)
export OLAT_TEST_WORKSPACE
COMPOSE_PROJECT="olat-test-$$-$RANDOM"
COMPOSE=(docker compose --project-name "$COMPOSE_PROJECT" -f "$SCRIPT_DIR/test/docker/docker-compose.test.yml")

cleanup() {
  local test_status=$?
  trap - EXIT
  "${COMPOSE[@]}" down --volumes --remove-orphans || {
    local cleanup_status=$?
    if [ "$test_status" -eq 0 ]; then
      test_status=$cleanup_status
    fi
  }
  exit "$test_status"
}
trap cleanup EXIT

echo "Building test containers..."
"${COMPOSE[@]}" build

# run the test container and capture its exit code directly
echo "Running test containers..."
"${COMPOSE[@]}" up --abort-on-container-exit --exit-code-from test
