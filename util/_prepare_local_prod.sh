#!/bin/bash

# This script prepares the local development environment using production dumps
# Workflow:
# 1. Reset docker compose environment (including volumes)
# 2. Load Postgres database dump
# 3. Load Redis dump
# 4. Apply Prisma migrations

# Enable error handling
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function for cleanup on failure
cleanup() {
    log "Cleaning up - shutting down docker compose..."
    docker compose down -v
}

# Function to detect if running in WSL
is_wsl() {
    if [ -f /proc/version ]; then
        if grep -i microsoft /proc/version > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log "ERROR: Docker is not running"
    exit 1
fi

# Check if required dump files exist
if [ ! -f "${SCRIPT_DIR}/dump.tar" ]; then
    log "ERROR: Postgres dump file not found at ${SCRIPT_DIR}/dump.tar"
    exit 1
fi

if [ ! -f "${SCRIPT_DIR}/redis.dump" ]; then
    log "ERROR: Redis dump file not found at ${SCRIPT_DIR}/redis.dump"
    exit 1
fi

# Step 1: Reset docker compose environment
log "Stopping docker compose and removing volumes..."
cd "${REPO_ROOT}"
docker compose down -v

# copy the prisma schema for it to be available to python files
"${SCRIPT_DIR}/sync-schema.sh"

log "Starting docker compose..."
if is_wsl; then
    log "Detected WSL environment, using WSL dependencies script..."
    docker compose up -d postgres redis_exec redis_cache reverse_proxy_wsl
else
    log "Detected macOS environment, using macOS dependencies script..."
    docker compose up -d postgres redis_exec redis_cache reverse_proxy_macos
fi

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 10

# Step 2: Load Postgres dump
log "Loading Postgres dump..."
"${SCRIPT_DIR}/_restore-db-dev.sh" || true
log "Postgres dump loaded (some errors are expected)"

# Step 3: Load Redis dump
log "Loading Redis dump..."
"${SCRIPT_DIR}/_restore-redis-dev.sh"
if [ $? -eq 0 ]; then
    log "Successfully loaded Redis dump"
else
    log "ERROR: Failed to load Redis dump"
    cleanup
    exit 1
fi

# Step 4: Apply Prisma migrations
log "Applying Prisma migrations..."
cd "${REPO_ROOT}/packages/prisma" && pnpm prisma:deploy
if [ $? -eq 0 ]; then
    log "Successfully applied Prisma migrations"
else
    log "ERROR: Failed to apply Prisma migrations"
    cleanup
    exit 1
fi

log "Local development environment successfully prepared!"
