# KlickerUZH Backup and Restore Scripts

Production-ready backup and restore scripts for PostgreSQL databases and Redis data across development, staging, and production environments.

## Refresh the STG database from PRD

[`refresh-stg-from-prd.sh`](./refresh-stg-from-prd.sh) replaces the Klicker STG
PostgreSQL database with a transactionally consistent logical dump of PRD. It
then submits a hook-based sync directly to the self-hosted `app-klicker` ArgoCD
`Application` resource, which runs the existing STG `PreSync` migration hook
before restoring the desired Deployment replicas. The local `argocd` CLI is not
required.

This is a **database-only** operation. It does not copy Redis, Hatchet state,
Azure Blob Storage, or other services, and it does not preserve the previous STG
database. It also does not sanitize the dump: after a successful run, raw PRD
data—including personal data—is present in STG. Run it only when STG is approved
for that data classification and its outbound integrations are safely isolated.

### Prerequisites

- Private-network access to both Azure PostgreSQL Flexible Servers.
- `infisical` access to `DIRECT_DATABASE_URL` in the `prd` and `stg`
  environments and `BACKUP_ENCRYPTION_KEY` in `prd` on the self-hosted
  `https://inf.prd.df-app.ch/api` instance, project
  `d071be96-5136-4f23-a6cb-e0c7f9b9a6c8`. The secrets default to path `/`;
  override `INFISICAL_SECRET_PATH` if they are stored in a folder.
- A working `aks-stg-apps` kubectl context with permission to list and scale the
  release Deployments.
- Kubernetes access to the ArgoCD control-plane cluster, with `get` and `patch`
  permission for `applications.argoproj.io/app-klicker` in the `argocd`
  namespace. This defaults to the same `aks-stg-apps` context; set
  `ARGOCD_KUBE_CONTEXT` and `ARGOCD_NAMESPACE` if ArgoCD runs elsewhere.
- PostgreSQL client tools (`pg_dump`, `pg_restore`, and `psql`) version 17 or
  newer, plus `gpg`, `jq`, Node.js, and standard Unix utilities.
- A STG release whose database schema is the same as or newer than PRD. The hook
  can migrate forward; it cannot downgrade a newer PRD schema for an older app.

Run the read-only preflight first from the repository root:

```bash
./util/backup/refresh-stg-from-prd.sh
```

The preflight validates the exact source and target hostnames, PostgreSQL client
compatibility, source size against STG capacity, Prisma migration health,
STG object ownership, ArgoCD state, and the set of STG Deployments. The database
must use only the `public` application schema and must not contain PostgreSQL
large objects. It creates no dump and changes no external state.

After reviewing that output, execute the refresh with all three gates:

```bash
DRY_RUN=false \
CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
ALLOW_RAW_PRD_DATA_IN_STG=true \
./util/backup/refresh-stg-from-prd.sh
```

The script streams `pg_dump` directly into an AES-256 GPG archive; it never
writes a plaintext dump. Before changing STG it validates the archive, disables
ArgoCD automated sync/self-heal, and scales every Deployment in the Klicker
release to zero. Azure owns the `public` schema, so the script preserves the
schema and its grants, transactionally removes only objects owned by the STG
application role, and excludes `public` schema creation/ownership entries from
the restore catalog. It restores with an explicit
`pg_restore --dbname=<STG-database> --exit-on-error --single-transaction`,
verifies aggregate table and migration counts, and patches
`Application.operation.sync` with ArgoCD's hook sync strategy. It then waits
for the operation carrying this run's unique initiator to reach `Succeeded`. A
successful sync runs the PreSync migrator and restores the Git-declared replica
counts; a failed hook fails the operation.

The database URLs are validated and decomposed into libpq's `PGHOST`, `PGPORT`,
`PGUSER`, `PGPASSWORD`, `PGDATABASE`, and supported SSL environment variables.
The URLs are never placed in process arguments, and `PGDATABASE` receives only
the database name rather than the full URI. PostgreSQL's `pg_restore` does not
use `PGDATABASE` to select direct-to-database mode, so the non-secret database
name is also supplied explicitly with `--dbname`; the host, username, and
password remain environment-only.

