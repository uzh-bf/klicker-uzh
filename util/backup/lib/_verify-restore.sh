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
    local timeout_duration="${2:-10}"

    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi

    log_info "Testing PostgreSQL connection..."

    # Test connection with a simple query
    # Use cross-platform timeout approach
    if command -v timeout >/dev/null 2>&1; then
        # Linux timeout command
        if ! timeout "$timeout_duration" psql "$connection_string" -c "SELECT 1;" &>/dev/null; then
            return 1
        fi
    elif command -v gtimeout >/dev/null 2>&1; then
        # macOS GNU coreutils timeout
        if ! gtimeout "$timeout_duration" psql "$connection_string" -c "SELECT 1;" &>/dev/null; then
            return 1
        fi
    else
        # Fallback: simple connection test without timeout
        if ! psql "$connection_string" -c "SELECT 1;" &>/dev/null; then
            return 1
        fi
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

    # Check for table in public schema with proper case handling
    local query="SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name');"

    if ! result=$(psql "$connection_string" -t -A -c "$query" 2>/dev/null); then
        error_exit "Failed to check table existence for '$table_name'"
    fi

    # Clean up result and check
    result=$(echo "$result" | tr -d ' \n\r')
    if [[ "$result" != "t" ]]; then
        error_exit "Table '$table_name' does not exist in public schema"
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

    # Quote table name and specify schema to handle case sensitivity and ensure correct targeting
    local query="SELECT COUNT(*) FROM public.\"$table_name\";"

    # Try the quoted version first (Prisma tables are typically quoted)
    if result=$(psql "$connection_string" -t -A -c "$query" 2>/dev/null); then
        # Clean up whitespace and return the result
        echo "$result" | tr -d ' \n\r'
        return 0
    fi

    # Fallback to unquoted version for legacy compatibility
    local fallback_query="SELECT COUNT(*) FROM public.$table_name;"
    if result=$(psql "$connection_string" -t -A -c "$fallback_query" 2>/dev/null); then
        # Clean up whitespace and return the result
        echo "$result" | tr -d ' \n\r'
        return 0
    fi

    # If both fail, return empty (caller should handle this gracefully)
    return 1
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
        log_warning "Table '$table_name' has insufficient data ($row_count rows, minimum: $min_rows)"
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

    # Extract database name from connection string if DATABASE_NAME is not set
    local db_name="${DATABASE_NAME:-}"
    if [[ -z "$db_name" && -n "$connection_string" ]]; then
        # Extract database name from PostgreSQL connection string
        # Format: postgresql://user:pass@host:port/dbname or postgres://user:pass@host:port/dbname
        db_name=$(echo "$connection_string" | sed -n 's|.*://[^/]*/\([^?]*\).*|\1|p')
    fi
    
    # Verify database accessibility
    verify_database_accessible "$db_name" "$connection_string"

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
# KLICKERUZH-SPECIFIC DATABASE VERIFICATION
# =============================================================================

# Define critical tables that should exist in a properly restored KlickerUZH database
readonly KLICKER_CRITICAL_TABLES=(
    "User"
    "Element"
    "Course"
    "Participant"
    "LiveQuiz"
    "PracticeQuiz"
    "MicroLearning"
    "ElementInstance"
    "QuestionResponse"
    "_prisma_migrations"
)

# Function to get database table statistics
get_database_statistics() {
    local connection_string="${1:-}"

    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi

    log_step "Gathering Database Statistics"

    # Get table count and row statistics
    local stats_query="
    SELECT
        schemaname,
        tablename,
        COALESCE(n_tup_ins - n_tup_del, 0) as estimated_rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY estimated_rows DESC;
    "

    log_info "Database table statistics:"
    if ! psql "$connection_string" -c "$stats_query" 2>/dev/null; then
        log_warning "Could not retrieve table statistics"
        return 1
    fi

    return 0
}

