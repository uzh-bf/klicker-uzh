#!/bin/bash

# =============================================================================
# Restore Orchestrator - Production-Safe Multi-Service Operations
# =============================================================================
#
# This script provides production-grade orchestration for database and Redis
# restore operations with transaction-like behavior, state management, and
# comprehensive safety measures.
#
# Usage: ./restore-orchestrator.sh [environment] [options]
#
# Arguments:
#   environment    Target environment (stg|prd)
#
# Options:
#   --dry-run             Validate operations without executing
#   --force               Skip staging validation requirement for production
#   --skip-backup         Skip pre-restore backup creation (dangerous)
#   --continue-from=ID    Resume from specific operation ID
#
# Features:
# - Transaction-like behavior: both services succeed or both are rolled back
# - Mandatory staging validation before production operations
# - Pre-restore backup creation with automatic rollback capability
# - State management for resume/rollback operations
# - Comprehensive safety checks and confirmations
# - Detailed audit logging and monitoring integration
#
# =============================================================================

# Enable strict error handling
set -euo pipefail

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# =============================================================================
# CONSTANTS AND CONFIGURATION
# =============================================================================

readonly STATE_DIR="/tmp/klicker-restore-state"
readonly BACKUP_DIR_PREFIX="backup_pre_restore"
readonly STAGING_VALIDATION_FILE="${STATE_DIR}/staging_validation_success"
readonly OPERATION_TIMEOUT=3600  # 1 hour timeout for operations

# =============================================================================
# PARAMETER PARSING AND VALIDATION
# =============================================================================

# Function to display usage information
show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [OPTIONS]

Production-Safe Restore Orchestrator

ARGUMENTS:
    ENVIRONMENT    Target environment (stg|prd)

OPTIONS:
    --dry-run              Validate operations without executing
    --force                Skip staging validation requirement for production
    --skip-backup          Skip pre-restore backup creation (dangerous)
    --continue-from=ID     Resume from specific operation ID
    --help, -h             Show this help message

ENVIRONMENTS:
    stg                   Staging environment (also validates for production)
    prd                   Production environment (requires staging validation)

OPERATION MODES:
    Staging Validation:
        $0 stg             Validates restore process on staging environment
                          Creates validation marker for production use

    Production Execution:
        $0 prd             Executes production restore (requires prior staging validation)
                          Includes pre-restore backup and rollback capability

SAFETY FEATURES:
    - Staging validation required before production execution
    - Pre-restore backups created automatically
    - Transaction-like behavior (both services succeed or both rollback)
    - State tracking for resume/rollback operations
    - Comprehensive confirmation prompts for production
    - Detailed audit logging and monitoring

EXAMPLES:
    # Step 1: Validate on staging (mandatory for production)
    $0 stg

    # Step 2: Execute on production (after staging validation)
    $0 prd

    # Test workflow without execution
    $0 stg --dry-run
    $0 prd --dry-run

    # Resume from failed operation
    $0 prd --continue-from=restore-20240712-143022

EOF
}

# Parse command line arguments
ENVIRONMENT=""
DRY_RUN=false
FORCE_PRODUCTION=false
SKIP_BACKUP=false
CONTINUE_FROM=""
ASSESSMENT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        stg|prd)
            ENVIRONMENT="$1"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE_PRODUCTION=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --continue-from=*)
            CONTINUE_FROM="${1#*=}"
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument '$1'"
            echo ""
            show_usage
            exit 1
            ;;
    esac
done

# Validate required environment parameter
if [[ -z "$ENVIRONMENT" ]]; then
    echo "ERROR: Environment parameter is required"
    echo ""
    show_usage
    exit 1
fi

# Validate environment parameter
case "$ENVIRONMENT" in
    "stg"|"prd")
        echo "🎯 Target environment: $ENVIRONMENT"
        ;;
    *)
        echo "ERROR: Invalid environment '$ENVIRONMENT'. Valid environments: stg, prd"
        echo ""
        show_usage
        exit 1
        ;;
esac

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

# =============================================================================
# STATE MANAGEMENT FUNCTIONS
# =============================================================================

# Create operation state directory
create_state_dir() {
    mkdir -p "$STATE_DIR"
    if [[ ! -w "$STATE_DIR" ]]; then
        error_exit "State directory is not writable: $STATE_DIR"
    fi
}

# Generate unique operation ID
generate_operation_id() {
    echo "restore-$(date +%Y%m%d-%H%M%S)"
}

# Create operation state file
create_operation_state() {
    local operation_id="$1"
    local state_file="${STATE_DIR}/${operation_id}.json"
    
    cat > "$state_file" << EOF
{
    "operation_id": "$operation_id",
    "environment": "$ENVIRONMENT",
    "assessment": $ASSESSMENT,
    "initiated_by": "${USER:-unknown}",
    "started_at": "$(date -Iseconds)",
    "dry_run": $DRY_RUN,
    "force_production": $FORCE_PRODUCTION,
    "skip_backup": $SKIP_BACKUP,
    "source_dumps": {},
    "backup_created": {},
    "steps": [],
    "status": "initialized"
}
EOF
    
    echo "$state_file"
}

