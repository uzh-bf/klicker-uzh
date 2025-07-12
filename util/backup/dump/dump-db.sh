#!/bin/bash

# Enable strict error handling
set -euo pipefail

echo "========================================"
echo "Starting PostgreSQL Database Dump Process"
echo "========================================"

# Function for logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function for error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Function for cleanup on failure
cleanup() {
    log "Cleaning up sensitive environment variables..."
    unset DATABASE_URL DATABASE_USER DATABASE_PASS DATABASE_HOST DATABASE_NAME PGPASSWORD 2>/dev/null || true
}

# Set up trap for cleanup on script exit
trap cleanup EXIT

echo "\n🔐 Step 1: Loading Environment Variables"
echo "---------------------------------------"

# Run doppler secrets first to ensure we have the environment loaded
log "Downloading Doppler secrets..."
if ! doppler secrets download --no-file --format env --config prd > /tmp/doppler_secrets.env 2>/dev/null; then
    error_exit "Failed to download Doppler secrets. Please check your Doppler configuration and authentication."
fi

# Source the environment variables
if ! source /tmp/doppler_secrets.env; then
    rm -f /tmp/doppler_secrets.env
    error_exit "Failed to load Doppler environment variables"
fi

# Clean up the temporary file
rm -f /tmp/doppler_secrets.env

log "Doppler secrets loaded successfully"

echo "\n🔍 Step 2: Validating Database Connection Variables"
echo "----------------------------------------------------"

# Validate database connection variables
if [[ -n "${DATABASE_URL:-}" ]]; then
  log "Using DATABASE_URL for connection"
  # Remove unsupported query parameters like "schema" and "pgbouncer" that pg_dump doesn't understand
  DB_CONN=$(echo "$DATABASE_URL" | sed 's/[?&]schema=[^&]*//g' | sed 's/[?&]sslmode=[^&]*//g' | sed 's/[?&]pgbouncer=[^&]*//g' | sed 's/?$//')
else
  log "Using individual database variables for connection"
  echo "  🔍 Checking DATABASE_USER..."
  # Validate required individual variables
  if [[ -z "${DATABASE_USER:-}" ]]; then
    error_exit "DATABASE_USER environment variable is not set"
  fi
  echo "  ✅ DATABASE_USER is set"
  
  echo "  🔍 Checking DATABASE_PASS..."
  if [[ -z "${DATABASE_PASS:-}" ]]; then
    error_exit "DATABASE_PASS environment variable is not set"
  fi
  echo "  ✅ DATABASE_PASS is set"
  
  echo "  🔍 Checking DATABASE_HOST..."
  if [[ -z "${DATABASE_HOST:-}" ]]; then
    error_exit "DATABASE_HOST environment variable is not set"
  fi
  echo "  ✅ DATABASE_HOST is set"
  
  echo "  🔍 Checking DATABASE_NAME..."
  if [[ -z "${DATABASE_NAME:-}" ]]; then
    error_exit "DATABASE_NAME environment variable is not set"
  fi
  echo "  ✅ DATABASE_NAME is set"
  
  DB_CONN="postgresql://$DATABASE_USER:$DATABASE_PASS@$DATABASE_HOST:5432/$DATABASE_NAME"
fi

echo "\n🔧 Step 3: Verifying Required Tools"
echo "------------------------------------"
echo "  🔍 Checking for pg_dump command..."

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    error_exit "pg_dump command not found. Please install PostgreSQL client tools."
fi
echo "  ✅ pg_dump is available"

echo "\n💾 Step 4: Preparing Database Dump"
echo "------------------------------------"
echo "  🔍 Setting up authentication..."

# Use PGPASSWORD to avoid password prompt if using individual vars
unset_pgpassword=false
if [[ -z "${DATABASE_URL:-}" && -n "${DATABASE_PASS:-}" ]]; then
  export PGPASSWORD="$DATABASE_PASS"
  unset_pgpassword=true
  echo "  ✅ Password authentication configured"
else
  echo "  ✅ Using DATABASE_URL for authentication"
fi

echo "  📅 Generating timestamp for dump file..."
# Generate timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="dump_${TIMESTAMP}.tar"
echo "  💾 Dump file will be: $DUMP_FILE"

echo "\n🚀 Step 5: Executing Database Dump"
echo "------------------------------------"
log "Creating database dump: $DUMP_FILE"

# Run pg_dump with error handling
echo "  📊 Starting pg_dump process (this may take a while)..."
if ! pg_dump --dbname="$DB_CONN" --format=t --file="$DUMP_FILE" --no-owner --verbose; then
    error_exit "Database dump failed"
fi

echo "\n✅ Step 6: Dump Process Completed Successfully"
echo "----------------------------------------------"
log "Database dump completed successfully: $DUMP_FILE"

echo "\n🧹 Step 7: Cleanup and Finalization"
echo "-------------------------------------"
echo "  🔍 Cleaning up temporary credentials..."

# Clean up PGPASSWORD if it was set
if [[ "$unset_pgpassword" == true ]]; then
  unset PGPASSWORD
  echo "  ✅ PGPASSWORD cleaned up"
fi

# Source the verification utility
source "$(dirname "$0")/../lib/_verify-dump-file.sh"

# Verify the dump file with minimum size of 1KB for database dumps
if ! verify_dump_file "$DUMP_FILE" 1024; then
  error_exit "Database dump file verification failed"
fi

echo "\n🎉 DATABASE DUMP COMPLETED SUCCESSFULLY!"
echo "================================================"
echo "Dump file: $DUMP_FILE"
echo "Location: $(pwd)/$DUMP_FILE"
echo "Generated: $(date)"
echo "================================================"
