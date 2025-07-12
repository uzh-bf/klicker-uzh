#!/bin/bash

# =============================================================================
# Restore Verification Utilities
# =============================================================================
#
# This script provides verification functions for database and Redis restore operations.
# It includes functionality for:
# - Database connection testing
# - Redis connection testing
# - Data validation and integrity checks
# - Table/key existence verification
# - Row/data count validation
#
# Usage: source this script in your restore scripts
# =============================================================================

# Ensure common utilities are loaded
if [[ "${RESTORE_COMMON_LOADED:-}" != "true" ]]; then
    # Try to load common utilities from the same directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    if [[ -f "$SCRIPT_DIR/_restore-common.sh" ]]; then
        source "$SCRIPT_DIR/_restore-common.sh"
    else
        echo "ERROR: Common utilities not found. Please ensure _restore-common.sh is available." >&2
        exit 1
    fi
fi

# =============================================================================
# DATABASE CONNECTION VERIFICATION
# =============================================================================

# Function to test PostgreSQL connection
test_pg_connection() {
    local connection_string="${1:-}"
    local timeout="${2:-10}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi
    
    log_info "Testing PostgreSQL connection..."
    
    # Test connection with a simple query
    if ! timeout "$timeout" psql "$connection_string" -c "SELECT 1;" &>/dev/null; then
        return 1
    fi
    
    log_info "PostgreSQL connection test passed"
    return 0
}

# Function to test PostgreSQL connection with retries
test_pg_connection_with_retry() {
    local connection_string="${1:-}"
    local max_retries="${2:-3}"
    local retry_delay="${3:-5}"
    local timeout="${4:-10}"
    
    log_info "Testing PostgreSQL connection (max retries: $max_retries)..."
    
    for ((i=1; i<=max_retries; i++)); do
        log_info "Connection attempt $i/$max_retries"
        
        if test_pg_connection "$connection_string" "$timeout"; then
            log_success "PostgreSQL connection established successfully"
            return 0
        fi
        
        if [[ $i -lt $max_retries ]]; then
            log_warning "Connection failed, retrying in $retry_delay seconds..."
            sleep "$retry_delay"
        fi
    done
    
    error_exit "PostgreSQL connection failed after $max_retries attempts"
}

# Function to verify database exists and is accessible
verify_database_accessible() {
    local db_name="${1:-${DATABASE_NAME:-}}"
    local connection_string="${2:-}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi
    
    log_info "Verifying database '$db_name' is accessible..."
    
    # Query to check database existence and basic access
    local query="SELECT datname FROM pg_database WHERE datname = '$db_name';"
    
    if ! result=$(psql "$connection_string" -t -A -c "$query" 2>/dev/null); then
        error_exit "Failed to query database information"
    fi
    
    if [[ -z "$result" ]]; then
        error_exit "Database '$db_name' not found or not accessible"
    fi
    
    log_success "Database '$db_name' is accessible"
}

# =============================================================================
# REDIS CONNECTION VERIFICATION
# =============================================================================

# Function to test Redis connection
test_redis_connection() {
    local connection_string="${1:-}"
    local timeout="${2:-10}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_redis_connection_string)"
    fi
    
    log_info "Testing Redis connection..."
    
    # Test connection with PING command
    if ! timeout "$timeout" redis-cli -u "$connection_string" ping &>/dev/null; then
        return 1
    fi
    
    log_info "Redis connection test passed"
    return 0
}

# Function to test Redis connection with retries
test_redis_connection_with_retry() {
    local connection_string="${1:-}"
    local max_retries="${2:-3}"
    local retry_delay="${3:-5}"
    local timeout="${4:-10}"
    
    log_info "Testing Redis connection (max retries: $max_retries)..."
    
    for ((i=1; i<=max_retries; i++)); do
        log_info "Connection attempt $i/$max_retries"
        
        if test_redis_connection "$connection_string" "$timeout"; then
            log_success "Redis connection established successfully"
            return 0
        fi
        
        if [[ $i -lt $max_retries ]]; then
            log_warning "Connection failed, retrying in $retry_delay seconds..."
            sleep "$retry_delay"
        fi
    done
    
    error_exit "Redis connection failed after $max_retries attempts"
}

