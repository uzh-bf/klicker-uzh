#!/bin/bash

# =============================================================================
# Staging Database Restore Script
# =============================================================================
#
# This script restores a PostgreSQL database from a dump file in the staging
# environment using Doppler for secrets management.
#
# Features:
# - Strict error handling with set -euo pipefail
# - Comprehensive logging with timestamps
# - Environment variable validation
# - File verification before restore
# - Proper cleanup with trap handlers
# - Progress indicators and user feedback
# - Tool availability checks
#
# Usage: ./util/_restore-db-stg.sh
# =============================================================================

# Enable strict error handling
set -euo pipefail

# =============================================================================
# SCRIPT CONFIGURATION
# =============================================================================

# Get script directory for relative path resolution
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default dump file name
DUMP_FILE="${DUMP_FILE:-dump.tar}"

# Set CONFIG for Doppler integration
export CONFIG="stg"

# =============================================================================
# SOURCE UTILITIES
# =============================================================================

# Source common utility functions
if [[ -f "$SCRIPT_DIR/../lib/_restore-common.sh" ]]; then
    source "$SCRIPT_DIR/../lib/_restore-common.sh"
else
    echo "ERROR: Common utilities not found at $SCRIPT_DIR/../lib/_restore-common.sh"
    exit 1
fi

# Source dump file verification function
if [[ -f "$SCRIPT_DIR/../lib/_verify-dump-file.sh" ]]; then
    source "$SCRIPT_DIR/../lib/_verify-dump-file.sh"
else
    error_exit "Dump file verification utility not found at $SCRIPT_DIR/../lib/_verify-dump-file.sh"
fi

# =============================================================================
# CLEANUP HANDLER
# =============================================================================

