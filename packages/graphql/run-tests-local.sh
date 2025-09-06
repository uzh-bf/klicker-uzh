#!/bin/bash

set -e

echo "=== GraphQL Test Suite (Vitest) ==="
echo "Starting services and running tests locally..."

# Function to cleanup services on exit
cleanup() {
  echo ""
  echo "Cleaning up services..."
  docker compose -f test/docker/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
}

# Set trap to cleanup on script exit
trap cleanup EXIT

echo "Stopping any existing containers..."
docker compose -f test/docker/docker-compose.test.yml down --volumes 2>/dev/null || true

echo "Starting dependency services (PostgreSQL, Hatchet)..."
docker compose -f test/docker/docker-compose.test.yml up -d

echo "Waiting for services to be ready..."
sleep 15

# Check PostgreSQL health
echo "Checking PostgreSQL connection..."
for i in {1..30}; do
  if docker compose -f test/docker/docker-compose.test.yml exec postgres pg_isready -U klicker -d klicker-prod >/dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "PostgreSQL failed to become ready. Exiting."
    exit 1
  fi
  echo "Waiting for PostgreSQL... ($i/30)"
  sleep 2
done

# Check Hatchet health
echo "Checking Hatchet connection..."
for i in {1..30}; do
  if curl -f http://localhost:8888/healthz >/dev/null 2>&1; then
    echo "Hatchet is ready!"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "Hatchet failed to become ready. Exiting."
    exit 1
  fi
  echo "Waiting for Hatchet... ($i/30)"
  sleep 2
done

# Generate Hatchet token
echo "Generating Hatchet client token..."
TOKEN=$(docker compose -f test/docker/docker-compose.test.yml exec -T hatchet /hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs)

if [ -z "$TOKEN" ]; then
  echo "Failed to generate Hatchet token. Exiting."
  exit 1
fi

echo "Hatchet token generated successfully: ${TOKEN:0:20}..."

# Set up environment variables
export DATABASE_URL="postgresql://klicker:klicker@localhost:5432/klicker-prod"
export HATCHET_CLIENT_TOKEN="$TOKEN"
export HATCHET_CLIENT_TLS_STRATEGY="none"
export NODE_ENV="test"

echo ""
echo "=== Environment Setup ==="
echo "DATABASE_URL: $DATABASE_URL"
echo "HATCHET_CLIENT_TOKEN: ${HATCHET_CLIENT_TOKEN:0:20}..."
echo "HATCHET_CLIENT_TLS_STRATEGY: $HATCHET_CLIENT_TLS_STRATEGY"
echo ""

# Build required packages
echo "Building dependency packages..."
cd ../..

echo "Building types package..."
cd packages/types
pnpm run build

echo "Building util package..."
cd ../util
pnpm run build

echo "Building grading package..."
cd ../grading
pnpm run build

echo "Building prisma package..."
cd ../prisma
pnpm run build

echo "Running Prisma migrations..."
pnpm run prisma:reset:raw -f

# Run tests
echo ""
echo "=== Running GraphQL Tests ==="
cd ../graphql

# Run Vitest tests
DATABASE_URL="$DATABASE_URL" \
HATCHET_CLIENT_TOKEN="$HATCHET_CLIENT_TOKEN" \
HATCHET_CLIENT_TLS_STRATEGY="$HATCHET_CLIENT_TLS_STRATEGY" \
NODE_ENV="$NODE_ENV" \
pnpm vitest run --reporter=verbose

TEST_EXIT_CODE=$?
echo ""
echo "=== Test Results ==="
echo "Tests completed with exit code: $TEST_EXIT_CODE"

# Cleanup happens automatically via trap
exit $TEST_EXIT_CODE
