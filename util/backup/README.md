# KlickerUZH Backup and Restore Scripts

This directory contains scripts for backing up and restoring PostgreSQL databases and Redis data across different environments.

## Directory Structure

```
backup/
├── dump/           # Database and Redis dump scripts
│   ├── dump-db.sh           # PostgreSQL database dump (supports all environments)
│   ├── dump-redis.sh        # Redis data dump (supports all environments)
│   └── backup-automated.sh  # Automated backup wrapper
├── restore/        # Restore scripts and orchestration
│   ├── restore.sh              # Simple restore wrapper (basic operations)
│   ├── restore-db.sh           # Unified database restore (all environments)
│   ├── restore-redis.sh        # Unified Redis restore (all environments)
│   └── restore-orchestrator.sh # Production-safe multi-service operations
├── lib/            # Shared utilities and libraries
│   ├── _restore-common.sh    # Common restore functions
│   ├── _verify-dump-file.sh  # Dump file verification
│   └── _verify-restore.sh    # Restore verification utilities
└── _prepare_local_prod.sh    # Local production setup
```

## Prerequisites

### Required Tools
- `doppler` - For secrets management
- `pg_dump` - PostgreSQL client tools for database operations
- `pg_restore` - PostgreSQL restore utility
- `redis-cli` - Redis command-line interface
- `upstash-redis-dump` - Redis dump utility (for Redis dumps)

### Environment Setup
- Doppler CLI configured with access to appropriate configs (`dev`, `stg`, `prd`)
- Network access to target databases and Redis instances
- Appropriate permissions for database and Redis operations

## Usage

### Database Operations

#### Create Database Dump
```bash
cd dump/
./dump-db.sh           # Production dump (default)
./dump-db.sh prd       # Production dump (explicit)
./dump-db.sh stg       # Staging dump
./dump-db.sh dev       # Development dump
```

#### Restore Database
```bash
cd restore/
./restore-db.sh dev    # Restore to development
./restore-db.sh stg    # Restore to staging
./restore-db.sh prd    # Restore to production (with safety prompts)

# Or use the wrapper
./restore.sh db dev    # Restore to development
./restore.sh db stg    # Restore to staging
./restore.sh db prd    # Restore to production

# Or specify a particular dump file
DUMP_FILE=/path/to/specific/dump.tar ./restore-db.sh dev
```

### Redis Operations

#### Create Redis Dump
```bash
cd dump/
./dump-redis.sh        # Production dump (default)
./dump-redis.sh prd    # Production dump (explicit)
./dump-redis.sh stg    # Staging dump
./dump-redis.sh dev    # Development dump
```

#### Restore Redis
```bash
cd restore/
./restore-redis.sh dev # Restore to development
./restore-redis.sh stg # Restore to staging
./restore-redis.sh prd # Restore to production (with safety prompts)

# Or use the wrapper
./restore.sh redis dev # Restore to development
./restore.sh redis stg # Restore to staging
./restore.sh redis prd # Restore to production

# Or specify a particular dump file
DUMP_FILE=/path/to/specific/redis_dump.dump ./restore-redis.sh dev
```

### Production Operations (Recommended)

For production environments, use the orchestrator for coordinated multi-service operations:

#### Staging Validation (Required before production)
```bash
cd restore/
./restore-orchestrator.sh stg
```

#### Production Execution (After staging validation)
```bash
cd restore/
./restore-orchestrator.sh prd
```

The orchestrator provides:
- Transaction-like behavior (both services succeed or both rollback)
- Pre-restore backup creation
- Comprehensive safety checks and confirmations
- State tracking for resume/rollback capabilities

### Local Development Setup

#### Prepare Local Environment with Production Data
```bash
# Automatically discovers and uses latest dumps
./_prepare_local_prod.sh

# With encrypted dumps
BACKUP_ENCRYPTION_KEY=<your-key> ./_prepare_local_prod.sh
```

This script:
1. Resets Docker Compose environment and volumes
2. Automatically discovers the latest database and Redis dumps
3. Restores both dumps to local development environment
4. Applies Prisma migrations
5. Supports encrypted dumps automatically

### Automated Backup (Production VMs)

