#!/bin/bash

# Enable strict error handling
set -euo pipefail

# Function for logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function for error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Function for cleanup on failure
cleanup() {
    log "Cleaning up sensitive environment variables..."
    unset REDIS_HOST REDIS_PORT REDIS_PASS 2>/dev/null || true
}

# Set up trap for cleanup on script exit
trap cleanup EXIT

# Run doppler secrets first to ensure we have the environment loaded
log "Downloading Doppler secrets..."
if ! doppler secrets download --no-file --format env --config prd > /tmp/doppler_secrets.env 2>/dev/null; then
    error_exit "Failed to download Doppler secrets. Please check your Doppler configuration and authentication."
fi

# Source the environment variables
if ! source /tmp/doppler_secrets.env; then
    rm -f /tmp/doppler_secrets.env
    error_exit "Failed to load Doppler environment variables"
fi

# Clean up the temporary file
rm -f /tmp/doppler_secrets.env

log "Doppler secrets loaded successfully"

# Validate required environment variables
if [[ -z "${REDIS_HOST:-}" ]]; then
    error_exit "REDIS_HOST environment variable is not set"
fi

if [[ -z "${REDIS_PORT:-}" ]]; then
    error_exit "REDIS_PORT environment variable is not set"
fi

if [[ -z "${REDIS_PASS:-}" ]]; then
    error_exit "REDIS_PASS environment variable is not set"
fi

# Check if upstash-redis-dump executable exists
if [[ ! -f "./upstash-redis-dump" ]]; then
    error_exit "upstash-redis-dump executable not found in current directory"
fi

if [[ ! -x "./upstash-redis-dump" ]]; then
    error_exit "upstash-redis-dump is not executable"
fi

# Generate timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="redis_dump_${TIMESTAMP}.dump"

log "Creating Redis dump: $DUMP_FILE"

# Run the dump command with the loaded environment variables
if ! ./upstash-redis-dump -host "${REDIS_HOST}" -port "${REDIS_PORT}" -pass "${REDIS_PASS}" -tls > "$DUMP_FILE"; then
    error_exit "Failed to create Redis dump"
fi

echo "\n🧹 Step 3: Cleanup and Verification"
echo "-------------------------------------"
# Source the verification utility
source "$(dirname "$0")/../lib/_verify-dump-file.sh"

# Verify the dump file with minimum size of 1 byte for Redis dumps
if ! verify_dump_file "$DUMP_FILE" 1; then
  error_exit "Redis dump file verification failed"
fi

echo "\n🎉 REDIS DUMP COMPLETED SUCCESSFULLY!"
echo "================================================"
echo "Dump file: $DUMP_FILE"
echo "Location: $(pwd)/$DUMP_FILE"
echo "Generated: $(date)"
echo "================================================"

log "Redis dump completed successfully: $DUMP_FILE"
