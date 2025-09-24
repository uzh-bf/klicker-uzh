#!/bin/bash

# =============================================================================
# Unified Restore Wrapper Script
# =============================================================================
#
# This script provides a unified interface for both database and Redis 
# restoration across different environments (dev/stg). It validates parameters
# and delegates to the appropriate environment-specific restore script.
#
# Usage: ./restore.sh [db|redis] [dev|stg]
#
# Features:
# - Service type and environment parameter validation
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

# Available services and environments
VALID_SERVICES=("db" "redis" "redis-assessment")
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
Usage: $0 [SERVICE] [ENVIRONMENT]

Unified Restore Wrapper Script

ARGUMENTS:
    SERVICE        Service to restore (db|redis)
    ENVIRONMENT    Target environment for restore (dev|stg)

SERVICES:
    db               PostgreSQL database restore
    redis            Main Redis data restore
    redis-assessment Assessment Redis data restore

ENVIRONMENTS:
    dev           Development environment (local services)
    stg           Staging environment (uses Doppler for configuration)

EXAMPLES:
    $0 db dev             # Restore database in development environment
    $0 db stg             # Restore database in staging environment
    $0 redis dev          # Restore main Redis in development environment
    $0 redis stg          # Restore main Redis in staging environment
    $0 redis-assessment dev # Restore assessment Redis in development environment
    $0 redis-assessment stg # Restore assessment Redis in staging environment

PRODUCTION OPERATIONS:
    For production restores, use the orchestrator for safety:
    ./advanced/restore-orchestrator.sh stg   # Validate on staging first
    ./advanced/restore-orchestrator.sh prd   # Execute on production with safety measures

DESCRIPTION:
    This script provides a unified interface for database and Redis restoration
    for development and staging environments. It validates the service and 
    environment parameters and delegates to the appropriate restore script.

    For development (dev):
    - Uses local service configurations
    - Calls restore-{service}.sh dev

    For staging (stg):
    - Uses Doppler for secrets management
    - Sets CONFIG=stg for Doppler integration
    - Calls restore-{service}.sh stg

PRODUCTION SAFETY:
    - Production restores are NOT supported by this script for safety reasons
    - Use restore-orchestrator.sh for production operations instead
    - The orchestrator provides transaction-like behavior, rollback capability,
      and comprehensive safety measures required for production environments

EOF
}

# Function to validate service parameter
validate_service() {
    local service="$1"
    
    # Check if service is in valid list
    for valid_service in "${VALID_SERVICES[@]}"; do
        if [[ "$service" == "$valid_service" ]]; then
            return 0
        fi
    done
    
    return 1
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

# Function to get unified script path
get_restore_script_path() {
    local service="$1"
    local env="$2"
    echo "${SCRIPT_DIR}/advanced/restore-${service}-infisical.sh"
}

# Function to validate that the target script exists
validate_target_script() {
    local script_path="$1"
    local service="$2"
    local env="$3"
    
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

restore_service() {
    local service="$1"
    local environment="$2"
    local script_path="$3"
    
    log_info "Starting $service restore for environment: $environment"
    
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
    
    # Run the script with appropriate parameters
    local exit_code=0
    if [[ "$service" == "redis-assessment" ]]; then
        # For redis-assessment, call restore-redis.sh with assessment instance parameter
        if ! bash "${SCRIPT_DIR}/advanced/restore-redis-infisical.sh" "$environment" "assessment"; then
            exit_code=$?
            error_exit "$service restore failed with exit code $exit_code"
        fi
    else
        # For other services, use the provided script path
        if ! bash "$script_path" "$environment"; then
            exit_code=$?
            error_exit "$service restore failed with exit code $exit_code"
        fi
    fi
    
    log_success "$service restore completed successfully for environment: $environment"
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
    
    # Check if service parameter is provided
    if [[ $# -eq 0 ]]; then
        echo "ERROR: Service parameter is required"
        echo ""
        show_usage
        exit 1
    fi
    
    # Check if environment parameter is provided
    if [[ $# -eq 1 ]]; then
        echo "ERROR: Environment parameter is required"
        echo ""
        show_usage
        exit 1
    fi
    
    # Check if too many parameters are provided
    if [[ $# -gt 2 ]]; then
        echo "ERROR: Too many parameters provided"
        echo ""
        show_usage
        exit 1
    fi
    
    local service="$1"
    local environment="$2"
    
    # Validate service parameter
    if ! validate_service "$service"; then
        error_exit "Invalid service: $service. Valid services: ${VALID_SERVICES[*]}"
    fi
    
    # Check for production environment and redirect
    if [[ "$environment" == "prd" ]]; then
        echo ""
        echo "❌ ERROR: Production restores are not supported by this script"
        echo ""
        echo "For production operations, use the orchestrator for safety:"
        echo "  ./advanced/restore-orchestrator.sh stg   # Validate on staging first"
        echo "  ./advanced/restore-orchestrator.sh prd   # Execute on production"
        echo ""
        echo "The orchestrator provides:"
        echo "  • Transaction-like behavior (both services succeed or rollback)"
        echo "  • Pre-restore backup creation"
        echo "  • Comprehensive safety checks and confirmations"
        echo "  • State management for resume/rollback operations"
        echo ""
        exit 1
    fi
    
    # Validate environment parameter
    if ! validate_environment "$environment"; then
        error_exit "Invalid environment: $environment. Valid environments: ${VALID_ENVIRONMENTS[*]}"
    fi
    
    # Get the path to the environment-specific script (unless it's redis-assessment)
    local script_path=""
    if [[ "$service" != "redis-assessment" ]]; then
        script_path="$(get_restore_script_path "$service" "$environment")"
        
        # Validate that the target script exists and is executable
        validate_target_script "$script_path" "$service" "$environment"
    fi
    
    # Print header
    echo "======================================================================"
    echo "🔄 Unified Restore Wrapper"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Service: $service"
    echo "Environment: $environment"
    echo "Target script: $script_path"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Execute the restoration
    restore_service "$service" "$environment" "$script_path"
    
    echo ""
    echo "======================================================================"
    echo "✅ $service Restore Completed Successfully"
    echo "======================================================================"
    echo "Service: $service"
    echo "Environment: $environment"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
}

# Execute main function with all parameters
main "$@"