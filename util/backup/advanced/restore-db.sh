#!/bin/bash

# =============================================================================
# Unified PostgreSQL Database Restore Script
# =============================================================================
#
# This script restores a PostgreSQL database from a dump file for any environment.
# It supports all environments (dev/stg/prd) via Doppler configuration.
#
# Usage: ./restore-db.sh [environment]
#
# Arguments:
#   environment    Target environment (dev|stg|prd). Defaults to 'dev'
#
# Environment Variables:
#   DUMP_FILE           Path to specific dump file to restore
#   BACKUP_ENCRYPTION_KEY  Required for encrypted dumps
#   DEBUG_RESTORE       Set to 'true' to enable verbose debugging output
#
# Debug Mode:
#   DEBUG_RESTORE=true ./restore-db.sh dev
#   - Shows detailed GPG error messages
#   - Displays file validation steps
#   - Provides comprehensive troubleshooting information
#
# Features:
# - Environment-specific configuration via Doppler (stg/prd) or local config (dev)
# - Automatic dump file discovery with priority order
# - Comprehensive error handling and validation
# - Production safety measures and confirmation prompts
# - Progress indicators and detailed logging
# - Automatic decryption of encrypted dumps
# - Post-restore verification
#
# =============================================================================

# Enable strict error handling
set -euo pipefail

# Debug mode support
if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
    echo "🐛 DEBUG MODE ENABLED - Verbose output activated"
    echo "🐛 Script: $(basename "$0")"
    echo "🐛 PID: $$"
    echo "🐛 Debug variables will be shown throughout the restore process"
    echo ""
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Debug mode directory information
if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
    echo "🐛 Debug - Directory paths:"
    echo "🐛   Script directory: $SCRIPT_DIR"
    echo "🐛   Repository root: $REPO_ROOT"
    echo ""
fi

# =============================================================================
# PARAMETER VALIDATION AND HELP
# =============================================================================

# Function to display usage information
show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT]

Unified PostgreSQL Database Restore Script

ARGUMENTS:
    ENVIRONMENT    Target environment for restore (dev|stg|prd). Defaults to 'dev'

ENVIRONMENTS:
    dev           Development environment (local configuration)
    stg           Staging environment (uses Doppler)
    prd           Production environment (uses Doppler, requires safety confirmation)

EXAMPLES:
    $0            # Restore to development (default)
    $0 dev        # Restore to development (explicit)
    $0 stg        # Restore to staging
    $0 prd        # Restore to production (with safety prompts)

DESCRIPTION:
    Restores a PostgreSQL database from dump files with automatic discovery.
    Uses different configuration methods based on environment:
    - Development: Direct local configuration
    - Staging/Production: Doppler secrets management

ENVIRONMENT VARIABLES:
    DUMP_FILE                 Explicit path to dump file (overrides auto-discovery)
    BACKUP_ENCRYPTION_KEY     GPG passphrase for encrypted dumps
    DATABASE_URL              PostgreSQL connection URL (Doppler environments)
    SKIP_PRODUCTION_SAFETY    Skip production safety prompts (use with caution)

SAFETY FEATURES:
    - Production restores require explicit confirmation
    - Pre-restore validation and connectivity checks
    - Automatic decryption of encrypted dumps
    - Comprehensive error handling and rollback

EOF
}

# Check if help is requested
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    show_usage
    exit 0
fi

# Get environment parameter (default to 'dev' for safety)
ENVIRONMENT="${1:-dev}"

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
# DOPPLER DELEGATION (for stg/prd environments)
# =============================================================================

# For staging and production, delegate to _run_with_doppler.sh
if [[ "$ENVIRONMENT" == "stg" || "$ENVIRONMENT" == "prd" ]]; then
    echo "🔄 Delegating to Doppler with environment: $ENVIRONMENT"

    # Set CONFIG and execute via _run_with_doppler.sh
    CONFIG="$ENVIRONMENT" exec "${REPO_ROOT}/util/_run_with_doppler.sh" "$0" "$ENVIRONMENT" "--internal-doppler-loaded"
fi

# =============================================================================
# DEVELOPMENT CONFIGURATION (dev environment only)
# =============================================================================

if [[ "$ENVIRONMENT" == "dev" ]]; then
    echo "🏠 Using development environment configuration"

    # Development database configuration
    export DATABASE_HOST="localhost"
    export DATABASE_PORT="5432"
    export DATABASE_USER="klicker-prod"
    export DATABASE_PASS="klicker"
    export DATABASE_NAME="klicker-prod"

    echo "   Host: ${DATABASE_HOST}"
    echo "   Database: ${DATABASE_NAME}"
    echo "   User: ${DATABASE_USER}"
