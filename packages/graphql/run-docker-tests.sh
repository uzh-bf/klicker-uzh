#!/bin/bash

set -e

echo "Stopping any existing containers..."
docker compose -f docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Building test containers..."
docker compose -f docker-compose.test.yml build 

echo "Running test containers..."
docker compose -f docker-compose.test.yml up --abort-on-container-exit

# get the exit code from the test container
TEST_EXIT_CODE=$(docker compose -f docker-compose.test.yml ps -q test | xargs docker inspect -f '{{.State.ExitCode}}' 2>/dev/null || echo "1")

echo "Cleaning up containers..."
docker compose -f docker-compose.test.yml down --volumes

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"

# exit with the same code as the test container
exit ${TEST_EXIT_CODE}