#### Schedule Automated Backups
```bash
# For scheduled execution via cron
./dump/backup-automated.sh prd     # Production backups (default)
./dump/backup-automated.sh stg     # Staging backups
./dump/backup-automated.sh dev     # Development backups

# Example crontab entries
# Production backups every hour at 5 minutes past
# 5 * * * * /opt/backup/dump/backup-automated.sh prd >> /var/log/backup.log 2>&1

# Staging backups daily at 2 AM
# 0 2 * * * /opt/backup/dump/backup-automated.sh stg >> /var/log/backup.log 2>&1
```

#### Environment Variables for Automation
```bash
# Required for automated mode
BACKUP_VOLUME_PATH=/mnt/backup          # Backup storage location
BACKUP_ENCRYPTION_KEY=<gpg-passphrase> # For encrypted dumps

# Optional configuration
BACKUP_RETENTION_DAYS=7                 # Days to keep old dumps (default: 7)
BACKUP_CLEANUP_ENABLED=true            # Enable automatic cleanup
MONITORING_WEBHOOK=https://...          # Success notification URL
MONITORING_WEBHOOK_FAILURE=https://...  # Failure notification URL
```

## Features

### Security & Safety
- **Production restore is NOT supported** for safety reasons
- Sensitive environment variables are automatically cleaned up
- Comprehensive error handling with early exit on failures
- File verification before restore operations
- Post-restore validation and verification

### Logging & Monitoring
- Timestamped logging for all operations
- Progress indicators for long-running operations
- Comprehensive error reporting with exit codes
- Operation summaries with file sizes and timing

### Environment Management
- Automatic Doppler secrets loading for staging/production
- Environment-specific configuration handling
- Support for both DATABASE_URL and individual connection parameters
- Fallback authentication methods for external drives

### Unified Script Architecture
- **Environment Support**: All scripts support dev/stg/prd environments via parameter
- **Doppler Integration**: Automatic environment loading via `_run_with_doppler.sh`
- **Consistent Interface**: Single pattern for both dump and restore operations
- **Backward Compatibility**: Existing workflows continue to work with defaults

### Intelligent Dump Management
- **Automatic dump discovery**: Restore scripts automatically find the latest dump
- **Flexible storage**: Works in both local development and dedicated backup VMs
- **Latest symlinks**: Automatically maintained for easy access to most recent dumps
- **Smart path resolution**: Adapts to local repos or backup volumes

### Encryption & Security
- **Optional GPG encryption**: Dumps can be encrypted using `BACKUP_ENCRYPTION_KEY`
- **Automatic decryption**: Restore scripts handle encrypted dumps transparently
- **AES256 cipher**: Strong encryption for sensitive production data
- **Key management**: Encryption keys stored securely in Doppler

### Production Safety Features
- **Multi-layer Confirmations**: Production operations require explicit confirmation
- **Staging Validation**: Production restores require successful staging testing first
- **Pre-restore Backups**: Automatic backup creation before production changes
- **Transaction-like Behavior**: Coordinated operations with automatic rollback
- **State Management**: Operation tracking for resume/rollback capabilities

### Automated Operations
- **Multi-environment Support**: Automated backups for any environment
- **Automatic cleanup**: Old dumps removed based on retention policy
- **Monitoring integration**: Webhook notifications for backup status
- **Cron-ready**: Designed for scheduled execution with proper error handling

## Configuration

### Doppler Integration
The scripts use Doppler for secrets management with the following configs:
- `prd` - Production environment (dump operations only)
- `stg` - Staging environment (restore operations)
- `dev` - Development environment (local configuration)

### Environment Variables
The scripts expect the following environment variables (loaded via Doppler):

#### Database
- `DATABASE_URL` (preferred) or individual variables:
  - `DATABASE_HOST`
  - `DATABASE_USER` 
  - `DATABASE_PASS`
  - `DATABASE_NAME`

