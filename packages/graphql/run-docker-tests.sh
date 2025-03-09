#!/bin/bash

set -e

echo "Stopping any existing containers..."
docker compose -f docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Building test containers..."
docker compose -f docker-compose.test.yml build 

# run the test container and capture its exit code directly
echo "Running test containers..."
docker compose -f docker-compose.test.yml up --abort-on-container-exit

# after container runs, find the exit code from docker-compose ps output
TEST_EXIT_CODE=$(docker compose -f docker-compose.test.yml ps -a --format json | grep -o '"ExitCode":[0-9]*' | grep -o '[0-9]*' | head -1)
echo "Test exit code: ${TEST_EXIT_CODE}"

echo "Cleaning up containers..."
docker compose -f docker-compose.test.yml down --volumes --remove-orphans

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"
exit ${TEST_EXIT_CODE}
