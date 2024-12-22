#!/bin/bash

# Validate required environment variables
if [ -z "${SERVICE_ENDPOINTS:-}" ]; then
  # Default endpoints if not specified
  SERVICE_ENDPOINTS="http://127.0.0.1:3000/api/graphql http://127.0.0.1:3001 http://127.0.0.1:3002 http://127.0.0.1:3003 http://127.0.0.1:3010"
fi

if [ -z "${TIMEOUT_SECONDS:-}" ]; then
  TIMEOUT_SECONDS=300
fi

if [ -z "${CHECK_INTERVAL:-}" ]; then
  CHECK_INTERVAL=5
fi

# Cleanup function
cleanup() {
  local exit_code=$?
  # Only kill the service if we're exiting with an error
  if [ $exit_code -ne 0 ] && [ ! -z "${SERVICE_PID:-}" ]; then
    echo "Cleaning up service process..."
    kill $SERVICE_PID 2>/dev/null || true
  fi
  exit $exit_code
}

# Set up trap for cleanup
trap cleanup EXIT

# Start the service in the background and capture all output
if ! pnpm run start:test > service.log 2>&1 & then
  echo "❌ Failed to start service"
  exit 1
fi

# Store the PID of the background process
SERVICE_PID=$!

# Function to check if process is still running
check_process() {
  if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
    echo "❌ Service process died. Last few lines of output:"
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
    echo "✅ $endpoint is up (HTTP $http_code)"
    return 0
  else
    echo "❌ $endpoint is not ready (HTTP $http_code)"
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

echo "🚀 Starting services and waiting for readiness..."
echo "Monitoring endpoints: $SERVICE_ENDPOINTS"
echo "Timeout: ${TIMEOUT_SECONDS}s, Check interval: ${CHECK_INTERVAL}s"

while [ $elapsed -lt $TIMEOUT_SECONDS ]; do
  # Check if the process is still running
  if ! check_process; then
    exit 1
  fi

  # Try to access all endpoints
  if check_endpoints; then
    echo "✨ All services are ready!"
    # Keep the background process running but exit the script successfully
    trap - EXIT  # Remove the trap as we want to keep the service running
    exit 0
  fi

  sleep $CHECK_INTERVAL
  elapsed=$((elapsed + CHECK_INTERVAL))

  echo "⏳ Still waiting for services... ($elapsed seconds elapsed)"

  # Show recent logs periodically
  if [ $((elapsed % 30)) -eq 0 ]; then
    echo "📑 Recent service logs:"
    tail -n 5 service.log
  fi
done

echo "⚠️ Timeout waiting for services to be ready. Last few lines of output:"
tail -n 20 service.log
exit 1
