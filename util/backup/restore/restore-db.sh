#!/bin/bash

# =============================================================================
# Unified Database Restore Wrapper Script
# =============================================================================
#
# This script provides a unified interface for database restoration across
# different environments (dev/stg). It validates the environment parameter
# and delegates to the appropriate environment-specific restore script.
#
# Usage: ./restore-db.sh [dev|stg]
#
# Features:
# - Environment parameter validation
# - Automatic CONFIG variable setting for Doppler integration
# - Delegation to appropriate environment-specific scripts
# - Comprehensive error handling and logging
# - Help and usage information
#
# =============================================================================

# Enable strict error handling
set -euo pipefail

# =============================================================================
# SCRIPT CONFIGURATION
# =============================================================================

# Get script directory for relative path resolution
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Available environments
VALID_ENVIRONMENTS=("dev" "stg")

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Function for logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function for error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Function for info messages
log_info() {
    log "INFO: $1"
}

# Function for success messages
log_success() {
    log "SUCCESS: $1"
}

# Function to display usage information
show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT]

Unified Database Restore Wrapper Script

ARGUMENTS:
    ENVIRONMENT    Target environment for database restore (dev|stg)

ENVIRONMENTS:
    dev           Development environment (local database)
    stg           Staging environment (uses Doppler for configuration)

EXAMPLES:
    $0 dev        # Restore database in development environment
    $0 stg        # Restore database in staging environment

DESCRIPTION:
    This script provides a unified interface for database restoration across
    different environments. It validates the environment parameter and delegates
    to the appropriate environment-specific restore script.

    For development (dev):
    - Uses local database configuration
    - Calls _restore-db-dev.sh

    For staging (stg):
    - Uses Doppler for secrets management
    - Sets CONFIG=stg for Doppler integration
    - Calls _restore-db-stg.sh

EOF
}

# Function to validate environment parameter
validate_environment() {
    local env="$1"
    
    # Check if environment is in valid list
    for valid_env in "${VALID_ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    
    return 1
}

# Function to get environment-specific script path
get_restore_script_path() {
    local env="$1"
    echo "${SCRIPT_DIR}/_restore-db-${env}.sh"
}

# Function to validate that the target script exists
validate_target_script() {
    local script_path="$1"
    local env="$2"
    
    if [[ ! -f "$script_path" ]]; then
        error_exit "Environment-specific restore script not found: $script_path"
    fi
    
    if [[ ! -x "$script_path" ]]; then
        error_exit "Environment-specific restore script is not executable: $script_path"
    fi
    
    log_info "Validated target script: $script_path"
}

# =============================================================================
# MAIN RESTORATION FUNCTION
# =============================================================================

restore_database() {
    local environment="$1"
    local script_path="$2"
    
    log_info "Starting database restore for environment: $environment"
    
    # Set environment-specific configuration
    case "$environment" in
        "dev")
            log_info "Using development environment configuration"
            # Dev doesn't need special CONFIG setting
            ;;
        "stg")
            log_info "Using staging environment configuration"
            # Set CONFIG for Doppler integration
            export CONFIG="stg"
            log_info "Set CONFIG=$CONFIG for Doppler integration"
            ;;
        *)
            error_exit "Unsupported environment: $environment"
            ;;
    esac
    
    # Execute the environment-specific restore script
    log_info "Executing environment-specific restore script: $script_path"
    
    # Run the script and capture its exit code
    local exit_code=0
    if ! bash "$script_path"; then
        exit_code=$?
        error_exit "Database restore failed with exit code $exit_code"
    fi
    
    log_success "Database restore completed successfully for environment: $environment"
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Main execution function
main() {
    # Check if help is requested
    if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Check if environment parameter is provided
    if [[ $# -eq 0 ]]; then
        echo "ERROR: Environment parameter is required"
        echo ""
        show_usage
        exit 1
    fi
    
    # Check if too many parameters are provided
    if [[ $# -gt 1 ]]; then
        echo "ERROR: Too many parameters provided"
        echo ""
        show_usage
        exit 1
    fi
    
    local environment="$1"
    
    # Validate environment parameter
    if ! validate_environment "$environment"; then
        error_exit "Invalid environment: $environment. Valid environments: ${VALID_ENVIRONMENTS[*]}"
    fi
    
    # Get the path to the environment-specific script
    local script_path
    script_path="$(get_restore_script_path "$environment")"
    
    # Validate that the target script exists and is executable
    validate_target_script "$script_path" "$environment"
    
    # Print header
    echo "======================================================================"
    echo "🔄 Unified Database Restore Wrapper"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Environment: $environment"
    echo "Target script: $script_path"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Execute the restoration
    restore_database "$environment" "$script_path"
    
    echo ""
    echo "======================================================================"
    echo "✅ Database Restore Completed Successfully"
    echo "======================================================================"
    echo "Environment: $environment"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
}

# Execute main function with all parameters
main "$@"
