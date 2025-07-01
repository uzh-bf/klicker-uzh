#!/bin/bash

set -e

echo "Stopping any existing containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Running dependency containers..."
docker compose -f test/docker/docker-compose.test.yml up -d reverse_proxy_macos postgres hatchet_postgres hatchet_rabbitmq hatchet_migration hatchet_setup_config hatchet_engine hatchet_token_generator

echo "Building test containers..."
docker compose -f test/docker/docker-compose.test.yml build

echo "Running test container..."
docker compose -f test/docker/docker-compose.test.yml up test --abort-on-container-exit --exit-code-from test

# capture the exit code from the run command
TEST_EXIT_CODE=$?
echo "Test exit code: ${TEST_EXIT_CODE}"

echo "Cleaning up containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes --remove-orphans

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"
exit ${TEST_EXIT_CODE}
