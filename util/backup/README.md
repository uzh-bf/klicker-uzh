# KlickerUZH Backup and Restore Scripts

Production-ready backup and restore scripts for PostgreSQL databases and Redis data across development, staging, and production environments.

**Main Interface:** Use `dump.sh` and `restore.sh` for all operations - these unified wrappers provide consistent commands for both database and Redis operations.

## Prerequisites

### Required Tools

- `docker` and `docker-compose` - For local development environment
- `doppler` - For secrets management ([install guide](https://docs.doppler.com/docs/install-cli))
- `pg_dump` / `pg_restore` - PostgreSQL client tools (`brew install libpq`)
- `redis-cli` - Redis command-line interface (`brew install redis`)

### Environment Setup

- Doppler CLI configured with access to `dev`, `stg`, `prd` configs
- Network access to target databases and Redis instances
- `BACKUP_ENCRYPTION_KEY` available (via Doppler or environment variable)

## Quick Start

### Local Development with Production Data

```bash
# One-command setup: automatically discovers and restores latest dumps
./prepare_local_prod.sh

# With specific encryption key
BACKUP_ENCRYPTION_KEY=your-key ./prepare_local_prod.sh
```

This script automatically:

1. Discovers latest database and Redis dumps
2. Resets Docker environment and volumes
3. Starts local PostgreSQL and Redis services
4. Restores both dumps to local development environment
5. Leaves services running for development

## Common Operations

### Creating Dumps (Recommended: Use Unified Interface)

```bash
./dump.sh both prd      # Backup both database and Redis (recommended)
./dump.sh db prd        # Production database dump only
./dump.sh redis prd     # Production Redis dump only

./dump.sh both stg      # Staging dumps
```

### Restoring to Development/Staging

```bash
./restore.sh db dev     # Restore database to development
./restore.sh redis dev  # Restore Redis to development

./restore.sh db stg     # Restore to staging
./restore.sh redis stg
```

### Using Specific Dump Files

```bash
# Restore specific dumps
DUMP_FILE=/path/to/dump.tar.gpg ./restore.sh db dev
DUMP_FILE=/path/to/redis.dump.gpg ./restore.sh redis dev
```

## Configuration

### Essential Environment Variables

**Database:**

- `DATABASE_URL` - PostgreSQL connection string (preferred)
- Or individual: `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASS`, `DATABASE_NAME`

**Redis:**

- `REDIS_URL` - Redis connection string (preferred)
- Or individual: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`

**Encryption (Required):**

- `BACKUP_ENCRYPTION_KEY` - GPG passphrase for dump encryption/decryption

### Doppler Configuration

Scripts automatically load environment variables via Doppler:

- `dev` - Development environment (local configuration)
- `stg` - Staging environment
- `prd` - Production environment (dump operations only)

## Security Features

- **All dumps are encrypted** with AES256 - unencrypted dumps are rejected
- **Production restores blocked** for safety - use `./advanced/restore-orchestrator.sh` for production operations
- **Automatic cleanup** of sensitive environment variables
- **Comprehensive error handling** with secure temporary file management

## Troubleshooting

### No dumps found

```bash
# Create production dumps first
./dump.sh both prd      # Recommended: backup both services
# OR individually:
./dump.sh db prd
./dump.sh redis prd
```

### Docker not running

```bash
# Start Docker and retry
docker info
./prepare_local_prod.sh
```

### Missing encryption key

```bash
# Set encryption key manually
export BACKUP_ENCRYPTION_KEY='your-key'

# Or configure Doppler
doppler login
doppler setup
```

### Doppler authentication issues

**Standard Setup:**

```bash
# Login and verify access
doppler login
doppler configs
```

**External Drive Authentication:**

When working from external drives (e.g., `/Volumes/*` on macOS), Doppler keychain authentication may fail. The scripts automatically fall back to service tokens:

```bash
# 1. Create a Service Token in Doppler dashboard:
#    Projects → klicker-uzh → [environment] → Access → "Generate Service Token"

# 2. Save the token to your home directory:
mkdir -p ~/.doppler-tokens
echo 'dp.st.your_generated_token' > ~/.doppler-tokens/klicker-uzh-prd

# 3. Scripts will automatically use the service token
./dump.sh both prd   # Will use service token if on external drive
```

**Service Token Naming Convention:**

- Production: `~/.doppler-tokens/klicker-uzh-prd`
- Staging: `~/.doppler-tokens/klicker-uzh-stg`
- Development: `~/.doppler-tokens/klicker-uzh-dev`

### Services not starting

```bash
# Check Docker Compose status
docker compose ps
docker compose logs postgres redis_exec
```

## Getting Help

Run any script with `--help` for detailed usage information:

```bash
./prepare_local_prod.sh --help
./dump.sh --help
./restore.sh --help
```

## Advanced Operations

For production operations, automated backups, and advanced troubleshooting:

```bash
# Production restore operations (with safety measures)
./advanced/restore-orchestrator.sh stg   # Validate on staging first
./advanced/restore-orchestrator.sh prd   # Execute on production

# Automated backup for cron/production VMs
./advanced/backup-automated.sh prd       # Production automation
```

For detailed documentation, advanced operations, and AI agent guidance, see the [CLAUDE.md](./CLAUDE.md) documentation.
