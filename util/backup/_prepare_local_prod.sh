#!/bin/bash

# This script prepares the local development environment using production dumps
# Workflow:
# 1. Reset docker compose environment (including volumes)
# 2. Load Postgres database dump (automatically discovers latest dump)
# 3. Load Redis dump (automatically discovers latest dump)
# 4. Apply Prisma migrations

# Enable error handling
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Source common utility functions for dump discovery
if [[ -f "${SCRIPT_DIR}/lib/_restore-common.sh" ]]; then
    source "${SCRIPT_DIR}/lib/_restore-common.sh"
else
    echo "ERROR: Required common utilities not found at ${SCRIPT_DIR}/lib/_restore-common.sh"
    exit 1
fi

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

# Check if required dump files exist using automatic discovery
log "Discovering available dump files..."

DB_DUMP=""
if DB_DUMP=$(find_latest_dump "db" 2>/dev/null); then
    log "Found database dump: $DB_DUMP"
else
    log "ERROR: No database dump found. Please create a database dump first using:"
    log "  cd ${SCRIPT_DIR}/dump && ./dump-db.sh"
    exit 1
fi

REDIS_DUMP=""
if REDIS_DUMP=$(find_latest_dump "redis" 2>/dev/null); then
    log "Found Redis dump: $REDIS_DUMP"
else
    log "ERROR: No Redis dump found. Please create a Redis dump first using:"
    log "  cd ${SCRIPT_DIR}/dump && ./dump-redis.sh"
    exit 1
fi

# Check if dumps are encrypted and warn user if encryption key is needed
if [[ "$DB_DUMP" == *.gpg ]] || [[ "$REDIS_DUMP" == *.gpg ]]; then
    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        log "WARNING: Encrypted dumps found but no BACKUP_ENCRYPTION_KEY provided"
        log "If restore fails, set BACKUP_ENCRYPTION_KEY environment variable"
    else
        log "Encrypted dumps detected, will decrypt automatically"
    fi
fi

# Validate that unified restore scripts exist
if [[ ! -f "${SCRIPT_DIR}/restore/restore-db.sh" ]]; then
    log "ERROR: Unified database restore script not found at ${SCRIPT_DIR}/restore/restore-db.sh"
    exit 1
fi

if [[ ! -f "${SCRIPT_DIR}/restore/restore-redis.sh" ]]; then
    log "ERROR: Unified Redis restore script not found at ${SCRIPT_DIR}/restore/restore-redis.sh"
    exit 1
fi

if [[ ! -x "${SCRIPT_DIR}/restore/restore-db.sh" ]]; then
    log "ERROR: Database restore script is not executable: ${SCRIPT_DIR}/restore/restore-db.sh"
    exit 1
fi

if [[ ! -x "${SCRIPT_DIR}/restore/restore-redis.sh" ]]; then
    log "ERROR: Redis restore script is not executable: ${SCRIPT_DIR}/restore/restore-redis.sh"
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
export DUMP_FILE="$DB_DUMP"
if ! "${SCRIPT_DIR}/restore/restore-db.sh" dev; then
    log "WARNING: Postgres dump restore had errors (some errors are expected for production dumps)"
fi
log "Postgres dump loaded"

# Step 3: Load Redis dump
log "Loading Redis dump..."
export DUMP_FILE="$REDIS_DUMP"
if ! "${SCRIPT_DIR}/restore/restore-redis.sh" dev; then
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

log "=========================================="
log "Local development environment successfully prepared!"
log "=========================================="
log "Database dump used: $(basename "$DB_DUMP")"
log "Redis dump used: $(basename "$REDIS_DUMP")"
log "=========================================="