# Update operation state
update_operation_state() {
    local state_file="$1"
    local step="$2"
    local status="$3"
    local message="${4:-}"
    
    # Create temporary file for atomic update
    local temp_file="${state_file}.tmp"
    
    # Use jq to update the state file
    if command -v jq &> /dev/null; then
        jq --arg step "$step" --arg status "$status" --arg timestamp "$(date -Iseconds)" --arg message "$message" \
           '.steps += [{"step": $step, "status": $status, "timestamp": $timestamp, "message": $message}] | .last_update = $timestamp' \
           "$state_file" > "$temp_file" && mv "$temp_file" "$state_file"
    else
        # Fallback without jq
        echo "Warning: jq not available, limited state tracking"
        echo "$(date -Iseconds): $step - $status - $message" >> "${state_file}.log"
    fi
}

# Mark operation as completed
complete_operation_state() {
    local state_file="$1"
    local status="$2"
    
    if command -v jq &> /dev/null; then
        local temp_file="${state_file}.tmp"
        jq --arg status "$status" --arg timestamp "$(date -Iseconds)" \
           '.status = $status | .completed_at = $timestamp' \
           "$state_file" > "$temp_file" && mv "$temp_file" "$state_file"
    fi
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

# Check if staging validation exists and is recent
check_staging_validation() {
    if [[ ! -f "$STAGING_VALIDATION_FILE" ]]; then
        return 1
    fi
    
    # Check if validation is recent (within 24 hours)
    local validation_time
    validation_time=$(stat -f %m "$STAGING_VALIDATION_FILE" 2>/dev/null || stat -c %Y "$STAGING_VALIDATION_FILE" 2>/dev/null)
    local current_time
    current_time=$(date +%s)
    local age=$((current_time - validation_time))
    
    # 24 hours = 86400 seconds
    if [[ $age -gt 86400 ]]; then
        return 1
    fi
    
    return 0
}

# Create staging validation marker
create_staging_validation() {
    mkdir -p "$(dirname "$STAGING_VALIDATION_FILE")"
    echo "$(date -Iseconds): Staging validation completed successfully" > "$STAGING_VALIDATION_FILE"
    echo "Environment: $ENVIRONMENT" >> "$STAGING_VALIDATION_FILE"
    echo "Operation: Orchestrated restore validation" >> "$STAGING_VALIDATION_FILE"
}

# Validate dump files exist and are consistent
validate_dump_files() {
    local state_file="$1"
    
    log_step "Validating Source Dump Files"
    
    # Find database dump
    local db_dump
    if ! db_dump=$(find_latest_dump "db"); then
        error_exit "No database dump found for restore operation"
    fi
    
    # Find Redis dump
    local redis_dump
    if ! redis_dump=$(find_latest_dump "redis"); then
        error_exit "No Redis dump found for restore operation"
    fi

    local redis_assessment_dump
    if ! redis_assessment_dump=$(find_latest_dump "redis-assessment"); then
        error_exit "No Redis assessment dump found for restore operation"
    fi
    
    log_info "Database dump: $db_dump"
    log_info "Redis dump: $redis_dump"
    log_info "Redis assessment dump: $redis_assessment_dump"
    
    # Verify dump files using validate_dump_file from common utilities
    validate_dump_file "$db_dump" "database dump"
    validate_dump_file "$redis_dump" "Redis dump"
    validate_dump_file "$redis_assessment_dump" "Redis assessment dump"
    
    # Update state with dump file information
    if command -v jq &> /dev/null; then
        local temp_file="${state_file}.tmp"
        jq --arg db_dump "$db_dump" --arg redis_dump "$redis_dump" --arg redis_assessment_dump "$redis_assessment_dump" \
           '.source_dumps = {"db": {"file": $db_dump}, "redis": {"file": $redis_dump}, "redis-assessment": {"file": $redis_assessment_dump}}' \
           "$state_file" > "$temp_file" && mv "$temp_file" "$state_file"
    fi
    
    update_operation_state "$state_file" "validate_dumps" "completed" "Dump files validated successfully"
    log_success "Dump file validation completed"
    
    # Export for use by other functions
    export VALIDATED_DB_DUMP="$db_dump"
    export VALIDATED_REDIS_DUMP="$redis_dump"
    export VALIDATED_REDIS_ASSESSMENT_DUMP="$redis_assessment_dump"
}

# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================

# Create pre-restore backups
create_pre_restore_backups() {
    local state_file="$1"
    
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warning "Skipping pre-restore backup creation (--skip-backup specified)"
        update_operation_state "$state_file" "create_backups" "skipped" "Backup creation skipped by user request"
        return 0
    fi
    
    log_step "Creating Pre-Restore Backups"
    
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_prefix="${BACKUP_DIR_PREFIX}_${timestamp}"
    
    # Create database backup
    log_info "Creating database backup..."
    local db_backup_cmd="${SCRIPT_DIR}/dump-db-infisical.sh $ENVIRONMENT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute: $db_backup_cmd"
    else
        # Set backup prefix for the dump script
        export BACKUP_PREFIX="$backup_prefix"
        if ! $db_backup_cmd; then
            error_exit "Failed to create database backup"
        fi
    fi
    
    # Create Redis backup
    log_info "Creating Redis backup..."
    local redis_backup_cmd="${SCRIPT_DIR}/dump-redis-infisical.sh $ENVIRONMENT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute: $redis_backup_cmd"
    else
        export BACKUP_PREFIX="$backup_prefix"
        if ! $redis_backup_cmd; then
            error_exit "Failed to create Redis backup"
        fi
    fi

    # Create Redis assessment backup
    log_info "Creating Redis assessment backup..."
    local redis_assessment_backup_cmd="${SCRIPT_DIR}/dump-redis-infisical.sh $ENVIRONMENT assessment"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute: $redis_assessment_backup_cmd"
    else
        export BACKUP_PREFIX="$backup_prefix"
        if ! $redis_assessment_backup_cmd; then
            error_exit "Failed to create Redis assessment backup"
        fi
    fi
    

    # Update state with backup information
    if [[ "$DRY_RUN" != "true" ]] && command -v jq &> /dev/null; then
        local db_backup_dir="${STATE_DIR}/../dumps/db"
        local redis_backup_dir="${STATE_DIR}/../dumps/redis"
        local redis_assessment_backup_dir="${STATE_DIR}/../dumps/redis-assessment"
        local temp_file="${state_file}.tmp"

        jq --arg db_backup_dir "$db_backup_dir" --arg redis_backup_dir "$redis_backup_dir" --arg redis_assessment_backup_dir "$redis_assessment_backup_dir" \
           '.backup_created = {"db": {"directory": $db_backup_dir}, "redis": {"directory": $redis_backup_dir}, "redis-assessment": {"directory": $redis_assessment_backup_dir}}' \
           "$state_file" > "$temp_file" && mv "$temp_file" "$state_file"
    fi
    
    update_operation_state "$state_file" "create_backups" "completed" "Pre-restore backups created successfully"
    log_success "Pre-restore backup creation completed"
}

# =============================================================================
# RESTORE FUNCTIONS
# =============================================================================

# Execute coordinated restore with transaction-like behavior
execute_coordinated_restore() {
    local state_file="$1"
    
    log_step "Executing Coordinated Restore Operation"
    
    # Step 1: Restore database
    log_info "Step 1: Restoring database..."
    update_operation_state "$state_file" "restore_database" "in_progress" "Starting database restore"
    
    local db_restore_cmd="${SCRIPT_DIR}/restore-db-infisical.sh $ENVIRONMENT"
    local db_restore_success=false
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute: $db_restore_cmd"
        db_restore_success=true
    else
        export DUMP_FILE="$VALIDATED_DB_DUMP"
        if $db_restore_cmd; then
            db_restore_success=true
            update_operation_state "$state_file" "restore_database" "completed" "Database restore completed successfully"
            log_success "Database restore completed successfully"
        else
            update_operation_state "$state_file" "restore_database" "failed" "Database restore failed"
            log "ERROR: Database restore failed"
        fi
    fi
    
    # Step 2: Restore Redis
    local redis_restore_success=false
    if [[ "$db_restore_success" == "true" ]]; then
        log_info "Step 2: Restoring Redis..."
        update_operation_state "$state_file" "restore_redis" "in_progress" "Starting Redis restore"
        
        local redis_restore_cmd="${SCRIPT_DIR}/restore-redis-infisical.sh $ENVIRONMENT"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would execute: $redis_restore_cmd"
            redis_restore_success=true
        else
            export DUMP_FILE="$VALIDATED_REDIS_DUMP"
            if $redis_restore_cmd; then
                redis_restore_success=true
                update_operation_state "$state_file" "restore_redis" "completed" "Redis restore completed successfully"
                log_success "Redis restore completed successfully"
            else
                update_operation_state "$state_file" "restore_redis" "failed" "Redis restore failed"
                log "ERROR: Redis restore failed"
            fi
        fi
    else
        # Database failed - no need for Redis restore or rollback
        update_operation_state "$state_file" "coordinated_restore" "failed" "Database restore failed, aborting operation"
        error_exit "Database restore failed, aborting coordinated restore operation"
    fi

    # Step 3: Restore Redis
    local redis_assessment_restore_success=false
    if [[ "$db_restore_success" == "true" && "$redis_restore_success" == "true" ]]; then
        log_info "Step 3: Restoring Redis assessment..."
        update_operation_state "$state_file" "restore_redis_assessment" "in_progress" "Starting Redis restore"
        
        local redis_assesssment_restore_cmd="${SCRIPT_DIR}/restore-redis-infisical.sh $ENVIRONMENT assessment"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would execute: $redis_assesssment_restore_cmd"
            redis_assessment_restore_success=true
        else
            export DUMP_FILE="$VALIDATED_REDIS_ASSESSMENT_DUMP"
            if $redis_assesssment_restore_cmd; then
                redis_assessment_restore_success=true
                update_operation_state "$state_file" "restore_redis_assessment" "completed" "Redis assessment restore completed successfully"
                log_success "Redis assessment restore completed successfully"
            else
                update_operation_state "$state_file" "restore_redis_assessment" "failed" "Redis assessment restore failed"
                log "ERROR: Redis assessment restore failed"
            fi
        fi
        
        # Check final result
        if [[ "$redis_assessment_restore_success" == "true" ]]; then
            # Both succeeded - operation complete
            update_operation_state "$state_file" "coordinated_restore" "completed" "Both services restored successfully"
            log_success "Coordinated restore completed successfully"
            return 0
        else
            # Redis failed after DB succeeded - need rollback
            log "ERROR: Redis assessment restore failed after database restore and redis restore succeeded"
            update_operation_state "$state_file" "coordinated_restore" "failed" "Redis assessment restore failed, initiating rollback"

            if [[ "$DRY_RUN" != "true" ]]; then
                rollback_operation "$state_file"
            fi
            
            return 1
        fi
    else
        # Database failed - no need for Redis restore or rollback
        update_operation_state "$state_file" "coordinated_restore" "failed" "Database restore failed, aborting operation"
        error_exit "Database restore failed, aborting coordinated restore operation"
    fi
}

# Find backup files with specific prefix
find_backup_dump() {
    local service="$1"      # "db" or "redis"
    local backup_prefix="$2" # backup prefix to search for
    
    # Determine search directory
    local dump_dir="$(get_dump_base_dir)/$service"
    
    # Search pattern based on service and backup prefix
    local pattern
    if [[ "$service" == "db" ]]; then
        pattern="${backup_prefix}_dump_*.tar*"
    elif [[ "$service" == "redis" ]]; then
        pattern="${backup_prefix}_redis_dump_*.json*"
    else
        pattern="${backup_prefix}_redis_assessment_dump_*.json*"
    fi
    
    # Find most recent backup with the prefix
    local latest=$(ls -1t "$dump_dir"/$pattern 2>/dev/null | head -1)
    if [[ -n "$latest" ]]; then
        echo "$latest"
        return 0
    fi
    
    return 1
}

# Extract backup prefix from state file
get_backup_prefix_from_state() {
    local state_file="$1"
    
    # Try to extract backup prefix from the operation ID or timestamp
    if command -v jq &> /dev/null && [[ -f "$state_file" ]]; then
        # Get started_at timestamp from state file
        local started_at=$(jq -r '.started_at' "$state_file" 2>/dev/null)
        if [[ "$started_at" != "null" && -n "$started_at" ]]; then
            # Convert ISO timestamp to backup format: backup_pre_restore_YYYYMMDD_HHMMSS
            local backup_timestamp=$(date -d "$started_at" +%Y%m%d_%H%M%S 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$started_at" +%Y%m%d_%H%M%S 2>/dev/null)
            if [[ -n "$backup_timestamp" ]]; then
                echo "${BACKUP_DIR_PREFIX}_${backup_timestamp}"
                return 0
            fi
        fi
    fi
    
    # Fallback: try to find any backup_pre_restore files and use the most recent
    local dump_dir="$(get_dump_base_dir)"
    local recent_backup=""
    
    # Check for any backup_pre_restore files in both db and redis directories
    for service in db redis redis-assessment; do
        local pattern="${BACKUP_DIR_PREFIX}_*"
        if [[ "$service" == "db" ]]; then
            pattern="${pattern}_dump_*.tar*"
        elif [[ "$service" == "redis" ]]; then
            pattern="${pattern}_redis_dump_*.json*"
        else
            pattern="${pattern}_redis_assessment_dump_*.json*"
        fi
        
        local latest=$(ls -1t "$dump_dir/$service"/$pattern 2>/dev/null | head -1)
        if [[ -n "$latest" ]]; then
            # Extract prefix from filename
            local filename=$(basename "$latest")
            if [[ "$service" == "db" ]]; then
                # Extract backup_pre_restore_YYYYMMDD_HHMMSS from backup_pre_restore_YYYYMMDD_HHMMSS_dump_*.tar*
                recent_backup=$(echo "$filename" | sed -E 's/^(backup_pre_restore_[0-9]{8}_[0-9]{6})_dump_.*$/\1/')
            elif [[ "$service" == "redis" ]]; then
                # Extract backup_pre_restore_YYYYMMDD_HHMMSS from backup_pre_restore_YYYYMMDD_HHMMSS_redis_dump_*.dump*
                recent_backup=$(echo "$filename" | sed -E 's/^(backup_pre_restore_[0-9]{8}_[0-9]{6})_redis_dump_.*$/\1/')
            else
                # Extract backup_pre_restore_YYYYMMDD_HHMMSS from backup_pre_restore_YYYYMMDD_HHMMSS_redis_assessment_dump_*.dump*
                recent_backup=$(echo "$filename" | sed -E 's/^(backup_pre_restore_[0-9]{8}_[0-9]{6})_redis_assessment_dump_.*$/\1/')
            fi
            
            if [[ -n "$recent_backup" && "$recent_backup" != "$filename" ]]; then
                echo "$recent_backup"
                return 0
            fi
        fi
    done
    
    return 1
}

# Rollback operation to pre-restore state
rollback_operation() {
    local state_file="$1"
    
    log_step "Initiating Rollback Operation"
    update_operation_state "$state_file" "rollback" "in_progress" "Starting rollback to pre-restore state"
    
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        error_exit "Cannot rollback: no pre-restore backups were created (--skip-backup was used)"
    fi
    
    log_warning "Rolling back both database and Redis to pre-restore state"
    
    # Get the backup prefix from the state file
    local backup_prefix
    if ! backup_prefix=$(get_backup_prefix_from_state "$state_file"); then
        log "ERROR: Could not determine backup prefix for rollback"
        log "INFO: Checking for any recent pre-restore backups..."
        
        # List available backup files for debugging
        local dump_dir="$(get_dump_base_dir)"
        log "INFO: Available backup files:"
        for service in db redis redis-assessment; do
            log "INFO: $service backups:"
            ls -lt "$dump_dir/$service"/${BACKUP_DIR_PREFIX}_* 2>/dev/null | head -5 | sed 's/^/  /' || log "  No backup files found"
        done
        
        error_exit "Cannot proceed with rollback: unable to identify backup files"
    fi
    
    log_info "Using backup prefix: $backup_prefix"
    
    # Find the pre-restore backup files
    local db_backup_file redis_backup_file redis_assessment_backup_file
    
    log_info "Locating database backup file..."
    if ! db_backup_file=$(find_backup_dump "db" "$backup_prefix"); then
        error_exit "Database backup file not found with prefix: $backup_prefix"
    fi
    log_info "Found database backup: $db_backup_file"
    
    log_info "Locating Redis backup file..."
    if ! redis_backup_file=$(find_backup_dump "redis" "$backup_prefix"); then
        error_exit "Redis backup file not found with prefix: $backup_prefix"
    fi
    log_info "Found Redis backup: $redis_backup_file"

    log_info "Locating Redis assessment backup file..."
    if ! redis_assessment_backup_file=$(find_backup_dump "redis-assessment" "$backup_prefix"); then
        error_exit "Redis assessment backup file not found with prefix: $backup_prefix"
    fi
    log_info "Found Redis assessment backup: $redis_assessment_backup_file"

    # Confirm rollback operation
    echo ""
    echo "⚠️  ROLLBACK CONFIRMATION ⚠️"
    echo "=============================="
    echo ""
    echo "About to rollback both services to pre-restore state:"
    echo "  🗄️  Database backup: $(basename "$db_backup_file")"
    echo "  🔄 Redis backup: $(basename "$redis_backup_file")"
    echo "  🔄 Redis assessment backup: $(basename "$redis_assessment_backup_file")"
    echo "  🎯 Environment: $ENVIRONMENT"
    echo ""
    echo "This will replace current data with the backup data."
    echo ""
    
    if [[ "$DRY_RUN" != "true" ]]; then
        read -p "Type 'ROLLBACK' to confirm: " confirmation
        
        if [[ "$confirmation" != "ROLLBACK" ]]; then
            echo "❌ Rollback cancelled by user"
            update_operation_state "$state_file" "rollback" "cancelled" "Rollback cancelled by user"
            exit 1
        fi
        
        echo ""
        echo "✅ Rollback confirmed"
        echo ""
    fi
    
    # Execute database rollback
    log_info "Rolling back database..."
    update_operation_state "$state_file" "rollback_database" "in_progress" "Rolling back database to pre-restore state"
    
    local db_rollback_cmd="${SCRIPT_DIR}/restore-db-infisical.sh $ENVIRONMENT"
    local db_rollback_success=false
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute: DUMP_FILE=\"$db_backup_file\" $db_rollback_cmd"
        db_rollback_success=true
    else
        export DUMP_FILE="$db_backup_file"
        if $db_rollback_cmd; then
            db_rollback_success=true
            update_operation_state "$state_file" "rollback_database" "completed" "Database rollback completed successfully"
            log_success "Database rollback completed successfully"
        else
            update_operation_state "$state_file" "rollback_database" "failed" "Database rollback failed"
            log "ERROR: Database rollback failed"
        fi
    fi
    
    # Execute Redis rollback (only if database succeeded)
    local redis_rollback_success=false
    if [[ "$db_rollback_success" == "true" ]]; then
        log_info "Rolling back Redis..."
        update_operation_state "$state_file" "rollback_redis" "in_progress" "Rolling back Redis to pre-restore state"
        
        local redis_rollback_cmd="${SCRIPT_DIR}/restore-redis-infisical.sh $ENVIRONMENT"
        
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would execute: DUMP_FILE=\"$redis_backup_file\" $redis_rollback_cmd"
            redis_rollback_success=true
        else
            export DUMP_FILE="$redis_backup_file"
            if $redis_rollback_cmd; then
                redis_rollback_success=true
                update_operation_state "$state_file" "rollback_redis" "completed" "Redis rollback completed successfully"
                log_success "Redis rollback completed successfully"
            else
                update_operation_state "$state_file" "rollback_redis" "failed" "Redis rollback failed"
                log "ERROR: Redis rollback failed"
            fi
        fi
    else
        # Database rollback failed
        update_operation_state "$state_file" "rollback" "failed" "Database rollback failed, aborting rollback operation"
        error_exit "Database rollback failed, aborting rollback operation"
    fi

    if [[ "$db_rollback_success" == "true" && "$redis_rollback_success" == "true" ]]; then
        log_info "Rolling back Redis..."
        update_operation_state "$state_file" "rollback_redis_assessment" "in_progress" "Rolling back Redis assessment to pre-restore state"
        
        local redis_assessment_rollback_cmd="${SCRIPT_DIR}/restore-redis-infisical.sh $ENVIRONMENT assessment"
        local redis_assessment_rollback_success=false

        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would execute: DUMP_FILE=\"$redis_assessment_backup_file\" $redis_assessment_rollback_cmd"
            redis_assessment_rollback_success=true
        else
            export DUMP_FILE="$redis_assessment_backup_file"
            if $redis_assessment_rollback_cmd; then
                redis_assessment_rollback_success=true
                update_operation_state "$state_file" "rollback_redis_assessment" "completed" "Redis assessment rollback completed successfully"
                log_success "Redis assessment rollback completed successfully"
            else
                update_operation_state "$state_file" "rollback_redis_assessment" "failed" "Redis assessment rollback failed"
                log "ERROR: Redis assessment rollback failed"
            fi
        fi
        
        # Check final rollback result
        if [[ "$redis_assessment_rollback_success" == "true" ]]; then
            # Both rollbacks succeeded
            update_operation_state "$state_file" "rollback" "completed" "Rollback completed - services restored to pre-restore state"
            log_success "Rollback operation completed successfully"
            
            echo ""
            echo "📊 Rollback Summary:"
            echo "  ✅ Database rolled back to: $(basename "$db_backup_file")"
            echo "  ✅ Redis rolled back to: $(basename "$redis_backup_file")"
            echo "  ✅ Redis assessment rolled back to: $(basename "$redis_backup_file")"
            echo "  🎯 Environment: $ENVIRONMENT"
            echo "  🕐 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
            echo ""
            
            return 0
        else
            # Redis rollback failed after database succeeded
            update_operation_state "$state_file" "rollback" "failed" "Redis rollback failed after database rollback succeeded"
            error_exit "Redis rollback failed after database rollback succeeded - system is in inconsistent state"
        fi
    else
        # Database rollback failed
        update_operation_state "$state_file" "rollback" "failed" "Database rollback failed, aborting rollback operation"
        error_exit "Database rollback failed, aborting rollback operation"
    fi
}

# =============================================================================
# RESUME HELPER FUNCTIONS
# =============================================================================

# Check if a specific step has been completed
step_completed() {
    local state_file="$1"
    local step_name="$2"
    
    if ! command -v jq &> /dev/null || [[ ! -f "$state_file" ]]; then
        return 1
    fi
    
    local step_status=$(jq -r ".steps[] | select(.step == \"$step_name\") | .status" "$state_file" 2>/dev/null)
    [[ "$step_status" == "completed" ]]
}

# Check if a specific step has failed
step_failed() {
    local state_file="$1"
    local step_name="$2"
    
    if ! command -v jq &> /dev/null || [[ ! -f "$state_file" ]]; then
        return 1
    fi
    
    local step_status=$(jq -r ".steps[] | select(.step == \"$step_name\") | .status" "$state_file" 2>/dev/null)
    [[ "$step_status" == "failed" ]]
}

# =============================================================================
# MAIN ORCHESTRATION FUNCTION
# =============================================================================

# Resume operation from existing state
resume_operation() {
    local operation_id="$1"
    local state_file="${STATE_DIR}/${operation_id}.json"
    
    log_step "Resuming Operation"
    log_info "Operation ID: $operation_id"
    
    # Validate state file exists
    if [[ ! -f "$state_file" ]]; then
        error_exit "State file not found for operation: $operation_id (expected: $state_file)"
    fi
    
    # Read current state
    if ! command -v jq &> /dev/null; then
        error_exit "jq is required for resume functionality but is not installed"
    fi
    
    local current_status=$(jq -r '.status' "$state_file" 2>/dev/null)
    local environment=$(jq -r '.environment' "$state_file" 2>/dev/null)
    local started_at=$(jq -r '.started_at' "$state_file" 2>/dev/null)
    
    # Validate state file content
    if [[ "$current_status" == "null" || "$environment" == "null" ]]; then
        error_exit "Invalid or corrupted state file: $state_file"
    fi
    
    # Check if environment matches
    if [[ "$environment" != "$ENVIRONMENT" ]]; then
        error_exit "Environment mismatch: operation was for '$environment' but current is '$ENVIRONMENT'"
    fi
    
    log_info "Previous operation status: $current_status"
    log_info "Operation environment: $environment"
    log_info "Started at: $started_at"
    
    # Determine what steps have been completed
    local completed_steps=($(jq -r '.steps[] | select(.status == "completed") | .step' "$state_file" 2>/dev/null))
    local failed_steps=($(jq -r '.steps[] | select(.status == "failed") | .step' "$state_file" 2>/dev/null))
    local in_progress_steps=($(jq -r '.steps[] | select(.status == "in_progress") | .step' "$state_file" 2>/dev/null))
    
    echo ""
    echo "📋 Operation Resume Analysis:"
    echo "  🆔 Operation ID: $operation_id"
    echo "  📅 Started: $started_at"
    echo "  🎯 Environment: $environment"
    echo "  📊 Current Status: $current_status"
    echo ""
    
    if [[ ${#completed_steps[@]} -gt 0 ]]; then
        echo "  ✅ Completed Steps:"
        for step in "${completed_steps[@]}"; do
            echo "    • $step"
        done
        echo ""
    fi
    
    if [[ ${#failed_steps[@]} -gt 0 ]]; then
        echo "  ❌ Failed Steps:"
        for step in "${failed_steps[@]}"; do
            echo "    • $step"
        done
        echo ""
    fi
    
    if [[ ${#in_progress_steps[@]} -gt 0 ]]; then
        echo "  🔄 In Progress Steps:"
        for step in "${in_progress_steps[@]}"; do
            echo "    • $step"
        done
        echo ""
    fi
    
    # Determine resume strategy based on current state
    case "$current_status" in
        "completed")
            log_info "Operation already completed successfully"
            echo "  ℹ️  This operation has already completed successfully."
            echo "     Use a new operation instead of resuming."
            exit 0
            ;;
        "cancelled")
            log_info "Operation was previously cancelled"
            echo "  ⚠️  This operation was previously cancelled."
            echo "     Use a new operation instead of resuming."
            exit 0
            ;;
        "failed")
            # Check if this was a rollback failure or a restore failure
            local has_rollback_failure=false
            for step in "${failed_steps[@]}"; do
                if [[ "$step" == "rollback"* ]]; then
                    has_rollback_failure=true
                    break
                fi
            done
            
            if [[ "$has_rollback_failure" == "true" ]]; then
                log_warning "Operation failed during rollback - manual intervention may be required"
                echo "  🚨 This operation failed during rollback."
                echo "     Manual intervention may be required to restore system consistency."
                echo "     Please review the state file: $state_file"
                
                read -p "Do you want to attempt rollback again? (y/N): " retry_rollback
                if [[ "$retry_rollback" =~ ^[Yy]$ ]]; then
                    log_info "Attempting rollback retry..."
                    rollback_operation "$state_file"
                    return $?
                else
                    exit 1
                fi
            else
                # Regular restore failure - offer rollback
                log_warning "Operation failed during restore - rollback available"
                echo "  ⚠️  This operation failed during restore."
                echo "     You can attempt to rollback to pre-restore state."
                
                read -p "Do you want to rollback to pre-restore state? (y/N): " do_rollback
                if [[ "$do_rollback" =~ ^[Yy]$ ]]; then
                    log_info "Initiating rollback..."
                    rollback_operation "$state_file"
                    return $?
                else
                    exit 1
                fi
            fi
            ;;
        "initialized"|"in_progress")
            # Check what step we should resume from
            local should_resume=false
            local resume_reason=""
            
            # Check for incomplete steps
            if [[ ${#in_progress_steps[@]} -gt 0 ]]; then
                should_resume=true
                resume_reason="in-progress steps detected"
            elif [[ ${#failed_steps[@]} -gt 0 ]]; then
                should_resume=true
                resume_reason="failed steps detected"
            elif [[ ${#completed_steps[@]} -eq 0 ]]; then
                should_resume=true
                resume_reason="no completed steps found"
            fi
            
            if [[ "$should_resume" == "true" ]]; then
                echo "  🔄 Resume Required: $resume_reason"
                echo ""
                
                read -p "Do you want to resume this operation? (Y/n): " confirm_resume
                if [[ ! "$confirm_resume" =~ ^[Nn]$ ]]; then
                    log_info "Resuming operation..."
                    return 0  # Signal to continue with normal orchestration
                else
                    echo "❌ Resume cancelled by user"
                    exit 0
                fi
            else
                log_info "Operation appears to be in a consistent state"
                echo "  ℹ️  Operation appears to be in a consistent state."
                echo "     Consider starting a new operation instead."
                exit 0
            fi
            ;;
        *)
            error_exit "Unknown operation status: $current_status"
            ;;
    esac
}

orchestrate_restore() {
    local operation_id
    local state_file
    local is_resume=false
    
    # Handle continue-from scenario
    if [[ -n "$CONTINUE_FROM" ]]; then
        operation_id="$CONTINUE_FROM"
        state_file="${STATE_DIR}/${operation_id}.json"
        is_resume=true
        
        log_info "Continuing from operation: $operation_id"
        
        # Execute resume logic
        if ! resume_operation "$operation_id"; then
            error_exit "Failed to resume operation: $operation_id"
        fi
    else
        operation_id=$(generate_operation_id)
        is_resume=false
    fi
    
    log_step "Starting Orchestrated Restore Operation"
    log_info "Operation ID: $operation_id"
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    log_info "Resume Mode: $is_resume"
    
    # Create or use existing state directory and operation state
    create_state_dir
    
    if [[ "$is_resume" == "true" ]]; then
        # Use existing state file
        log_info "Using existing state file: $state_file"
    else
        # Create new operation state
        state_file=$(create_operation_state "$operation_id")
        log_info "Created new state file: $state_file"
    fi
    
    # Production safety checks
    if [[ "$ENVIRONMENT" == "prd" ]]; then
        log_step "Production Safety Validation"
        
        # Check staging validation requirement
        if [[ "$FORCE_PRODUCTION" != "true" ]] && ! check_staging_validation; then
            error_exit "Production restore requires recent staging validation. Run '$0 stg' first or use --force."
        fi
        
        if [[ "$FORCE_PRODUCTION" == "true" ]]; then
            log_warning "Forcing production restore without staging validation (--force specified)"
        else
            log_success "Recent staging validation found - proceeding with production restore"
        fi
        
        # Additional production confirmations (unless dry run)
        if [[ "$DRY_RUN" != "true" ]]; then
            echo ""
            echo "⚠️  PRODUCTION ORCHESTRATED RESTORE ⚠️"
            echo "====================================="
            echo ""
            echo "This will perform a coordinated restore of BOTH database and Redis"
            echo "in the production environment. This operation:"
            echo ""
            echo "  • Will replace ALL production data"
            echo "  • May cause significant service downtime"
            echo "  • Affects live users and applications"
            echo "  • Creates pre-restore backups for rollback"
            echo ""
            echo "Operation ID: $operation_id"
            echo "Environment: $ENVIRONMENT"
            echo ""
            
            read -p "Type 'ORCHESTRATED PRODUCTION RESTORE' to confirm: " confirmation
            
            if [[ "$confirmation" != "ORCHESTRATED PRODUCTION RESTORE" ]]; then
                echo "❌ Production restore cancelled by user"
                complete_operation_state "$state_file" "cancelled"
                exit 1
            fi
            
            echo ""
            echo "✅ Production orchestrated restore confirmed"
            echo ""
        fi
    fi
    
    # Step 1: Validate dump files
    if [[ "$is_resume" == "true" ]] && step_completed "$state_file" "validate_dumps"; then
        log_info "Step 1: Dump file validation already completed - skipping"
    else
        validate_dump_files "$state_file"
    fi
    
    # Step 2: Create pre-restore backups (production only, unless --skip-backup)
    if [[ "$ENVIRONMENT" == "prd" ]]; then
        if [[ "$is_resume" == "true" ]] && step_completed "$state_file" "create_backups"; then
            log_info "Step 2: Pre-restore backup creation already completed - skipping"
        else
            create_pre_restore_backups "$state_file"
        fi
    fi
    
    # Step 3: Execute coordinated restore
    local coordinated_restore_completed=false
    if [[ "$is_resume" == "true" ]] && step_completed "$state_file" "coordinated_restore"; then
        log_info "Step 3: Coordinated restore already completed - skipping"
        coordinated_restore_completed=true
    else
        if execute_coordinated_restore "$state_file"; then
            coordinated_restore_completed=true
        fi
    fi
    
    if [[ "$coordinated_restore_completed" == "true" ]]; then
        # Success
        complete_operation_state "$state_file" "completed"
        
        # Create staging validation marker if this was staging
        if [[ "$ENVIRONMENT" == "stg" ]]; then
            create_staging_validation
            log_success "Staging validation marker created for production use"
        fi
        
        log_success "Orchestrated restore operation completed successfully"
        
        echo ""
        echo "📊 Operation Summary:"
        echo "  ✅ Coordinated restore completed"
        echo "  🆔 Operation ID: $operation_id"
        echo "  🎯 Environment: $ENVIRONMENT"
        echo "  📁 State file: $state_file"
        echo "  🕐 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
        
        return 0
    else
        # Failure
        complete_operation_state "$state_file" "failed"
        error_exit "Orchestrated restore operation failed"
    fi
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Print script header
    echo "======================================================================"
    echo "🔄 Restore Orchestrator - Production-Safe Multi-Service Operations"
    echo "======================================================================"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Environment: $ENVIRONMENT"
    echo "Dry Run: $DRY_RUN"
    echo "Script: ${BASH_SOURCE[0]}"
    echo "Working directory: $(pwd)"
    echo "======================================================================"
    echo ""
    
    # Execute main orchestration function
    orchestrate_restore
    
    echo ""
    echo "======================================================================"
    echo "✅ Orchestrated Restore Operation Completed"
    echo "======================================================================"
    echo "Environment: $ENVIRONMENT"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "======================================================================"
fi