# Function to verify Redis info
verify_redis_info() {
    local connection_string="${1:-}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_redis_connection_string)"
    fi
    
    log_info "Verifying Redis server information..."
    
    # Get Redis info
    if ! redis_info=$(redis-cli -u "$connection_string" info server 2>/dev/null); then
        error_exit "Failed to get Redis server information"
    fi
    
    # Extract Redis version
    local redis_version
    redis_version=$(echo "$redis_info" | grep "redis_version:" | cut -d: -f2 | tr -d '\r')
    
    if [[ -n "$redis_version" ]]; then
        log_info "Redis server version: $redis_version"
    else
        log_warning "Could not determine Redis server version"
    fi
    
    log_success "Redis server information verified"
}

# =============================================================================
# DATABASE DATA VERIFICATION
# =============================================================================

# Function to verify table exists
verify_table_exists() {
    local table_name="$1"
    local connection_string="${2:-}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi
    
    log_info "Verifying table '$table_name' exists..."
    
    local query="SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table_name');"
    
    if ! result=$(psql "$connection_string" -t -A -c "$query" 2>/dev/null); then
        error_exit "Failed to check table existence for '$table_name'"
    fi
    
    if [[ "$result" != "t" ]]; then
        error_exit "Table '$table_name' does not exist"
    fi
    
    log_success "Table '$table_name' exists"
}