# Function for comprehensive cleanup
cleanup_staging_restore() {
    log_info "Performing cleanup..."
    
    # Clean up sensitive environment variables
    cleanup_database
    
    # Remove any temporary files
    rm -f /tmp/staging_restore_*.log 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Set up trap for cleanup on script exit
trap cleanup_staging_restore EXIT

# =============================================================================
# MAIN RESTORE FUNCTION
# =============================================================================

restore_staging_database() {
    log_step "Starting Staging Database Restore"
    
    # Initialize restore environment
    init_restore_environment "database"
    
    # Check for required tools
    check_database_tools
    
    # Verify dump file exists and is valid
    log_step "Verifying Dump File"
    if ! verify_dump_file "$DUMP_FILE" 1024; then  # Minimum 1KB file size
        error_exit "Dump file verification failed"
    fi
    log_success "Dump file verification completed"
    
    # Load environment variables using _run_with_doppler.sh
    log_step "Loading Environment Variables"
    if [[ -f "$SCRIPT_DIR/_run_with_doppler.sh" ]]; then
        log_info "Using _run_with_doppler.sh for Doppler integration"
        
        # Export CONFIG for _run_with_doppler.sh
        export CONFIG="stg"
        
        # Create a temporary script to load environment variables
        cat > /tmp/load_env_vars.sh << 'EOF'
#!/bin/bash
# Temporary script to load environment variables and export them
eval $(doppler secrets download --no-file --format env --config "$CONFIG")

# Export all environment variables to a file for the parent script
env | grep -E '^(DATABASE_|PGPASSWORD)' > /tmp/staging_env_vars.txt
EOF
        
        chmod +x /tmp/load_env_vars.sh
        
        # Run the temporary script with Doppler
        if ! "$SCRIPT_DIR/_run_with_doppler.sh" /tmp/load_env_vars.sh; then
            rm -f /tmp/load_env_vars.sh /tmp/staging_env_vars.txt
            error_exit "Failed to load environment variables using _run_with_doppler.sh"
        fi
        
        # Source the environment variables
        if [[ -f /tmp/staging_env_vars.txt ]]; then
            source /tmp/staging_env_vars.txt
        else
            rm -f /tmp/load_env_vars.sh
            error_exit "Failed to retrieve environment variables from Doppler"
        fi
        
        # Clean up temporary files
        rm -f /tmp/load_env_vars.sh /tmp/staging_env_vars.txt
    else
        log_warning "_run_with_doppler.sh not found, falling back to direct Doppler integration"
        load_doppler_secrets_simple "stg"
    fi
    
    log_success "Environment variables loaded successfully"
    
    # Validate required environment variables
    validate_database_env
    
    # Build connection parameters
    log_step "Preparing Database Connection"
    
    # Set PGPASSWORD for pg_restore
    export PGPASSWORD="${DATABASE_PASS}"
    
    # Build connection string or use individual parameters
    if [[ -n "${DATABASE_URL:-}" ]]; then
        CONNECTION_STRING=$(build_pg_connection_string)
        log_info "Using DATABASE_URL for connection"
    else
        log_info "Using individual database parameters for connection"
        log_info "Host: ${DATABASE_HOST}"
        log_info "Database: ${DATABASE_NAME}"
        log_info "User: ${DATABASE_USER}"
    fi
    
    log_success "Database connection prepared"
    
    # Perform the database restore
    log_step "Restoring Database"
    
    echo "  📥 Starting database restore..."
    echo "  📁 Dump file: $DUMP_FILE"
    echo "  🎯 Target: Staging Database"
    echo "  ⏳ This may take several minutes..."
    echo ""
    
    # Show progress indicator
    (
        while true; do
            echo -n "."
            sleep 5
        done
    ) &
    PROGRESS_PID=$!
    
    # Execute the restore command
    local restore_exit_code=0
    if [[ -n "${DATABASE_URL:-}" ]]; then
        # Use DATABASE_URL approach
        if ! pg_restore --dbname="$CONNECTION_STRING" --no-owner --format="t" --verbose "$DUMP_FILE" 2>/tmp/restore_staging.log; then
            restore_exit_code=$?
        fi
    else
        # Use individual parameters
        if ! pg_restore --host="${DATABASE_HOST}" --port=5432 --user="${DATABASE_USER}" --dbname="${DATABASE_NAME}" --no-owner --format="t" --verbose "$DUMP_FILE" 2>/tmp/restore_staging.log; then
            restore_exit_code=$?
        fi
    fi
    
    # Stop progress indicator
    kill $PROGRESS_PID 2>/dev/null || true
    echo ""
    
    # Check restore result
    if [[ $restore_exit_code -eq 0 ]]; then
        log_success "Database restore completed successfully"
        
        # Show summary information
        echo "  📊 Restore Summary:"
        echo "  ✅ Database restored successfully"
        echo "  📁 Source file: $DUMP_FILE"
        echo "  🎯 Target: Staging Database (${DATABASE_NAME:-from DATABASE_URL})"
        echo "  🕐 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Show any warnings from the restore log
        if [[ -f /tmp/restore_staging.log ]] && grep -q "WARNING" /tmp/restore_staging.log; then
            echo ""
            echo "  ⚠️  Restore completed with warnings:"
            grep "WARNING" /tmp/restore_staging.log | head -5 | sed 's/^/     /'
            echo "  📋 Full log available at: /tmp/restore_staging.log"
        fi
        
    else
        echo "  ❌ Database restore failed"
        echo "  📋 Error details:"
        
        if [[ -f /tmp/restore_staging.log ]]; then
            echo "     Last 10 lines of restore log:"
            tail -10 /tmp/restore_staging.log | sed 's/^/     /'
            echo "  📋 Full log available at: /tmp/restore_staging.log"
        fi
        
        error_exit "Database restore failed with exit code $restore_exit_code"
    fi
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Print script header
    echo "======================================================================"
    echo "🔄 Staging Database Restore Script"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Script: ${BASH_SOURCE[0]}"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Execute main restore function
    restore_staging_database
    
    echo ""
    echo "======================================================================"
    echo "✅ Staging Database Restore Completed Successfully"
    echo "======================================================================"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
fi
