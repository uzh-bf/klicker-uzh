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
cd "${REPO_ROOT}" || {
    log "ERROR: Failed to change to repository root directory"
    exit 1
}

if ! docker compose down -v; then
    log "ERROR: Failed to stop docker compose"
    exit 1
fi

# copy the prisma schema for it to be available to python files
log "Syncing Prisma schema..."
if ! "${SCRIPT_DIR}/sync-schema.sh"; then
    log "ERROR: Failed to sync Prisma schema"
    exit 1
fi

log "Starting docker compose..."
if is_wsl; then
    log "Detected WSL environment, using WSL dependencies script..."
    if ! docker compose up -d postgres redis_exec redis_cache reverse_proxy_wsl; then
        log "ERROR: Failed to start WSL docker compose services"
        exit 1
    fi
else
    log "Detected macOS environment, using macOS dependencies script..."
    if ! docker compose up -d postgres redis_exec redis_cache reverse_proxy_macos; then
        log "ERROR: Failed to start macOS docker compose services"
        exit 1
    fi
fi

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
log "Checking PostgreSQL connection..."
PG_READY=false
for i in {1..30}; do
    if docker exec "$(docker compose ps -q postgres)" pg_isready -U klicker -d klicker-prod > /dev/null 2>&1; then
        PG_READY=true
        break
    fi
    log "Waiting for PostgreSQL to be ready... ($i/30)"
    sleep 2
done

if [ "$PG_READY" = false ]; then
    log "ERROR: PostgreSQL failed to become ready after 60 seconds"
    cleanup
    exit 1
fi

log "PostgreSQL is ready"

# Step 2: Load Postgres dump
log "Loading Postgres dump..."
if ! "${SCRIPT_DIR}/_restore-db-dev.sh"; then
    log "WARNING: Postgres dump restore had errors (some errors are expected for production dumps)"
fi
log "Postgres dump loaded"

# Step 3: Load Redis dump
log "Loading Redis dump..."
if ! "${SCRIPT_DIR}/_restore-redis-dev.sh"; then
    log "ERROR: Failed to load Redis dump"
    cleanup
    exit 1
fi
log "Successfully loaded Redis dump"

# Step 4: Apply Prisma migrations
log "Applying Prisma migrations..."
cd "${REPO_ROOT}/packages/prisma" || {
    log "ERROR: Failed to change to Prisma directory"
    cleanup
    exit 1
}

if ! pnpm prisma:deploy; then
    log "ERROR: Failed to apply Prisma migrations"
    cleanup
    exit 1
fi
log "Successfully applied Prisma migrations"

log "Local development environment successfully prepared!"