For a self-hosted ArgoCD control plane in another Kubernetes context, run both
the preflight and execution with the overrides, for example:

```bash
ARGOCD_KUBE_CONTEXT=aks-platform \
ARGOCD_NAMESPACE=argocd \
./util/backup/refresh-stg-from-prd.sh
```

The Infisical endpoint defaults to the production self-hosted instance. If the
CLI is authenticated against another host, log in to this instance before the
preflight:

```bash
infisical login --domain=https://inf.prd.df-app.ch/api
```

Metadata-only receipts are written below
`util/backup/dumps/prd-to-stg-refresh/<run-id>/`, which is gitignored. The
encrypted archive is deleted after the run unless
`KEEP_ENCRYPTED_ARCHIVE=true` is explicitly set.

If anything fails after maintenance mode starts, the script deliberately leaves
automated sync disabled and the selected Deployments at zero. Do not simply
restart them. If the restore was not verified, do **not** submit an ArgoCD hook
sync against the incomplete database. Inspect the failed run's metadata-only
`before.json` and `deployments.tsv`, then validate the guarded resume in
read-only mode with a fresh default `RUN_ID`:

```bash
RESUME_FAILED_RUN_ID=<failed-run-id> \
./util/backup/refresh-stg-from-prd.sh
```

The resume is accepted only when the failed run has no `after.json`, its source
and target match the current fixed endpoints, its saved policy was automated,
ArgoCD is still manual with no active operation, and the exact recorded
Deployment set remains at zero desired and running replicas. After reviewing
that preflight, rerun with the same failed-run ID and the three execution gates:

```bash
RESUME_FAILED_RUN_ID=<failed-run-id> \
DRY_RUN=false \
CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
ALLOW_RAW_PRD_DATA_IN_STG=true \
./util/backup/refresh-stg-from-prd.sh
```

The resume creates and validates a fresh encrypted PRD dump under a new run ID;
it never reuses a partial archive. It resets any remaining application-owned
STG objects, restores the snapshot, runs the PreSync hook, and only then
restores the exact automated-sync policy saved by the failed run. A normal
refresh still refuses to adopt an unfinished manual Argo state, and a failed
run never mutates PRD.

**Main Interface:** Use `dump.sh` and `restore.sh` for all operations - these unified wrappers provide consistent commands for both database and Redis operations.

## Prerequisites

### Required Tools

