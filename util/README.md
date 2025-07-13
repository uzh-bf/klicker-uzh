# KlickerUZH Utilities

This directory contains essential development and operational utilities for the KlickerUZH platform. These tools support local development, deployment, database management, and system operations.

## 🔧 Available Utilities

### 1. **Backup/Restore System** (`backup/`)

Production-ready backup and restore utilities for PostgreSQL databases and Redis data with enterprise-grade security features.

**Quick Start:**

```bash
# Create production dumps
cd backup && ./dump.sh both prd

# Set up local development with production data
cd backup && ./prepare_local_prod.sh

# Restore to development environment
cd backup && ./restore.sh db dev
```

**Key Features:**

- Unified interface with `dump.sh` and `restore.sh` wrapper scripts
- Mandatory AES256 encryption for all dumps
- External drive authentication support for Doppler
- Comprehensive error handling and verification
- One-command local development setup

📚 **Detailed Documentation:** [backup/README.md](./backup/README.md) | [backup/CLAUDE.md](./backup/CLAUDE.md)

### 2. **Doppler Integration** (`_run_with_doppler.sh`)

Centralized Doppler CLI wrapper that handles authentication across different environments, with special support for external drive scenarios.

**Purpose:**

- Automatic fallback to service tokens on external drives (e.g., `/Volumes/*` on macOS)
- Consistent Doppler authentication patterns across all scripts
- Secure handling of credentials and environment variables

**Usage:**

```bash
# Used internally by other scripts
CONFIG=prd ./_run_with_doppler.sh command args...
```

### 3. **Schema Management** (`sync-schema.sh`)

Synchronizes Prisma database schemas between `packages/prisma` and `apps/analytics` to ensure consistency across the codebase.

**Purpose:**

- Keeps database schemas in sync between different parts of the application
- Required after any Prisma schema changes
- Part of the development workflow

**Usage:**

```bash
# Sync schemas after making changes
./sync-schema.sh
```

### 4. **Infrastructure Configuration** (`traefik/`)

Contains Docker and reverse proxy configuration files for local development and deployment.

**Contents:**

- `Dockerfile` / `Dockerfile.wsl` - Container configurations for different platforms
- `rules_docker.yaml` / `rules_wsl.yaml` - Routing rules for development
- `ssl/` - Local SSL certificates for HTTPS development

**Purpose:**

- Enables local HTTPS development
- Provides consistent routing across services
- Platform-specific configurations (macOS/WSL)

### 5. **Database Tools**

#### `init.sql`

Database initialization script with required setup commands, roles, and initial data.

#### `upstash-redis-dump`

Specialized binary utility for creating and restoring Redis dumps, optimized for Upstash Redis instances with support for parallel processing and TTL preservation.

### 6. **Development Tools**

#### `yaml-updater.js`

Node.js utility for programmatic YAML file updates, used in deployment and configuration management workflows.

**Purpose:**

- Automated configuration updates
- Deployment pipeline support
- Consistent YAML processing

## 🚀 Common Development Tasks

### Setting Up Local Development

```bash
# 1. Sync database schemas
./sync-schema.sh

# 2. Set up local environment with production data
cd backup && ./prepare_local_prod.sh

# 3. Start development with proper reverse proxy
# (from project root)
pnpm dev
```

### Creating Production Backups

```bash
# Create encrypted dumps of both database and Redis
cd backup && ./dump.sh both prd
```

### Database Operations

```bash
# Initialize database
psql -f init.sql

# Restore from backup
cd backup && ./restore.sh db dev
```

## 📋 Directory Structure

```
util/
├── backup/                    # Complete backup/restore system
│   ├── dump.sh               # Main dump interface
│   ├── restore.sh            # Main restore interface
│   ├── prepare_local_prod.sh # One-command local setup
│   ├── advanced/             # Individual service scripts
│   ├── lib/                  # Shared utilities
│   └── dumps/                # Local dump storage
├── _run_with_doppler.sh      # Doppler CLI wrapper
├── sync-schema.sh            # Prisma schema sync
├── traefik/                  # Reverse proxy config
│   ├── ssl/                  # Local SSL certificates
│   └── rules_*.yaml          # Platform-specific routing
├── init.sql                  # Database initialization
├── upstash-redis-dump        # Redis dump utility
└── yaml-updater.js           # YAML processing tool
```

## 🔧 Prerequisites

### Development Tools

```bash
# macOS
brew install postgresql redis dopplerhq/cli/doppler

# Ubuntu/Debian
sudo apt-get install postgresql-client redis-tools
curl -Ls https://cli.doppler.com/install.sh | sh
```

### Environment Setup

- Docker and Docker Compose for local development
- Doppler CLI configured with access to dev/stg/prd configs
- Node.js for running JavaScript utilities

## 🛠️ Troubleshooting

### Doppler Authentication Issues

```bash
# Standard setup
doppler login && doppler setup

# External drive (service token required)
# See backup/README.md for detailed instructions
```

### Permission Errors

```bash
# Make scripts executable
chmod +x *.sh backup/*.sh
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Test connection
psql -h localhost -p 5432 -U klicker -d klicker-prod
```

## 📚 Additional Documentation

- **Backup System**: [backup/README.md](./backup/README.md) - User guide
- **AI Development**: [backup/CLAUDE.md](./backup/CLAUDE.md) - Technical details
- **Project Overview**: [../CLAUDE.md](../CLAUDE.md) - Main documentation

## 🆘 Support

- [KlickerUZH Community](https://community.klicker.uzh.ch/)
- [GitHub Issues](https://github.com/uzh-bf/klicker-uzh/issues)
- [Project Documentation](https://www.klicker.uzh.ch/)
