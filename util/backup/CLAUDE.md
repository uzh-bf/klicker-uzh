# util/backup/CLAUDE.md

This file provides guidance to Claude Code when working with the KlickerUZH backup and restore system. This system provides production-ready, secure backup and restore capabilities for PostgreSQL databases and Redis data across all environments.

## System Overview

The backup/restore system is a comprehensive, production-ready solution that handles database and Redis operations with enterprise-grade security and safety features. It was designed to support local development workflows while maintaining strict security standards suitable for production environments.

### Architecture

The system follows a modular architecture with clear separation of concerns:

```
util/backup/
├── prepare_local_prod.sh   # Complete local development setup
├── dump.sh                 # Main dump interface (unified wrapper)
├── restore.sh              # Main restore interface (unified wrapper)
├── advanced/               # Advanced and internal scripts
│   ├── dump-db.sh          # PostgreSQL dumps (called by dump.sh)
│   ├── dump-redis.sh       # Redis dumps (called by dump.sh)
│   ├── restore-db.sh       # PostgreSQL restore (called by restore.sh)
│   ├── restore-redis.sh    # Redis restore (called by restore.sh)
│   ├── restore-orchestrator.sh # Production-safe multi-service operations
│   └── backup-automated.sh # Automated backup orchestration
├── lib/                    # Shared utilities and libraries
│   ├── _restore-common.sh  # Core utility functions
│   ├── _verify-dump-file.sh # Dump file validation
│   └── _verify-restore.sh  # Restore verification and integrity checks
└── dumps/                  # Local dump storage
    ├── db/                 # Database dumps with latest symlinks
    └── redis/              # Redis dumps with latest symlinks
```

### Key Design Principles

1. **Security First**: All dumps must be encrypted; unencrypted dumps are rejected
2. **Environment Consistency**: Single scripts support dev/stg/prd via parameters
3. **Production Safety**: Multi-layer confirmations and staging validation requirements
4. **Developer Experience**: One-command local setup with production data
5. **Operational Excellence**: Comprehensive logging, monitoring, and error handling

## Security Features

### Mandatory Encryption

- **Policy**: All dump files MUST be encrypted using GPG AES256 cipher
- **Implementation**: Scripts automatically reject unencrypted dumps
- **Key Management**: Encryption keys stored securely in Doppler secrets
- **Validation**: Automatic encryption detection and transparent decryption

### Secure Temporary File Management

- **Registry System**: All temporary files tracked in persistent registry
- **Secure Permissions**: Temporary files created with 600 permissions
- **Cleanup Chain**: Comprehensive cleanup on any script termination
- **Emergency Cleanup**: Proactive cleanup of leftover files from previous runs

### Signal Handling

- **Trap Chaining**: Multiple cleanup functions executed in reverse order
- **Signal Coverage**: Handles SIGINT, SIGTERM, SIGHUP, and EXIT
- **Emergency Response**: Secure deletion with data overwriting
- **Verification**: Post-cleanup verification ensures no sensitive data remains

## Core Components

### Main Interface Scripts

#### dump.sh

**Purpose**: Unified dump interface providing consistent command pattern for all backup operations

**Key Features**:

- Single command for both database and Redis backups
- Support for individual service dumps (db, redis) or combined (both)
- Unified parameter validation and error handling
- Environment support: dev/stg/prd with Doppler integration
- Delegates to appropriate service-specific scripts in advanced/

**Usage**:

```bash
./dump.sh both prd    # Backup both database and Redis (recommended)
./dump.sh db prd      # Production database dump
./dump.sh redis stg   # Staging Redis dump
```

#### restore.sh

**Purpose**: Unified restore interface providing consistent command pattern for all restore operations

**Key Features**:

- Single command pattern for both database and Redis restores
- Environment support: dev/stg (production blocked for safety)
- Parameter validation and safety checks
- Delegates to appropriate service-specific scripts in advanced/

**Usage**:

```bash
./restore.sh db dev    # Restore database to development
./restore.sh redis dev # Restore Redis to development
./restore.sh db stg    # Restore to staging
```

### Advanced/Internal Scripts

#### advanced/dump-db.sh

**Purpose**: Creates encrypted PostgreSQL database dumps for any environment

**Key Features**:

- Unified script supporting dev/stg/prd environments
- Automatic Doppler secrets loading
- Mandatory encryption with security policy enforcement
- Intelligent dump management with latest symlinks
- Comprehensive error handling and validation

**Usage**:

```bash
./dump-db.sh prd    # Production dump
./dump-db.sh stg    # Staging dump
./dump-db.sh dev    # Development dump
```

### advanced/dump-redis.sh

**Purpose**: Creates encrypted Redis data dumps using upstash-redis-dump

**Key Features**:

- Multi-database support with selective dumping
- Parallel worker configuration for performance
- Key filtering patterns for targeted dumps
- TTL preservation for cache consistency
- Silent mode for automated operations

**Configuration**:

