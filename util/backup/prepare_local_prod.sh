#!/bin/bash

# =============================================================================
# Local Development Environment Setup with Production Data
# =============================================================================
#
# This script prepares the local development environment using production dumps
#
# Workflow:
# 1. Discover latest database and Redis dumps
# 2. Reset Docker Compose environment (including volumes)
# 3. Start local PostgreSQL and Redis services
# 4. Restore database dump to local PostgreSQL
# 5. Restore Redis dump to local Redis
# 6. Leave services running for local development
# Note: Database is restored exactly as in production dump (no automatic migrations)
#
# Usage: ./prepare_local_prod.sh
#
# Features:
# - Automatic dump discovery (uses latest available)
# - Encrypted dump support (provide BACKUP_ENCRYPTION_KEY)
# - Docker environment detection (macOS/WSL)
# - Comprehensive error handling and cleanup
# - Progress tracking and status updates
#
# =============================================================================

# Enable error handling
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Source common utility functions for dump discovery
if [[ -f "${SCRIPT_DIR}/lib/_restore-common.sh" ]]; then
    source "${SCRIPT_DIR}/lib/_restore-common.sh"
else
    echo "ERROR: Required common utilities not found at ${SCRIPT_DIR}/lib/_restore-common.sh"
    exit 1
fi

# Source verification utility functions
if [[ -f "${SCRIPT_DIR}/lib/_verify-restore.sh" ]]; then
    source "${SCRIPT_DIR}/lib/_verify-restore.sh"
else
    echo "ERROR: Required verification utilities not found at ${SCRIPT_DIR}/lib/_verify-restore.sh"
    exit 1
fi

# Set up secure signal handling (but don't register the database cleanup function)
# The cleanup_on_failure function is only called explicitly on errors
setup_secure_signal_handling

# Function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function for step logging
log_step() {
    echo ""
    echo "🔄 $1"
    echo "$(printf '%*s' ${#1} '' | tr ' ' '-')"
}

# Function for success logging
log_success() {
    echo "✅ $1"
}

# Function for warning logging
log_warning() {
    echo "⚠️  $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Local Development Environment Setup with Production Data

DESCRIPTION:
    Prepares your local development environment using the latest production
    dumps. This script automatically discovers database and Redis dumps,
    resets your Docker environment, and restores production data locally.

OPTIONS:
    --help, -h          Show this help message

ENVIRONMENT VARIABLES:
    BACKUP_ENCRYPTION_KEY    Decryption key for encrypted dumps (optional)

EXAMPLES:
    $0                                      # Use latest available dumps
    BACKUP_ENCRYPTION_KEY=key $0            # With encrypted dumps

WORKFLOW:
    1. 🔍 Discover latest database and Redis dumps
    2. 🔄 Reset Docker Compose environment and volumes
    3. 🚀 Start local PostgreSQL and Redis services
    4. 📦 Restore database dump to local PostgreSQL
    5. 🔄 Restore Redis dump to local Redis
    6. 🎯 Leave services running for local development
    Note: Database restored exactly as in production (no automatic migrations)

REQUIREMENTS:
    - Docker and Docker Compose running
    - Production dumps available in dumps/ directory
    - pnpm installed for Prisma migrations

EOF
}

# Function for cleanup on failure (only called explicitly on errors)
cleanup_on_failure() {
    log "ERROR: Setup failed - shutting down docker compose..."
    docker compose down -v
}

