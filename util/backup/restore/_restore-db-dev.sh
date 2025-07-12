#!/bin/bash

# =============================================================================
# Development Database Restore Script
# =============================================================================
#
# This script restores a PostgreSQL database from a dump file in the development
# environment using direct connection credentials.
#
# Features:
# - Strict error handling with set -euo pipefail
# - Comprehensive logging with timestamps
# - File verification before restore
# - Proper cleanup with trap handlers
# - Progress indicators and user feedback
# - Tool availability checks
#
# Usage: ./util/_restore-db-dev.sh
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

# Development database configuration
export DATABASE_HOST="localhost"
export DATABASE_PORT="5432"
export DATABASE_USER="klicker"
export DATABASE_PASS="klicker"
export DATABASE_NAME="klicker-prod"

# =============================================================================
# SOURCE UTILITIES
# =============================================================================

# Source common utility functions
if [[ -f "$SCRIPT_DIR/_restore-common.sh" ]]; then
    source "$SCRIPT_DIR/_restore-common.sh"
else
    echo "ERROR: Common utilities not found at $SCRIPT_DIR/_restore-common.sh"
    exit 1
fi

# Source dump file verification function
if [[ -f "$SCRIPT_DIR/_verify-dump-file.sh" ]]; then
    source "$SCRIPT_DIR/_verify-dump-file.sh"
else
    error_exit "Dump file verification utility not found at $SCRIPT_DIR/_verify-dump-file.sh"
fi

# =============================================================================
# CLEANUP HANDLER
# =============================================================================

# Function for comprehensive cleanup
cleanup_development_restore() {
    log_info "Performing cleanup..."
    
    # Clean up sensitive environment variables
    cleanup_database
    
    # Remove any temporary files
    rm -f /tmp/development_restore_*.log 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Set up trap for cleanup on script exit
trap cleanup_development_restore EXIT

# =============================================================================
# MAIN RESTORE FUNCTION
# =============================================================================

restore_development_database() {
    log_step "Starting Development Database Restore"
    
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
    
    # Validate required environment variables
    validate_database_env
    
    # Build connection parameters
    log_step "Preparing Database Connection"
    
    # Set PGPASSWORD for pg_restore
    export PGPASSWORD="${DATABASE_PASS}"
    
    log_info "Using individual database parameters for connection"
    log_info "Host: ${DATABASE_HOST}"
    log_info "Database: ${DATABASE_NAME}"
    log_info "User: ${DATABASE_USER}"
    
    log_success "Database connection prepared"
    
    # Perform the database restore
    log_step "Restoring Database"
    
    echo "  📥 Starting database restore..."
    echo "  📁 Dump file: $DUMP_FILE"
    echo "  🎯 Target: Development Database"
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
    if ! pg_restore --host="${DATABASE_HOST}" --port="${DATABASE_PORT}" --user="${DATABASE_USER}" --dbname="${DATABASE_NAME}" --no-owner --format="t" --verbose "$DUMP_FILE" 2>/tmp/restore_development.log; then
        restore_exit_code=$?
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
        echo "  🎯 Target: Development Database (${DATABASE_NAME})"
        echo "  🕐 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Show any warnings from the restore log
        if [[ -f /tmp/restore_development.log ]] && grep -q "WARNING" /tmp/restore_development.log; then
            echo ""
            echo "  ⚠️  Restore completed with warnings:"
            grep "WARNING" /tmp/restore_development.log | head -5 | sed 's/^/     /'
            echo "  📋 Full log available at: /tmp/restore_development.log"
        fi
        
    else
        echo "  ❌ Database restore failed"
        echo "  📋 Error details:"
        
        if [[ -f /tmp/restore_development.log ]]; then
            echo "     Last 10 lines of restore log:"
            tail -10 /tmp/restore_development.log | sed 's/^/     /'
            echo "  📋 Full log available at: /tmp/restore_development.log"
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
    echo "🔄 Development Database Restore Script"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Script: ${BASH_SOURCE[0]}"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Execute main restore function
    restore_development_database
    
    echo ""
    echo "======================================================================"
    echo "✅ Development Database Restore Completed Successfully"
    echo "======================================================================"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
fi
