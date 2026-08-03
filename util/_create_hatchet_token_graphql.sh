#!/usr/bin/env bash
set -euo pipefail

IMAGE="${HATCHET_IMAGE:-ghcr.io/hatchet-dev/hatchet/hatchet-lite-dev:v0.101.0}"
TENANT_ID="${HATCHET_TENANT_ID:-707d0855-80ab-4e1f-a156-f1c4546cbf52}"

find_hatchet_container() {
  local container=""

  # 1. GitHub Actions service container label
  container=$(docker ps -a --filter "label=com.github.actions.service-name=hatchet" --format "{{.Names}}" | head -n1)
  if [[ -n "$container" ]]; then echo "$container"; return 0; fi

  # 2. Exact image ancestor match
  container=$(docker ps -a --filter "ancestor=${IMAGE}" --format "{{.Names}}" | head -n1)
  if [[ -n "$container" ]]; then echo "$container"; return 0; fi

  # 3. Docker Compose / service name filter
  container=$(docker ps -a --filter "name=hatchet" --format "{{.Names}}" | head -n1)
  if [[ -n "$container" ]]; then echo "$container"; return 0; fi

  # 4. Search all containers for 'hatchet' image or name
  container=$(docker ps -a --format "{{.Names}}\t{{.Image}}" | grep -i "hatchet" | awk '{print $1}' | head -n1)
  if [[ -n "$container" ]]; then echo "$container"; return 0; fi

  return 1
}

echo "[hatchet-token] Locating Hatchet container..."
CONTAINER_NAME=$(find_hatchet_container || true)
if [[ -z "${CONTAINER_NAME}" ]]; then
  echo "[hatchet-token] Could not find running Hatchet container." >&2
  docker ps -a || true
  exit 1
fi
echo "[hatchet-token] Using container: ${CONTAINER_NAME}"

echo "[hatchet-token] Waiting for Hatchet health endpoint..."
for i in {1..30}; do
  if docker exec "${CONTAINER_NAME}" curl -sf http://localhost:8888/healthz >/dev/null 2>&1 || curl -sf http://localhost:8888/healthz >/dev/null 2>&1; then
    echo "[hatchet-token] Hatchet is healthy."
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "[hatchet-token] Hatchet failed to become healthy in time." >&2
    exit 1
  fi
  echo "[hatchet-token] Waiting... ($i/30)"
  sleep 2
done

echo "[hatchet-token] Reading authdisabled tenant token..."
TOKEN=$(docker exec "${CONTAINER_NAME}" cat /config/authdisabled-token 2>/dev/null | tr -d '[:space:]')
if [[ -z "${TOKEN}" || "${TOKEN}" == "error" ]]; then
  TOKEN=$(docker exec "${CONTAINER_NAME}" /hatchet-admin token create --config /config --tenant-id "${TENANT_ID}" 2>/dev/null | xargs)
fi
if [[ -z "${TOKEN}" || "${TOKEN}" == "error" ]]; then
  TOKEN=$(docker logs "${CONTAINER_NAME}" 2>&1 | grep -A 2 "authdisabled build: worker API token" | tail -n 1 | tr -d '[:space:]')
fi

if [[ -z "${TOKEN}" ]]; then
  echo "[hatchet-token] Failed to generate Hatchet token (empty response)." >&2
  exit 1
fi

echo "[hatchet-token] Token generated successfully (prefix): ${TOKEN:0:12}..."

# Write token into GraphQL package .env so Vitest (dotenv/config) can load it
for d in packages/graphql; do
  if [[ -f "$d/.env.example" ]]; then
    sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.example" > "$d/.env"
    echo "[hatchet-token] Wrote token to $d/.env"
  fi
done

# Also expose for current step/process if running in GitHub Actions
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "HATCHET_CLIENT_TOKEN=${TOKEN}" >> "$GITHUB_ENV"
  echo "[hatchet-token] Exported HATCHET_CLIENT_TOKEN to GITHUB_ENV"
fi