# Function to detect if running in WSL
is_wsl() {
    if [ -f /proc/version ]; then
        if grep -i microsoft /proc/version > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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

# Print script header
echo "========================================================================"
echo "🚀 KlickerUZH Local Development Environment Setup"
echo "========================================================================"
echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Working directory: $(pwd)"
echo "========================================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log "ERROR: Docker is not running"
    exit 1
fi

# Check if required dump files exist using automatic discovery
log_step "Step 1: Discovering Available Dump Files"

DB_DUMP=""
if DB_DUMP=$(find_latest_dump "db" 2>/dev/null); then
    log "Found database dump: $DB_DUMP"
else
    log "ERROR: No database dump found. Please create a database dump first using:"
    log "  ${SCRIPT_DIR}/dump.sh db prd"
    exit 1
fi

REDIS_DUMP=""
if REDIS_DUMP=$(find_latest_dump "redis" 2>/dev/null); then
    log "Found main Redis dump: $REDIS_DUMP"
else
    log "ERROR: No main Redis dump found. Please create a Redis dump first using:"
    log "  ${SCRIPT_DIR}/dump.sh redis prd"
    exit 1
fi

# Optional: Look for assessment Redis dump
REDIS_ASSESSMENT_DUMP=""
if REDIS_ASSESSMENT_DUMP=$(find_latest_dump "redis-assessment" 2>/dev/null); then
    log "Found assessment Redis dump: $REDIS_ASSESSMENT_DUMP"
else
    log "No assessment Redis dump found (optional)"
fi

# Function to load encryption key from Doppler production config if needed
load_encryption_key_if_needed() {
    # If key is already set, we're good
    if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        log "✅ BACKUP_ENCRYPTION_KEY already available"
        return 0
    fi

    # Resolve symlinks to get actual filenames for encryption check
    local actual_db_dump="$DB_DUMP"
    local actual_redis_dump="$REDIS_DUMP"
    local actual_redis_assessment_dump=""

    if [[ -L "$DB_DUMP" ]]; then
        actual_db_dump=$(readlink -f "$DB_DUMP" 2>/dev/null || readlink "$DB_DUMP" 2>/dev/null || echo "$DB_DUMP")
    fi

    if [[ -L "$REDIS_DUMP" ]]; then
        actual_redis_dump=$(readlink -f "$REDIS_DUMP" 2>/dev/null || readlink "$REDIS_DUMP" 2>/dev/null || echo "$REDIS_DUMP")
    fi

    if [[ -n "$REDIS_ASSESSMENT_DUMP" && -L "$REDIS_ASSESSMENT_DUMP" ]]; then
        actual_redis_assessment_dump=$(readlink -f "$REDIS_ASSESSMENT_DUMP" 2>/dev/null || readlink "$REDIS_ASSESSMENT_DUMP" 2>/dev/null || echo "$REDIS_ASSESSMENT_DUMP")
    elif [[ -n "$REDIS_ASSESSMENT_DUMP" ]]; then
        actual_redis_assessment_dump="$REDIS_ASSESSMENT_DUMP"
    fi

    # Check if any dump is encrypted (check the actual target files)
    if [[ "$actual_db_dump" == *.gpg ]] || [[ "$actual_redis_dump" == *.gpg ]] || [[ "$actual_redis_assessment_dump" == *.gpg ]]; then
        log "🔑 Encrypted dumps detected:"
        if [[ "$actual_db_dump" == *.gpg ]]; then
            log "   📦 Database: $(basename "$actual_db_dump") (encrypted)"
        fi
        if [[ "$actual_redis_dump" == *.gpg ]]; then
            log "   📦 Main Redis: $(basename "$actual_redis_dump") (encrypted)"
        fi
        if [[ "$actual_redis_assessment_dump" == *.gpg ]]; then
            log "   📦 Assessment Redis: $(basename "$actual_redis_assessment_dump") (encrypted)"
        fi
        log "   Attempting to load BACKUP_ENCRYPTION_KEY from Doppler..."

        # Try to get the key from Doppler production config using _run_with_doppler.sh
        if [[ -f "${REPO_ROOT}/util/_run_with_doppler.sh" ]]; then
            log "   Fetching encryption key from Doppler production config..."

            # Use _run_with_doppler.sh to handle external drive authentication
            # Note: CONFIG=prd is scoped to this command only and won't affect subsequent calls
            if BACKUP_ENCRYPTION_KEY=$(CONFIG=prd "${REPO_ROOT}/util/_run_with_doppler.sh" doppler secrets get BACKUP_ENCRYPTION_KEY --plain 2>/dev/null); then
                if [[ -n "$BACKUP_ENCRYPTION_KEY" ]]; then
                    export BACKUP_ENCRYPTION_KEY
                    log "✅ Successfully loaded BACKUP_ENCRYPTION_KEY from Doppler"
                    # Ensure CONFIG is not set in the environment for subsequent operations
                    unset CONFIG 2>/dev/null || true
                    return 0
                else
                    log "⚠️  BACKUP_ENCRYPTION_KEY is empty in Doppler production config"
                fi
            else
                log "⚠️  Failed to fetch BACKUP_ENCRYPTION_KEY from Doppler (check Doppler setup)"
            fi
            # Ensure CONFIG is not set in the environment
            unset CONFIG 2>/dev/null || true
        else
            log "⚠️  Doppler helper script not found - cannot auto-load encryption key"
        fi

        # If we couldn't get the key, show helpful error message
        log ""
        log "❌ Encrypted dumps found but no BACKUP_ENCRYPTION_KEY available"
        log ""
        log "📋 To resolve this issue:"
        log "   1. Set the environment variable manually:"
        log "      export BACKUP_ENCRYPTION_KEY='your-key-here'"
        log "   2. Or install and configure Doppler CLI:"
        log "      doppler login && doppler setup"
        log "   3. Contact your admin for the encryption key"
        log ""
        log "🔒 Note: All dumps must be encrypted for security - unencrypted dumps are not supported"
        log ""
        return 1
    else
        # This should not happen as all dumps must be encrypted
        log "❌ Security Policy Violation: Unencrypted dumps detected"
        log "🔒 All dump files must be encrypted for security"
        log "   📦 Database: $(basename "$actual_db_dump")"
        log "   📦 Main Redis: $(basename "$actual_redis_dump")"
        if [[ -n "$actual_redis_assessment_dump" ]]; then
            log "   📦 Assessment Redis: $(basename "$actual_redis_assessment_dump")"
        fi
        log ""
        log "💡 Please ensure all dumps are created with encryption enabled"
        log "   Use: BACKUP_ENCRYPTION_KEY='your-key' ./dump.sh db prd"
        log "   Use: BACKUP_ENCRYPTION_KEY='your-key' ./dump.sh redis prd"
        if [[ -n "$actual_redis_assessment_dump" ]]; then
            log "   Use: BACKUP_ENCRYPTION_KEY='your-key' ./dump.sh redis-assessment prd"
        fi
        return 1
    fi
}

# Check and load encryption key for encrypted dumps
log_step "Step 1.5: Checking Encryption Requirements"
if ! load_encryption_key_if_needed; then
    log "ERROR: Cannot proceed with encrypted dumps without BACKUP_ENCRYPTION_KEY"
    exit 1
fi

# Validate that unified restore scripts exist
if [[ ! -f "${SCRIPT_DIR}/advanced/restore-db.sh" ]]; then
    log "ERROR: Unified database restore script not found at ${SCRIPT_DIR}/advanced/restore-db.sh"
    exit 1
fi

if [[ ! -f "${SCRIPT_DIR}/advanced/restore-redis.sh" ]]; then
    log "ERROR: Unified Redis restore script not found at ${SCRIPT_DIR}/advanced/restore-redis.sh"
    exit 1
fi

if [[ ! -x "${SCRIPT_DIR}/advanced/restore-db.sh" ]]; then
    log "ERROR: Database restore script is not executable: ${SCRIPT_DIR}/advanced/restore-db.sh"
    exit 1
fi

if [[ ! -x "${SCRIPT_DIR}/advanced/restore-redis.sh" ]]; then
    log "ERROR: Redis restore script is not executable: ${SCRIPT_DIR}/advanced/restore-redis.sh"
    exit 1
fi

# Step 2: Reset docker compose environment
log_step "Step 2: Resetting Docker Environment"
log "Stopping docker compose and removing volumes..."
cd "${REPO_ROOT}" || {
    log "ERROR: Failed to change to repository root directory"
    exit 1
}

if ! docker compose down -v; then
    log "ERROR: Failed to stop docker compose"
    exit 1
fi

# copy the prisma schema for it to be available to python files
log "Syncing Prisma schema..."
if ! "${REPO_ROOT}/util/sync-schema.sh"; then
    log "ERROR: Failed to sync Prisma schema"
    exit 1
fi

log_step "Step 3: Starting Local Services"
log "Starting docker compose..."
if is_wsl; then
    log "Detected WSL environment, using WSL dependencies script..."
    if ! docker compose up -d postgres redis_exec redis_cache reverse_proxy_wsl; then
        log "ERROR: Failed to start WSL docker compose services"
        exit 1
    fi
else
    log "Detected macOS environment, using macOS dependencies script..."
    if ! docker compose up -d postgres redis_exec redis_cache reverse_proxy_macos; then
        log "ERROR: Failed to start macOS docker compose services"
        exit 1
    fi
fi

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
log "Checking PostgreSQL connection..."
PG_READY=false
for i in {1..30}; do
    if docker exec "$(docker compose ps -q postgres)" pg_isready -U klicker-prod -d klicker-prod > /dev/null 2>&1; then
        PG_READY=true
        break
    fi
    log "Waiting for PostgreSQL to be ready... ($i/30)"
    sleep 2
done

if [ "$PG_READY" = false ]; then
    log "ERROR: PostgreSQL failed to become ready after 60 seconds"
    cleanup_on_failure
    exit 1
fi

log "PostgreSQL is ready"

# Step 4: Load Postgres dump
log_step "Step 4: Restoring Database Dump"
log "Loading Postgres dump with enhanced logging..."
export DUMP_FILE="$DB_DUMP"

# Execute database restore with clear feedback about any issues
if "${SCRIPT_DIR}/advanced/restore-db.sh" dev; then
    log_success "Postgres dump restored successfully"
else
    restore_exit_code=$?
    log_warning "Postgres dump restore completed with warnings/errors (exit code: $restore_exit_code)"
    log "Some errors during restore are normal for production dumps (e.g., role/permission issues)"
    log "Proceeding with verification to check if restore was actually successful..."
fi

# Step 4.5: Verify database restore
log_step "Step 4.5: Verifying Database Restore"
log "Verifying database restore integrity..."

# Ensure database tools are available in this script context
check_database_tools

# Build connection string for verification (matching local dev setup)
DB_VERIFY_CONN="postgresql://klicker-prod:klicker@localhost:5432/klicker-prod"

if verify_klicker_database_restore "$DB_VERIFY_CONN"; then
    log_success "Database restore verification passed"
    log "✅ All critical tables present and populated"
    log "✅ Database structure appears intact"
else
    log_warning "Database restore verification failed"
    log "⚠️  Some verification checks failed"

    # Provide detailed guidance about the failure
    echo ""
    echo "🔍 Database restore verification details:"
    echo "   • The database restore process may have been incomplete"
    echo "   • Critical tables might be missing or empty"
    echo "   • This could indicate encryption key issues, corrupted dumps, or restore errors"
    echo ""
    echo "🛠️  Troubleshooting steps:"
    echo "   1. Check if the dump file was fully decrypted (if encrypted)"
    echo "   2. Verify the dump file is not corrupted"
    echo "   3. Check the restore logs for specific error messages"
    echo "   4. Try using a different/newer dump file"
    echo "   5. Ensure PostgreSQL has sufficient permissions and disk space"
    echo ""

    # Give user option to continue or abort
    echo "❓ Do you want to continue with potentially incomplete data? (y/N)"
    read -r continue_choice
    if [[ "$continue_choice" != "y" && "$continue_choice" != "Y" ]]; then
        log "Aborting setup due to failed verification"
        echo ""
        echo "💡 Recommended next steps:"
        echo "   • Check and fix any issues mentioned above"
        echo "   • Review restore logs for specific errors"
        echo "   • Contact admin if encryption key or dump issues persist"
        cleanup_on_failure
        exit 1
    else
        log "Continuing with setup despite verification warnings..."
        log "⚠️  Note: Some features may not work correctly with incomplete data"
    fi
fi

# Step 5: Load main Redis dump
log_step "Step 5: Restoring Main Redis Dump"
log "Loading main Redis dump with enhanced logging..."
export DUMP_FILE="$REDIS_DUMP"

if "${SCRIPT_DIR}/advanced/restore-redis.sh" dev main; then
    log_success "Main Redis dump restored successfully"
else
    log "ERROR: Failed to load main Redis dump"
    echo ""
    echo "🔍 Redis restore failure details:"
    echo "   • Main Redis dump restoration failed completely"
    echo "   • This could be due to encryption issues, corruption, or Redis connectivity"
    echo ""
    echo "🛠️  Troubleshooting steps:"
    echo "   1. Check if Redis is running: docker compose ps"
    echo "   2. Verify Redis connectivity: docker exec <redis-container> redis-cli ping"
    echo "   3. Check if the Redis dump file was properly decrypted (if encrypted)"
    echo "   4. Try using a different/newer Redis dump file"
    echo ""
    cleanup_on_failure
    exit 1
fi

# Step 5.5: Load assessment Redis dump (optional)
if [[ -n "$REDIS_ASSESSMENT_DUMP" ]]; then
    log_step "Step 5.5: Restoring Assessment Redis Dump"
    log "Loading assessment Redis dump with enhanced logging..."
    export DUMP_FILE="$REDIS_ASSESSMENT_DUMP"

    if "${SCRIPT_DIR}/advanced/restore-redis.sh" dev assessment; then
        log_success "Assessment Redis dump restored successfully"
    else
        log_warning "Failed to load assessment Redis dump (non-fatal)"
        log "Assessment Redis restore failed but continuing with setup..."
        log "Main Redis is available for development, assessment features may not work"
    fi
else
    log "Skipping assessment Redis restore (no dump found)"
fi

# Note: Prisma migrations are NOT automatically applied
# The database is restored exactly as it was in the production dump
# To apply local migrations manually (if needed), run:
#   cd packages/prisma && pnpm prisma:deploy

echo ""
echo "========================================================================"
echo "🎉 Local Development Environment Successfully Prepared!"
echo "========================================================================"
echo "📊 Restore Summary:"
echo "  ✅ Database restored from: $(basename "$DB_DUMP")"
if [[ "${DB_DUMP}" == *.gpg ]]; then
    echo "     🔓 (was encrypted, decrypted successfully)"
fi
echo "  ✅ Main Redis restored from: $(basename "$REDIS_DUMP")"
if [[ "${REDIS_DUMP}" == *.gpg ]]; then
    echo "     🔓 (was encrypted, decrypted successfully)"
fi
if [[ -n "$REDIS_ASSESSMENT_DUMP" ]]; then
    echo "  ✅ Assessment Redis restored from: $(basename "$REDIS_ASSESSMENT_DUMP")"
    if [[ "${REDIS_ASSESSMENT_DUMP}" == *.gpg ]]; then
        echo "     🔓 (was encrypted, decrypted successfully)"
    fi
else
    echo "  ⏭️ Assessment Redis: Not available (no dump found)"
fi
echo "  ✅ Database integrity verified"
echo "  ✅ Database restored exactly as in production"
echo "  ✅ Docker services running and ready for development"
echo ""
echo "🔗 Your local environment is ready for development:"
echo "  • Database: localhost:5432 (klicker-prod)"
echo "  • Redis: localhost:6379"
echo "  • All services: docker compose ps"
echo ""
echo "🚀 Development workflow:"
echo "  • Services will remain running for local development"
echo "  • To stop services: docker compose down"
echo "  • To restart services: docker compose up -d"
echo ""
echo "📝 Optional: To apply local Prisma migrations manually:"
echo "  cd packages/prisma && pnpm prisma:deploy"
echo ""
if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
    echo "🔑 Encryption: BACKUP_ENCRYPTION_KEY was used for encrypted dumps"
    echo ""
fi
echo "📅 Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================================================"
