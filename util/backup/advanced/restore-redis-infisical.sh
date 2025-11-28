#!/bin/bash

# =============================================================================
# Unified Redis Data Restore Script
# =============================================================================
#
# This script restores Redis data from a dump file for any environment.
# It supports all environments (dev/stg/prd) via Infisical configuration.
#
# Usage: ./restore-redis.sh [environment] [instance]
#
# Arguments:
#   environment    Target environment (dev|stg|prd). Defaults to 'dev'
#   instance       Redis instance type (main|assessment). Defaults to 'main'
#
# Environment Variables:
#   DUMP_FILE           Path to specific dump file to restore
#   BACKUP_ENCRYPTION_KEY  Required for encrypted dumps
#   DEBUG_RESTORE       Set to 'true' to enable verbose debugging output
#
# Debug Mode:
#   DEBUG_RESTORE=true ./restore-redis.sh dev main
#   - Shows detailed GPG error messages
#   - Displays Redis connection details
#   - Provides comprehensive troubleshooting information
#
# Features:
# - Environment-specific configuration via Infisical (stg/prd) or local config (dev)
# - Automatic dump file discovery with priority order
# - Comprehensive error handling and validation
# - Production safety measures and confirmation prompts
# - Progress indicators and detailed logging
# - Automatic decryption of encrypted dumps
# - Connection testing and post-restore verification
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

Unified Redis Data Restore Script

ARGUMENTS:
    ENVIRONMENT    Target environment for restore (dev|stg|prd). Defaults to 'dev'
    INSTANCE       Redis instance type (main|assessment). Defaults to 'main'

ENVIRONMENTS:
    dev           Development environment (local configuration)
    stg           Staging environment (uses Infisical)
    prd           Production environment (uses Infisical, requires safety confirmation)

EXAMPLES:
    $0            # Restore to development (default, main Redis)
    $0 dev        # Restore to development (explicit, main Redis)
    $0 dev main   # Restore to development (main Redis, explicit)
    $0 dev assessment # Restore to development (assessment Redis)
    $0 stg        # Restore to staging (main Redis)
    $0 stg assessment # Restore to staging (assessment Redis)
    $0 prd        # Restore to production (main Redis, with safety prompts)

DESCRIPTION:
    Restores Redis data from dump files with automatic discovery.
    Uses different configuration methods based on environment:
    - Development: Direct local configuration (redis://localhost:6379)
    - Staging/Production: Infisical secrets management

ENVIRONMENT VARIABLES:
    DUMP_FILE                 Explicit path to dump file (overrides auto-discovery)
    BACKUP_ENCRYPTION_KEY     GPG passphrase for encrypted dumps
    REDIS_URL                 Redis connection URL (Infisical environments)
    SKIP_PRODUCTION_SAFETY    Skip production safety prompts (use with caution)

SAFETY FEATURES:
    - Production restores require explicit confirmation
    - Pre-restore connectivity checks
    - Automatic decryption of encrypted dumps
    - Comprehensive error handling and validation

EOF
}

# Check if help is requested
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    show_usage
    exit 0
fi

# Parse command line arguments
ENVIRONMENT=""
INSTANCE=""

# Parse arguments allowing for flexible order
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

