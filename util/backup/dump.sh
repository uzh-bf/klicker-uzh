#!/bin/bash

# =============================================================================
# Unified Dump Wrapper Script
# =============================================================================
#
# This script provides a unified interface for both database and Redis 
# backup operations across different environments (dev/stg/prd). It validates 
# parameters and delegates to the appropriate service-specific dump script.
#
# Usage: ./dump.sh [db|redis|both] [dev|stg|prd]
#
# Features:
# - Service type and environment parameter validation
# - Support for backing up both services with a single command
# - Automatic CONFIG variable setting for Doppler integration
# - Delegation to appropriate service-specific scripts
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
VALID_SERVICES=("db" "redis" "both")
VALID_ENVIRONMENTS=("dev" "stg" "prd")

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

Unified Dump Wrapper Script

ARGUMENTS:
    SERVICE        Service to backup (db|redis|both)
    ENVIRONMENT    Target environment for backup (dev|stg|prd)

SERVICES:
    db            PostgreSQL database backup
    redis         Redis data backup
    both          Both database and Redis backup (recommended)

ENVIRONMENTS:
    dev           Development environment
    stg           Staging environment
    prd           Production environment (default for backward compatibility)

EXAMPLES:
    $0 both prd   # Backup both database and Redis from production (recommended)
    $0 db prd     # Backup only database from production
    $0 redis prd  # Backup only Redis from production
    $0 both stg   # Backup both services from staging
    $0 db dev     # Backup database from development

DESCRIPTION:
    This script provides a unified interface for database and Redis backup
    operations across all environments. It validates the service and 
    environment parameters and delegates to the appropriate dump script.

    For all environments:
    - Uses Doppler for secrets management and configuration
    - Sets appropriate CONFIG environment variable for Doppler integration
    - Calls dump-{service}.sh {environment} scripts

    The 'both' service type will execute both database and Redis dumps
    sequentially, ensuring both complete successfully or both fail.

CONFIGURATION:
    Environment variables are loaded via Doppler for each environment:
    - dev: Development configuration
    - stg: Staging configuration  
    - prd: Production configuration

    Required environment variables (loaded via Doppler):
    - BACKUP_ENCRYPTION_KEY: GPG passphrase for dump encryption
    - DATABASE_* or DATABASE_URL: Database connection parameters
    - REDIS_* or REDIS_URL: Redis connection parameters

SECURITY:
    - All dumps are automatically encrypted with AES256 cipher
    - Encryption key must be provided via BACKUP_ENCRYPTION_KEY
    - Sensitive environment variables are automatically cleaned up

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

# Function to get dump script path
get_dump_script_path() {
    local service="$1"
    echo "${SCRIPT_DIR}/advanced/dump-${service}.sh"
}

# Function to validate that the target script exists
validate_target_script() {
    local script_path="$1"
    local service="$2"
    local env="$3"
    
    if [[ ! -f "$script_path" ]]; then
        error_exit "Service-specific dump script not found: $script_path"
    fi
    
    if [[ ! -x "$script_path" ]]; then
        error_exit "Service-specific dump script is not executable: $script_path"
    fi
    
    log_info "Validated target script: $script_path"
}

# =============================================================================
# MAIN DUMP FUNCTION
# =============================================================================

dump_service() {
    local service="$1"
    local environment="$2"
    local script_path="$3"
    
    log_info "Starting $service dump for environment: $environment"
    
    # Execute the service-specific dump script
    log_info "Executing service-specific dump script: $script_path"
    
    # Run the script with environment parameter and capture its exit code
    local exit_code=0
    if ! bash "$script_path" "$environment"; then
        exit_code=$?
        error_exit "$service dump failed with exit code $exit_code"
    fi
    
    log_success "$service dump completed successfully for environment: $environment"
}

dump_both_services() {
    local environment="$1"
    
    log_info "Starting combined database and Redis dump for environment: $environment"
    
    # Get script paths for both services
    local db_script_path
    local redis_script_path
    db_script_path="$(get_dump_script_path "db")"
    redis_script_path="$(get_dump_script_path "redis")"
    
    # Validate both scripts exist
    validate_target_script "$db_script_path" "db" "$environment"
    validate_target_script "$redis_script_path" "redis" "$environment"
    
    # Execute database dump first
    log_info "Step 1/2: Creating database dump..."
    dump_service "db" "$environment" "$db_script_path"
    
    # Execute Redis dump second
    log_info "Step 2/2: Creating Redis dump..."
    dump_service "redis" "$environment" "$redis_script_path"
    
    log_success "Combined database and Redis dump completed successfully for environment: $environment"
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
    
    # Default environment to 'prd' for backward compatibility if not provided
    local service="$1"
    local environment="${2:-prd}"
    
    # Check if too many parameters are provided
    if [[ $# -gt 2 ]]; then
        echo "ERROR: Too many parameters provided"
        echo ""
        show_usage
        exit 1
    fi
    
    # Validate service parameter
    if ! validate_service "$service"; then
        error_exit "Invalid service: $service. Valid services: ${VALID_SERVICES[*]}"
    fi
    
    # Validate environment parameter
    if ! validate_environment "$environment"; then
        error_exit "Invalid environment: $environment. Valid environments: ${VALID_ENVIRONMENTS[*]}"
    fi
    
    # Print header
    echo "======================================================================"
    echo "🚀 Unified Dump Wrapper"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Service: $service"
    echo "Environment: $environment"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Handle 'both' service type specially
    if [[ "$service" == "both" ]]; then
        dump_both_services "$environment"
    else
        # Get the path to the service-specific script
        local script_path
        script_path="$(get_dump_script_path "$service")"
        
        # Validate that the target script exists and is executable
        validate_target_script "$script_path" "$service" "$environment"
        
        # Execute the dump operation
        dump_service "$service" "$environment" "$script_path"
    fi
    
    echo ""
    echo "======================================================================"
    echo "✅ $service Dump Completed Successfully"
    echo "======================================================================"
    echo "Service: $service"
    echo "Environment: $environment"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
}

# Execute main function with all parameters
main "$@"