#!/bin/bash

# Exit on error
set -e

# Validate required environment variables
if [ -z "${SERVICE_ENDPOINTS:-}" ]; then
  # Default endpoints if not specified
  SERVICE_ENDPOINTS="http://127.0.0.1:3000/healthz http://127.0.0.1:3001 http://127.0.0.1:3002 http://127.0.0.1:3003 http://127.0.0.1:3010"
fi

if [ -z "${TIMEOUT_SECONDS:-}" ]; then
  TIMEOUT_SECONDS=300
fi

if [ -z "${CHECK_INTERVAL:-}" ]; then
  CHECK_INTERVAL=5
fi

POSTGRES_CHECK_HOST="${POSTGRES_CHECK_HOST:-localhost}"
POSTGRES_CHECK_PORT="${POSTGRES_CHECK_PORT:-5432}"
REDIS_CHECK_HOST="${REDIS_CHECK_HOST:-${REDIS_HOST:-localhost}}"
REDIS_CHECK_PORT="${REDIS_CHECK_PORT:-${REDIS_PORT:-6379}}"
REDIS_CACHE_CHECK_HOST="${REDIS_CACHE_CHECK_HOST:-${REDIS_CACHE_HOST:-}}"
REDIS_CACHE_CHECK_PORT="${REDIS_CACHE_CHECK_PORT:-${REDIS_CACHE_PORT:-6379}}"
REDIS_ASSESSMENT_CHECK_HOST="${REDIS_ASSESSMENT_CHECK_HOST:-${REDIS_ASSESSMENT_HOST:-}}"
REDIS_ASSESSMENT_CHECK_PORT="${REDIS_ASSESSMENT_CHECK_PORT:-${REDIS_ASSESSMENT_PORT:-6379}}"
HATCHET_CHECK_HOST="${HATCHET_CHECK_HOST:-localhost}"
HATCHET_HTTP_PORT="${HATCHET_HTTP_PORT:-8888}"
HATCHET_GRPC_PORT="${HATCHET_GRPC_PORT:-7077}"

# Check Redis
check_redis_endpoint() {
  local label="$1"
  local host="$2"
  local port="$3"

  if ! nc -z "$host" "$port" 2>/dev/null; then
    echo "$label Redis is not running on ${host}:${port}"
    return 1
  fi

  echo "$label Redis is running on ${host}:${port}"
  return 0
}

check_redis() {
  check_redis_endpoint "Primary" "$REDIS_CHECK_HOST" "$REDIS_CHECK_PORT" || return 1

  if [ -n "$REDIS_CACHE_CHECK_HOST" ]; then
    check_redis_endpoint "Cache" "$REDIS_CACHE_CHECK_HOST" "$REDIS_CACHE_CHECK_PORT" || return 1
  fi

  if [ -n "$REDIS_ASSESSMENT_CHECK_HOST" ]; then
    check_redis_endpoint "Assessment" "$REDIS_ASSESSMENT_CHECK_HOST" "$REDIS_ASSESSMENT_CHECK_PORT" || return 1
  fi

  return 0
}

# Check PostgreSQL
check_postgres() {
  if ! nc -z "$POSTGRES_CHECK_HOST" "$POSTGRES_CHECK_PORT" 2>/dev/null; then
    echo "PostgreSQL is not running on ${POSTGRES_CHECK_HOST}:${POSTGRES_CHECK_PORT}"
    return 1
  fi
  echo "PostgreSQL is running on ${POSTGRES_CHECK_HOST}:${POSTGRES_CHECK_PORT}"
  return 0
}

# Check Hatchet
check_hatchet() {
  # Check HTTP endpoint
  if ! curl -s -f "http://${HATCHET_CHECK_HOST}:${HATCHET_HTTP_PORT}/healthz" >/dev/null 2>&1; then
    echo "Hatchet HTTP is not ready on ${HATCHET_CHECK_HOST}:${HATCHET_HTTP_PORT}"
    return 1
  fi

  # Check gRPC port
  if ! nc -z "$HATCHET_CHECK_HOST" "$HATCHET_GRPC_PORT" 2>/dev/null; then
    echo "Hatchet gRPC is not ready on ${HATCHET_CHECK_HOST}:${HATCHET_GRPC_PORT}"
    return 1
  fi

  echo "Hatchet is ready (HTTP: ${HATCHET_HTTP_PORT}, gRPC: ${HATCHET_GRPC_PORT})"
  return 0
}