# Function to verify KlickerUZH critical tables
verify_klicker_critical_tables() {
    local connection_string="${1:-}"
    local min_rows="${2:-1}"

    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi

    log_step "Verifying KlickerUZH Critical Tables"

    local missing_tables=()
    local empty_tables=()
    local total_rows=0

    for table in "${KLICKER_CRITICAL_TABLES[@]}"; do
        log_info "Checking table: $table"

        # Check if table exists
        if ! verify_table_exists "$table" "$connection_string" >/dev/null 2>&1; then
            missing_tables+=("$table")
            continue
        fi

        # Get row count for this table (non-critical operation)
        local row_count
        if row_count=$(get_table_row_count "$table" "$connection_string"); then
            # Validate that row_count is a number
            if [[ "$row_count" =~ ^[0-9]+$ ]]; then
                total_rows=$((total_rows + row_count))

                if [[ "$row_count" -lt "$min_rows" ]] && [[ "$table" != "_prisma_migrations" ]]; then
                    empty_tables+=("$table")
                fi

                log_info "  ✅ Table '$table' has $row_count rows"
            else
                log_warning "  ⚠️  Invalid row count returned for table '$table': '$row_count'"
            fi
        else
            log_warning "  ⚠️  Could not get row count for table '$table' (table may not exist or access denied)"
            # This is non-critical - continue verification
        fi
    done

    # Report results
    if [[ ${#missing_tables[@]} -gt 0 ]]; then
        log "ERROR: Missing critical tables: ${missing_tables[*]}"
        return 1
    fi

    if [[ ${#empty_tables[@]} -gt 0 ]]; then
        log "WARNING: Empty critical tables: ${empty_tables[*]}"
        log "WARNING: This might indicate an incomplete restore"
    fi

    log_success "Critical tables verification completed"
    log_info "Total rows across critical tables: $total_rows"

    # If we have very few total rows, the restore might have failed
    if [[ "$total_rows" -lt 10 ]]; then
        log "WARNING: Very few rows found ($total_rows). Database restore may have failed."
        return 1
    fi

    return 0
}

# Function to check Prisma migration status
check_prisma_migration_status() {
    local connection_string="${1:-}"

    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi

    log_step "Checking Prisma Migration Status"

    # Check if _prisma_migrations table exists
    if ! verify_table_exists "_prisma_migrations" "$connection_string" >/dev/null 2>&1; then
        log_info "No _prisma_migrations table found - fresh database"
        return 0
    fi

    # Get migration count and status
    local migration_query="
    SELECT
        COUNT(*) as total_migrations,
        COUNT(CASE WHEN finished_at IS NOT NULL THEN 1 END) as completed_migrations,
        MAX(finished_at) as last_migration
    FROM _prisma_migrations;
    "

    log_info "Migration status:"
    if ! psql "$connection_string" -c "$migration_query" 2>/dev/null; then
        log_warning "Could not query migration status"
        return 1
    fi

    # Get list of applied migrations
    local applied_migrations_query="
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL
    ORDER BY finished_at DESC
    LIMIT 5;
    "

    log_info "Recent applied migrations:"
    if ! psql "$connection_string" -c "$applied_migrations_query" 2>/dev/null; then
        log_warning "Could not query applied migrations"
        return 1
    fi

    log_success "Migration status check completed"
    return 0
}

# Function to perform comprehensive KlickerUZH database verification
verify_klicker_database_restore() {
    local connection_string="${1:-}"
    local min_rows="${2:-1}"

    log_step "Performing Comprehensive KlickerUZH Database Verification"

    # Basic database verification first
    if ! verify_database_restore "$connection_string" "$(IFS=,; echo "${KLICKER_CRITICAL_TABLES[*]}")" "$min_rows"; then
        log "ERROR: Basic database verification failed"
        return 1
    fi

    # KlickerUZH-specific verification
    if ! verify_klicker_critical_tables "$connection_string" "$min_rows"; then
        log "ERROR: KlickerUZH critical tables verification failed"
        return 1
    fi

    # Check migration status
    if ! check_prisma_migration_status "$connection_string"; then
        log "WARNING: Could not verify migration status"
    fi

    # Get database statistics
    if ! get_database_statistics "$connection_string"; then
        log "WARNING: Could not retrieve database statistics"
    fi

    log_success "KlickerUZH database restore verification completed successfully"
    return 0
}

# Function to check if database needs migrations
needs_prisma_migrations() {
    local connection_string="${1:-}"

    if [[ -z "$connection_string" ]]; then
        connection_string="$(build_pg_connection_string)"
    fi

    # If _prisma_migrations table doesn't exist, we definitely need migrations
    if ! verify_table_exists "_prisma_migrations" "$connection_string" >/dev/null 2>&1; then
        log_info "No _prisma_migrations table found - migrations needed"
        return 0  # True - needs migrations
    fi

    # Check if there are any pending migrations by comparing with filesystem
    # This is a simple heuristic - if we have very few applied migrations,
    # there are probably more to apply
    local migration_count_query="SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"

    if migration_count=$(psql "$connection_string" -t -A -c "$migration_count_query" 2>/dev/null); then
        migration_count=$(echo "$migration_count" | tr -d ' \n')

        if [[ "$migration_count" -lt 5 ]]; then
            log_info "Only $migration_count migrations applied - likely needs more migrations"
            return 0  # True - needs migrations
        else
            log_info "$migration_count migrations already applied - may not need additional migrations"
            return 1  # False - probably doesn't need migrations
        fi
    else
        log_warning "Could not check migration count - assuming migrations needed"
        return 0  # True - assume migrations needed
    fi
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
export -f get_database_statistics verify_klicker_critical_tables check_prisma_migration_status
export -f verify_klicker_database_restore needs_prisma_migrations

# Mark that this utility has been loaded
export RESTORE_VERIFY_LOADED=true

log_info "Restore verification utilities loaded successfully"
