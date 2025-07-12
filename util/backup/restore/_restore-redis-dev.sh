#!/bin/bash

# =============================================================================
# Development Redis Restore Script
# =============================================================================
#
# This script restores Redis data from a dump file to the development environment.
# It includes comprehensive error handling, logging, and validation.
#
# Usage: ./restore-redis-dev.sh
# =============================================================================

# Enable strict error handling
set -euo pipefail

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DUMP_FILE="${SCRIPT_DIR}/redis.dump"

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

# Source dump file verification utilities
if [[ -f "${SCRIPT_DIR}/../lib/_verify-dump-file.sh" ]]; then
    source "${SCRIPT_DIR}/../lib/_verify-dump-file.sh"
else
    error_exit "Required dump file verification utilities not found at ${SCRIPT_DIR}/../lib/_verify-dump-file.sh"
fi

# =============================================================================
# SCRIPT INITIALIZATION
# =============================================================================

# Initialize Redis restore environment with proper cleanup
init_restore_environment "redis"

log_step "Starting Redis Development Restore"

# =============================================================================
# TOOL AVAILABILITY CHECKS
# =============================================================================

# Check if redis-cli is available
check_redis_tools

# =============================================================================
# DUMP FILE VERIFICATION
# =============================================================================

log_step "Verifying Dump File"

# Use the verify_dump_file function from _verify-dump-file.sh
if ! verify_dump_file "$DUMP_FILE" 100; then
    error_exit "Dump file verification failed"
fi

# =============================================================================
# REDIS RESTORE OPERATION
# =============================================================================

log_step "Starting Redis Data Restore"

# Build Redis connection string
REDIS_CONNECTION="redis://localhost:6379"
log_info "Using Redis connection: $(echo "$REDIS_CONNECTION" | sed 's/:[^@]*@/:***@/')"

# Get file size for progress indication
DUMP_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
log_info "Restoring Redis data from dump file (${DUMP_SIZE})"

# Show progress indicator
echo "  📤 Uploading data to Redis..."
echo "  ⏳ This may take several minutes depending on the dump size..."

# Perform the Redis restore with error handling
if ! redis-cli -u "$REDIS_CONNECTION" --pipe < "$DUMP_FILE"; then
    error_exit "Redis restore operation failed"
fi

log_success "Redis Development Restore Completed Successfully"
log_info "Data from ${DUMP_FILE} has been restored to development Redis"
log_info "Redis connection details: $(echo "$REDIS_CONNECTION" | sed 's/:[^@]*@/:***@/' | sed 's|//[^@]*@|//***@|')"

# Final cleanup is handled by the trap in init_restore_environment
log_info "Restore operation completed. Environment cleaned up."

exit 0
