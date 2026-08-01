#!/usr/bin/env bash
set -euo pipefail

umask 077

data_ingestion_repo="${DATA_INGESTION_REPO:-}"
api_port="${KB_INGESTION_LOCAL_PORT:-18080}"
api_key="${KB_INGESTION_API_KEY:-dev-local-kb-ingestion-api-key}"
app_origin="${KLICKER_KB_APP_ORIGIN:-}"
foreground=0

if [[ "${1:-}" == "--foreground" ]]; then
  foreground=1
  shift
fi
if [[ "$#" -gt 0 ]]; then
  echo "Usage: $0 [--foreground]" >&2
  exit 2
fi

if [[ -z "$data_ingestion_repo" ]]; then
  echo "DATA_INGESTION_REPO must point to the data-ingestion checkout." >&2
  exit 2
fi
if [[ ! -f "$data_ingestion_repo/modules/ingestion-api/pyproject.toml" ]]; then
  echo "data-ingestion API project not found under: $data_ingestion_repo" >&2
  exit 2
fi
if [[ -z "$app_origin" ]]; then
  if [[ -n "${WORKSPACE:-}" ]]; then
    app_origin="https://api.klicker.${WORKSPACE}.localhost"
  else
    app_origin="http://localhost:3000"
  fi
fi

state_root="$data_ingestion_repo/.ingestion-local/klicker-resource-api"
registry_dir="$state_root/producer-registry"
state_db="$state_root/state.db"
pid_file="$state_root/api.pid"
log_file="$state_root/api.log"
mkdir -p "$registry_dir"

if [[ -f "$pid_file" ]]; then
  existing_pid="$(<"$pid_file")"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    if curl -fsS "http://127.0.0.1:${api_port}/ready" >/dev/null 2>&1; then
      echo "Local KB ingestion API already running on http://127.0.0.1:${api_port}."
      exit 0
    fi
    echo "Existing local KB ingestion API process is not ready: ${existing_pid}." >&2
    exit 1
  fi
  rm -f "$pid_file"
fi

cat >"$registry_dir/klicker.yaml" <<EOF
version: 1
producer:
  id: klicker
  enabled: true
  api_contracts: [knowledge-source/v1]
  allowed_projects: [klicker-course-materials]
  allowed_source_kinds: [blob, url]
auth:
  type: static_key
  credential_secret_ref: ingestion-producer-klicker
source_gateway:
  allowed_origins: ["${app_origin}"]
  credential_secret_ref: klicker-source-gateway-client
callback:
  url: "${app_origin}/api/webhooks/kb-ingestion"
  signing_secret_ref: ingestion-webhook-klicker
limits:
  max_bytes: 52428800
  allowed_mime_types: [application/pdf, text/plain]
EOF

export INGESTION_PRODUCER_REGISTRY_DIR="$registry_dir"
export INGESTION_STATE_BACKEND=sqlite
export INGESTION_STATE_DB="$state_db"
export INGESTION_SECRET_INGESTION_PRODUCER_KLICKER_API_KEY="$api_key"
export INGESTION_SECRET_INGESTION_WEBHOOK_KLICKER_HMAC_KEY="${KB_WEBHOOK_SECRET:-dev-kb-webhook-secret}"
export INGESTION_METRICS_BEARER_TOKEN="${KB_INGESTION_METRICS_TOKEN:-dev-local-kb-metrics-token}"

uv run --project "$data_ingestion_repo/modules/ingestion-api" python -m ingestion_api.migrations

if [[ "$foreground" == "1" ]]; then
  echo "Starting local KB ingestion API in the foreground on http://127.0.0.1:${api_port}."
  cd "$data_ingestion_repo"
  exec uv run --project modules/ingestion-api uvicorn \
    ingestion_api.app:create_app --factory \
    --host 0.0.0.0 --port "$api_port"
fi

(
  cd "$data_ingestion_repo"
  exec nohup uv run --project modules/ingestion-api uvicorn \
    ingestion_api.app:create_app --factory \
    --host 0.0.0.0 --port "$api_port"
) >"$log_file" 2>&1 < /dev/null &
api_pid=$!
echo "$api_pid" >"$pid_file"

cleanup_stale_pid() {
  if ! kill -0 "$api_pid" 2>/dev/null; then
    rm -f "$pid_file"
    return 1
  fi
  return 0
}

for _attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${api_port}/ready" >/dev/null 2>&1; then
    echo "Local KB ingestion API is ready: http://127.0.0.1:${api_port}"
    echo "State: $state_db"
    exit 0
  fi
  cleanup_stale_pid || {
    echo "Local KB ingestion API exited; inspect $log_file" >&2
    exit 1
  }
  sleep 1
done

echo "Timed out waiting for the local KB ingestion API; inspect $log_file" >&2
exit 1
