#!/bin/bash

set -e

echo "Stopping any existing containers..."
docker compose -f docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Building test containers..."
docker compose -f docker-compose.test.yml build 

# Run the test container and capture its exit code directly
echo "Running test containers..."
docker compose -f docker-compose.test.yml up --abort-on-container-exit

# After container runs, find the exit code from docker-compose ps output
# This works even if the container is no longer running
TEST_EXIT_CODE=$(docker compose -f docker-compose.test.yml ps -a --format json | grep -o '"ExitCode":[0-9]*' | grep -o '[0-9]*' | head -1)

# If we couldn't get the exit code, check if container log indicates success
if [ -z "$TEST_EXIT_CODE" ]; then
  echo "Could not get explicit exit code, checking container logs..."
  if docker compose -f docker-compose.test.yml logs test | grep -q "Tests completed with exit code: 0"; then
    echo "Found success message in logs, assuming tests passed"
    TEST_EXIT_CODE=0
  else
    echo "No success message found in logs, assuming failure"
    TEST_EXIT_CODE=1
  fi
fi

echo "Test exit code: ${TEST_EXIT_CODE}"

echo "Cleaning up containers..."
docker compose -f docker-compose.test.yml down --volumes --remove-orphans

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"
exit ${TEST_EXIT_CODE}
