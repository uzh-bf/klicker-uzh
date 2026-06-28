#!/bin/bash

# Exit on error
set -e

RUN_COMMAND_AFTER_READY=false
if [ "${1:-}" = "--" ]; then
  shift
  RUN_COMMAND_AFTER_READY=true

  if [ "$#" -eq 0 ]; then
    echo "No command provided after --"
    exit 1
  fi
fi

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

SERVICE_LOG="${SERVICE_LOG:-service.log}"
SERVICE_START_SCRIPT="${SERVICE_START_SCRIPT:-start:test:ci}"
POSTGRES_CHECK_HOST="${POSTGRES_CHECK_HOST:-localhost}"
POSTGRES_CHECK_PORT="${POSTGRES_CHECK_PORT:-5432}"
POSTGRES_CHECK_USER="${POSTGRES_CHECK_USER:-${POSTGRES_USER:-}}"
POSTGRES_CHECK_DATABASE="${POSTGRES_CHECK_DATABASE:-${POSTGRES_DB:-}}"
REDIS_CHECK_HOST="${REDIS_CHECK_HOST:-${REDIS_HOST:-localhost}}"
REDIS_CHECK_PORT="${REDIS_CHECK_PORT:-${REDIS_PORT:-6379}}"
REDIS_CACHE_CHECK_HOST="${REDIS_CACHE_CHECK_HOST:-${REDIS_CACHE_HOST:-}}"
REDIS_CACHE_CHECK_PORT="${REDIS_CACHE_CHECK_PORT:-${REDIS_CACHE_PORT:-6379}}"
REDIS_ASSESSMENT_CHECK_HOST="${REDIS_ASSESSMENT_CHECK_HOST:-${REDIS_ASSESSMENT_HOST:-}}"
REDIS_ASSESSMENT_CHECK_PORT="${REDIS_ASSESSMENT_CHECK_PORT:-${REDIS_ASSESSMENT_PORT:-6379}}"
HATCHET_CHECK_HOST="${HATCHET_CHECK_HOST:-localhost}"
HATCHET_HTTP_PORT="${HATCHET_HTTP_PORT:-8888}"
HATCHET_GRPC_PORT="${HATCHET_GRPC_PORT:-7077}"

check_tcp() {
  local host="$1"
  local port="$2"

  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" >/dev/null 2>&1
    return $?
  fi

  if command -v timeout >/dev/null 2>&1; then
    timeout 5 bash -c ': </dev/tcp/$1/$2' _ "$host" "$port" >/dev/null 2>&1
  else
    bash -c ': </dev/tcp/$1/$2' _ "$host" "$port" >/dev/null 2>&1
  fi
}

# Check Redis
check_redis_endpoint() {
  local label="$1"
  local host="$2"
  local port="$3"

  if ! check_tcp "$host" "$port"; then
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
  if command -v pg_isready >/dev/null 2>&1 && [ -n "$POSTGRES_CHECK_USER" ] && [ -n "$POSTGRES_CHECK_DATABASE" ]; then
    if ! pg_isready \
      -h "$POSTGRES_CHECK_HOST" \
      -p "$POSTGRES_CHECK_PORT" \
      -U "$POSTGRES_CHECK_USER" \
      -d "$POSTGRES_CHECK_DATABASE" >/dev/null 2>&1; then
      echo "PostgreSQL is not ready on ${POSTGRES_CHECK_HOST}:${POSTGRES_CHECK_PORT} as ${POSTGRES_CHECK_USER}/${POSTGRES_CHECK_DATABASE}"
      return 1
    fi

    echo "PostgreSQL is ready on ${POSTGRES_CHECK_HOST}:${POSTGRES_CHECK_PORT} as ${POSTGRES_CHECK_USER}/${POSTGRES_CHECK_DATABASE}"
    return 0
  fi

  if ! check_tcp "$POSTGRES_CHECK_HOST" "$POSTGRES_CHECK_PORT"; then
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
  if ! check_tcp "$HATCHET_CHECK_HOST" "$HATCHET_GRPC_PORT"; then
    echo "Hatchet gRPC is not ready on ${HATCHET_CHECK_HOST}:${HATCHET_GRPC_PORT}"
    return 1
  fi

  echo "Hatchet is ready (HTTP: ${HATCHET_HTTP_PORT}, gRPC: ${HATCHET_GRPC_PORT})"
  return 0
}

check_dependencies() {
  check_redis || return 1
  check_postgres || return 1
  check_hatchet || return 1
  return 0
}

