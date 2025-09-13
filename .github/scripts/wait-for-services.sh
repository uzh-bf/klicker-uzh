#!/bin/bash

# Exit on error
set -e

# Detect if running in act
IS_ACT="${ACT:-false}"

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

# Enhanced Redis check
check_redis() {
  if [ "$IS_ACT" = "true" ]; then
    # Try both localhost and 127.0.0.1 in act
    if nc -z localhost 6379 2>/dev/null || nc -z 127.0.0.1 6379 2>/dev/null; then
      echo "✅ Redis is running on port 6379"
      return 0
    fi
  else
    if ! nc -z localhost 6379 2>/dev/null; then
      echo "❌ Redis is not running on port 6379"
      return 1
    fi
    echo "✅ Redis is running on port 6379"
    return 0
  fi
  echo "❌ Redis is not running on port 6379"
  return 1
}

# Enhanced PostgreSQL check
check_postgres() {
  if [ "$IS_ACT" = "true" ]; then
    # Try both localhost and 127.0.0.1 in act
    if nc -z localhost 5432 2>/dev/null || nc -z 127.0.0.1 5432 2>/dev/null; then
      echo "✅ PostgreSQL is running on port 5432"
      return 0
    fi
  else
    if ! nc -z localhost 5432 2>/dev/null; then
      echo "❌ PostgreSQL is not running on port 5432"
      return 1
    fi
    echo "✅ PostgreSQL is running on port 5432"
    return 0
  fi
  echo "❌ PostgreSQL is not running on port 5432"
  return 1
}

# Add comprehensive Hatchet check with token verification
check_hatchet() {
  echo "🔍 Checking Hatchet services..."
  
  # Check HTTP API on port 8888
  local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:8888 2>/dev/null || echo "000")
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
    echo "✅ Hatchet HTTP API is running on port 8888 (HTTP $http_code)"
  else
    echo "⚠️ Hatchet HTTP API not yet ready on port 8888 (HTTP $http_code)"
    return 1
  fi
  
  # Check gRPC on port 7077
  if nc -z 127.0.0.1 7077 2>/dev/null; then
    echo "✅ Hatchet gRPC is running on port 7077"
  else
    echo "⚠️ Hatchet gRPC not yet ready on port 7077"
    return 1
  fi
  
  # Verify Hatchet token if .env file exists
  if [ -f "apps/backend-docker/.env" ]; then
    echo "🔑 Verifying Hatchet token..."
    
    # Extract token from .env file
    HATCHET_TOKEN=$(grep "^HATCHET_CLIENT_TOKEN=" apps/backend-docker/.env | cut -d'=' -f2 | tr -d '"')
    
    if [ -z "$HATCHET_TOKEN" ] || [ "$HATCHET_TOKEN" = "__HATCHET_CLIENT_TOKEN__" ]; then
      echo "⚠️ Hatchet token not yet generated"
      return 1
    fi
    
    # Test API with token - check tenant endpoint
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $HATCHET_TOKEN" \
      -H "Content-Type: application/json" \
      --max-time 5 \
      http://127.0.0.1:8888/api/v1/tenants/707d0855-80ab-4e1f-a156-f1c4546cbf52 2>/dev/null || echo "000")
    
    if [ "$api_response" -eq 200 ] || [ "$api_response" -eq 201 ] || [ "$api_response" -eq 204 ]; then
      echo "✅ Hatchet API accepts the generated token (HTTP $api_response)"
    else
      echo "⚠️ Hatchet API token verification failed (HTTP $api_response)"
      echo "   Token might not be properly configured or Hatchet is not fully ready"
      
      # Try a simpler health check endpoint
      local health_response=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 5 \
        http://127.0.0.1:8888/api/readyz 2>/dev/null || echo "000")
      
      if [ "$health_response" -eq 200 ]; then
        echo "   Note: Hatchet health endpoint is responding, but token auth may need time"
      fi
      
      return 1
    fi
  else
    echo "⚠️ Backend .env file not found - token verification skipped"
  fi
  
  return 0
}

# Cleanup function
cleanup() {
  local exit_code=$?

  # If we have a service PID and either we're exiting with an error or received a signal
  if [ ! -z "${SERVICE_PID:-}" ] && { [ $exit_code -ne 0 ] || [ "${1:-}" = "TERM" ]; }; then
    echo "🛑 Cleaning up service process (PID: $SERVICE_PID)..."
    kill $SERVICE_PID 2>/dev/null || true
    wait $SERVICE_PID 2>/dev/null || true
  fi

  # If we received SIGTERM, exit with special code
  if [ "${1:-}" = "TERM" ]; then
    echo "⚠️ Received termination signal"
    exit 143  # 128 + 15 (SIGTERM)
  fi

  exit $exit_code
}

# Set up traps for cleanup
trap 'cleanup TERM' TERM
trap cleanup EXIT

# Add extra wait time for act environment
if [ "$IS_ACT" = "true" ]; then
  echo "🎭 Running in act environment - allowing extra time for services"
  sleep 10
fi

# Check dependencies before starting
echo "🔍 Checking dependencies..."
check_redis || { echo "❌ Redis check failed"; exit 1; }
check_postgres || { echo "❌ PostgreSQL check failed"; exit 1; }

# Check Hatchet with retries (it may take time to fully start)
HATCHET_RETRIES=0
MAX_HATCHET_RETRIES=5
while [ $HATCHET_RETRIES -lt $MAX_HATCHET_RETRIES ]; do
  if check_hatchet; then
    break
  fi
  HATCHET_RETRIES=$((HATCHET_RETRIES + 1))
  if [ $HATCHET_RETRIES -lt $MAX_HATCHET_RETRIES ]; then
    echo "⏳ Retrying Hatchet check in 5 seconds... (attempt $HATCHET_RETRIES/$MAX_HATCHET_RETRIES)"
    sleep 5
  else
    echo "❌ Hatchet service check failed after $MAX_HATCHET_RETRIES attempts"
    exit 1
  fi
done

# Start the service in the background and capture all output
echo "🚀 Starting service..."
pnpm run start:test:ci > service.log 2>&1 &

# Store the PID of the background process
SERVICE_PID=$!

# Give the process a moment to fail fast if it's going to
sleep 2

# Check if process is still running after initial start
if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
  echo "❌ Service failed to start. Last few lines of output:"
  tail -n 20 service.log
  exit 1
fi

echo "📋 Initial service start successful (PID: $SERVICE_PID)"

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

echo "⚠️ Timeout waiting for services to be ready. Full service log:"
cat service.log
exit 1
