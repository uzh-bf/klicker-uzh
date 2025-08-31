#!/bin/bash

set -e

echo "Stopping any existing containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Running dependency containers..."
docker compose -f test/docker/docker-compose.test.yml --profile dependencies up -d

sleep 10

TOKEN=$(docker compose -f test/docker/docker-compose.test.yml exec -T hatchet /hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs)
sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "test/docker/.env.example" > "test/docker/.env"

echo "Building test containers..."
docker compose -f test/docker/docker-compose.test.yml --profile test build

echo "Running test container..."
docker compose -f test/docker/docker-compose.test.yml --profile test up  --abort-on-container-exit --exit-code-from test

# capture the exit code from the run command
TEST_EXIT_CODE=$?
echo "Test exit code: ${TEST_EXIT_CODE}"

echo "Cleaning up containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes --remove-orphans

echo "Tests completed with exit code: ${TEST_EXIT_CODE}"
exit ${TEST_EXIT_CODE}