# Cleanup function
cleanup() {
  local exit_code=$?

  # Stop log streaming
  if [ ! -z "${TAIL_PID:-}" ]; then
    kill $TAIL_PID 2>/dev/null || true
  fi

  # If the script owns a follow-up command, always stop the service after it.
  # Otherwise preserve the historical behavior and keep the service alive on a
  # successful readiness-only invocation.
  if [ ! -z "${SERVICE_PID:-}" ] && { [ "$RUN_COMMAND_AFTER_READY" = "true" ] || [ $exit_code -ne 0 ] || [ "${1:-}" = "TERM" ]; }; then
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
dependencies_elapsed=0
while [ $dependencies_elapsed -lt $TIMEOUT_SECONDS ]; do
  if check_dependencies; then
    echo "✨ Dependencies are ready!"
    break
  fi

  sleep $CHECK_INTERVAL
  dependencies_elapsed=$((dependencies_elapsed + CHECK_INTERVAL))
  echo "⏳ Still waiting for dependencies... ($dependencies_elapsed seconds elapsed)"
done

if [ $dependencies_elapsed -ge $TIMEOUT_SECONDS ]; then
  echo "Dependency check failed"
  exit 1
fi

# Function to check if process is still running
check_process() {
  if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
    echo "Service process died. Last few lines of output:"
    tail -n 20 "$SERVICE_LOG"
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

start_service() {
  if [ -z "${TAIL_PID:-}" ]; then
    : > "$SERVICE_LOG"
    tail -f "$SERVICE_LOG" &
    TAIL_PID=$!
  fi

  echo "🚀 Starting service..."
  echo "📋 Service logs will be streamed below:"
  echo "----------------------------------------"

  {
    echo ""
    echo "===== ${SERVICE_START_SCRIPT} started at $(date -u +"%Y-%m-%dT%H:%M:%SZ") ====="
  } >> "$SERVICE_LOG"

  pnpm run "$SERVICE_START_SCRIPT" >> "$SERVICE_LOG" 2>&1 &
  SERVICE_PID=$!

  # Give the process a moment to fail fast if it's going to
  sleep 2

  if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
    echo "Service failed to start. Last few lines of output:"
    tail -n 20 "$SERVICE_LOG"
    exit 1
  fi

  echo "📋 Service start successful (PID: $SERVICE_PID)"
}

stop_service() {
  if [ ! -z "${SERVICE_PID:-}" ]; then
    echo "🛑 Stopping service process (PID: $SERVICE_PID)..."
    kill $SERVICE_PID 2>/dev/null || true
    wait $SERVICE_PID 2>/dev/null || true
    SERVICE_PID=
  fi
}

run_command_with_service_guard() {
  "$@" &
  local command_pid=$!

  while true; do
    if ! kill -0 "$command_pid" 2>/dev/null; then
      set +e
      wait "$command_pid"
      local command_status=$?
      set -e
      return $command_status
    fi

    if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
      echo "Service process died while the command was running. Recent service logs:"
      tail -n 120 "$SERVICE_LOG"
      kill "$command_pid" 2>/dev/null || true
      wait "$command_pid" 2>/dev/null || true
      return 1
    fi

    sleep 2
  done
}

wait_for_service_readiness() {
  local elapsed=0

  echo "⚙️ Configuration:"
  echo "🔍 Monitoring endpoints: $SERVICE_ENDPOINTS"
  echo "⏲️ Timeout: ${TIMEOUT_SECONDS}s, Check interval: ${CHECK_INTERVAL}s"

  while [ $elapsed -lt $TIMEOUT_SECONDS ]; do
    if ! check_process; then
      echo "📑 Full service log:"
      cat "$SERVICE_LOG"
      exit 1
    fi

    if check_endpoints; then
      echo "✨ All services are ready!"
      echo "📋 Service logs are available in $SERVICE_LOG"
      return 0
    fi

    sleep $CHECK_INTERVAL
    elapsed=$((elapsed + CHECK_INTERVAL))

    echo "⏳ Still waiting for services... ($elapsed seconds elapsed)"

    if [ $((elapsed % 30)) -eq 0 ]; then
      echo "📑 Recent service logs:"
      tail -n 30 "$SERVICE_LOG"
    fi
  done

  echo "Timeout waiting for services to be ready. Full service log:"
  cat "$SERVICE_LOG"
  exit 1
}

start_service
wait_for_service_readiness

if [ "$RUN_COMMAND_AFTER_READY" = "true" ]; then
  echo "▶️ Running command: $*"
  set +e
  run_command_with_service_guard "$@"
  command_status=$?
  set -e
  exit $command_status
fi

# Keep the background process running but exit the script successfully
if [ ! -z "${TAIL_PID:-}" ]; then
  kill $TAIL_PID 2>/dev/null || true
  echo "📋 Service logs are available in $SERVICE_LOG"
fi
trap - TERM  # Remove SIGTERM trap as we want to keep the service running
trap - EXIT  # Remove exit trap as we want to keep the service running
exit 0
