#!/bin/bash

# =============================================================================
# PostgreSQL Database Dump Script
# =============================================================================
#
# This script creates a PostgreSQL database dump for a specified environment.
# It supports all environments (dev/stg/prd) via Doppler configuration.
#
# Usage: ./dump-db.sh [environment]
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
    Doppler for configuration management. Supports encryption, automated
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
INTERNAL_DOPPLER_LOADED=false

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|stg|prd)
            ENVIRONMENT="$1"
            shift
            ;;
        --internal-doppler-loaded)
            INTERNAL_DOPPLER_LOADED=true
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

# =============================================================================
# DOPPLER DELEGATION
# =============================================================================

# If we haven't been called with internal doppler flag, delegate to Doppler
if [[ "$INTERNAL_DOPPLER_LOADED" != "true" ]]; then
    echo "🔄 Delegating to Doppler with environment: $ENVIRONMENT"
    
    # Set CONFIG and execute via _run_with_doppler.sh
    CONFIG="$ENVIRONMENT" exec "${REPO_ROOT}/util/_run_with_doppler.sh" "$0" "$ENVIRONMENT" "--internal-doppler-loaded"
fi

# =============================================================================
# INTERNAL EXECUTION (after Doppler delegation)
# =============================================================================

# This section only runs when called from _run_with_doppler.sh
if [[ "$INTERNAL_DOPPLER_LOADED" != "true" ]]; then
    echo "ERROR: This script should be called with --internal-doppler-loaded flag when running internally"
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
log "Doppler environment loaded successfully for config: ${CONFIG:-unknown}"

echo "\n🔍 Step 2: Validating Database Connection Variables"
echo "----------------------------------------------------"

# Validate database connection variables
if [[ -n "${DATABASE_URL:-}" ]]; then
  log "Using DATABASE_URL for connection"
  # Remove unsupported query parameters like "schema" and "pgbouncer" that pg_dump doesn't understand
  DB_CONN=$(echo "$DATABASE_URL" | sed 's/[?&]schema=[^&]*//g' | sed 's/[?&]sslmode=[^&]*//g' | sed 's/[?&]pgbouncer=[^&]*//g' | sed 's/?$//')
else
  log "Using individual database variables for connection"
  echo "  🔍 Checking DATABASE_USER..."
  # Validate required individual variables
  if [[ -z "${DATABASE_USER:-}" ]]; then
    error_exit "DATABASE_USER environment variable is not set"
  fi
  echo "  ✅ DATABASE_USER is set"
  
  echo "  🔍 Checking DATABASE_PASS..."
  if [[ -z "${DATABASE_PASS:-}" ]]; then
    error_exit "DATABASE_PASS environment variable is not set"
  fi
  echo "  ✅ DATABASE_PASS is set"
  
  echo "  🔍 Checking DATABASE_HOST..."
  if [[ -z "${DATABASE_HOST:-}" ]]; then
    error_exit "DATABASE_HOST environment variable is not set"
  fi
  echo "  ✅ DATABASE_HOST is set"
  
  echo "  🔍 Checking DATABASE_NAME..."
  if [[ -z "${DATABASE_NAME:-}" ]]; then
    error_exit "DATABASE_NAME environment variable is not set"
  fi
  echo "  ✅ DATABASE_NAME is set"
  
  DB_CONN="postgresql://$DATABASE_USER:$DATABASE_PASS@$DATABASE_HOST:5432/$DATABASE_NAME"
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
echo "  🔍 Setting up authentication..."

# Use PGPASSWORD to avoid password prompt if using individual vars
unset_pgpassword=false
if [[ -z "${DATABASE_URL:-}" && -n "${DATABASE_PASS:-}" ]]; then
  export PGPASSWORD="$DATABASE_PASS"
  unset_pgpassword=true
  echo "  ✅ Password authentication configured"
else
  echo "  ✅ Using DATABASE_URL for authentication"
fi

echo "  📅 Generating timestamp and preparing dump location..."
# Generate timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Get the appropriate dump directory
DUMP_DIR=$(get_dump_directory "db")
mkdir -p "$DUMP_DIR"

# Set full path for dump file
DUMP_FILE="$DUMP_DIR/dump_${TIMESTAMP}.tar"
echo "  💾 Dump file will be: $DUMP_FILE"
echo "  📁 Dump directory: $DUMP_DIR"

if is_automated_mode; then
    echo "  🤖 Running in automated mode"
else
    echo "  👤 Running in local development mode"
fi

echo "\n🚀 Step 5: Executing Database Dump"
echo "------------------------------------"
log "Creating database dump: $DUMP_FILE"

# Run pg_dump with error handling
echo "  📊 Starting pg_dump process (this may take a while)..."
if ! pg_dump --dbname="$DB_CONN" --format=t --file="$DUMP_FILE" --no-owner --verbose; then
    error_exit "Database dump failed"
fi

echo "\n✅ Step 6: Dump Process Completed Successfully"
echo "----------------------------------------------"
log "Database dump completed successfully: $DUMP_FILE"

echo "\n🧹 Step 7: Cleanup and Finalization"
echo "-------------------------------------"
echo "  🔍 Cleaning up temporary credentials..."

# Clean up PGPASSWORD if it was set
if [[ "$unset_pgpassword" == true ]]; then
  unset PGPASSWORD
  echo "  ✅ PGPASSWORD cleaned up"
fi

# Source the verification utility
source "$(dirname "$0")/../lib/_verify-dump-file.sh"

# Verify the dump file with minimum size of 1KB for database dumps
if ! verify_dump_file "$DUMP_FILE" 1024; then
  error_exit "Database dump file verification failed"
fi

echo "\n🔒 Step 8: Post-Processing"
echo "--------------------------"

# Encrypt dump (mandatory for all dumps)
echo "  🔐 Encrypting dump file (security policy requirement)..."

if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
    echo "  ❌ ERROR: Missing required encryption key"
    echo "  🔑 BACKUP_ENCRYPTION_KEY is mandatory for all dump operations"
    echo "  💡 Set BACKUP_ENCRYPTION_KEY environment variable or use Doppler"
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

echo "\n🎉 DATABASE DUMP COMPLETED SUCCESSFULLY!"
echo "================================================"
echo "Dump file: $(basename "$DUMP_FILE")"
echo "Location: $DUMP_FILE"
echo "Directory: $DUMP_DIR"
echo "Generated: $(date)"
if [[ -L "$DUMP_DIR/latest" ]]; then
    echo "Latest link: $DUMP_DIR/latest -> $(readlink "$DUMP_DIR/latest")"
fi
echo "================================================"
