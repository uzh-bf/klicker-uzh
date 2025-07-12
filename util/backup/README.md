# KlickerUZH Backup and Restore Scripts

This directory contains scripts for backing up and restoring PostgreSQL databases and Redis data across different environments.

## Directory Structure

```
backup/
├── dump/           # Database and Redis dump scripts
│   ├── dump-db.sh      # PostgreSQL database dump
│   └── dump-redis.sh   # Redis data dump
├── restore/        # Restore scripts and wrappers
│   ├── restore.sh           # Unified restore wrapper (recommended)
│   ├── restore-db.sh        # Database restore wrapper (legacy)
│   ├── restore-redis.sh     # Redis restore wrapper (legacy)
│   ├── _restore-db-dev.sh   # Development database restore
│   ├── _restore-db-stg.sh   # Staging database restore
│   ├── _restore-redis-dev.sh # Development Redis restore
│   └── _restore-redis-stg.sh # Staging Redis restore
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

#### Create Database Dump (Production)
```bash
cd dump/
./dump-db.sh
```

#### Restore Database
```bash
# Using unified restore script (recommended)
cd restore/
./restore.sh db dev     # Restore to development
./restore.sh db stg     # Restore to staging

# Using legacy wrapper
./restore-db.sh dev     # Development restore
./restore-db.sh stg     # Staging restore
```

### Redis Operations

#### Create Redis Dump (Production)
```bash
cd dump/
./dump-redis.sh
```

#### Restore Redis
```bash
# Using unified restore script (recommended)
cd restore/
./restore.sh redis dev  # Restore to development
./restore.sh redis stg  # Restore to staging

# Using legacy wrapper
./restore-redis.sh dev  # Development restore
./restore-redis.sh stg  # Staging restore
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
- Database dumps: `dump_YYYYMMDD_HHMMSS.tar`
- Redis dumps: `redis_dump_YYYYMMDD_HHMMSS.dump`

### Scripts
- `dump-*.sh` - Create backups
- `restore*.sh` - Restore wrappers
- `_restore-*-*.sh` - Environment-specific restore implementations
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

## Safety Notes

⚠️ **Important Safety Reminders:**
- **Never restore to production environments**
- Always verify dump file integrity before restore
- Test restore operations in development first
- Keep backups of existing data before restore operations
- Monitor disk space during dump/restore operations
- Ensure proper network security when transferring dump files