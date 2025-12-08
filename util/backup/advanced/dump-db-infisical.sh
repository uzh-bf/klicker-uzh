#!/bin/bash

# =============================================================================
# PostgreSQL Database Dump Script
# =============================================================================
#
# This script creates a PostgreSQL database dump for a specified environment.
# It supports all environments (dev/stg/prd) via Infisical configuration.
#
# Usage: ./dump-db.sh [environment]
#
# Arguments:
#   environment    Target environment (dev|stg|prd). Defaults to 'prd'
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
Usage: $0 [ENVIRONMENT]

PostgreSQL Database Dump Script

ARGUMENTS:
    ENVIRONMENT    Target environment for dump (dev|stg|prd). Defaults to 'prd'

ENVIRONMENTS:
    dev           Development environment
    stg           Staging environment  
    prd           Production environment (default)

EXAMPLES:
    $0            # Dump production database (default)
    $0 prd        # Dump production database (explicit)
    $0 stg        # Dump staging database
    $0 dev        # Dump development database

DESCRIPTION:
    Creates a PostgreSQL database dump for the specified environment using
    Infisical for configuration management. Supports encryption, automated
    cleanup, and symlink management based on environment variables.

ENVIRONMENT VARIABLES:
    BACKUP_ENCRYPTION_KEY     GPG passphrase for encryption (REQUIRED)
    BACKUP_VOLUME_PATH        Custom backup storage location (automated mode)
    BACKUP_RETENTION_DAYS     Days to keep old dumps (default: 7)
    BACKUP_CLEANUP_ENABLED    Enable automatic cleanup (default: true)
    BACKUP_UPDATE_LATEST      Update latest symlink (default: true)

EOF
}

# Parse command line arguments
ENVIRONMENT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|stg|prd)
            ENVIRONMENT="$1"
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
ROOT_DIR=$(git rev-parse --show-toplevel)
if [[ "$ENVIRONMENT" == "prd" ]]; then
    CONFIG_FILE="$ROOT_DIR/.infisical_prd.json"
else
    CONFIG_FILE="$ROOT_DIR/.infisical_stg.json"
fi
PROJECT_ID=$(jq -r '.workspaceId' "$CONFIG_FILE")

