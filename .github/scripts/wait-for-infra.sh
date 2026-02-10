#!/bin/bash

# Wait for infrastructure services (postgres, redis, hatchet) to be ready.
# Unlike wait-for-services.sh, this does NOT start any application processes.
# Intended for local dev where the user will run `pnpm dev` manually.

set -e

TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
CHECK_INTERVAL="${CHECK_INTERVAL:-3}"

check_redis() {
  if ! nc -z localhost 6379 2>/dev/null; then
    echo "Redis is not running on port 6379"
    return 1
  fi
  echo "Redis is running on port 6379"
  return 0
}

check_postgres() {
  if ! nc -z localhost 5432 2>/dev/null; then
    echo "PostgreSQL is not running on port 5432"
    return 1
  fi
  echo "PostgreSQL is running on port 5432"
  return 0
}

check_hatchet() {
  if ! curl -s -f http://localhost:8888/healthz >/dev/null 2>&1; then
    echo "Hatchet HTTP is not ready on port 8888"
    return 1
  fi

  if ! nc -z localhost 7077 2>/dev/null; then
    echo "Hatchet gRPC is not ready on port 7077"
    return 1
  fi

  echo "Hatchet is ready (HTTP: 8888, gRPC: 7077)"
  return 0
}

elapsed=0

echo "Waiting for infrastructure services (timeout: ${TIMEOUT_SECONDS}s)..."

while [ $elapsed -lt $TIMEOUT_SECONDS ]; do
  all_up=true

  check_postgres || all_up=false
  check_redis || all_up=false
  check_hatchet || all_up=false

  if $all_up; then
    echo "All infrastructure services are ready."
    exit 0
  fi

  sleep $CHECK_INTERVAL
  elapsed=$((elapsed + CHECK_INTERVAL))
  echo "Still waiting... ($elapsed seconds elapsed)"
done

echo "Timeout waiting for infrastructure services."
exit 1
