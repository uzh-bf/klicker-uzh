#!/bin/bash

set -e

HATCHET_WORKER_PID=""
HATCHET_WORKER_ENV_FILE=""

wait_for_port() {
  local host="$1"
  local port="$2"
  local label="$3"

  for i in {1..30}; do
    if nc -z "$host" "$port" >/dev/null 2>&1; then
      echo "$label is ready!"
      return 0
    fi

    if [[ "$i" == "30" ]]; then
      echo "$label failed to become ready on ${host}:${port}. Exiting." >&2
      return 1
    fi

    echo "Waiting for $label... ($i/30)"
    sleep 2
  done
}

echo "=== GraphQL Test Suite (Vitest) ==="
echo "Starting services and running tests locally..."

# Function to cleanup services on exit
cleanup() {
  echo ""
  if [[ -n "$HATCHET_WORKER_PID" ]]; then
    echo "Stopping Hatchet worker (PID $HATCHET_WORKER_PID)..."
    if kill -0 "$HATCHET_WORKER_PID" >/dev/null 2>&1; then
      kill "$HATCHET_WORKER_PID" >/dev/null 2>&1 || true
      for _ in {1..5}; do
        if ! kill -0 "$HATCHET_WORKER_PID" >/dev/null 2>&1; then
          break
        fi
        sleep 1
      done
      if kill -0 "$HATCHET_WORKER_PID" >/dev/null 2>&1; then
        echo "Hatchet worker did not terminate gracefully, forcing shutdown..."
        if command -v pgrep >/dev/null 2>&1; then
          while read -r child_pid; do
            [[ -n "$child_pid" ]] || continue
            kill -9 "$child_pid" >/dev/null 2>&1 || true
          done < <(pgrep -P "$HATCHET_WORKER_PID" || true)
        fi
        kill -9 "$HATCHET_WORKER_PID" >/dev/null 2>&1 || true
      fi
      wait "$HATCHET_WORKER_PID" 2>/dev/null || true
    fi
  fi
  if [[ -n "$HATCHET_WORKER_ENV_FILE" && -f "$HATCHET_WORKER_ENV_FILE" ]]; then
    rm -f "$HATCHET_WORKER_ENV_FILE"
  fi
  echo "Cleaning up services..."
  docker compose -f test/docker/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
}

# Ensure cleanup runs both on normal exit and termination signals
trap cleanup EXIT INT TERM

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

echo "Checking Redis services..."
wait_for_port localhost 6379 "Redis exec" || exit 1
wait_for_port localhost 6380 "Redis assessment" || exit 1
wait_for_port localhost 6381 "Redis cache" || exit 1

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

echo "Starting Hatchet worker..."
pushd ../../apps/hatchet-worker-general >/dev/null

HATCHET_WORKER_ENV_FILE="$PWD/.env.test.local"
cat <<EOF > "$HATCHET_WORKER_ENV_FILE"
HATCHET_CLIENT_TOKEN=$HATCHET_CLIENT_TOKEN
HATCHET_CLIENT_HOST_PORT=localhost:7077
HATCHET_CLIENT_TLS_STRATEGY=none
HATCHET_API_URL=http://localhost:8888
HATCHET_HOST_PORT=localhost:7077
HATCHET_LOG_LEVEL=DEBUG
HATCHET_TENANT_ID=707d0855-80ab-4e1f-a156-f1c4546cbf52
HATCHET_WORKER_NAME=hatchet-worker-general
LOG_LEVEL=info
NODE_ENV=test
DATABASE_URL=postgresql://klicker:klicker@localhost:5432/klicker-prod
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_ASSESSMENT_HOST=localhost
REDIS_ASSESSMENT_PORT=6380
REDIS_CACHE_HOST=localhost
REDIS_CACHE_PORT=6381
APP_ORIGIN_API=http://api.klicker.com
APP_ORIGIN_AUTH=http://auth.klicker.com
APP_ORIGIN_LTI=http://lti.klicker.com
APP_ORIGIN_PWA=http://pwa.klicker.com
APP_ORIGIN_MANAGE=http://manage.klicker.com
APP_ORIGIN_CONTROL=http://control.klicker.com
APP_ORIGIN_ASSESSMENT_API=http://assessment-api.klicker.com
APP_ORIGIN_ASSESSMENT_PWA=http://assessment.klicker.com
EOF

node --env-file "$HATCHET_WORKER_ENV_FILE" dist/index.js &
HATCHET_WORKER_PID=$!

popd >/dev/null

echo "Hatchet worker started with PID ${HATCHET_WORKER_PID}"
sleep 5
if ! kill -0 "$HATCHET_WORKER_PID" >/dev/null 2>&1; then
  echo "Hatchet worker failed to start. Check logs above." >&2
  exit 1
fi

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
pnpm test "$@"

TEST_EXIT_CODE=$?
echo ""
echo "=== Test Results ==="
echo "Tests completed with exit code: $TEST_EXIT_CODE"

# Cleanup happens automatically via trap
exit $TEST_EXIT_CODE