- `docker` and `docker-compose` - For local development environment
- `doppler` - For secrets management ([install guide](https://docs.doppler.com/docs/install-cli))
- `pg_dump` / `pg_restore` / `psql` - PostgreSQL client tools (`brew install libpq`)
  - **Note**: Scripts automatically detect and configure PostgreSQL tools on most systems
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

1. Discovers latest database and Redis dumps (including optional assessment Redis)
2. Resets Docker environment and volumes
3. Starts local PostgreSQL and Redis services
4. Restores all available dumps to local development environment
5. Leaves services running for development

## Common Operations

### Creating Dumps (Recommended: Use Unified Interface)

```bash
# Comprehensive backups (recommended)
./dump.sh all prd       # Database + both Redis instances (main + assessment)
./dump.sh both prd      # Database + main Redis only (backward compatible)

# Individual service dumps
./dump.sh db prd        # Production database dump only
./dump.sh redis prd     # Production main Redis dump only
./dump.sh redis-assessment prd  # Production assessment Redis dump only

# Staging environment
./dump.sh all stg       # All services from staging
./dump.sh both stg      # Database + main Redis from staging
```

### Restoring to Development/Staging

```bash
# Database and main Redis restoration
./restore.sh db dev     # Restore database to development
./restore.sh redis dev  # Restore main Redis to development

# Assessment Redis restoration
./restore.sh redis-assessment dev  # Restore assessment Redis to development

# Staging environment
./restore.sh db stg     # Restore to staging
./restore.sh redis stg  # Restore main Redis to staging
./restore.sh redis-assessment stg  # Restore assessment Redis to staging
```

### Using Specific Dump Files

```bash
# Restore specific dumps
DUMP_FILE=/path/to/dump.tar.gpg ./restore.sh db dev
DUMP_FILE=/path/to/redis.dump.gpg ./restore.sh redis dev
DUMP_FILE=/path/to/redis_assessment.dump.gpg ./restore.sh redis-assessment dev
```

## Configuration

### Essential Environment Variables

**Database:**

- `DATABASE_URL` - PostgreSQL connection string (preferred)
- Or individual: `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASS`, `DATABASE_NAME`

**Redis (Main Instance):**

- `REDIS_URL` - Redis connection string (preferred)
- Or individual: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`

**Redis (Assessment Instance - Optional):**

- `REDIS_ASSESSMENT_HOST` - Assessment Redis host
- `REDIS_ASSESSMENT_PORT` - Assessment Redis port
- `REDIS_ASSESSMENT_PASS` - Assessment Redis password
- `REDIS_ASSESSMENT_TLS` - Enable TLS (optional, default: false)

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

## Multi-Redis Instance Support

The backup system supports multiple Redis instances to accommodate different application architectures:

### Architecture

- **Main Redis** (`redis`): Primary Redis instance for caching, sessions, and general data
- **Assessment Redis** (`redis-assessment`): Dedicated Redis instance for assessment/quiz execution data

### Service Options

| Service            | Description           | Includes                                    |
| ------------------ | --------------------- | ------------------------------------------- |
| `all`              | Comprehensive backup  | Database + Main Redis + Assessment Redis    |
| `both`             | Traditional backup    | Database + Main Redis (backward compatible) |
| `redis`            | Main Redis only       | Main Redis instance                         |
| `redis-assessment` | Assessment Redis only | Assessment Redis instance                   |
| `db`               | Database only         | PostgreSQL database                         |

### Usage Examples

```bash
# Backup strategies
./dump.sh all prd               # Complete backup (recommended if using assessment Redis)
./dump.sh both prd              # Traditional backup (main Redis + database)
./dump.sh redis-assessment prd  # Assessment data only

# Restore strategies
./restore.sh redis dev          # Restore main Redis to development
./restore.sh redis-assessment dev # Restore assessment Redis to development

# Check if assessment Redis is configured
./dump.sh redis-assessment prd  # Will show error if not configured
```

### Configuration Detection

- Assessment Redis backup is **automatic** when `REDIS_ASSESSMENT_HOST` is configured
- If assessment Redis variables are not set, only main Redis is backed up
- Local development automatically handles both instances if dumps are available

## Troubleshooting

### No dumps found

```bash
# Create production dumps first
./dump.sh all prd       # Recommended: backup all services (if using assessment Redis)
./dump.sh both prd      # Alternative: backup database + main Redis

# OR individually:
./dump.sh db prd
./dump.sh redis prd
./dump.sh redis-assessment prd  # Only if assessment Redis is configured
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

### PostgreSQL tools not found

Scripts automatically detect PostgreSQL tools (psql, pg_restore) in common locations:

```bash
# If auto-detection fails, install PostgreSQL client tools:
brew install libpq

# Or add to PATH manually:
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

### Services not starting

```bash
# Check Docker Compose status
docker compose ps
docker compose logs postgres redis_exec
```

### Assessment Redis issues

```bash
# Check if assessment Redis is configured
./dump.sh redis-assessment prd 2>&1 | head -10

# If you see "REDIS_ASSESSMENT_HOST environment variable is not set":
# - Assessment Redis is not configured for this environment
# - Use ./dump.sh both prd instead of ./dump.sh all prd

# To configure assessment Redis, set these environment variables:
# REDIS_ASSESSMENT_HOST=your-assessment-redis-host
# REDIS_ASSESSMENT_PORT=6379
# REDIS_ASSESSMENT_PASS=your-password
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
