#!/bin/bash

set -e

# Capture all arguments passed to the script
TEST_ARGS="$@"

echo "Stopping any existing containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Building test containers..."
docker compose -f test/docker/docker-compose.test.yml build 

# Run test container with arguments
echo "Running test containers..."
if [ -z "$TEST_ARGS" ]; then
    echo "Running all tests..."
    docker compose -f test/docker/docker-compose.test.yml run --rm -e TEST_ARGS="" test
else
    echo "Running tests with arguments: $TEST_ARGS"
    docker compose -f test/docker/docker-compose.test.yml run --rm -e TEST_ARGS="$TEST_ARGS" test
fi

# Capture the exit code
TEST_EXIT_CODE=$?

echo "Cleaning up containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes --remove-orphans

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"
exit ${TEST_EXIT_CODE}
