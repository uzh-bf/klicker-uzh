#!/bin/bash

# =============================================================================
# Restore Common Utilities
# =============================================================================
#
# This script provides shared functions for database and Redis restore operations.
# It consolidates common functionality including:
# - Logging with timestamps
# - Error handling and exit management
# - Environment variable validation
# - Cleanup routines
# - Tool availability checks
# - Doppler secrets management
#
# Usage: source this script in your restore scripts
# =============================================================================

# Enable strict error handling
set -euo pipefail

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================

# Function for logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function for info messages
log_info() {
    log "INFO: $1"
}

# Function for warning messages
log_warning() {
    log "WARNING: $1"
}

# Function for step messages with formatting
log_step() {
    echo ""
    echo "🔄 $1"
    echo "$(printf '%*s' ${#1} '' | tr ' ' '-')"
}

# Function for success messages
log_success() {
    echo ""
    echo "✅ $1"
    echo ""
}

# =============================================================================
# ERROR HANDLING FUNCTIONS
# =============================================================================

# Function for error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Function for validation errors
validation_error() {
    log "VALIDATION ERROR: $1"
    exit 1
}

# =============================================================================
# CLEANUP FUNCTIONS
# =============================================================================

# Function for cleanup on failure - common sensitive vars
cleanup_common() {
    log_info "Cleaning up sensitive environment variables..."
    unset PGPASSWORD 2>/dev/null || true
    unset DATABASE_URL DATABASE_USER DATABASE_PASS DATABASE_HOST DATABASE_NAME 2>/dev/null || true
    unset REDIS_HOST REDIS_PORT REDIS_PASS REDIS_URL 2>/dev/null || true
    rm -f /tmp/doppler_secrets.env 2>/dev/null || true
}

# Function for cleanup on database restore failure
cleanup_database() {
    log_info "Cleaning up database-specific variables..."
    unset PGPASSWORD 2>/dev/null || true
    unset DATABASE_URL DATABASE_USER DATABASE_PASS DATABASE_HOST DATABASE_NAME 2>/dev/null || true
}

# Function for cleanup on Redis restore failure
cleanup_redis() {
    log_info "Cleaning up Redis-specific variables..."
    unset REDIS_HOST REDIS_PORT REDIS_PASS REDIS_URL 2>/dev/null || true
}

# =============================================================================
# ENVIRONMENT VALIDATION FUNCTIONS
# =============================================================================

# Function to validate required environment variables
validate_env_var() {
    local var_name="$1"
    local var_value="${!var_name:-}"
    
    if [[ -z "$var_value" ]]; then
        validation_error "$var_name environment variable is not set"
    fi
    
    log_info "$var_name is set and valid"
}

# Function to validate database connection variables
validate_database_env() {
    log_step "Validating Database Environment Variables"
    
    # Check if we have DATABASE_URL or individual vars
    if [[ -n "${DATABASE_URL:-}" ]]; then
        log_info "Using DATABASE_URL for connection"
        # Validate DATABASE_URL format
        if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
            validation_error "DATABASE_URL must start with 'postgresql://'"
        fi
    else
        log_info "Using individual database variables for connection"
        validate_env_var "DATABASE_USER"
        validate_env_var "DATABASE_PASS"
        validate_env_var "DATABASE_HOST"
        validate_env_var "DATABASE_NAME"
    fi
    
    log_success "Database environment validation completed"
}

