#!/bin/sh

ROOT_DIR=$(git rev-parse --show-toplevel)
CONFIG_FILE="$ROOT_DIR/.infisical_stg.json"
PROJECT_ID=$(jq -r '.workspaceId' "$CONFIG_FILE")
infisical run --watch --env="stg" --project-config-dir="$CONFIG_FILE" --projectId="$PROJECT_ID" -- sh -c 'PGPASSWORD="$DATABASE_PASS" pg_restore --host="$DATABASE_HOST" --port=6432 --username="$DATABASE_USER" --dbname="$DATABASE_NAME" --no-owner --format="t" dump.tar'