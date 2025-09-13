#!/bin/bash
set -e

echo "🚀 Starting local GitHub Actions execution with act..."

# Check if act.secrets exists
if [ ! -f "act.secrets" ]; then
    echo "❌ act.secrets file not found. Please create it from the template:"
    echo "   cp act.secrets.template act.secrets"
    exit 1
fi

# Start services with Docker Compose
echo "🐳 Starting test services..."
docker-compose -f docker-compose.test.yml up -d

# Wait for infrastructure services to be healthy
echo "⏳ Waiting for infrastructure services to be ready..."
echo "Checking PostgreSQL, Redis, and Hatchet services..."

# Simple wait for the docker-compose services to be healthy
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
  if docker-compose -f docker-compose.test.yml ps | grep -E "(postgres|redis|hatchet)" | grep -q "Up (healthy)"; then
    echo "✅ Infrastructure services are ready!"
    break
  fi
  echo "⏳ Waiting for services to be healthy (attempt $attempt/$max_attempts)..."
  sleep 5
  attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
  echo "❌ Services failed to become healthy within timeout"
  docker-compose -f docker-compose.test.yml ps
  exit 1
fi

# Run act for the draft PR job (faster, no cloud recording)
echo "🎬 Running GitHub Actions workflow with act..."
act pull_request \
  --workflows .github/workflows/cypress-testing.yml \
  --job cypress-run-parallel-draft \
  --secret-file act.secrets \
  --env GITHUB_EVENT_NAME=pull_request \
  --eventpath .github/events/pull_request_draft.json

# Cleanup function
cleanup() {
  echo "🧹 Stopping test services..."
  docker-compose -f docker-compose.test.yml down
}

# Set up trap for cleanup on script exit
trap cleanup EXIT

echo "✅ Workflow execution completed!"