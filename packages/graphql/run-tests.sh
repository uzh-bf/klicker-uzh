#!/bin/bash

set -e

echo "Stopping any existing containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Building test containers..."
docker compose -f test/docker/docker-compose.test.yml build 

# use 'docker compose run' instead of 'up' to avoid --abort-on-container-exit issues (returns on first container exit)
# this runs only the test service and its dependencies, and exits when test completes
echo "Running test container..."
# docker compose -f test/docker/docker-compose.test.yml run --rm test
docker compose -f test/docker/docker-compose.test.yml up

# capture the exit code from the run command
TEST_EXIT_CODE=$?
echo "Test exit code: ${TEST_EXIT_CODE}"

echo "Cleaning up containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes --remove-orphans

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"
exit ${TEST_EXIT_CODE}
