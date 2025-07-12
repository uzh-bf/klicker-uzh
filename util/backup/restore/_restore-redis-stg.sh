#!/bin/bash

# =============================================================================
# Redis Staging Restore Script
# =============================================================================
#
# This script restores Redis data from a dump file to the staging environment.
# It includes comprehensive error handling, logging, and validation.
#
# Prerequisites:
# - Redis CLI tools must be installed
# - Doppler CLI must be configured
# - redis.dump file must exist in the same directory
#
# Usage: ./restore-redis-stg.sh
# =============================================================================

# Enable strict error handling
set -euo pipefail

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DUMP_FILE="${SCRIPT_DIR}/redis.dump"

# Source common utility functions
if [[ -f "${SCRIPT_DIR}/_restore-common.sh" ]]; then
    source "${SCRIPT_DIR}/_restore-common.sh"
else
    echo "ERROR: Required common utilities not found at ${SCRIPT_DIR}/_restore-common.sh"
    exit 1
fi

# Source dump file verification utilities
if [[ -f "${SCRIPT_DIR}/_verify-dump-file.sh" ]]; then
    source "${SCRIPT_DIR}/_verify-dump-file.sh"
else
    error_exit "Required dump file verification utilities not found at ${SCRIPT_DIR}/_verify-dump-file.sh"
fi

# =============================================================================
# SCRIPT INITIALIZATION
# =============================================================================

# Initialize Redis restore environment with proper cleanup
init_restore_environment "redis"

log_step "Starting Redis Staging Restore"

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
# DOPPLER SECRETS LOADING
# =============================================================================

log_step "Loading Environment Variables"

# Use the _run_with_doppler.sh script for Doppler integration
if [[ -f "${SCRIPT_DIR}/_run_with_doppler.sh" ]]; then
    # Set CONFIG for the doppler script
    export CONFIG="stg"
    
    # Create a temporary script to load environment variables
    TEMP_ENV_SCRIPT="/tmp/load_redis_env_$$.sh"
    cat > "$TEMP_ENV_SCRIPT" << 'EOF'
#!/bin/bash
# This script loads environment variables and exports them
if ! eval "$(doppler secrets download --no-file --format env --config stg)"; then
    echo "Failed to load Doppler secrets" >&2
    exit 1
fi

# Export the loaded variables to a file that can be sourced
echo "export REDIS_HOST='${REDIS_HOST:-}'" >> /tmp/redis_env_$$.sh
echo "export REDIS_PORT='${REDIS_PORT:-}'" >> /tmp/redis_env_$$.sh
echo "export REDIS_PASS='${REDIS_PASS:-}'" >> /tmp/redis_env_$$.sh
echo "export REDIS_URL='${REDIS_URL:-}'" >> /tmp/redis_env_$$.sh
EOF
    
    chmod +x "$TEMP_ENV_SCRIPT"
    
    # Run the temp script with doppler
    if ! bash "${SCRIPT_DIR}/_run_with_doppler.sh" "$TEMP_ENV_SCRIPT"; then
        rm -f "$TEMP_ENV_SCRIPT" "/tmp/redis_env_$$.sh"
        error_exit "Failed to load Doppler secrets using _run_with_doppler.sh"
    fi
    
    # Source the exported variables
    if [[ -f "/tmp/redis_env_$$.sh" ]]; then
        source "/tmp/redis_env_$$.sh"
        rm -f "/tmp/redis_env_$$.sh"
    fi
    
    rm -f "$TEMP_ENV_SCRIPT"
else
    log_warning "_run_with_doppler.sh not found, falling back to direct Doppler usage"
    # Fallback to direct Doppler usage
    if ! eval "$(doppler secrets download --no-file --format env --config stg)"; then
        error_exit "Failed to load Doppler secrets directly"
    fi
fi

# =============================================================================
# ENVIRONMENT VALIDATION
# =============================================================================

# Validate Redis environment variables
validate_redis_env

# =============================================================================
# REDIS RESTORE OPERATION
# =============================================================================

log_step "Starting Redis Data Restore"

# Build Redis connection string
REDIS_CONNECTION=$(build_redis_connection_string)
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

# =============================================================================
# COMPLETION
# =============================================================================

log_success "Redis Staging Restore Completed Successfully"
log_info "Data from ${DUMP_FILE} has been restored to staging Redis"
log_info "Redis connection details: $(echo "$REDIS_CONNECTION" | sed 's/:[^@]*@/:***@/' | sed 's|//[^@]*@|//***@|')"

# Final cleanup is handled by the trap in init_restore_environment
log_info "Restore operation completed. Environment cleaned up."

exit 0
