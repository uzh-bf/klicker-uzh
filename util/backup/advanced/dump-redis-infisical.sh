#!/bin/bash

# =============================================================================
# Redis Data Dump Script
# =============================================================================
#
# This script creates a Redis data dump for a specified environment.
# It supports all environments (dev/stg/prd) via Infisical configuration.
#
# Usage: ./dump-redis.sh [environment] [instance]
#
# Arguments:
#   environment    Target environment (dev|stg|prd). Defaults to 'prd'
#   instance       Redis instance type (main|assessment). Defaults to 'main'
#
# Features:
# - Environment-specific configuration via Infisical
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
Usage: $0 [ENVIRONMENT] [INSTANCE]

Redis Data Dump Script

ARGUMENTS:
    ENVIRONMENT    Target environment for dump (dev|stg|prd). Defaults to 'prd'
    INSTANCE       Redis instance type (main|assessment). Defaults to 'main'

ENVIRONMENTS:
    dev           Development environment
    stg           Staging environment  
    prd           Production environment (default)

INSTANCES:
    main          Main Redis instance (default)
    assessment    Assessment Redis instance

EXAMPLES:
    $0            # Dump production main Redis (default)
    $0 prd        # Dump production main Redis (explicit)
    $0 prd main   # Dump production main Redis (explicit)
    $0 prd assessment # Dump production assessment Redis
    $0 stg        # Dump staging main Redis
    $0 dev assessment # Dump development assessment Redis

DESCRIPTION:
    Creates a Redis data dump for the specified environment using
    Infisical for configuration management. Supports encryption, automated
    cleanup, and symlink management based on environment variables.

ENVIRONMENT VARIABLES:
    BACKUP_ENCRYPTION_KEY     GPG passphrase for encryption (REQUIRED)
    BACKUP_VOLUME_PATH        Custom backup storage location (automated mode)
    BACKUP_RETENTION_DAYS     Days to keep old dumps (default: 7)
    BACKUP_CLEANUP_ENABLED    Enable automatic cleanup (default: true)
    BACKUP_UPDATE_LATEST      Update latest symlink (default: true)
    
    REDIS_DUMP_WORKERS        Number of parallel workers (default: 10)
    REDIS_DUMP_DATABASE       Specific database to dump (default: all databases)
    REDIS_DUMP_FILTER         Key filter pattern (default: *)
    REDIS_DUMP_SILENT         Use silent mode (default: false, auto-enabled in automated mode)

REQUIREMENTS:
    - upstash-redis-dump executable at ../../util/upstash-redis-dump
    - Redis connection configuration via Infisical

EOF
}

# Parse command line arguments
ENVIRONMENT=""
INSTANCE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|stg|prd)
            ENVIRONMENT="$1"
            shift
            ;;
        main|assessment)
            INSTANCE="$1"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument '$1'"
            echo ""
            show_usage
            exit 1
            ;;
    esac
done

# Set default environment if not provided (for backward compatibility)
if [[ -z "$ENVIRONMENT" ]]; then
    ENVIRONMENT="prd"
fi

# Set default instance if not provided (for backward compatibility)
if [[ -z "$INSTANCE" ]]; then
    INSTANCE="main"
fi

# Validate environment parameter
case "$ENVIRONMENT" in
    "dev"|"stg"|"prd")
        echo "🎯 Target environment: $ENVIRONMENT"
        echo "🎯 Target instance: $INSTANCE"
        ;;
    *)
        echo "ERROR: Invalid environment '$ENVIRONMENT'. Valid environments: dev, stg, prd"
        echo ""
        show_usage
        exit 1
        ;;
esac

# =============================================================================
# INFISICAL DELEGATION
# =============================================================================
export BACKUP_ENCRYPTION_KEY=$(infisical secrets get BACKUP_ENCRYPTION_KEY --env="$ENVIRONMENT" --plain)