# Function to validate Redis connection variables
validate_redis_env() {
    log_step "Validating Redis Environment Variables"
    
    # Check if we have REDIS_URL or individual vars
    if [[ -n "${REDIS_URL:-}" ]]; then
        log_info "Using REDIS_URL for connection"
        # Validate REDIS_URL format
        if [[ ! "$REDIS_URL" =~ ^redis(s)?:// ]]; then
            validation_error "REDIS_URL must start with 'redis://' or 'rediss://'"
        fi
    else
        log_info "Using individual Redis variables for connection"
        validate_env_var "REDIS_HOST"
        validate_env_var "REDIS_PORT"
        validate_env_var "REDIS_PASS"
    fi
    
    log_success "Redis environment validation completed"
}

# =============================================================================
# TOOL AVAILABILITY FUNCTIONS
# =============================================================================

# Function to check if a command is available
check_command() {
    local cmd="$1"
    local description="${2:-$cmd}"
    
    if ! command -v "$cmd" &> /dev/null; then
        error_exit "$description command not found. Please install the required tools."
    fi
    
    log_info "$description is available"
}

# Function to check database tools
check_database_tools() {
    log_step "Verifying Database Tools"
    check_command "pg_restore" "PostgreSQL restore tool"
    log_success "Database tools verification completed"
}

# Function to check Redis tools
check_redis_tools() {
    log_step "Verifying Redis Tools"
    check_command "redis-cli" "Redis CLI tool"
    log_success "Redis tools verification completed"
}

# =============================================================================
# FILE VALIDATION FUNCTIONS
# =============================================================================

# Function to validate dump file exists
validate_dump_file() {
    local dump_file="$1"
    local file_type="${2:-dump}"
    
    if [[ ! -f "$dump_file" ]]; then
        error_exit "$file_type file not found: $dump_file"
    fi
    
    # Check if file is readable
    if [[ ! -r "$dump_file" ]]; then
        error_exit "$file_type file is not readable: $dump_file"
    fi
    
    # Check if file has content
    if [[ ! -s "$dump_file" ]]; then
        error_exit "$file_type file is empty: $dump_file"
    fi
    
    log_info "$file_type file validation passed: $dump_file"
}

# =============================================================================
# DOPPLER SECRETS MANAGEMENT
# =============================================================================

# Function to load Doppler secrets for a given config
load_doppler_secrets() {
    local config="${1:-}"
    
    if [[ -z "$config" ]]; then
        error_exit "Config parameter is required for loading Doppler secrets"
    fi
    
    log_step "Loading Doppler Secrets for Config: $config"
    
    # Check if Doppler is available
    if ! command -v doppler &> /dev/null; then
        error_exit "Doppler CLI not found. Please install Doppler CLI."
    fi
    
    # Download secrets to temporary file
    log_info "Downloading Doppler secrets..."
    if ! doppler secrets download --no-file --format env --config "$config" > /tmp/doppler_secrets.env 2>/dev/null; then
        rm -f /tmp/doppler_secrets.env
        error_exit "Failed to download Doppler secrets for config '$config'. Please check your Doppler configuration and authentication."
    fi
    
    # Source the environment variables
    log_info "Loading environment variables..."
    if ! source /tmp/doppler_secrets.env; then
        rm -f /tmp/doppler_secrets.env
        error_exit "Failed to load Doppler environment variables"
    fi
    
    # Clean up the temporary file
    rm -f /tmp/doppler_secrets.env
    
    log_success "Doppler secrets loaded successfully for config: $config"
}

# Function to load Doppler secrets using the simple eval method
load_doppler_secrets_simple() {
    local config="${1:-}"
    
    if [[ -z "$config" ]]; then
        error_exit "Config parameter is required for loading Doppler secrets"
    fi
    
    log_info "Loading Doppler secrets for config: $config"
    
    # Check if Doppler is available
    if ! command -v doppler &> /dev/null; then
        error_exit "Doppler CLI not found. Please install Doppler CLI."
    fi
    
    # Load secrets using eval method
    if ! eval "$(doppler secrets download --no-file --format env --config "$config")"; then
        error_exit "Failed to load Doppler secrets for config '$config'"
    fi
    
    log_info "Doppler secrets loaded successfully for config: $config"
}

# =============================================================================
# DIRECTORY AND PATH UTILITIES
# =============================================================================

# Function to get script directory
get_script_dir() {
    echo "$( cd "$( dirname "${BASH_SOURCE[1]}" )" && pwd )"
}

# Function to get dump file path
get_dump_file_path() {
    local filename="$1"
    local script_dir="${2:-$(get_script_dir)}"
    
    echo "${script_dir}/${filename}"
}

# =============================================================================
# CONNECTION STRING UTILITIES
# =============================================================================

# Function to build PostgreSQL connection string
build_pg_connection_string() {
    if [[ -n "${DATABASE_URL:-}" ]]; then
        # Clean up DATABASE_URL for pg_restore (remove unsupported query parameters)
        echo "$DATABASE_URL" | sed 's/[?&]schema=[^&]*//g' | sed 's/[?&]sslmode=[^&]*//g' | sed 's/[?&]pgbouncer=[^&]*//g' | sed 's/?$//'
    else
        echo "postgresql://$DATABASE_USER:$DATABASE_PASS@$DATABASE_HOST:5432/$DATABASE_NAME"
    fi
}

# Function to build Redis connection string
build_redis_connection_string() {
    if [[ -n "${REDIS_URL:-}" ]]; then
        echo "$REDIS_URL"
    else
        # Determine if we need TLS
        local scheme="redis"
        if [[ "${REDIS_PORT:-6379}" == "6380" ]] || [[ "${REDIS_TLS:-}" == "true" ]]; then
            scheme="rediss"
        fi
        echo "${scheme}://${REDIS_PASS}@${REDIS_HOST}:${REDIS_PORT}"
    fi
}

# =============================================================================
# INITIALIZATION
# =============================================================================

# Function to initialize common restore environment
init_restore_environment() {
    local restore_type="${1:-generic}"
    
    log_step "Initializing $restore_type Restore Environment"
    
    # Set up trap for cleanup on script exit
    case "$restore_type" in
        "database")
            trap cleanup_database EXIT
            ;;
        "redis")
            trap cleanup_redis EXIT
            ;;
        *)
            trap cleanup_common EXIT
            ;;
    esac
    
    log_success "$restore_type restore environment initialized"
}

# =============================================================================
# SCRIPT METADATA
# =============================================================================

# Export functions that might be used externally
export -f log log_info log_warning log_step log_success
export -f error_exit validation_error
export -f cleanup_common cleanup_database cleanup_redis
export -f validate_env_var validate_database_env validate_redis_env
export -f check_command check_database_tools check_redis_tools
export -f validate_dump_file
export -f load_doppler_secrets load_doppler_secrets_simple
export -f get_script_dir get_dump_file_path
export -f build_pg_connection_string build_redis_connection_string
export -f init_restore_environment

# Mark that this utility has been loaded
export RESTORE_COMMON_LOADED=true

log_info "Restore common utilities loaded successfully"