```bash
REDIS_DUMP_WORKERS=20           # Parallel workers
REDIS_DUMP_DATABASE=1           # Specific database
REDIS_DUMP_FILTER="user:*"      # Key pattern
REDIS_DUMP_SILENT=true          # Silent mode
```

### advanced/restore-db.sh

**Purpose**: Unified PostgreSQL database restore with environment-specific configuration

**Key Features**:

- Production safety checks with explicit confirmations
- Automatic encrypted dump decryption
- Connection testing with retry logic
- Post-restore verification and integrity checks
- KlickerUZH-specific table validation

**Safety Measures**:

- Production restores require "RESTORE PRODUCTION" confirmation
- Staging validation required before production operations
- Pre-restore connectivity testing
- Comprehensive error reporting with actionable guidance

### advanced/restore-redis.sh

**Purpose**: Unified Redis data restore with transparent encryption handling

**Key Features**:

- Automatic connection string building from Doppler secrets
- Encrypted dump handling with transparent decryption
- Connection validation with retry mechanisms
- Error handling with detailed troubleshooting guidance

### lib/\_restore-common.sh

**Purpose**: Core utility library providing shared functionality across all scripts

**Key Functions**:

- `setup_secure_signal_handling()`: Configures comprehensive signal traps
- `decrypt_dump_if_needed()`: Handles encrypted dump decryption
- `find_latest_dump()`: Intelligent dump discovery with fallbacks
- `create_secure_temp_file()`: Creates tracked temporary files
- `cleanup_secure_temp_files()`: Secure deletion with overwriting
- `build_pg_connection_string()`: PostgreSQL connection handling
- `build_redis_connection_string()`: Redis connection handling

### lib/\_verify-restore.sh

**Purpose**: Comprehensive verification and integrity checking utilities

**Key Functions**:

- `verify_klicker_database_restore()`: KlickerUZH-specific database validation
- `verify_klicker_critical_tables()`: Critical table existence and population checks
- `get_table_row_count()`: PostgreSQL table row counting with case sensitivity handling
- `test_pg_connection_with_retry()`: Database connectivity with retry logic
- `check_prisma_migration_status()`: Migration state verification

**Critical Tables Verified**:

- User, Element, Course, Participant
- LiveQuiz, PracticeQuiz, MicroLearning
- ElementInstance, QuestionResponse
- \_prisma_migrations

### prepare_local_prod.sh

**Purpose**: Complete local development environment setup with production data

**Workflow**:

1. **Discovery**: Automatically finds latest database and Redis dumps
2. **Reset**: Stops Docker Compose and removes volumes
3. **Start**: Launches PostgreSQL and Redis services
4. **Restore**: Loads both dumps with verification
5. **Preserve**: Maintains exact production state (no automatic migrations)
6. **Verify**: Comprehensive integrity checks

**Key Improvements** (from recent work):

- Fixed PostgreSQL case sensitivity in table verification
- Enhanced error handling for non-critical verification failures
- Removed automatic Prisma migrations to preserve exact production state
- Fixed database destruction issue - services remain running for development
- Improved cleanup of leftover temporary files from previous runs

## Environment Handling

### Development (dev)

- **Configuration**: Local hardcoded settings
- **Database**: localhost:5432, klicker/klicker credentials
- **Safety**: Minimal restrictions, designed for rapid iteration
- **Use Case**: Local development with production data

### Staging (stg)

- **Configuration**: Doppler secrets management
- **Purpose**: Production validation and testing
- **Requirements**: Required validation step before production operations
- **Use Case**: Final testing before production deployment

### Production (prd)

- **Configuration**: Doppler secrets with enhanced security
- **Restrictions**: Restore operations blocked for safety
- **Requirements**: Must use restore-orchestrator.sh with staging validation
- **Confirmations**: Multiple explicit confirmations required

## Common Tasks

### Setting Up Local Development

```bash
# Complete one-command setup
cd util/backup
./prepare_local_prod.sh

# With specific encryption key
BACKUP_ENCRYPTION_KEY='your-key' ./prepare_local_prod.sh
```

### Creating Production Dumps

```bash
cd util/backup
./dump.sh both prd      # Creates both encrypted dumps (recommended)
./dump.sh db prd        # Creates encrypted database dump
./dump.sh redis prd     # Creates encrypted Redis dump
```

### Manual Restore Operations

```bash
cd util/backup
./restore.sh db dev     # Restore database to development
./restore.sh redis dev  # Restore Redis to development

# With specific dump file
DUMP_FILE=/path/to/dump.tar.gpg ./restore.sh db dev
```

### Verification and Troubleshooting

```bash
# Verify dump file integrity
cd util/backup/lib
source _verify-dump-file.sh
verify_dump_file /path/to/dump.tar.gpg

# Check database restoration
source _verify-restore.sh
verify_klicker_database_restore "postgresql://user:pass@host:5432/db"

# Get help with main commands
cd util/backup
./dump.sh --help
./restore.sh --help
```

## Recent Improvements

### Row Count Verification Fixes

