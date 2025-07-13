# Backup and Restore Utilities

This directory contains comprehensive backup and restore utilities for the KlickerUZH application, supporting both database (PostgreSQL) and Redis operations across development and staging environments.

## Overview

The restore utilities provide a unified, safe, and reliable way to restore PostgreSQL and Redis data across different environments, with comprehensive error handling, logging, validation, and cleanup mechanisms.

## Quick Start

**Database Restore:**

```bash
# Development environment
./restore-db.sh dev

# Staging environment
./restore-db.sh stg
```

**Redis Restore:**

```bash
# Development environment
./restore-redis.sh dev

# Staging environment
./restore-redis.sh stg
```

**Get Help:**

```bash
# Database help
./restore-db.sh --help

# Redis help
./restore-redis.sh --help
```

## Prerequisites

### Required Tools

- PostgreSQL client tools (`psql`, `pg_restore`)
- Redis client tools (`redis-cli`)
- Doppler CLI for secret management (staging)
- Appropriate dump files (`dump.tar` for database, `redis.dump` for Redis)

### Installation Commands

**Ubuntu/Debian:**

```bash
sudo apt-get install postgresql-client redis-tools
curl -Ls https://cli.doppler.com/install.sh | sh
```

**macOS:**

```bash
brew install postgresql redis
brew install dopplerhq/cli/doppler
```

## Detailed Usage

### Configuration

**Development Environment:**

- Uses local database and Redis instances with hardcoded credentials.

**Staging Environment:**

- Secure configuration via Doppler, requires Doppler setup.

### Example Commands

- For development: `./restore-db.sh dev`
- For staging: `CONFIG=stg ./restore-db.sh stg`

## File Structure

```
util/
├── restore-db.sh              # Unified Database Restore Wrapper
├── restore-redis.sh           # Unified Redis Restore Wrapper
├── _restore-db-dev.sh         # Development database restore
├── _restore-db-stg.sh         # Staging database restore
├── _restore-redis-dev.sh      # Development Redis restore
├── _restore-redis-stg.sh      # Staging Redis restore
├── _restore-common.sh         # Shared utilities
├── _verify-restore.sh         # Verification functions
├── _verify-dump-file.sh       # Dump file validation
└── _run_with_doppler.sh       # Doppler integration
```

## Common Issues and Solutions

- `Command not found: pg_restore`: Install PostgreSQL client tools.
- `Permission denied`: Run `chmod +x *.sh`.
- `Dump file not found`: Verify `dump.tar` and `redis.dump` exist.
- `Could not connect to database`: Check that the database is running and credentials.
- `Doppler secrets not loading`: Run `doppler login`, verify configuration.

## Security and Best Practices

- Protect dump files with appropriate permissions (600 or 640).
- Use Doppler for managing secrets in production/staging environments.
- Regularly rotate database and Redis passwords.

## Troubleshooting and Debugging

- **Logs Location:** Review logs in /tmp directory.
- **Debug Mode:** Enable debug mode with `export DEBUG=1`.

## Support and Documentation

- [KlickerUZH Community](https://community.klicker.uzh.ch/)
- [GitHub Issues](https://github.com/uzh-bf/klicker-uzh/issues)