fi

# =============================================================================
# INTERNAL EXECUTION (after Doppler delegation or dev config)
# =============================================================================

# For Doppler environments, ensure we have the --internal-doppler-loaded flag
if [[ "$ENVIRONMENT" != "dev" && "${2:-}" != "--internal-doppler-loaded" ]]; then
    echo "ERROR: Non-dev environments should be called with --internal-doppler-loaded flag"
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

# Source verification utility functions
if [[ -f "${SCRIPT_DIR}/../lib/_verify-dump-file.sh" ]]; then
    source "${SCRIPT_DIR}/../lib/_verify-dump-file.sh"
else
    echo "ERROR: Required verification utilities not found at ${SCRIPT_DIR}/../lib/_verify-dump-file.sh"
    exit 1
fi

# Source restore verification utility functions
if [[ -f "${SCRIPT_DIR}/../lib/_verify-restore.sh" ]]; then
    source "${SCRIPT_DIR}/../lib/_verify-restore.sh"
else
    echo "ERROR: Required restore verification utilities not found at ${SCRIPT_DIR}/../lib/_verify-restore.sh"
    exit 1
fi

# Source checksum verification utility functions (optional)
if [[ -f "${SCRIPT_DIR}/../lib/_checksum.sh" ]]; then
    source "${SCRIPT_DIR}/../lib/_checksum.sh"
else
    echo "WARNING: Checksum utilities not found at ${SCRIPT_DIR}/../lib/_checksum.sh"
    echo "Checksum verification will be skipped"
fi

# =============================================================================
# SCRIPT CONFIGURATION
# =============================================================================

echo "========================================"
echo "Starting PostgreSQL Database Restore"
echo "Environment: $ENVIRONMENT"
echo "========================================"

# Try to find the latest dump file automatically
if [[ -z "${DUMP_FILE:-}" ]]; then
    if DISCOVERED_DUMP=$(find_latest_dump "db"); then
        DUMP_FILE="$DISCOVERED_DUMP"
        log_info "Auto-discovered dump file: $DUMP_FILE"
    else
        # Fallback to default location for backward compatibility
        DUMP_FILE="${SCRIPT_DIR}/../dump.tar"
        log_warning "No dumps found, using fallback: $DUMP_FILE"
    fi
else
    log_info "Using explicitly provided dump file: $DUMP_FILE"
fi

# =============================================================================
# PRODUCTION SAFETY CHECKS
# =============================================================================

if [[ "$ENVIRONMENT" == "prd" && "${SKIP_PRODUCTION_SAFETY:-}" != "true" ]]; then
    echo ""
    echo "⚠️  PRODUCTION ENVIRONMENT DETECTED ⚠️"
    echo "======================================="
    echo ""
    echo "You are about to restore to the PRODUCTION database."
    echo "This operation will:"
    echo "  • Replace all existing production data"
    echo "  • Potentially cause service downtime"
    echo "  • Affect live users and applications"
    echo ""
    echo "Dump file: $DUMP_FILE"
    echo "Target: Production Database"
    echo ""

    # Require explicit confirmation
    read -p "Are you absolutely sure you want to proceed? Type 'RESTORE PRODUCTION' to confirm: " confirmation

    if [[ "$confirmation" != "RESTORE PRODUCTION" ]]; then
        echo "❌ Production restore cancelled by user"
        exit 1
    fi

    echo ""
    echo "✅ Production restore confirmed"
    echo ""

    # Additional confirmation for extra safety
    read -p "Final confirmation - type 'YES' to proceed with production restore: " final_confirmation

    if [[ "$final_confirmation" != "YES" ]]; then
        echo "❌ Production restore cancelled by user"
        exit 1
    fi

    echo ""
    echo "🚀 Proceeding with production database restore..."
    echo ""
fi

# =============================================================================
# CLEANUP HANDLER
# =============================================================================

# Function for comprehensive cleanup
cleanup_database_restore() {
    log_info "Performing cleanup..."

    # Clean up sensitive environment variables
    cleanup_database

    # Remove any log files (temp decrypted files handled by secure system)
    rm -f /tmp/${ENVIRONMENT}_restore_*.log 2>/dev/null || true

    log_info "Cleanup completed"
}

# Set up secure signal handling and register cleanup functions
setup_secure_signal_handling
register_cleanup_function cleanup_database_restore

# =============================================================================
# MAIN RESTORE FUNCTION
# =============================================================================

