#!/bin/sh

# Wait for Hatchet container to be ready and generate token with retry logic
CONTAINER_NAME=$(docker ps -a --filter "ancestor=ghcr.io/hatchet-dev/hatchet/hatchet-lite:v0.73.1" --format "{{.Names}}" | head -n1)

if [ -z "$CONTAINER_NAME" ]; then
  echo "❌ No Hatchet container found"
  exit 1
fi

echo "🔍 Found Hatchet container: $CONTAINER_NAME"

# Wait for Hatchet to be ready with retry logic
echo "⏳ Waiting for Hatchet to be ready..."
for i in {1..30}; do
  if docker exec $CONTAINER_NAME curl -s -f http://localhost:8888/healthz >/dev/null 2>&1; then
    echo "✅ Hatchet is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Timeout waiting for Hatchet to be ready"
    exit 1
  fi
  echo "⏳ Attempt $i/30: Hatchet not ready yet, waiting 2s..."
  sleep 2
done

# Generate token with retry logic
echo "🔑 Generating Hatchet token..."
for i in {1..10}; do
  TOKEN=$(docker exec $CONTAINER_NAME /hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 2>/dev/null | xargs)
  if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "error" ]; then
    echo "✅ Token generated successfully"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "❌ Failed to generate token after 10 attempts"
    exit 1
  fi
  echo "⏳ Attempt $i/10: Token generation failed, retrying in 2s..."
  sleep 2
done
for d in apps/backend-docker; do sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.cypress" > "$d/.env"; done
for d in apps/hatchet-worker-general apps/hatchet-worker-response-processor apps/response-api; do sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.example" > "$d/.env"; done
