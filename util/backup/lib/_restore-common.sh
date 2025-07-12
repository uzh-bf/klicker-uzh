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
# PATH MANAGEMENT FUNCTIONS
# =============================================================================

# Function to detect if running in automated mode
is_automated_mode() {
    [[ -n "${BACKUP_VOLUME_PATH:-}" ]] || [[ -n "${AUTOMATED_BACKUP:-}" ]]
}

# Function to get appropriate dump base directory
get_dump_base_dir() {
    if is_automated_mode; then
        echo "${BACKUP_VOLUME_PATH:-/mnt/backup}"
    else
        # Use script location to find repo dumps directory
        local script_dir="$(get_script_dir)"
        echo "${script_dir}/../dumps"
    fi
}

# Function to get dump directory for specific service
get_dump_directory() {
    local service="$1"  # "db" or "redis"
    local base_dir="$(get_dump_base_dir)"
    echo "${base_dir}/${service}"
}

# Function to find latest dump file for a service
find_latest_dump() {
    local service="$1"  # "db" or "redis"
    
    # 1. Check if explicit dump file provided
    if [[ -n "${DUMP_FILE:-}" ]] && [[ -f "$DUMP_FILE" ]]; then
        echo "$DUMP_FILE"
        return 0
    fi
    
    # 2. Determine search directory
    local dump_dir="$(get_dump_directory "$service")"
    
    # 3. Check for latest symlink
    if [[ -L "$dump_dir/latest" ]] && [[ -f "$dump_dir/latest" ]]; then
        echo "$dump_dir/latest"
        return 0
    fi
    
    # 4. Find most recent dump by timestamp
    local pattern
    if [[ "$service" == "db" ]]; then
        pattern="dump_*.tar*"
    else
        pattern="redis_dump_*.dump*"
    fi
    
    local latest=$(ls -1t "$dump_dir"/$pattern 2>/dev/null | head -1)
    if [[ -n "$latest" ]]; then
        echo "$latest"
        return 0
    fi
    
    # 5. Fallback to legacy location (backward compatibility)
    local script_dir="$(get_script_dir)"
    if [[ "$service" == "db" ]] && [[ -f "${script_dir}/../dump.tar" ]]; then
        echo "${script_dir}/../dump.tar"
        return 0
    elif [[ "$service" == "redis" ]] && [[ -f "${script_dir}/../redis.dump" ]]; then
        echo "${script_dir}/../redis.dump"
        return 0
    fi
    
    return 1
}

# Function to check if encryption should be used
should_encrypt() {
    [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]
}

# Function to check if cleanup should be performed
should_cleanup() {
    is_automated_mode && [[ "${BACKUP_CLEANUP_ENABLED:-true}" == "true" ]]
}

# Function to check if latest symlink should be updated
should_update_latest() {
    [[ "${BACKUP_UPDATE_LATEST:-true}" == "true" ]]
}

# Function to cleanup old dumps
cleanup_old_dumps() {
    local dump_dir="$1"
    local retention_days="${BACKUP_RETENTION_DAYS:-7}"
    
    if [[ ! -d "$dump_dir" ]]; then
        log_warning "Dump directory does not exist: $dump_dir"
        return 0
    fi
    
    log_info "Cleaning up dumps older than $retention_days days in $dump_dir"
    
    # Find and remove old dump files
    local deleted_count=0
    local old_files
    old_files=$(find "$dump_dir" -name "*.tar*" -o -name "*.dump*" -type f -mtime +$retention_days 2>/dev/null || true)
    
    if [[ -n "$old_files" ]]; then
        while IFS= read -r file; do
            if [[ -n "$file" && -f "$file" ]]; then
                log_info "Removing old dump: $(basename "$file")"
                rm -f "$file"
                ((deleted_count++))
            fi
        done <<< "$old_files"
    fi
    
    if [[ $deleted_count -eq 0 ]]; then
        log_info "No old dumps found to clean up"
    else
        log_info "Cleaned up $deleted_count old dump files"
    fi
}

# Function to decrypt dump file if needed
decrypt_dump_if_needed() {
    local dump_file="$1"
    
    # Check if file is encrypted
    if [[ "$dump_file" == *.gpg ]]; then
        if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
            error_exit "Dump file is encrypted but BACKUP_ENCRYPTION_KEY not provided"
        fi
        
        log_info "Decrypting dump file..."
        local temp_dump="/tmp/restore_dump_$$"
        
        if ! gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
                --decrypt "$dump_file" > "$temp_dump" 2>/dev/null; then
            rm -f "$temp_dump"
            error_exit "Failed to decrypt dump file"
        fi
        
        # Set up cleanup for temporary file
        trap "rm -f $temp_dump" EXIT
        echo "$temp_dump"
    else
        echo "$dump_file"
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
export -f is_automated_mode get_dump_base_dir get_dump_directory
export -f find_latest_dump should_encrypt should_cleanup should_update_latest
export -f cleanup_old_dumps decrypt_dump_if_needed

# Mark that this utility has been loaded
export RESTORE_COMMON_LOADED=true

log_info "Restore common utilities loaded successfully"