# Set defaults if not provided
ENVIRONMENT="${ENVIRONMENT:-dev}"
INSTANCE="${INSTANCE:-main}"

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
if [[ "$ENVIRONMENT" != "dev" ]]; then
    export REDIS_ASSESSMENT_TLS="true"
    if [[ "$INSTANCE" == "assessment" ]]; then
        export REDIS_ASSESSMENT_HOST=$(infisical secrets get REDIS_ASSESSMENT_HOST --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
        export REDIS_ASSESSMENT_PORT=$(infisical secrets get REDIS_ASSESSMENT_PORT --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
        export REDIS_ASSESSMENT_PASS=$(infisical secrets get REDIS_ASSESSMENT_PASS --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)

        export REDIS_URL="rediss://default:${REDIS_ASSESSMENT_PASS}@${REDIS_ASSESSMENT_HOST}:${REDIS_ASSESSMENT_PORT}"
    else
        export REDIS_HOST=$(infisical secrets get REDIS_HOST --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
        export REDIS_PORT=$(infisical secrets get REDIS_PORT --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
        export REDIS_PASS=$(infisical secrets get REDIS_PASS --env="$ENVIRONMENT" --projectId="$PROJECT_ID" --plain)
        export REDIS_URL="rediss://default:${REDIS_PASS}@${REDIS_HOST}:${REDIS_PORT}"
    fi
else
    export REDIS_ASSESSMENT_TLS="false"
    if [[ "$INSTANCE" == "assessment" ]]; then
        export REDIS_ASSESSMENT_HOST="localhost"
        export REDIS_ASSESSMENT_PORT=6381
        export REDIS_ASSESSMENT_PASS=""
        export REDIS_URL="rediss://default:${REDIS_ASSESSMENT_PASS}@${REDIS_ASSESSMENT_HOST}:${REDIS_ASSESSMENT_PORT}"
    else
        export REDIS_HOST="localhost"
        export REDIS_PORT=6379
        export REDIS_PASS=""
        export REDIS_URL="rediss://default:${REDIS_PASS}@${REDIS_HOST}:${REDIS_PORT}"
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

# Source verification utility functions
if [[ -f "${SCRIPT_DIR}/../lib/_verify-dump-file.sh" ]]; then
    source "${SCRIPT_DIR}/../lib/_verify-dump-file.sh"
else
    echo "ERROR: Required verification utilities not found at ${SCRIPT_DIR}/../lib/_verify-dump-file.sh"
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
echo "Starting Redis Data Restore"
echo "Environment: $ENVIRONMENT"
echo "Instance: $INSTANCE"
echo "========================================"

# Try to find the latest dump file automatically
if [[ -z "${DUMP_FILE:-}" ]]; then
    # Use instance-specific service name for dump discovery
    service_name="redis"
    if [[ "$INSTANCE" == "assessment" ]]; then
        service_name="redis-assessment"
    fi
    
    if DISCOVERED_DUMP=$(find_latest_dump "$service_name"); then
        DUMP_FILE="$DISCOVERED_DUMP"
        log_info "Auto-discovered dump file: $DUMP_FILE"
    else
        # Fallback to default location for backward compatibility
        if [[ "$INSTANCE" == "assessment" ]]; then
            DUMP_FILE="${SCRIPT_DIR}/../redis_assessment.dump"
        else
            DUMP_FILE="${SCRIPT_DIR}/../redis.dump"
        fi
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
    echo "You are about to restore to the PRODUCTION Redis instance."
    echo "This operation will:"
    echo "  • Replace all existing production Redis data"
    echo "  • Clear all caches and sessions"
    echo "  • Potentially cause service disruption"
    echo ""
    echo "Dump file: $DUMP_FILE"
    echo "Target: Production Redis"
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
    echo "🚀 Proceeding with production Redis restore..."
    echo ""
fi

# =============================================================================
# CLEANUP HANDLER
# =============================================================================

# Function for comprehensive cleanup
cleanup_redis_restore() {
    log_info "Performing cleanup..."
    
    # Clean up sensitive environment variables (includes assessment Redis vars)
    cleanup_redis
    
    # Remove any log files (temp decrypted files handled by secure system)
    rm -f /tmp/${ENVIRONMENT}_redis_restore_*.log 2>/dev/null || true
    rm -f /tmp/${ENVIRONMENT}_redis_${INSTANCE}_restore_*.log 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Set up secure signal handling and register cleanup functions
setup_secure_signal_handling
register_cleanup_function cleanup_redis_restore

# =============================================================================
# MAIN RESTORE FUNCTION
# =============================================================================

restore_redis() {
    log_step "Starting Redis Restore for $ENVIRONMENT Environment ($INSTANCE instance)"
    
    # Initialize restore environment with instance-specific service name
    service_name="redis"
    if [[ "$INSTANCE" == "assessment" ]]; then
        service_name="redis-assessment"
    fi
    init_restore_environment "$service_name"
    
    # Check for required tools
    check_redis_tools
    
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
        echo "     1. Create encrypted dumps: BACKUP_ENCRYPTION_KEY='key' ./dump-redis.sh"
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
        echo "     2. Or contact admin for the encryption key"
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

    # Perform decryption
    DUMP_FILE=$(decrypt_dump_if_needed "$DUMP_FILE")
    log_info "✅ Using prepared dump file: $(basename "$DUMP_FILE")"
    
    # Verify dump file exists and is valid
    log_step "Verifying Dump File"
    validate_dump_file "$DUMP_FILE" "Redis dump"
    log_success "Dump file verification completed"
    
    # Validate Redis environment variables
    log_step "Validating Redis Configuration"
    validate_redis_env
    
    # Build Redis connection string
    log_step "Preparing Redis Connection"
    
    if [[ -n "${REDIS_URL:-}" ]]; then
        REDIS_CONNECTION="$REDIS_URL"
        log_info "Using REDIS_URL for connection"
    else
        log_info "Using individual Redis parameters for connection"
        log_info "Host: ${REDIS_HOST}"
        log_info "Port: ${REDIS_PORT}"
        
        # Build connection string from individual parameters
        REDIS_CONNECTION=$(build_redis_connection_string)
    fi
    
    # Mask password in logs
    REDIS_CONNECTION_DISPLAY=$(echo "$REDIS_CONNECTION" | sed 's/:[^@]*@/:***@/')
    log_info "Redis connection: $REDIS_CONNECTION_DISPLAY"
    log_success "Redis connection prepared"
    
    # Test Redis connectivity
    log_step "Testing Redis Connectivity"
    
    # Extract connection details for redis-cli
    if [[ "$REDIS_CONNECTION" =~ ^redis(s)?://([^:]*):([^@]*)@([^:]*):([0-9]+)(/[0-9]+)?$ ]]; then
        REDIS_SCHEME="${BASH_REMATCH[1]}"
        REDIS_USER="${BASH_REMATCH[2]}"
        REDIS_PASS="${BASH_REMATCH[3]}"
        REDIS_HOST="${BASH_REMATCH[4]}"
        REDIS_PORT="${BASH_REMATCH[5]}"
        REDIS_DB="${BASH_REMATCH[6]}"
    elif [[ "$REDIS_CONNECTION" =~ ^redis(s)?://([^@]*)@([^:]*):([0-9]+)(/[0-9]+)?$ ]]; then
        REDIS_SCHEME="${BASH_REMATCH[1]}"
        REDIS_PASS="${BASH_REMATCH[2]}"
        REDIS_HOST="${BASH_REMATCH[3]}"
        REDIS_PORT="${BASH_REMATCH[4]}"
        REDIS_DB="${BASH_REMATCH[5]}"
    elif [[ "$REDIS_CONNECTION" =~ ^redis(s)?://([^:]*):([0-9]+)(/[0-9]+)?$ ]]; then
        REDIS_SCHEME="${BASH_REMATCH[1]}"
        REDIS_HOST="${BASH_REMATCH[2]}"
        REDIS_PORT="${BASH_REMATCH[3]}"
        REDIS_DB="${BASH_REMATCH[4]}"
    else
        error_exit "Invalid Redis connection URL format: $REDIS_CONNECTION_DISPLAY"
    fi
    
    # Build redis-cli command
    REDIS_CLI_CMD="redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT}"
    
    if [[ -n "${REDIS_PASS:-}" ]]; then
        REDIS_CLI_CMD="$REDIS_CLI_CMD -a $REDIS_PASS"
    fi
    
    if [[ "${REDIS_SCHEME}" == "s" ]]; then
        REDIS_CLI_CMD="$REDIS_CLI_CMD --tls"
    fi
    
    # Test connectivity
   if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
        log_info "Testing Redis connection with: ${REDIS_CLI_CMD} ping"
   fi
   if ! $REDIS_CLI_CMD ping > /dev/null 2>&1; then
        error_exit "Redis connectivity test failed. Please check your Redis configuration."
    fi
    log_success "Redis connectivity confirmed"
    
    # Get file size for progress indication
    DUMP_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
    log_info "Restoring Redis data from dump file (${DUMP_SIZE})"
    
    # Perform the Redis restore
    log_step "Restoring Redis Data"
    
    echo "  📥 Starting Redis restore..."
    echo "  📁 Dump file: $DUMP_FILE"
    echo "  🎯 Target: $ENVIRONMENT Redis"
    echo "  ⏳ This may take several minutes depending on dump size..."
    echo ""
    
    # Create log file for this restore
    local log_file="/tmp/${ENVIRONMENT}_redis_restore_$(date +%Y%m%d_%H%M%S).log"
    
    # Show progress indicator for production/staging
    if [[ "$ENVIRONMENT" == "prd" ]] || [[ "$ENVIRONMENT" == "stg" ]]; then
        (
            while true; do
                echo -n "."
                sleep 2
            done
        ) &
        PROGRESS_PID=$!
    fi
    
    # Execute the restore command
    local restore_exit_code=0
    echo "  📤 Uploading data to Redis..."
    
    # # Use redis-cli to restore the data
    # if ! $REDIS_CLI_CMD --pipe < "$DUMP_FILE" > "$log_file" 2>&1; then
    #     restore_exit_code=$?
    # fi

    if ! riot file-import -u "${REDIS_URL}" "$DUMP_FILE" > "$log_file" 2>&1; then
        restore_exit_code=$?
    fi

    # Stop progress indicator
    if [[ -n "${PROGRESS_PID:-}" ]]; then
        kill $PROGRESS_PID 2>/dev/null || true
        echo ""
    fi
    
    # Check restore result and provide detailed feedback
    if [[ $restore_exit_code -eq 0 ]]; then
        log_success "Redis restore completed successfully"
        
        # Verify Redis has data after restore
        echo "  🔍 Verifying restored data..."
        KEY_COUNT=$($REDIS_CLI_CMD dbsize 2>/dev/null || echo "unknown")
        
        # Show summary information
        echo "  📊 Restore Summary:"
        echo "  ✅ Redis data restored successfully"
        echo "  📁 Source file: $DUMP_FILE"
        echo "  🎯 Target: $ENVIRONMENT Redis"
        echo "  📊 Keys in database: $KEY_COUNT"
        echo "  🕐 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Show any warnings from the restore log
        if [[ -f "$log_file" ]] && grep -qi "error\|warning" "$log_file"; then
            echo ""
            echo "  ⚠️  Restore completed with warnings/errors:"
            grep -i "error\|warning" "$log_file" | head -5 | sed 's/^/     /'
            echo "  📋 Full log available at: $log_file"
        fi
        
    else
        echo "  ❌ Redis restore failed"
        echo "  📋 Error details:"
        
        if [[ -f "$log_file" ]]; then
            echo "     Last 10 lines of restore log:"
            tail -10 "$log_file" | sed 's/^/     /'
            echo "  📋 Full log available at: $log_file"
        fi
        
        error_exit "Redis restore failed with exit code $restore_exit_code"
    fi
    
    # Store log file path for potential cleanup
    echo "$log_file" > /tmp/last_${ENVIRONMENT}_redis_restore_log_path.txt
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Print script header
    echo "======================================================================"
    echo "🔄 Unified Redis Restore Script"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Environment: $ENVIRONMENT"
    echo "Instance: $INSTANCE"
    echo "Script: ${BASH_SOURCE[0]}"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Execute main restore function
    restore_redis
    
    echo ""
    echo "======================================================================"
    echo "✅ Redis Restore Completed Successfully"
    echo "======================================================================"
    echo "Environment: $ENVIRONMENT"
    echo "Instance: $INSTANCE"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
fi