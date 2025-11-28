#!/bin/bash
set -euo pipefail

# Notes: 
# - infisical login must be done beforehand
# - use inf.stg.df-app.ch for development/staging and inf.prd.df-app.ch for production

VALID_ENVS=("dev" "stg" "prd")
VALID_MODES=("default" "cache" "assessment")

ENV=${1:-}
if [[ -z "$ENV" ]]; then
  echo "Usage: $0 <env> [mode]"
  echo "  env  = one of: ${VALID_ENVS[*]}"
  echo "  mode = one of: ${VALID_MODES[*]} (default: default)"
  exit 1
fi

if [[ ! " ${VALID_ENVS[*]} " =~ " ${ENV} " ]]; then
  echo "❌ Invalid environment: ${ENV}"
  exit 1
fi

ROOT_DIR=$(git rev-parse --show-toplevel)
if [[ "$ENV" == "prd" ]]; then
    CONFIG_FILE="$ROOT_DIR/.infisical_prd.json"
else
    CONFIG_FILE="$ROOT_DIR/.infisical_stg.json"
fi
PROJECT_ID=$(jq -r '.workspaceId' "$CONFIG_FILE")

MODE=${2:-default}
if [[ ! " ${VALID_MODES[*]} " =~ " ${MODE} " ]]; then
  echo "❌ Invalid mode: ${MODE}"
  exit 1
fi

echo "🚀 Using environment: $ENV"
echo "🧩 Mode: $MODE"

case "$MODE" in
  default)
    HOST_VAR="REDIS_HOST"
    PORT_VAR="REDIS_PORT"
    PASS_VAR="REDIS_PASS"
    ;;
  cache)
    HOST_VAR="REDIS_CACHE_HOST"
    PORT_VAR="REDIS_CACHE_PORT"
    PASS_VAR="REDIS_CACHE_PASS"
    ;;
  assessment)
    HOST_VAR="REDIS_ASSESSMENT_HOST"
    PORT_VAR="REDIS_ASSESSMENT_PORT"
    PASS_VAR="REDIS_ASSESSMENT_PASS"
    ;;
esac

env HOST_VAR="$HOST_VAR" PORT_VAR="$PORT_VAR" PASS_VAR="$PASS_VAR" infisical run --watch --env $ENV --project-config-dir="$CONFIG_FILE" --projectId="$PROJECT_ID" -- sh -c './upstash-redis-dump -host "${!HOST_VAR}" -port "${!PORT_VAR}" -pass "${!PASS_VAR}" -tls > redis.dump'