if [[ "$ENVIRONMENT" != "dev" ]]; then
    if [[ "$INSTANCE" == "assessment" ]]; then
        export REDIS_ASSESSMENT_HOST=$(infisical secrets get REDIS_ASSESSMENT_HOST --env="$ENVIRONMENT" --plain)
        export REDIS_ASSESSMENT_PORT=$(infisical secrets get REDIS_ASSESSMENT_PORT --env="$ENVIRONMENT" --plain)
        export REDIS_ASSESSMENT_PASS=$(infisical secrets get REDIS_ASSESSMENT_PASS --env="$ENVIRONMENT" --plain)
        export REDIS_ASSESSMENT_TLS="true"
    else
        export REDIS_HOST=$(infisical secrets get REDIS_HOST --env="$ENVIRONMENT" --plain)
        export REDIS_PORT=$(infisical secrets get REDIS_PORT --env="$ENVIRONMENT" --plain)
        export REDIS_PASS=$(infisical secrets get REDIS_PASS --env="$ENVIRONMENT" --plain)
        export REDIS_TLS="true"
    fi
else
    if [[ "$INSTANCE" == "assessment" ]]; then
        export REDIS_ASSESSMENT_HOST="localhost"
        export REDIS_ASSESSMENT_PORT=6381
        export REDIS_ASSESSMENT_PASS=""
        export REDIS_ASSESSMENT_TLS="false"
    else
        export REDIS_HOST="localhost"
        export REDIS_PORT=6379
        export REDIS_PASS=""
        export REDIS_TLS="false"
    fi
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
echo "Environment: ${ENVIRONMENT:-unknown}"
echo "========================================"

# Additional cleanup for dump-specific variables
cleanup_dump() {
    log "Cleaning up dump-specific environment variables..."
    unset REDIS_HOST REDIS_PORT REDIS_PASS REDIS_URL REDIS_TLS 2>/dev/null || true
    unset REDIS_ASSESSMENT_HOST REDIS_ASSESSMENT_PORT REDIS_ASSESSMENT_PASS REDIS_ASSESSMENT_TLS 2>/dev/null || true
    unset BACKUP_ENCRYPTION_KEY 2>/dev/null || true
}

# Set up trap for cleanup on script exit
trap cleanup_dump EXIT

echo "\n🔐 Step 1: Environment Configuration Loaded"
echo "---------------------------------------------"
log "Infisical environment loaded successfully for config: ${ENVIRONMENT:-unknown}"

echo "\n🔍 Step 2: Validating Redis Connection Variables"
echo "---------------------------------------------------"

# Validate required environment variables based on instance
if [[ "$INSTANCE" == "assessment" ]]; then
    if [[ -z "${REDIS_ASSESSMENT_HOST:-}" ]]; then
        error_exit "REDIS_ASSESSMENT_HOST environment variable is not set"
    fi
    if [[ -z "${REDIS_ASSESSMENT_PORT:-}" ]]; then
        error_exit "REDIS_ASSESSMENT_PORT environment variable is not set"
    fi
    if [[ -z "${REDIS_ASSESSMENT_PASS:-}" ]]; then
        error_exit "REDIS_ASSESSMENT_PASS environment variable is not set"
    fi
    
    # Set working variables for assessment Redis
    REDIS_HOST="$REDIS_ASSESSMENT_HOST"
    REDIS_PORT="$REDIS_ASSESSMENT_PORT"
    REDIS_PASS="$REDIS_ASSESSMENT_PASS"
    REDIS_TLS="${REDIS_ASSESSMENT_TLS:-false}"
else
    # Main Redis instance (existing logic)
    if [[ -z "${REDIS_HOST:-}" ]]; then
        error_exit "REDIS_HOST environment variable is not set"
    fi
    if [[ -z "${REDIS_PORT:-}" ]]; then
        error_exit "REDIS_PORT environment variable is not set"
    fi
    if [[ -z "${REDIS_PASS:-}" ]]; then
        error_exit "REDIS_PASS environment variable is not set"
    fi
    if [[ -z "${REDIS_TLS:-}" ]]; then
        error_exit "REDIS_TLS environment variable is not set"
    fi
fi
if [[ "$REDIS_TLS" == "true" ]]; then # TODO: dev doesnt work yet
    export REDIS_URL="rediss://default:$REDIS_PASS@$REDIS_HOST:$REDIS_PORT"
else
    export REDIS_URL="redis://default:$REDIS_PASS@$REDIS_HOST:$REDIS_PORT"