**Problem**: PostgreSQL case sensitivity causing table verification failures
**Solution**: Enhanced `get_table_row_count()` with proper quoting and schema specification
**Impact**: Reliable verification of critical tables like Element, Course, Participant

### Non-Critical Error Handling

**Problem**: Row count failures treated as critical errors
**Solution**: Enhanced error handling to continue verification despite non-critical failures
**Impact**: More robust verification process with appropriate warning levels

### Production State Preservation

**Problem**: Automatic Prisma migrations modifying restored production data
**Solution**: Removed automatic migration step, preserved exact production state
**Impact**: Developers get exact production data without local modifications

### Database Persistence Fix

**Problem**: Script destroying database after successful restoration
**Solution**: Renamed cleanup to `cleanup_on_failure`, removed from automatic EXIT trap
**Impact**: Services remain running for local development use

### Enhanced Cleanup System

**Problem**: Leftover temporary files from previous runs
**Solution**: Proactive cleanup system with comprehensive pattern matching
**Impact**: Clean environment for each script execution

## Error Handling Patterns

### Validation Errors

```bash
# Example: Missing encryption key
validation_error "BACKUP_ENCRYPTION_KEY is required for all backup operations"
```

### Connection Failures

```bash
# Example: Database connectivity with retry
test_pg_connection_with_retry "$connection_string" 3 5 10
```

### File Verification

```bash
# Example: Dump file validation
validate_dump_file "$dump_file" "database dump"
```

### Cleanup on Failure

```bash
# Example: Explicit cleanup on errors
if ! restore_operation; then
    cleanup_on_failure
    exit 1
fi
```

## Integration Points

### Docker Compose

- Services started/stopped via Docker Compose commands
- Volume management for persistent data
- Service readiness checks with retries

### Doppler Secrets

- Environment-specific configuration loading
- Automatic fallback to service tokens
- Secure key management for encryption

### Prisma Migrations

- Manual migration control (no automatic application)
- Migration status verification utilities
- Production state preservation

## Development Guidelines

### When Working with Backup Scripts

1. **Security**: Always maintain encryption requirements
2. **Error Handling**: Use provided error handling patterns
3. **Testing**: Test with all three environments (dev/stg/prd)
4. **Cleanup**: Ensure proper cleanup function registration
5. **Verification**: Add verification for new functionality
6. **Doppler Consistency**: Always use `_run_with_doppler.sh` for Doppler operations

### Doppler Integration Requirements

All scripts must use the centralized `_run_with_doppler.sh` wrapper instead of calling `doppler` directly. This ensures:

- **External Drive Support**: Automatic fallback to service tokens on external drives
- **Consistent Authentication**: Unified authentication patterns across all environments
- **Error Handling**: Standardized error messages and troubleshooting guidance

**Correct Pattern:**

```bash
# For script delegation (in dump/restore scripts)
CONFIG="$ENVIRONMENT" exec "${REPO_ROOT}/util/_run_with_doppler.sh" "$0" "$ENVIRONMENT" "--internal-doppler-loaded"

# For secret retrieval
CONFIG=prd "${REPO_ROOT}/util/_run_with_doppler.sh" doppler secrets get BACKUP_ENCRYPTION_KEY --plain

# For utility functions
CONFIG="$config" "$doppler_script" doppler secrets download --no-file --format env
```

**Incorrect Pattern (Do Not Use):**

```bash
# Direct doppler calls bypass external drive authentication
doppler secrets get KEY --config prd --plain  # ❌ Wrong
doppler run --config prd -- command args      # ❌ Wrong
```

### Common Patterns

```bash
# Standard script structure
setup_secure_signal_handling
register_cleanup_function your_cleanup_function

# Error handling
if ! operation; then
    error_exit "Operation failed with detailed message"
fi

# Verification
if verify_operation "$parameters"; then
    log_success "Operation completed successfully"
else
    log_warning "Operation completed with warnings"
fi
```

### Testing Approach

1. **Local Testing**: Use dev environment for initial testing
2. **Integration Testing**: Test complete workflow with prepare_local_prod.sh
3. **Error Scenarios**: Test failure cases and cleanup behavior
4. **Production Validation**: Use staging environment for production changes

## Troubleshooting

### Common Issues

**Encryption Key Missing**:

```bash
export BACKUP_ENCRYPTION_KEY='your-key'
# or configure Doppler with: doppler setup
```

**Docker Not Running**:

```bash
docker info
# Start Docker and retry operation
```

**Permission Errors**:

```bash
chmod +x script-name.sh
# Verify database/Redis access permissions
```

**Row Count Verification Failures**:

- Check database connectivity
- Verify table names are correct (case sensitive)
- Review PostgreSQL schema structure

**Leftover Temp Files**:

- Scripts automatically clean up on next run
- Manual cleanup: `rm -rf /tmp/klicker_secure_*`

This documentation reflects the current state of the system after recent improvements and provides guidance for future development and maintenance of the backup/restore infrastructure.
