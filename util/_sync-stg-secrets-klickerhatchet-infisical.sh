#!/usr/bin/env bash
set -euo pipefail

# NOTE: assumes that infisical login --domain https://inf.prd.df-app.ch was already run!

STG_URL="https://inf.stg.df-app.ch"
PRD_URL="https://inf.prd.df-app.ch"

SERVICE_TOKENS_PROJECT_ID="4eaff172-36b5-4819-86bb-21490cdece61"

STG_PROJECT_ID="08c77a2b-b8b6-4600-9cbe-c5cff06ec315" 
PRD_PROJECT_ID="9471f833-9f14-492c-afe5-0d32affd40ba" 

ENV_SLUG="stg"

STG_SECRET_PATH="/KlickerUZH-Hatchet-Staging"
PRD_SECRET_PATH="/KlickerUZH-Hatchet-Production"
SERVICE_TOKEN_NAME="stg"

STG_SERVICE_TOKEN=$(infisical secrets get $SERVICE_TOKEN_NAME \
  --env $ENV_SLUG \
  --projectId $SERVICE_TOKENS_PROJECT_ID \
  --path $STG_SECRET_PATH \
  --domain $PRD_URL \
  --plain)
PRD_SERVICE_TOKEN=$(infisical secrets get $SERVICE_TOKEN_NAME \
  --env $ENV_SLUG \
  --projectId $SERVICE_TOKENS_PROJECT_ID \
  --path $PRD_SECRET_PATH \
  --domain $PRD_URL \
  --plain)

echo "[INFO] Fetching secrets from PRD..."
secrets=$(infisical secrets \
  --env=$ENV_SLUG \
  --projectId=$PRD_PROJECT_ID \
  --domain=$PRD_URL \
  --token=$PRD_SERVICE_TOKEN \
  --plain)

count=$(echo "$secrets" | grep -vE '^\s*$|^#' | wc -l)
echo "[INFO] Found $count secrets."

while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue

  key=$(echo "$line" | cut -d '=' -f 1)
  value=$(echo "$line" | cut -d '=' -f 2-)

  infisical secrets set \
    --env=$ENV_SLUG \
    --projectId=$STG_PROJECT_ID \
    --domain=$STG_URL \
    --token=$STG_SERVICE_TOKEN \
    "$key=$value" > /dev/null
  echo "[SYNCED] $key"
done <<< "$secrets"

echo "[INFO] Sync complete!"