# =============================================================================
# INFISICAL DELEGATION
# =============================================================================
export BACKUP_ENCRYPTION_KEY=$(infisical secrets get BACKUP_ENCRYPTION_KEY --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
export DATABASE_URL=$(infisical secrets get DATABASE_URL --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
export DATABASE_URL_HATCHET=$(infisical secrets get HATCHET_DATABASE_URL --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
export DATABASE_URL_LTI=$(infisical secrets get LTI_DB_CONNECTION_STRING --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)

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
echo "Starting PostgreSQL Database Dump Process"
echo "Environment: ${CONFIG:-unknown}"
echo "========================================"

# Additional cleanup for dump-specific variables
cleanup_dump() {
    log "Cleaning up dump-specific environment variables..."
    unset DATABASE_URL DATABASE_USER DATABASE_PASS DATABASE_HOST DATABASE_NAME PGPASSWORD 2>/dev/null || true
    unset BACKUP_ENCRYPTION_KEY 2>/dev/null || true
}

# Set up trap for cleanup on script exit
trap cleanup_dump EXIT

echo "\n🔐 Step 1: Environment Configuration Loaded"
echo "---------------------------------------------"
log "Infisical environment loaded successfully for config: ${CONFIG:-unknown}"

echo "\n🔍 Step 2: Validating Database Connection Variables"
echo "----------------------------------------------------"

# Validate database connection variables
if [[ -n "${DATABASE_URL:-}" && -n "${DATABASE_URL_HATCHET:-}" && -n "${DATABASE_URL_LTI:-}" ]]; then
  log "Using DATABASE_URL for connection"
  # Remove unsupported query parameters like "schema" and "pgbouncer" that pg_dump doesn't understand
  DB_CONN=$(echo "$DATABASE_URL" | sed 's/[?&]schema=[^&]*//g' | sed 's/[?&]sslmode=[^&]*//g' | sed 's/[?&]pgbouncer=[^&]*//g' | sed 's/?$//')
  DB_CONN_HATCHET=$(echo "$DATABASE_URL_HATCHET" | sed 's/[?&]schema=[^&]*//g' | sed 's/[?&]sslmode=[^&]*//g' | sed 's/[?&]pgbouncer=[^&]*//g' | sed 's/?$//')
  DB_CONN_LTI=$(echo "$DATABASE_URL_LTI" | sed 's/[?&]schema=[^&]*//g' | sed 's/[?&]sslmode=[^&]*//g' | sed 's/[?&]pgbouncer=[^&]*//g' | sed 's/?$//')
else
  error_exit "Missing required database connection variables. Ensure DATABASE_URL, HATCHET_DATABASE_URL, and LTI_DATABASE_URL are set."
fi

echo "\n🔧 Step 3: Verifying Required Tools"
echo "------------------------------------"
echo "  🔍 Checking for pg_dump command..."

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    error_exit "pg_dump command not found. Please install PostgreSQL client tools."
fi
echo "  ✅ pg_dump is available"

echo "\n💾 Step 4: Preparing Database Dump"
echo "------------------------------------"

echo "  📅 Generating timestamp and preparing dump location..."
# Generate timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Get the appropriate dump directory
DUMP_DIR=$(get_dump_directory "db")
DUMP_DIR_HATCHET=$(get_dump_directory "db_hatchet")
DUMP_DIR_LTI=$(get_dump_directory "db_lti")
mkdir -p "$DUMP_DIR"
mkdir -p "$DUMP_DIR_HATCHET"
mkdir -p "$DUMP_DIR_LTI"

# Set full path for dump file
DUMP_FILE="$DUMP_DIR/dump_${TIMESTAMP}.tar"
DUMP_FILE_HATCHET="$DUMP_DIR_HATCHET/dump_${TIMESTAMP}.tar"
DUMP_FILE_LTI="$DUMP_DIR_LTI/dump_${TIMESTAMP}.tar"
echo "  💾 Dump file will be: $DUMP_FILE"
echo "  💾 Dump file will be: $DUMP_FILE_HATCHET"
echo "  💾 Dump file will be: $DUMP_FILE_LTI"
echo "  📁 Dump directory: $DUMP_DIR"
echo "  📁 Dump directory: $DUMP_DIR_HATCHET"
echo "  📁 Dump directory: $DUMP_DIR_LTI"


echo "\n🚀 Step 5: Executing Database Dump"
echo "------------------------------------"
log "Creating database dump: $DUMP_FILE"
log "Creating database dump: $DUMP_FILE_HATCHET"
log "Creating database dump: $DUMP_FILE_LTI"

# Run pg_dump with error handling
echo "  📊 Starting pg_dump process (this may take a while)..."
if ! pg_dump --dbname="$DB_CONN" --format=t --file="$DUMP_FILE" --no-owner --verbose; then
    error_exit "Database dump failed"
fi
if ! pg_dump --dbname="$DB_CONN_HATCHET" --format=t --file="$DUMP_FILE_HATCHET" --no-owner --verbose; then
    error_exit "Database dump failed"
fi
if ! pg_dump --dbname="$DB_CONN_LTI" --format=t --file="$DUMP_FILE_LTI" --no-owner --verbose; then
    error_exit "Database dump failed"
fi

echo "\n✅ Step 6: Dump Process Completed Successfully"
echo "----------------------------------------------"
log "Database dump completed successfully: $DUMP_FILE"
log "Database dump completed successfully: $DUMP_FILE_HATCHET"
log "Database dump completed successfully: $DUMP_FILE_LTI"

echo "\n🧹 Step 7: Cleanup and Finalization"
echo "-------------------------------------"
echo "  🔍 Cleaning up temporary credentials..."

# Source the verification utility
source "$(dirname "$0")/../lib/_verify-dump-file.sh"

# Source the checksum utility
if [[ -f "$(dirname "$0")/../lib/_checksum.sh" ]]; then
    source "$(dirname "$0")/../lib/_checksum.sh"
else
    echo "WARNING: Checksum utilities not found at $(dirname "$0")/../lib/_checksum.sh"
    echo "Checksums will not be generated for this backup"
fi

# Verify the dump file with minimum size of 1KB for database dumps
if ! verify_dump_file "$DUMP_FILE" 1024; then
  error_exit "Database dump file verification failed"
fi
if ! verify_dump_file "$DUMP_FILE_HATCHET" 1024; then
  error_exit "Database dump file verification failed"
fi
if ! verify_dump_file "$DUMP_FILE_LTI" 1024; then
  error_exit "Database dump file verification failed"
fi

echo "\n🔒 Step 8: Post-Processing"
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
if ! gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --cipher-algo AES256 --symmetric \
        --output "${DUMP_FILE_HATCHET}.gpg" "$DUMP_FILE_HATCHET"; then
    error_exit "Failed to encrypt dump file"
fi
if ! gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --cipher-algo AES256 --symmetric \
        --output "${DUMP_FILE_LTI}.gpg" "$DUMP_FILE_LTI"; then
    error_exit "Failed to encrypt dump file"
fi

# Remove unencrypted version (security requirement)
rm -f "$DUMP_FILE"
rm -f "$DUMP_FILE_HATCHET"
rm -f "$DUMP_FILE_LTI"
DUMP_FILE="${DUMP_FILE}.gpg"
DUMP_FILE_HATCHET="${DUMP_FILE_HATCHET}.gpg"
DUMP_FILE_LTI="${DUMP_FILE_LTI}.gpg"
echo "  ✅ Dump file encrypted successfully"

# Generate checksum for encrypted file (for integrity verification)
echo "  🔍 Generating integrity checksum..."
if command -v generate_checksum &> /dev/null; then
    if generate_checksum "$DUMP_FILE" >/dev/null; then
        echo "  ✅ Checksum generated successfully"
    else
        echo "  ⚠️  Warning: Failed to generate checksum (backup still valid)"
    fi
    if generate_checksum "$DUMP_FILE_HATCHET" >/dev/null; then
        echo "  ✅ Checksum generated successfully"
    else
        echo "  ⚠️  Warning: Failed to generate checksum (backup still valid)"
    fi
    if generate_checksum "$DUMP_FILE_LTI" >/dev/null; then
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
    if verify_backup_decrypt "$DUMP_FILE_HATCHET" 1048576 "$BACKUP_ENCRYPTION_KEY"; then
        echo "  ✅ Backup verification successful - can be decrypted"
    else
        echo "  ❌ ERROR: Backup verification failed - cannot decrypt!"
        echo "  🗑️  Removing corrupted backup file..."
        rm -f "$DUMP_FILE_HATCHET"
        error_exit "Backup verification failed - backup was corrupted and removed"
    fi
    if verify_backup_decrypt "$DUMP_FILE_LTI" 1048576 "$BACKUP_ENCRYPTION_KEY"; then
        echo "  ✅ Backup verification successful - can be decrypted"
    else
        echo "  ❌ ERROR: Backup verification failed - cannot decrypt!"
        echo "  🗑️  Removing corrupted backup file..."
        rm -f "$DUMP_FILE_LTI"
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
    cd "$DUMP_DIR_HATCHET"
    ln -sf "$(basename "$DUMP_FILE_HATCHET")" "latest"
    echo "  ✅ Latest symlink updated to $(basename "$DUMP_FILE_HATCHET")"
    cd - > /dev/null
    cd "$DUMP_DIR_LTI"
    ln -sf "$(basename "$DUMP_FILE_LTI")" "latest"
    echo "  ✅ Latest symlink updated to $(basename "$DUMP_FILE_LTI")"
    cd - > /dev/null
fi

# Cleanup old dumps if in automated mode
if should_cleanup; then
    echo "  🧹 Cleaning up old dumps..."
    cleanup_old_dumps "$DUMP_DIR"
    cleanup_old_dumps "$DUMP_DIR_HATCHET"
    cleanup_old_dumps "$DUMP_DIR_LTI"
fi

echo "\n🎉 DATABASE DUMP COMPLETED SUCCESSFULLY!"
echo "================================================"
echo "Dump file: $(basename "$DUMP_FILE")"
echo "Dump file: $(basename "$DUMP_FILE_HATCHET")"
echo "Dump file: $(basename "$DUMP_FILE_LTI")"
echo "Location: $DUMP_FILE"
echo "Location: $DUMP_FILE_HATCHET"
echo "Location: $DUMP_FILE_LTI"
echo "Directory: $DUMP_DIR"
echo "Directory: $DUMP_DIR_HATCHET"
echo "Directory: $DUMP_DIR_LTI"
echo "Generated: $(date)"
if [[ -L "$DUMP_DIR/latest" ]]; then
    echo "Latest link: $DUMP_DIR/latest -> $(readlink "$DUMP_DIR/latest")"
fi
if [[ -L "$DUMP_DIR_HATCHET/latest" ]]; then
    echo "Latest link: $DUMP_DIR_HATCHET/latest -> $(readlink "$DUMP_DIR_HATCHET/latest")"
fi
if [[ -L "$DUMP_DIR_LTI/latest" ]]; then
    echo "Latest link: $DUMP_DIR_LTI/latest -> $(readlink "$DUMP_DIR_LTI/latest")"
fi
echo "================================================"