fi

# Generate timestamp and prepare dump location
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Get the appropriate dump directory based on instance
if [[ "$INSTANCE" == "assessment" ]]; then
    DUMP_DIR=$(get_dump_directory "redis-assessment")
else
    DUMP_DIR=$(get_dump_directory "redis")
fi
mkdir -p "$DUMP_DIR"

# Set full path for dump file with instance-specific naming
if [[ "$INSTANCE" == "assessment" ]]; then
    DUMP_FILE="$DUMP_DIR/redis_assessment_dump_${TIMESTAMP}.json"
else
    DUMP_FILE="$DUMP_DIR/redis_dump_${TIMESTAMP}.json"
fi

log "Creating Redis dump: $DUMP_FILE"
log_info "Dump directory: $DUMP_DIR"

echo "\n🚀 Step 2: Executing Redis Dump"
echo "-------------------------------"
echo "  📊 Starting Redis dump process..."

# Run the dump command with the loaded environment variables
if ! riot file-export -u "${REDIS_URL}" "$DUMP_FILE"; then
    error_exit "Failed to create Redis dump"
fi

echo "\n🧹 Step 3: Cleanup and Verification"
echo "-------------------------------------"
# Source the verification utility
source "$(dirname "$0")/../lib/_verify-dump-file.sh"

# Source the checksum utility
if [[ -f "$(dirname "$0")/../lib/_checksum.sh" ]]; then
    source "$(dirname "$0")/../lib/_checksum.sh"
else
    echo "WARNING: Checksum utilities not found at $(dirname "$0")/../lib/_checksum.sh"
    echo "Checksums will not be generated for this backup"
fi

# Verify the dump file with minimum size of 1 byte for Redis dumps
if ! verify_dump_file "$DUMP_FILE" 1; then
  error_exit "Redis dump file verification failed"
fi

echo "\n🔒 Step 4: Post-Processing"
echo "--------------------------"

# Encrypt dump (mandatory for all dumps)
echo "  🔐 Encrypting dump file (security policy requirement)..."

if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
    echo "  ❌ ERROR: Missing required encryption key"
    echo "  🔑 BACKUP_ENCRYPTION_KEY is mandatory for all dump operations"
    echo "  💡 Set BACKUP_ENCRYPTION_KEY environment variable or use Infisical"
    error_exit "Cannot create unencrypted dumps - security policy violation"
fi

if ! gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --cipher-algo AES256 --symmetric \
        --output "${DUMP_FILE}.gpg" "$DUMP_FILE"; then
    error_exit "Failed to encrypt dump file"
fi

# Remove unencrypted version (security requirement)
rm -f "$DUMP_FILE"
DUMP_FILE="${DUMP_FILE}.gpg"
echo "  ✅ Dump file encrypted successfully"

# Generate checksum for encrypted file (for integrity verification)
echo "  🔍 Generating integrity checksum..."
if command -v generate_checksum &> /dev/null; then
    if generate_checksum "$DUMP_FILE" >/dev/null; then
        echo "  ✅ Checksum generated successfully"
    else
        echo "  ⚠️  Warning: Failed to generate checksum (backup still valid)"
    fi
else
    echo "  ⚠️  Warning: Checksum generation not available (backup still valid)"
fi

# Source the backup verification utility
if [[ -f "$(dirname "$0")/../lib/_backup-verify.sh" ]]; then
    source "$(dirname "$0")/../lib/_backup-verify.sh"
    
    # Immediately verify the backup can be decrypted
    echo "  🔍 Verifying backup can be decrypted..."
    if verify_backup_decrypt "$DUMP_FILE" 1048576 "$BACKUP_ENCRYPTION_KEY"; then
        echo "  ✅ Backup verification successful - can be decrypted"
    else
        echo "  ❌ ERROR: Backup verification failed - cannot decrypt!"
        echo "  🗑️  Removing corrupted backup file..."
        rm -f "$DUMP_FILE"
        error_exit "Backup verification failed - backup was corrupted and removed"
    fi
else
    echo "  ⚠️  Warning: Backup verification not available (skipping decrypt test)"
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