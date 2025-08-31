#!/bin/bash
set -e

echo "Running tests from container..."

cd /usr/src/app

# Verify PostgreSQL connection
echo "Checking PostgreSQL connection..."
if pg_isready -h postgres -U postgres; then
echo "PostgreSQL is ready!"
else
echo "PostgreSQL is not ready. Exiting."
exit 1
fi

# Verify Hatchet token is available in environment
if [ -n "${HATCHET_CLIENT_TOKEN:-}" ]; then
  echo "Hatchet client token found in environment!"
else
  echo "Hatchet client token not set. Exiting."
  exit 1
fi

# Load Hatchet environment variables
echo "Loading Hatchet configuration..."
export $(cat /hatchet/env/token.env | xargs)
echo "Hatchet client token loaded: ${HATCHET_CLIENT_TOKEN:0:20}..."
echo "Hatchet TLS strategy: $HATCHET_CLIENT_TLS_STRATEGY"

# Setup Prisma
echo "Setting up Prisma with database URL: $DATABASE_URL..."
cd /usr/src/app/packages/prisma
echo "Current directory: $(pwd)"

# Build the prisma package
echo "Building prisma package..."
pnpm run build

# Run migrations using the prisma CLI commands configured for this project
echo "Running migrations..."
pnpm run prisma:reset:raw -f

# Run tests with Hatchet environment variables
echo "Running tests..."
cd /usr/src/app/packages/graphql
DATABASE_URL=$DATABASE_URL HATCHET_CLIENT_TOKEN=$HATCHET_CLIENT_TOKEN HATCHET_CLIENT_TLS_STRATEGY=$HATCHET_CLIENT_TLS_STRATEGY pnpm jest --verbose --runInBand
# Check the exit code of the tests

TEST_EXIT=$?
echo "Tests completed with exit code: $TEST_EXIT"
exit $TEST_EXIT
