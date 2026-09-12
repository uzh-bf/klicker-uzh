#!/usr/bin/env bash
# Sourced only by the opt-in isolated lifecycle. Values stay in shell memory.
# Compose supplies these settings; ordinary defaults must not replace them.
local_kb_capture_environment() {
  LOCAL_KB_ENV_KEYS=(
    DATABASE_URL SHADOW_DATABASE_URL
    REDIS_HOST REDIS_PORT REDIS_CACHE_HOST REDIS_CACHE_PORT
    REDIS_ASSESSMENT_HOST REDIS_ASSESSMENT_PORT
    KB_INGESTION_API_URL KB_INGESTION_API_KEY KB_INGESTION_PROJECT_ID
    KB_SOURCE_GATEWAY_URL KB_SOURCE_GATEWAY_KEY KB_WEBHOOK_SECRET
    BLOB_STORAGE_ACCOUNT_NAME BLOB_STORAGE_ACCESS_KEY
    BLOB_STORAGE_ACCOUNT_URL BLOB_STORAGE_INTERNAL_ACCOUNT_URL
    HATCHET_CLIENT_TOKEN HATCHET_CLIENT_HOST_PORT HATCHET_CLIENT_TLS_STRATEGY
    DOC_QUERY_SCOPE_PRIVATE_KEY DOC_QUERY_SCOPE_KID
    DOC_QUERY_SCOPE_ISSUER DOC_QUERY_SCOPE_AUDIENCE
  )
  LOCAL_KB_ENV_VALUES=()
  local key
  for key in "${LOCAL_KB_ENV_KEYS[@]}"; do
    if [ -z "${!key:-}" ]; then
      echo "[local-kb] Missing isolated runtime setting: ${key}" >&2
      return 1
    fi
    LOCAL_KB_ENV_VALUES+=("${!key}")
  done
}

local_kb_restore_environment() {
  local index key
  for index in "${!LOCAL_KB_ENV_KEYS[@]}"; do
    key="${LOCAL_KB_ENV_KEYS[$index]}"
    printf -v "$key" '%s' "${LOCAL_KB_ENV_VALUES[$index]}"
    export "$key"
  done
}
