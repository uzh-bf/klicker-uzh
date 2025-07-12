#!/bin/bash

# =============================================================================
# Redis Data Dump Script
# =============================================================================
#
# This script creates a Redis data dump for a specified environment.
# It supports all environments (dev/stg/prd) via Doppler configuration.
#
# Usage: ./dump-redis.sh [environment]
#
# Arguments:
#   environment    Target environment (dev|stg|prd). Defaults to 'prd'
#
# Features:
# - Environment-specific configuration via Doppler
# - Automatic dump file management and organization
# - Optional encryption support
# - Automated cleanup and latest symlink management
# - Robust error handling and validation
#
# =============================================================================

# Enable strict error handling
set -euo pipefail

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# =============================================================================
# PARAMETER VALIDATION AND HELP
# =============================================================================

# Function to display usage information
show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT]

Redis Data Dump Script

ARGUMENTS:
    ENVIRONMENT    Target environment for dump (dev|stg|prd). Defaults to 'prd'

ENVIRONMENTS:
    dev           Development environment
    stg           Staging environment  
    prd           Production environment (default)

EXAMPLES:
    $0            # Dump production Redis (default)
    $0 prd        # Dump production Redis (explicit)
    $0 stg        # Dump staging Redis
    $0 dev        # Dump development Redis

DESCRIPTION:
    Creates a Redis data dump for the specified environment using
    Doppler for configuration management. Supports encryption, automated
    cleanup, and symlink management based on environment variables.

ENVIRONMENT VARIABLES:
    BACKUP_ENCRYPTION_KEY     GPG passphrase for encryption (optional)
    BACKUP_VOLUME_PATH        Custom backup storage location (automated mode)
    BACKUP_RETENTION_DAYS     Days to keep old dumps (default: 7)
    BACKUP_CLEANUP_ENABLED    Enable automatic cleanup (default: true)
    BACKUP_UPDATE_LATEST      Update latest symlink (default: true)

REQUIREMENTS:
    - upstash-redis-dump executable in script directory
    - Redis connection configuration via Doppler

EOF
}

# Check if help is requested
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    show_usage
    exit 0
fi

# Get environment parameter (default to 'prd' for backward compatibility)
ENVIRONMENT="${1:-prd}"

# Validate environment parameter
case "$ENVIRONMENT" in
    "dev"|"stg"|"prd")
        echo "🎯 Target environment: $ENVIRONMENT"
        ;;
    *)
        echo "ERROR: Invalid environment '$ENVIRONMENT'. Valid environments: dev, stg, prd"
        echo ""
        show_usage
        exit 1
        ;;
esac

# =============================================================================
# DOPPLER DELEGATION
# =============================================================================

# If we have environment parameter, delegate to _run_with_doppler.sh for proper environment handling
if [[ -n "$ENVIRONMENT" ]]; then
    echo "🔄 Delegating to Doppler with environment: $ENVIRONMENT"
    
    # Set CONFIG and execute via _run_with_doppler.sh
    CONFIG="$ENVIRONMENT" exec "${REPO_ROOT}/util/_run_with_doppler.sh" "$0" "--internal-doppler-loaded"
fi

# =============================================================================
# INTERNAL EXECUTION (after Doppler delegation)
# =============================================================================

# This section only runs when called from _run_with_doppler.sh
if [[ "${1:-}" != "--internal-doppler-loaded" ]]; then
    echo "ERROR: This script should be called with environment parameter or --internal-doppler-loaded flag"
    exit 1
fi

# =============================================================================
# SOURCE UTILITIES
# =============================================================================

# Source common utility functions
if [[ -f "${SCRIPT_DIR}/../lib/_restore-common.sh" ]]; then
    source "${SCRIPT_DIR}/../lib/_restore-common.sh"
else
    echo "ERROR: Required common utilities not found at ${SCRIPT_DIR}/../lib/_restore-common.sh"
    exit 1
fi

echo "========================================"
echo "Starting Redis Data Dump Process"
echo "Environment: ${CONFIG:-unknown}"
echo "========================================"

# Additional cleanup for dump-specific variables
cleanup_dump() {
    log "Cleaning up dump-specific environment variables..."
    unset REDIS_HOST REDIS_PORT REDIS_PASS REDIS_URL 2>/dev/null || true
    unset BACKUP_ENCRYPTION_KEY 2>/dev/null || true
}

# Set up trap for cleanup on script exit
trap cleanup_dump EXIT

echo "\n🔐 Step 1: Environment Configuration Loaded"
echo "---------------------------------------------"
log "Doppler environment loaded successfully for config: ${CONFIG:-unknown}"

echo "\n🔍 Step 2: Validating Redis Connection Variables"
echo "---------------------------------------------------"

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

# Generate timestamp and prepare dump location
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Get the appropriate dump directory
DUMP_DIR=$(get_dump_directory "redis")
mkdir -p "$DUMP_DIR"

# Set full path for dump file
DUMP_FILE="$DUMP_DIR/redis_dump_${TIMESTAMP}.dump"

log "Creating Redis dump: $DUMP_FILE"
log_info "Dump directory: $DUMP_DIR"

if is_automated_mode; then
    log_info "Running in automated mode"
else
    log_info "Running in local development mode"
fi

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

echo "\n🔒 Step 4: Post-Processing"
echo "--------------------------"

# Encrypt dump if encryption key is provided
if should_encrypt; then
    echo "  🔐 Encrypting dump file..."
    if ! gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
            --cipher-algo AES256 --symmetric \
            --output "${DUMP_FILE}.gpg" "$DUMP_FILE"; then
        error_exit "Failed to encrypt dump file"
    fi
    
    # Remove unencrypted version
    rm -f "$DUMP_FILE"
    DUMP_FILE="${DUMP_FILE}.gpg"
    echo "  ✅ Dump file encrypted successfully"
else
    echo "  ℹ️  No encryption key provided, dump file remains unencrypted"
fi

# Update latest symlink
if should_update_latest; then
    echo "  🔗 Updating latest symlink..."
    cd "$DUMP_DIR"
    ln -sf "$(basename "$DUMP_FILE")" "latest"
    echo "  ✅ Latest symlink updated to $(basename "$DUMP_FILE")"
    cd - > /dev/null
fi

# Cleanup old dumps if in automated mode
if should_cleanup; then
    echo "  🧹 Cleaning up old dumps..."
    cleanup_old_dumps "$DUMP_DIR"
fi

echo "\n🎉 REDIS DUMP COMPLETED SUCCESSFULLY!"
echo "================================================"
echo "Dump file: $(basename "$DUMP_FILE")"
echo "Location: $DUMP_FILE"
echo "Directory: $DUMP_DIR"
echo "Generated: $(date)"
if [[ -L "$DUMP_DIR/latest" ]]; then
    echo "Latest link: $DUMP_DIR/latest -> $(readlink "$DUMP_DIR/latest")"
fi
echo "================================================"

log "Redis dump completed successfully: $DUMP_FILE"
