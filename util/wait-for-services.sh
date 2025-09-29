#!/bin/bash

# Exit on error
set -e

# Validate required environment variables
DEFAULT_SERVICE_ENDPOINTS="http://127.0.0.1:3000/healthz http://127.0.0.1:3001 http://127.0.0.1:3002 http://127.0.0.1:3003 http://127.0.0.1:3010 http://127.0.0.1:7080/healthz"

SERVICE_ENDPOINTS_SOURCE="provided"
if [ -z "${SERVICE_ENDPOINTS+x}" ]; then
  SERVICE_ENDPOINTS="$DEFAULT_SERVICE_ENDPOINTS"
  SERVICE_ENDPOINTS_SOURCE="default"
fi

trimmed_service_endpoints=${SERVICE_ENDPOINTS//[[:space:]]/}
if [ "$SERVICE_ENDPOINTS_SOURCE" = "provided" ] && [ -z "$trimmed_service_endpoints" ]; then
  DEPENDENCY_ONLY_MODE=true
else
  DEPENDENCY_ONLY_MODE=false
fi

if [ -z "${TIMEOUT_SECONDS:-}" ]; then
  TIMEOUT_SECONDS=300
fi

if [ -z "${CHECK_INTERVAL:-}" ]; then
  CHECK_INTERVAL=5
fi

# Track service states to avoid repeated logging when status does not change
REDIS_STATE="unknown"
POSTGRES_STATE="unknown"
HATCHET_STATE="unknown"
ENDPOINTS_UP=()

# Check Redis
check_redis() {
  if nc -z localhost 6379 2>/dev/null; then
    if [ "$REDIS_STATE" != "up" ]; then
      echo "✅ Redis is running on port 6379"
      REDIS_STATE="up"
    fi
    return 0
  fi

  if [ "$REDIS_STATE" != "down" ]; then
    echo "❌ Redis is not reachable on port 6379"
    REDIS_STATE="down"
  fi
  return 1
}

# Check PostgreSQL
check_postgres() {
  if nc -z localhost 5432 2>/dev/null; then
    if [ "$POSTGRES_STATE" != "up" ]; then
      echo "✅ PostgreSQL is running on port 5432"
      POSTGRES_STATE="up"
    fi
    return 0
  fi

  if [ "$POSTGRES_STATE" != "down" ]; then
    echo "❌ PostgreSQL is not reachable on port 5432"
    POSTGRES_STATE="down"
  fi
  return 1
}

# Check Hatchet
check_hatchet() {
  # Check HTTP endpoint
  local http_ready=true
  local grpc_ready=true

  if ! curl -s -f http://localhost:8888/healthz >/dev/null 2>&1; then
    http_ready=false
  fi

  # Check gRPC port
  if ! nc -z localhost 7077 2>/dev/null; then
    grpc_ready=false
  fi

  if $http_ready && $grpc_ready; then
    if [ "$HATCHET_STATE" != "up" ]; then
      echo "✅ Hatchet is ready (HTTP: 8888, gRPC: 7077)"
      HATCHET_STATE="up"
    fi
    return 0
  fi

  if [ "$HATCHET_STATE" != "down" ]; then
    local reasons=()
    if ! $http_ready; then
      reasons+=("HTTP 8888")
    fi
    if ! $grpc_ready; then
      reasons+=("gRPC 7077")
    fi
    echo "❌ Hatchet is not ready (${reasons[*]})"
    HATCHET_STATE="down"
  fi

  return 1
}

# Check commonly required services and record state transitions
monitor_support_services() {
  local all_up=1

  if ! check_redis; then
    all_up=0
  fi

  if ! check_postgres; then
    all_up=0
  fi

  if ! check_hatchet; then
    all_up=0
  fi

  if [ $all_up -eq 1 ]; then
    return 0
  fi

  return 1
}

# Wait for required services to become ready, optionally tagging the context
wait_for_support_services() {
  local context="${1:-}"
  local timeout=${DEPENDENCY_TIMEOUT:-$TIMEOUT_SECONDS}
  local elapsed=0

  if [ -n "$context" ]; then
    echo "⏳ Waiting for supporting services ($context)..."
  else
    echo "⏳ Waiting for supporting services..."
  fi

  while [ $elapsed -lt $timeout ]; do
    if monitor_support_services; then
      return 0
    fi

    sleep "$CHECK_INTERVAL"
    elapsed=$((elapsed + CHECK_INTERVAL))

    if [ $((elapsed % 30)) -eq 0 ]; then
      echo "⏳ Supporting services still unavailable after ${elapsed}s"
    fi
  done

  echo "❌ Supporting services did not become ready within ${timeout}s"
  return 1
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

# Wait for Azurite (Azure Table emulator) to become reachable.
check_azurite() {
  local host=${AZURITE_HOST:-127.0.0.1}
  local port=${AZURITE_TABLE_PORT:-10002}
  local timeout=${AZURITE_WAIT_TIMEOUT:-30}
  local interval=${AZURITE_WAIT_INTERVAL:-1}
  local elapsed=0

  echo "⏳ Waiting for Azurite table endpoint at ${host}:${port}"

  while [ "$elapsed" -lt "$timeout" ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      echo "✅ Azurite Table endpoint detected on ${host}:${port}"
      return 0
    fi

    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "❌ Azurite did not become ready on ${host}:${port} within ${timeout}s"
  echo "   Ensure the GitHub workflow defines Azurite as a service before calling this script."
  return 1
}

# Check dependencies before starting
echo "🔍 Checking dependencies..."
check_azurite || { echo "❌ Azurite check failed"; exit 1; }
if ! wait_for_support_services "startup"; then
  echo "❌ Required service check failed"
  exit 1
fi

if [ "$DEPENDENCY_ONLY_MODE" = true ]; then
  echo "✅ Supporting services are ready (SERVICE_ENDPOINTS is empty); skipping service startup"
  exit 0
fi

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
endpoint_in_up_list() {
  local endpoint="$1"
  for item in "${ENDPOINTS_UP[@]}"; do
    if [ "$item" = "$endpoint" ]; then
      return 0
    fi
  done
  return 1
}

add_endpoint_to_up_list() {
  local endpoint="$1"
  ENDPOINTS_UP+=("$endpoint")
}

remove_endpoint_from_up_list() {
  local endpoint="$1"
  local retained=()

  for item in "${ENDPOINTS_UP[@]}"; do
    if [ "$item" != "$endpoint" ]; then
      retained+=("$item")
    fi
  done

  ENDPOINTS_UP=("${retained[@]}")
}

check_endpoint() {
  local endpoint="$1"
  local http_code
  local curl_status=0

  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 --fail "$endpoint") || curl_status=$?

  if [ "$curl_status" -eq 0 ] && [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    if ! endpoint_in_up_list "$endpoint"; then
      echo "✅ $endpoint is up (HTTP $http_code)"
      add_endpoint_to_up_list "$endpoint"
    fi
    return 0
  fi

  if [ -z "$http_code" ]; then
    http_code="curl:$curl_status"
  fi

  if endpoint_in_up_list "$endpoint"; then
    remove_endpoint_from_up_list "$endpoint"
    echo "⚠️ $endpoint became unavailable (HTTP $http_code)"
  else
    echo "⏳ $endpoint is not ready yet (HTTP $http_code)"
  fi

  return 1
}

# Function to check all endpoints
check_endpoints() {
  local all_up=1

  echo "Checking endpoints..."
  for endpoint in $SERVICE_ENDPOINTS; do
    if ! check_endpoint "$endpoint"; then
      all_up=0
    fi
  done

  if [ $all_up -eq 1 ]; then
    return 0
  fi

  return 1
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

  support_ready=1
  if ! monitor_support_services; then
    support_ready=0
  fi

  endpoints_ready=1
  if ! check_endpoints; then
    endpoints_ready=0
  fi

  if [ $support_ready -eq 1 ] && [ $endpoints_ready -eq 1 ]; then
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

echo "Timeout waiting for dependencies or endpoints to become ready. Full service log:"
cat service.log
exit 1