# Cleanup function
cleanup() {
  local exit_code=$?

  # Stop log streaming
  if [ ! -z "${TAIL_PID:-}" ]; then
    kill $TAIL_PID 2>/dev/null || true
  fi

  # If we have a service PID and either we're exiting with an error or received a signal
  if [ ! -z "${SERVICE_PID:-}" ] && { [ $exit_code -ne 0 ] || [ "${1:-}" = "TERM" ]; }; then
    echo "🛑 Cleaning up service process (PID: $SERVICE_PID)..."
    kill $SERVICE_PID 2>/dev/null || true
    wait $SERVICE_PID 2>/dev/null || true
  fi

  # If we received SIGTERM, exit with special code
  if [ "${1:-}" = "TERM" ]; then
    echo "Received termination signal"
    exit 143  # 128 + 15 (SIGTERM)
  fi

  exit $exit_code
}

# Set up traps for cleanup
trap 'cleanup TERM' TERM
trap cleanup EXIT

# Check dependencies before starting
echo "🔍 Checking dependencies..."
check_redis || { echo "Redis check failed"; exit 1; }
check_postgres || { echo "PostgreSQL check failed"; exit 1; }
check_hatchet || { echo "Hatchet check failed"; exit 1; }

# Start the service in the background and capture all output
echo "🚀 Starting service..."
echo "📋 Service logs will be streamed below:"
echo "----------------------------------------"

# Start service and stream logs in real-time
pnpm run start:test:ci > service.log 2>&1 &

# Store the PID of the background process
SERVICE_PID=$!

# Start background log streaming
tail -f service.log &
TAIL_PID=$!

# Give the process a moment to fail fast if it's going to
sleep 2

# Check if process is still running after initial start
if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
  echo "Service failed to start. Last few lines of output:"
  tail -n 20 service.log
  exit 1
fi

echo "📋 Initial service start successful (PID: $SERVICE_PID)"

# Function to check if process is still running
check_process() {
  if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
    echo "Service process died. Last few lines of output:"
    tail -n 20 service.log
    return 1
  fi
  return 0
}

# Function to check a single endpoint
check_endpoint() {
  local endpoint="$1"
  local http_code

  # Use --fail to consider only 2xx codes as success
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 --fail "$endpoint" || echo "$?")

  # Check if curl command itself succeeded
  if [ $? -eq 0 ] && [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "$endpoint is up (HTTP $http_code)"
    return 0
  else
    echo "$endpoint is not ready (HTTP $http_code)"
    return 1
  fi
}

# Function to check all endpoints
check_endpoints() {
  local all_up=true

  echo "Checking endpoints..."
  for endpoint in $SERVICE_ENDPOINTS; do
    if ! check_endpoint "$endpoint"; then
      all_up=false
      break
    fi
  done

  $all_up
}

# Initialize elapsed time
elapsed=0

echo "⚙️ Configuration:"
echo "🔍 Monitoring endpoints: $SERVICE_ENDPOINTS"
echo "⏲️ Timeout: ${TIMEOUT_SECONDS}s, Check interval: ${CHECK_INTERVAL}s"

while [ $elapsed -lt $TIMEOUT_SECONDS ]; do
  # Check if the process is still running
  if ! check_process; then
    echo "📑 Full service log:"
    cat service.log
    exit 1
  fi

  # Try to access all endpoints
  if check_endpoints; then
    echo "✨ All services are ready!"

    # Stop log streaming but keep service running
    if [ ! -z "${TAIL_PID:-}" ]; then
      kill $TAIL_PID 2>/dev/null || true
      echo "📋 Service logs are available in service.log"
    fi

    # Keep the background process running but exit the script successfully
    trap - TERM  # Remove SIGTERM trap as we want to keep the service running
    trap - EXIT  # Remove exit trap as we want to keep the service running
    exit 0
  fi

  sleep $CHECK_INTERVAL
  elapsed=$((elapsed + CHECK_INTERVAL))

  echo "⏳ Still waiting for services... ($elapsed seconds elapsed)"

  # Show recent logs periodically
  if [ $((elapsed % 30)) -eq 0 ]; then
    echo "📑 Recent service logs:"
    tail -n 30 service.log
  fi
done

echo "Timeout waiting for services to be ready. Full service log:"
cat service.log
exit 1
