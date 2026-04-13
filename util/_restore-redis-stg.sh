#!/bin/bash

ROOT_DIR=$(git rev-parse --show-toplevel)
CONFIG_FILE="$ROOT_DIR/.infisical_stg.json"
PROJECT_ID=$(jq -r '.workspaceId' "$CONFIG_FILE")
infisical run --watch --env="stg" --project-config-dir="$CONFIG_FILE" --projectId="$PROJECT_ID" -- sh -c 'redis-cli -u rediss://$REDIS_PASS@$REDIS_HOST:$REDIS_PORT --pipe < redis.dump'