# Function to verify tables exist from list
verify_tables_exist() {
    local connection_string="${1:-}"
    shift
    local tables=("$@")
    
    if [[ ${#tables[@]} -eq 0 ]]; then
        log_warning "No tables specified for verification"
        return 0
    fi
    
    log_step "Verifying Database Tables"
    
    for table in "${tables[@]}"; do
        verify_table_exists "$table" "$connection_string"
    done
    
    log_success "All specified tables verified"
}

# Function to get table row count
get_table_row_count() {
    local table_name="$1"
    local connection_string="${2:-}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi
    
    local query="SELECT COUNT(*) FROM $table_name;"
    
    if ! result=$(psql "$connection_string" -t -A -c "$query" 2>/dev/null); then
        error_exit "Failed to get row count for table '$table_name'"
    fi
    
    echo "$result"
}

# Function to verify table has data
verify_table_has_data() {
    local table_name="$1"
    local min_rows="${2:-1}"
    local connection_string="${3:-}"
    
    log_info "Verifying table '$table_name' has data (minimum: $min_rows rows)..."
    
    local row_count
    row_count=$(get_table_row_count "$table_name" "$connection_string")
    
    if [[ "$row_count" -lt "$min_rows" ]]; then
        error_exit "Table '$table_name' has insufficient data ($row_count rows, minimum: $min_rows)"
    fi
    
    log_success "Table '$table_name' has sufficient data ($row_count rows)"
}

# Function to verify multiple tables have data
verify_tables_have_data() {
    local connection_string="${1:-}"
    local min_rows="${2:-1}"
    shift 2
    local tables=("$@")
    
    if [[ ${#tables[@]} -eq 0 ]]; then
        log_warning "No tables specified for data verification"
        return 0
    fi
    
    log_step "Verifying Database Tables Have Data"
    
    for table in "${tables[@]}"; do
        verify_table_has_data "$table" "$min_rows" "$connection_string"
    done
    
    log_success "All specified tables have sufficient data"
}

# =============================================================================
# REDIS DATA VERIFICATION
# =============================================================================

# Function to get Redis key count
get_redis_key_count() {
    local pattern="${1:-*}"
    local connection_string="${2:-}"
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_redis_connection_string)"
    fi
    
    # Get key count using EVAL to avoid KEYS command on large datasets
    local script="return #redis.call('keys', ARGV[1])"
    
    if ! result=$(redis-cli -u "$connection_string" eval "$script" 0 "$pattern" 2>/dev/null); then
        error_exit "Failed to get Redis key count"
    fi
    
    echo "$result"
}

# Function to verify Redis has data
verify_redis_has_data() {
    local min_keys="${1:-1}"
    local pattern="${2:-*}"
    local connection_string="${3:-}"
    
    log_info "Verifying Redis has data (minimum: $min_keys keys, pattern: $pattern)..."
    
    local key_count
    key_count=$(get_redis_key_count "$pattern" "$connection_string")
    
    if [[ "$key_count" -lt "$min_keys" ]]; then
        error_exit "Redis has insufficient data ($key_count keys, minimum: $min_keys)"
    fi
    
    log_success "Redis has sufficient data ($key_count keys)"
}

# Function to verify specific Redis keys exist
verify_redis_keys_exist() {
    local connection_string="${1:-}"
    shift
    local keys=("$@")
    
    if [[ ${#keys[@]} -eq 0 ]]; then
        log_warning "No keys specified for verification"
        return 0
    fi
    
    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_redis_connection_string)"
    fi
    
    log_step "Verifying Redis Keys Exist"
    
    for key in "${keys[@]}"; do
        log_info "Verifying key '$key' exists..."
        
        if ! result=$(redis-cli -u "$connection_string" exists "$key" 2>/dev/null); then
            error_exit "Failed to check existence of key '$key'"
        fi
        
        if [[ "$result" != "1" ]]; then
            error_exit "Key '$key' does not exist"
        fi
        
        log_success "Key '$key' exists"
    done
    
    log_success "All specified keys verified"
}

# =============================================================================
# COMPREHENSIVE VERIFICATION FUNCTIONS
# =============================================================================

# Function to perform comprehensive database verification
verify_database_restore() {
    local connection_string="${1:-}"
    local required_tables="${2:-}"
    local min_rows="${3:-1}"
    
    log_step "Performing Comprehensive Database Verification"
    
    # Test connection
    test_pg_connection_with_retry "$connection_string"
    
    # Verify database accessibility
    verify_database_accessible "${DATABASE_NAME:-}" "$connection_string"
    
    # Verify tables if specified
    if [[ -n "$required_tables" ]]; then
        # Convert comma-separated string to array
        IFS=',' read -ra tables <<< "$required_tables"
        verify_tables_exist "$connection_string" "${tables[@]}"
        verify_tables_have_data "$connection_string" "$min_rows" "${tables[@]}"
    fi
    
    log_success "Database restore verification completed successfully"
}

# Function to perform comprehensive Redis verification
verify_redis_restore() {
    local connection_string="${1:-}"
    local min_keys="${2:-1}"
    local required_keys="${3:-}"
    
    log_step "Performing Comprehensive Redis Verification"
    
    # Test connection
    test_redis_connection_with_retry "$connection_string"
    
    # Verify Redis info
    verify_redis_info "$connection_string"
    
    # Verify data if specified
    verify_redis_has_data "$min_keys" "*" "$connection_string"
    
    # Verify specific keys if specified
    if [[ -n "$required_keys" ]]; then
        # Convert comma-separated string to array
        IFS=',' read -ra keys <<< "$required_keys"
        verify_redis_keys_exist "$connection_string" "${keys[@]}"
    fi
    
    log_success "Redis restore verification completed successfully"
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Function to display restoration summary
display_restore_summary() {
    local restore_type="$1"
    local dump_file="$2"
    local connection_info="$3"
    
    echo ""
    echo "🎉 $restore_type RESTORE COMPLETED SUCCESSFULLY!"
    echo "================================================"
    echo "Restore type: $restore_type"
    echo "Source file: $dump_file"
    echo "Connection: $connection_info"
    echo "Completed: $(date)"
    echo "================================================"
    echo ""
}

# Function to run post-restore cleanup
post_restore_cleanup() {
    local restore_type="${1:-generic}"
    
    log_step "Running Post-Restore Cleanup"
    
    # Clean up any temporary files
    rm -f /tmp/restore_*.tmp 2>/dev/null || true
    
    # Clean up environment variables based on restore type
    case "$restore_type" in
        "database")
            cleanup_database
            ;;
        "redis")
            cleanup_redis
            ;;
        *)
            cleanup_common
            ;;
    esac
    
    log_success "Post-restore cleanup completed"
}

# =============================================================================
# SCRIPT METADATA
# =============================================================================

# Export functions that might be used externally
export -f test_pg_connection test_pg_connection_with_retry verify_database_accessible
export -f test_redis_connection test_redis_connection_with_retry verify_redis_info
export -f verify_table_exists verify_tables_exist get_table_row_count
export -f verify_table_has_data verify_tables_have_data
export -f get_redis_key_count verify_redis_has_data verify_redis_keys_exist
export -f verify_database_restore verify_redis_restore
export -f display_restore_summary post_restore_cleanup

# Mark that this utility has been loaded
export RESTORE_VERIFY_LOADED=true

log_info "Restore verification utilities loaded successfully"