#### Redis
- `REDIS_URL` (preferred) or individual variables:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASS`

## File Naming Conventions

### Dump Files
- Database dumps: `dump_YYYYMMDD_HHMMSS.tar[.gpg]`
- Redis dumps: `redis_dump_YYYYMMDD_HHMMSS.dump[.gpg]`
- Latest symlinks: `latest` -> most recent dump file

### Directory Structure
- Local development: `dumps/db/` and `dumps/redis/`
- Automated backups: `$BACKUP_VOLUME_PATH/db/` and `$BACKUP_VOLUME_PATH/redis/`

### Scripts
- `dump-*.sh` - Create backups (with environment parameter)
- `restore-*.sh` - Unified restore scripts (with environment parameter)
- `restore-orchestrator.sh` - Production-safe multi-service operations
- `_*.sh` - Internal utilities and libraries

## Error Handling

All scripts include comprehensive error handling:
- Input validation with helpful error messages
- Tool availability checks before operations
- File existence and permission verification
- Connection testing with retry logic
- Automatic cleanup on script exit

## Migration from Legacy Structure

If you have existing scripts in the root backup directory:
1. Move dump scripts to `dump/` directory
2. Move restore scripts to `restore/` directory  
3. Move utility scripts to `lib/` directory
4. Update any custom scripts to reference new paths
5. Use the unified `restore.sh` script for new operations

## Troubleshooting

### Common Issues

#### Doppler Authentication Failures
- Run `doppler login` to authenticate
- Verify access to required configs with `doppler configs`
- For external drives, create service tokens in `~/.doppler-tokens/`

#### Missing Tools
- Install PostgreSQL client tools: `brew install libpq`
- Install Redis CLI: `brew install redis`
- Install Doppler CLI: `brew install dopplerhq/cli/doppler`

#### Permission Errors
- Ensure scripts are executable: `chmod +x script-name.sh`
- Verify database/Redis access permissions
- Check network connectivity to target services

#### File Not Found Errors
- Verify dump files exist before restore operations
- Check file paths and permissions
- Ensure all utility scripts are in correct locations

### Getting Help
Run any script with `--help` or `-h` for usage information:
```bash
./restore.sh --help
./dump-db.sh --help
```

## Migration Guide

### Version 2.0 - Unified Environment Support

This version introduces unified scripts with full environment support and production-grade safety features.

#### Major Changes
- **Unified Scripts**: Single script per service supporting all environments
- **Environment Parameters**: All scripts now accept environment parameter (dev|stg|prd)
- **Doppler Integration**: Consistent environment loading via `_run_with_doppler.sh`
- **Production Safety**: New orchestrator for safe production operations
- **Transaction Semantics**: Coordinated multi-service operations with rollback

#### Migration from Legacy Scripts

If you previously used environment-specific scripts, here are the equivalents:

```bash
# OLD: Environment-specific scripts (removed)
./restore/_restore-db-dev.sh
./restore/_restore-db-stg.sh
./restore/_restore-redis-dev.sh
./restore/_restore-redis-stg.sh

# NEW: Unified scripts with environment parameter
./restore/restore-db.sh dev
./restore/restore-db.sh stg
./restore/restore-redis.sh dev
./restore/restore-redis.sh stg

# OR: Using the wrapper (backward compatible)
./restore/restore.sh db dev
./restore/restore.sh db stg
./restore/restore.sh redis dev
./restore/restore.sh redis stg
```

#### Dump Script Updates
```bash
# OLD: Hardcoded to production
./dump/dump-db.sh
./dump/dump-redis.sh

# NEW: Environment parameter support (backward compatible)
./dump/dump-db.sh           # Still defaults to prd
./dump/dump-db.sh prd       # Explicit production
./dump/dump-db.sh stg       # Staging dumps
./dump/dump-db.sh dev       # Development dumps
```

#### Production Operations
```bash
# OLD: Direct production restore (risky)
./restore.sh db prd

# NEW: Recommended orchestrated approach
./restore/restore-orchestrator.sh stg   # Validate on staging first
./restore/restore-orchestrator.sh prd   # Execute on production
```

#### Breaking Changes
- **Removed Scripts**: `_restore-*-*.sh` environment-specific scripts
- **New Requirements**: Production operations strongly recommend using orchestrator
- **Safety Prompts**: Production restores now require explicit confirmation

#### Backward Compatibility
- **Default Behavior**: All scripts maintain backward compatibility with defaults
- **Environment Variables**: `DUMP_FILE` and other variables still work
- **Doppler Configs**: Existing dev/stg/prd configurations unchanged
- **File Locations**: Automatic discovery works with both new and legacy dump locations

## Safety Notes

⚠️ **Important Safety Reminders:**
- **Never restore to production environments**
- Always verify dump file integrity before restore
- Test restore operations in development first
- Keep backups of existing data before restore operations
- Monitor disk space during dump/restore operations
- Ensure proper network security when transferring dump files