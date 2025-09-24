#!/bin/bash

# =============================================================================
# Automated Backup Wrapper Script
# =============================================================================
#
# This script is designed for scheduled execution on dedicated backup VMs.
# It performs both database and Redis dumps with proper error handling,
# logging, and optional monitoring notifications.
#
# Usage: ./backup-automated.sh [environment]
#
# Arguments:
#   environment    Target environment (dev|stg|prd). Defaults to 'prd'
#
# Environment Variables:
# - BACKUP_VOLUME_PATH: Path to backup volume (default: /mnt/backup)
# - BACKUP_ENCRYPTION_KEY: GPG passphrase for encryption
# - BACKUP_RETENTION_DAYS: Days to keep old dumps (default: 7)
# - MONITORING_WEBHOOK: URL to ping on completion
# - AUTOMATED_BACKUP: Set to 'true' to enable automated mode features
#
# =============================================================================

# Enable strict error handling
set -euo pipefail

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# =============================================================================
# LOGGING SETUP
# =============================================================================

# Function for logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function for error handling
error_exit() {
    log "ERROR: $1"
    
    # Send failure notification if webhook is configured
    if [[ -n "${MONITORING_WEBHOOK_FAILURE:-}" ]]; then
        curl -fs -X POST "$MONITORING_WEBHOOK_FAILURE" \
            -d "message=Backup failed: $1" \
            -d "timestamp=$(date -Iseconds)" || true
    fi
    
    exit 1
}

# Function for success logging
log_success() {
    log "SUCCESS: $1"
}

# =============================================================================
# PARAMETER VALIDATION
# =============================================================================

# Get environment parameter (default to 'prd' for backward compatibility)
ENVIRONMENT="${1:-prd}"

# Validate environment parameter
case "$ENVIRONMENT" in
    "dev"|"stg"|"prd")
        log "Target environment: $ENVIRONMENT"
        ;;
    *)
        error_exit "Invalid environment '$ENVIRONMENT'. Valid environments: dev, stg, prd"
        ;;
esac

# =============================================================================
# CONFIGURATION
# =============================================================================

# Mark as automated execution
export AUTOMATED_BACKUP=true

# Set default values for automated backup
export BACKUP_UPDATE_LATEST="${BACKUP_UPDATE_LATEST:-true}"
export BACKUP_CLEANUP_ENABLED="${BACKUP_CLEANUP_ENABLED:-true}"
export BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

log "Starting automated backup process"
log "Script directory: $SCRIPT_DIR"
log "Automated mode: $AUTOMATED_BACKUP"
log "Backup volume path: ${BACKUP_VOLUME_PATH:-/mnt/backup}"
log "Retention days: $BACKUP_RETENTION_DAYS"

# Note: Environment loading is handled by individual dump scripts via _run_with_doppler.sh
log "Environment configuration will be loaded by individual dump scripts"
log "Using environment: $ENVIRONMENT"

# Validate backup volume if specified
if [[ -n "${BACKUP_VOLUME_PATH:-}" ]]; then
    if [[ ! -d "$BACKUP_VOLUME_PATH" ]]; then
        error_exit "Backup volume not found: $BACKUP_VOLUME_PATH"
    fi
    
    if [[ ! -w "$BACKUP_VOLUME_PATH" ]]; then
        error_exit "Backup volume not writable: $BACKUP_VOLUME_PATH"
    fi
    
    log_success "Backup volume validated: $BACKUP_VOLUME_PATH"
fi

# =============================================================================
# BACKUP EXECUTION
# =============================================================================

log "Starting database dump..."
start_time=$(date +%s)

# Execute database dump with environment parameter
if ! "$SCRIPT_DIR/dump-db-infisical.sh" "$ENVIRONMENT"; then
    error_exit "Database dump failed"
fi

log_success "Database dump completed"

log "Starting main Redis dump..."

# Execute main Redis dump with environment parameter
if ! "$SCRIPT_DIR/dump-redis-infisical.sh" "$ENVIRONMENT" "main"; then
    error_exit "Main Redis dump failed"
fi

log_success "Main Redis dump completed"

log "Starting assessment Redis dump..."
    
# Execute assessment Redis dump with environment parameter
if ! "$SCRIPT_DIR/dump-redis-infisical.sh" "$ENVIRONMENT" "assessment"; then
    error_exit "Assessment Redis dump failed"
fi

log_success "Assessment Redis dump completed"

# Calculate total execution time
end_time=$(date +%s)
duration=$((end_time - start_time))

log_success "All backups completed successfully in ${duration} seconds"

# =============================================================================
# MONITORING NOTIFICATION
# =============================================================================

# Send success notification if webhook is configured
if [[ -n "${MONITORING_WEBHOOK:-}" ]]; then
    log "Sending monitoring notification..."
    
    # Prepare notification data
    notification_data=$(cat <<EOF
{
    "status": "success",
    "timestamp": "$(date -Iseconds)",
    "duration_seconds": $duration,
    "backup_volume": "${BACKUP_VOLUME_PATH:-local}",
    "encryption_enabled": $(if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then echo "true"; else echo "false"; fi)
}
EOF
    )
    
    if curl -fs -X POST "$MONITORING_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "$notification_data"; then
        log_success "Monitoring notification sent"
    else
        log "Warning: Failed to send monitoring notification (non-fatal)"
    fi
fi

# =============================================================================
# COMPLETION
# =============================================================================

log "Automated backup process completed successfully"
log "Database and Redis dumps created with timestamp: $(date '+%Y%m%d_%H%M%S')"
log "Both main and assessment Redis instances backed up"


if [[ -n "${BACKUP_VOLUME_PATH:-}" ]]; then
    log "Backup files stored in: $BACKUP_VOLUME_PATH"
else
    log "Backup files stored in: $(dirname "$SCRIPT_DIR")/dumps"
fi

exit 0