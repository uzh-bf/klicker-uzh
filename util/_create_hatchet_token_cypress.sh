#!/usr/bin/env bash
set -euo pipefail

IMAGE="${HATCHET_IMAGE:-ghcr.io/hatchet-dev/hatchet/hatchet-lite:v0.73.1}"
TENANT_ID="${HATCHET_TENANT_ID:-707d0855-80ab-4e1f-a156-f1c4546cbf52}"
HATCHET_API_URL="${HATCHET_API_URL:-http://localhost:8888}"
HATCHET_ADMIN_EMAIL="${HATCHET_ADMIN_EMAIL:-admin@example.com}"
HATCHET_ADMIN_PASSWORD="${HATCHET_ADMIN_PASSWORD:-Admin123!!}"
TOKEN=""

wait_for_hatchet_http() {
  echo "[hatchet-token] Waiting for Hatchet at ${HATCHET_API_URL}..."
  for i in {1..30}; do
    if curl -s -f "${HATCHET_API_URL}/healthz" >/dev/null 2>&1; then
      echo "[hatchet-token] Hatchet is ready."
      return 0
    fi

    if [[ "$i" == "30" ]]; then
      echo "[hatchet-token] Timeout waiting for Hatchet at ${HATCHET_API_URL}." >&2
      return 1
    fi

    echo "[hatchet-token] Attempt $i/30: Hatchet not ready yet, waiting 2s..."
    sleep 2
  done
}

create_token_with_docker() {
  if [[ "${HATCHET_TOKEN_FORCE_HTTP:-}" == "true" ]]; then
    return 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  local container_name
  container_name=$(docker ps -a --filter "ancestor=${IMAGE}" --format "{{.Names}}" | head -n1)

  if [[ -z "$container_name" ]]; then
    return 1
  fi

  echo "[hatchet-token] Found Hatchet container: ${container_name}"
  echo "[hatchet-token] Waiting for container health endpoint..."
  for i in {1..30}; do
    if docker exec "$container_name" curl -s -f http://localhost:8888/healthz >/dev/null 2>&1; then
      echo "[hatchet-token] Container Hatchet is ready."
      break
    fi

    if [[ "$i" == "30" ]]; then
      echo "[hatchet-token] Timeout waiting for Hatchet container." >&2
      return 1
    fi

    echo "[hatchet-token] Attempt $i/30: container not ready yet, waiting 2s..."
    sleep 2
  done

  echo "[hatchet-token] Generating token through hatchet-admin..."
  for i in {1..10}; do
    TOKEN=$(docker exec "$container_name" /hatchet-admin token create --config /config --tenant-id "$TENANT_ID" 2>/dev/null | xargs)
    if [[ -n "$TOKEN" && "$TOKEN" != "error" ]]; then
      echo "[hatchet-token] Token generated successfully through Docker."
      return 0
    fi

    if [[ "$i" == "10" ]]; then
      echo "[hatchet-token] Failed to generate token through Docker after 10 attempts." >&2
      return 1
    fi

    echo "[hatchet-token] Attempt $i/10: token generation failed, retrying in 2s..."
    sleep 2
  done
}

create_token_with_http() {
  wait_for_hatchet_http

  local auth_cookie header_file login_file response_file
  header_file=$(mktemp)
  login_file=$(mktemp)
  response_file=$(mktemp)

  for i in {1..10}; do
    echo "[hatchet-token] Logging in to Hatchet API..."
    if curl -s -f -D "$header_file" -o "$login_file" \
      -H 'content-type: application/json' \
      -d "{\"email\":\"${HATCHET_ADMIN_EMAIL}\",\"password\":\"${HATCHET_ADMIN_PASSWORD}\"}" \
      "${HATCHET_API_URL}/api/v1/users/login"; then
      auth_cookie=$(tr -d '\r' < "$header_file" | sed -n 's/^[Ss]et-[Cc]ookie: \(hatchet=[^;]*\).*/\1/p' | tail -n1)

      if [[ -z "$auth_cookie" ]]; then
        echo "[hatchet-token] Hatchet login succeeded, but no auth cookie was returned."
      elif curl -s -f \
        -H 'content-type: application/json' \
        -H "Cookie: ${auth_cookie}" \
        -d '{"name":"playwright-ci","expiresIn":"2160h"}' \
        "${HATCHET_API_URL}/api/v1/tenants/${TENANT_ID}/api-tokens" > "$response_file"; then
        TOKEN=$(node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(data.token || '')" "$response_file")

        if [[ -n "$TOKEN" ]]; then
          rm -f "$header_file" "$login_file" "$response_file"
          echo "[hatchet-token] Token generated successfully through HTTP API."
          return 0
        fi

        echo "[hatchet-token] Hatchet API token response did not include a token."
      else
        echo "[hatchet-token] Hatchet API token request failed."
      fi
    else
      echo "[hatchet-token] Hatchet API login request failed."
    fi

    if [[ "$i" == "10" ]]; then
      rm -f "$header_file" "$login_file" "$response_file"
      echo "[hatchet-token] Failed to generate token through HTTP API after 10 attempts." >&2
      return 1
    fi

    echo "[hatchet-token] Attempt $i/10: HTTP token generation failed, retrying in 2s..."
    sleep 2
  done
}

write_env_files() {
  local template target

  for d in apps/backend-docker; do
    template="$d/.env.cypress"
    target="$d/.env"
    sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$template" > "$target"
    echo "[hatchet-token] Wrote token to ${target}"
  done

  for d in apps/hatchet-worker-general apps/hatchet-worker-response-processor apps/response-api; do
    template="$d/.env.example"
    target="$d/.env"
    sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$template" > "$target"
    echo "[hatchet-token] Wrote token to ${target}"
  done

  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "HATCHET_CLIENT_TOKEN=${TOKEN}" >> "$GITHUB_ENV"
    echo "[hatchet-token] Exported HATCHET_CLIENT_TOKEN to GITHUB_ENV"
  fi
}

if ! create_token_with_docker; then
  echo "[hatchet-token] Docker token generation unavailable; using Hatchet HTTP API."
  create_token_with_http
fi

write_env_files