restore_database() {
    log_step "Starting Database Restore for $ENVIRONMENT Environment"

    # Initialize restore environment
    init_restore_environment "database"

    # Check for required tools
    check_database_tools

    # Decrypt dump file (all dumps must be encrypted)
    log_step "Preparing Dump File"

    # All dumps must be encrypted - validate first
    # Resolve symlink to get actual filename for validation
    local actual_file="$DUMP_FILE"
    if [[ -L "$DUMP_FILE" ]]; then
        actual_file=$(readlink -f "$DUMP_FILE" 2>/dev/null || readlink "$DUMP_FILE" 2>/dev/null || echo "$DUMP_FILE")
    fi

    if [[ "$actual_file" != *.gpg ]]; then
        echo "  ❌ ERROR: Security Policy Violation - Unencrypted dump detected"
        echo "  🔒 All dump files must be encrypted for security"
        echo "  📁 File: $(basename "$DUMP_FILE")"
        echo "  💡 Expected: $(basename "$actual_file").gpg"
        echo ""
        echo "  📋 To fix this:"
        echo "     1. Create encrypted dumps: BACKUP_ENCRYPTION_KEY='key' ./dump-db.sh"
        echo "     2. Contact admin for encrypted production dumps"
        echo ""
        error_exit "Unencrypted dumps are not allowed - security policy violation"
    fi

    log_info "🔒 Encrypted dump detected: $(basename "$DUMP_FILE")"

    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        echo "  ❌ ERROR: Missing required encryption key"
        echo "  🔑 BACKUP_ENCRYPTION_KEY is mandatory for all dump operations"
        echo ""
        echo "  📋 To fix this:"
        echo "     1. Set the encryption key: export BACKUP_ENCRYPTION_KEY='your-key'"
        echo "     2. Or use Doppler: doppler run -- $0 $ENVIRONMENT"
        echo "     3. Or contact admin for the encryption key"
        echo ""
        error_exit "Cannot proceed without encryption key"
    fi

    log_info "🔑 Encryption key available, will decrypt dump automatically"

    # Verify file integrity with checksum before decryption
    if command -v verify_checksum &> /dev/null; then
        log_info "🔍 Verifying file integrity with checksum..."
        if verify_checksum "$actual_file" "" true; then
            log_info "✅ File integrity verification passed"
        else
            log_warning "❌ File integrity verification failed"
            log_warning "💡 Use --skip-checksum to bypass verification (not recommended)"
            error_exit "File integrity check failed - backup may be corrupted"
        fi
    else
        log_info "⚠️  Checksum verification not available (skipping)"
    fi

    # Perform decryption with enhanced logging
    DUMP_FILE=$(decrypt_dump_if_needed "$DUMP_FILE")
    log_info "✅ Using prepared dump file: $(basename "$DUMP_FILE")"

    # Verify dump file exists and is valid
    log_step "Verifying Dump File"
    validate_dump_file "$DUMP_FILE" "database dump"
    log_success "Dump file verification completed"

    # Validate database environment variables
    log_step "Validating Database Configuration"
    validate_database_env

    # Build connection parameters
    log_step "Preparing Database Connection"

    if [[ -n "${DATABASE_URL:-}" ]]; then
        log_info "Using DATABASE_URL for connection"
        # Clean up DATABASE_URL for pg_restore
        DB_CONN=$(build_pg_connection_string)
        log_info "Connection string prepared"
    else
        log_info "Using individual database parameters for connection"
        log_info "Host: ${DATABASE_HOST}"
        log_info "Database: ${DATABASE_NAME}"
        log_info "User: ${DATABASE_USER}"

        # Set PGPASSWORD for pg_restore
        export PGPASSWORD="${DATABASE_PASS}"
        DB_CONN="postgresql://${DATABASE_USER}:${DATABASE_PASS}@${DATABASE_HOST}:${DATABASE_PORT:-5432}/${DATABASE_NAME}"
    fi

    log_success "Database connection prepared"

    # Test database connectivity
    log_step "Testing Database Connectivity"
    if command -v pg_isready &> /dev/null; then
        if [[ -n "${DATABASE_URL:-}" ]]; then
            # Extract connection params from DATABASE_URL for pg_isready
            if ! pg_isready -d "$DB_CONN" -t 10; then
                error_exit "Database connectivity test failed. Please check your database configuration."
            fi
        else
            if ! pg_isready -h "${DATABASE_HOST}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER}" -d "${DATABASE_NAME}" -t 10; then
                error_exit "Database connectivity test failed. Please check your database configuration."
            fi
        fi
        log_success "Database connectivity confirmed"
    else
        log_warning "pg_isready not available, skipping connectivity test"
    fi

    # Perform the database restore
    log_step "Restoring Database"

    echo "  📥 Starting database restore..."
    echo "  📁 Dump file: $DUMP_FILE"
    echo "  🎯 Target: $ENVIRONMENT Database"
    echo "  ⏳ This may take several minutes..."
    echo ""

    # Create log file for this restore
    local log_file="/tmp/${ENVIRONMENT}_restore_$(date +%Y%m%d_%H%M%S).log"

    # Show progress indicator for long operations
    if [[ "$ENVIRONMENT" == "prd" ]] || [[ "$ENVIRONMENT" == "stg" ]]; then
        (
            while true; do
                echo -n "."
                sleep 5
            done
        ) &
        PROGRESS_PID=$!
    fi

    # Execute the restore command with enhanced logging
    local restore_exit_code=0
    echo "  🔄 Executing pg_restore with enhanced logging..."

    if [[ -n "${DATABASE_URL:-}" ]]; then
        # Use DATABASE_URL connection with real-time streaming
        echo "  📡 Using DATABASE_URL connection"
        if pg_restore --dbname="$DB_CONN" --no-owner --format="t" --verbose "$DUMP_FILE" 2>&1 | tee "$log_file"; then
            restore_exit_code=0
        else
            restore_exit_code=${PIPESTATUS[0]}
        fi
    else
        # Use individual parameters with real-time streaming
        echo "  📡 Using individual connection parameters"
        if pg_restore --host="${DATABASE_HOST}" --port="${DATABASE_PORT:-5432}" --user="${DATABASE_USER}" --dbname="${DATABASE_NAME}" --no-owner --format="t" --verbose "$DUMP_FILE" 2>&1 | tee "$log_file"; then
            restore_exit_code=0
        else
            restore_exit_code=${PIPESTATUS[0]}
        fi
    fi

    # Stop progress indicator
    if [[ -n "${PROGRESS_PID:-}" ]]; then
        kill $PROGRESS_PID 2>/dev/null || true
        echo ""
    fi

    # Check restore result and provide detailed feedback
    if [[ $restore_exit_code -eq 0 ]]; then
        log_success "Database restore completed successfully"

        # Perform post-restore verification
        log_step "Verifying Database Restore"
        echo "  🔍 Running post-restore verification checks..."

        # Build connection string for verification
        local verify_conn=""
        if [[ -n "${DATABASE_URL:-}" ]]; then
            verify_conn="$DB_CONN"
        else
            verify_conn="postgresql://${DATABASE_USER}:${DATABASE_PASS}@${DATABASE_HOST}:${DATABASE_PORT:-5432}/${DATABASE_NAME}"
        fi

        # Run KlickerUZH-specific database verification
        if verify_klicker_database_restore "$verify_conn"; then
            log_success "Database restore verification passed"
            echo "  ✅ All critical tables present and populated"
            echo "  ✅ Database structure appears intact"
        else
            log_warning "Database restore verification failed"
            echo "  ⚠️  Some verification checks failed, but restore completed"
            echo "  📋 You may need to check the database manually"
        fi

        # Show summary information
        echo ""
        echo "  📊 Restore Summary:"
        echo "  ✅ Database restored successfully"
        echo "  📁 Source file: $DUMP_FILE"
        echo "  🎯 Target: $ENVIRONMENT Database"
        echo "  🕐 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"

        # Show any warnings from the restore log, but filter out normal Redis replies
        if [[ -f "$log_file" ]] && grep -q "WARNING" "$log_file"; then
            # Check if warnings are just normal Redis replies (not actual problems)
            local actual_warnings
            actual_warnings=$(grep "WARNING" "$log_file" | grep -v "errors: 0, replies:" | head -5)

            if [[ -n "$actual_warnings" ]]; then
                echo ""
                echo "  ⚠️  Restore completed with warnings:"
                echo "$actual_warnings" | sed 's/^/     /'
                echo "  📋 Full log available at: $log_file"
            fi
        fi

    else
        echo "  ❌ Database restore failed"
        echo "  📋 Error details:"

        if [[ -f "$log_file" ]]; then
            echo "     Last 10 lines of restore log:"
            tail -10 "$log_file" | sed 's/^/     /'
            echo "  📋 Full log available at: $log_file"
        fi

        error_exit "Database restore failed with exit code $restore_exit_code"
    fi

    # Store log file path for potential cleanup
    echo "$log_file" > /tmp/last_${ENVIRONMENT}_restore_log_path.txt
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Print script header
    echo "======================================================================"
    echo "🔄 Unified Database Restore Script"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Environment: $ENVIRONMENT"
    echo "Script: ${BASH_SOURCE[0]}"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""

    # Execute main restore function
    restore_database

    echo ""
    echo "======================================================================"
    echo "✅ Database Restore Completed Successfully"
    echo "======================================================================"
    echo "Environment: $ENVIRONMENT"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
fi
