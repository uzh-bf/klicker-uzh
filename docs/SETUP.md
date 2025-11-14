# KlickerUZH Development Environment Setup

This guide provides detailed instructions for setting up a local KlickerUZH v3 development environment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Setup (TL;DR)](#quick-setup-tldr)
- [Detailed Setup Guide](#detailed-setup-guide)
- [Environment Configuration](#environment-configuration)
- [Development Modes](#development-modes)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| **Node.js** | 20.19.4 | [nodejs.org](https://nodejs.org/) or via Volta |
| **pnpm** | 10.15.0 | `corepack enable` or `npm install -g pnpm@10.15.0` |
| **Docker Desktop** | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |
| **Git** | 2.x+ | [git-scm.com](https://git-scm.com/) |

### Optional Software

| Software | Purpose | Installation |
|----------|---------|--------------|
| **Volta** | Node version management | [volta.sh](https://volta.sh/) |
| **mkcert** | Local HTTPS certificates | [github.com/FiloSottile/mkcert](https://github.com/FiloSottile/mkcert) |
| **Doppler CLI** | Environment management (core team) | [docs.doppler.com](https://docs.doppler.com/docs/install-cli) |

### System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 10GB for dependencies and Docker images
- **OS**: macOS, Linux, or Windows with WSL2

## Quick Setup (TL;DR)

```bash
# 1. Clone and install
git clone https://github.com/uzh-bf/klicker-uzh.git
cd klicker-uzh
pnpm install

# 2. Start infrastructure
docker-compose up -d postgres redis-exec redis-cache redis-assessment hatchet-server hatchet-engine

# 3. Configure environment
cp apps/backend-docker/.env.example apps/backend-docker/.env
cp packages/graphql/.env.example packages/graphql/.env
cp apps/hatchet-worker-general/.env.example apps/hatchet-worker-general/.env
cp apps/hatchet-worker-response-processor/.env.example apps/hatchet-worker-response-processor/.env
cp apps/response-api/.env.example apps/response-api/.env

# 4. Setup database
pnpm run prisma:setup

# 5. Start development
pnpm run dev:offline
```

**Access:** http://127.0.0.1:3001 (Student) | http://127.0.0.1:3002 (Lecturer)

**Test User:** `lecturer@test.com` / `abcd1234`

## Detailed Setup Guide

### Step 1: Clone the Repository

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/klicker-uzh.git
cd klicker-uzh

# Add upstream remote for syncing
git remote add upstream https://github.com/uzh-bf/klicker-uzh.git

# Verify remotes
git remote -v
```

**Expected output:**
```
origin    https://github.com/YOUR_USERNAME/klicker-uzh.git (fetch)
origin    https://github.com/YOUR_USERNAME/klicker-uzh.git (push)
upstream  https://github.com/uzh-bf/klicker-uzh.git (fetch)
upstream  https://github.com/uzh-bf/klicker-uzh.git (push)
```

### Step 2: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This installs dependencies for all 14 applications and 13 packages (~5-10 minutes first time).

**Verify installation:**
```bash
# Check Node version
node --version  # Should be v20.19.4

# Check pnpm version
pnpm --version  # Should be 10.15.0

# Check workspace structure
pnpm list --depth 0
```

### Step 3: Start Infrastructure Services

KlickerUZH requires several infrastructure services. We use Docker Compose to run them locally.

```bash
# Start all required services
docker-compose up -d postgres redis-exec redis-cache redis-assessment hatchet-server hatchet-engine
```

**Services started:**
- **PostgreSQL 15** (port 5432) - Main database
- **Redis** (port 6379) - Live quiz execution state
- **Redis** (port 6380) - Response caching
- **Redis** (port 6381) - Assessment mode state
- **Hatchet Server** (port 8888) - Workflow server
- **Hatchet Engine** (port 7077) - Workflow engine

**Verify services are running:**
```bash
docker-compose ps
```

All services should show status "Up" or "running".

**View logs:**
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs postgres
docker-compose logs redis-exec
```

### Step 4: Configure Environment Variables

KlickerUZH uses environment variables for configuration. You have two options:

#### Option A: Using .env Files (Recommended for Contributors)

Copy the example files:

```bash
# Backend (main GraphQL API)
cp apps/backend-docker/.env.example apps/backend-docker/.env

# GraphQL package (for tests)
cp packages/graphql/.env.example packages/graphql/.env

# Hatchet workers (background jobs)
cp apps/hatchet-worker-general/.env.example apps/hatchet-worker-general/.env
cp apps/hatchet-worker-response-processor/.env.example apps/hatchet-worker-response-processor/.env

# Response API (high-throughput endpoint)
cp apps/response-api/.env.example apps/response-api/.env
```

**Default values work out of the box!** You typically don't need to modify these files unless you:
- Changed Docker port mappings
- Want to enable optional features (Azure services, email, etc.)

#### Option B: Using Doppler (Core Team Only)

If you're a core team member with Doppler access:

```bash
# Login to Doppler
doppler login

# Setup the project
doppler setup

# Select configuration
# - dev: Standard development
# - dev_cypress: E2E testing
# - dev_lti: LTI development
# - dev_assessment: Assessment mode
```

**Most contributors should use Option A.**

### Step 5: Database Setup

Initialize the PostgreSQL database with the schema and seed data:

```bash
# Full setup: migrations + seeding
pnpm run prisma:setup
```

This command:
1. Pushes the Prisma schema to PostgreSQL
2. Runs any pending migrations
3. Seeds the database with test data

**What gets seeded:**
- Test users (lecturers and students)
- Sample courses
- Sample questions (SC, MC, Kprim, Numerical, Free Text)
- Sample live quizzes and practice quizzes
- Gamification data (achievements, XP)

**Test user accounts created:**
- `lecturer@test.com` / `abcd1234` (Lecturer)
- `participant1@test.com` / `abcd1234` (Student)
- `participant2@test.com` / `abcd1234` (Student)
- ... (50+ participant accounts)

**Database management commands:**
```bash
# Open Prisma Studio (database GUI)
pnpm run prisma:studio

# Reset database (⚠️ destroys all data)
pnpm run prisma:reset

# Re-seed without resetting
pnpm run --filter @klicker-uzh/prisma-data seed

# Create migration
pnpm run prisma:migrate

# Deploy migrations (production)
pnpm run prisma:deploy
```

### Step 6: Start Development Servers

Start all development servers:

```bash
# Start all apps in development mode (without Doppler)
pnpm run dev:offline
```

**This starts 14+ processes** using Turborepo's orchestration. Wait ~1-2 minutes for all services to be ready.

**Access the applications:**

| Application | URL | Description |
|-------------|-----|-------------|
| Frontend PWA | http://127.0.0.1:3001 | Student interface |
| Frontend Manage | http://127.0.0.1:3002 | Lecturer interface |
| Frontend Control | http://127.0.0.1:3003 | Mobile controller |
| Auth | http://127.0.0.1:3010 | Authentication |
| Backend API | http://127.0.0.1:3000/graphql | GraphQL endpoint |
| Chat | http://127.0.0.1:3004 | AI chat |
| LTI | http://127.0.0.1:4000 | LTI integration |
| Analytics | http://127.0.0.1:5000 | Analytics API |

**Verify setup:**
1. Open http://127.0.0.1:3002 (Manage frontend)
2. You should see the login page
3. Login with `lecturer@test.com` / `abcd1234`
4. You should see the lecturer dashboard

**Success!** Your development environment is ready.

## Environment Configuration

### Required Variables

These are the minimum variables needed for local development (already in `.env.example`):

```bash
# Database
DATABASE_URL="postgres://klicker-prod:klicker@localhost:5432/klicker-prod"

# App Security
APP_SECRET="abcd"  # Change this in production!

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_CACHE_HOST="localhost"
REDIS_CACHE_PORT=6380

# API Domain
API_DOMAIN="api.klicker.com"
COOKIE_DOMAIN=".klicker.com"

# App Origins
APP_ORIGIN_AUTH="http://127.0.0.1:3010"
APP_ORIGIN_API="http://127.0.0.1:3000"
APP_ORIGIN_PWA="http://127.0.0.1:3001"
APP_ORIGIN_MANAGE="http://127.0.0.1:3002"
APP_ORIGIN_CONTROL="http://127.0.0.1:3003"

# Hatchet (workflow orchestration)
HATCHET_CLIENT_TOKEN=__HATCHET_CLIENT_TOKEN__  # Get from Hatchet server logs
HATCHET_CLIENT_HOST_PORT=localhost:7077
HATCHET_CLIENT_TLS_STRATEGY=none
```

### Getting the Hatchet Token

After starting Hatchet, you need to copy the client token:

```bash
# View Hatchet server logs
docker-compose logs hatchet-server

# Look for a line like:
# HATCHET_CLIENT_TOKEN=ht_...
```

Copy this token to your `.env` files:
- `apps/backend-docker/.env`
- `apps/hatchet-worker-general/.env`
- `apps/hatchet-worker-response-processor/.env`

### Optional Variables (External Services)

These enable additional features but aren't required for basic development:

#### Azure Blob Storage (File Uploads)

```bash
BLOB_STORAGE_ACCOUNT_NAME="your-account"
BLOB_STORAGE_ACCESS_KEY="your-key"
```

**Without this:** File upload features are disabled.

#### Azure AI (Chat Features)

```bash
AZURE_API_KEY="your-key"
AZURE_RESOURCE_NAME="your-resource"
```

**Without this:** AI chat is disabled.

#### Edu-ID OAuth (Swiss Academic Authentication)

```bash
EDUID_CLIENT_SECRET="your-secret"
```

**Without this:** OAuth login is disabled (basic email/password still works).

#### Email Service (Notifications)

```bash
EMAIL_TYPE="smtp"
EMAIL_HOST="smtp.example.com"
EMAIL_PORT=587
EMAIL_SECURE="true"
EMAIL_USER="your-user"
EMAIL_PASS="your-password"
EMAIL_FROM="noreply@example.com"
```

**Without this:** Email notifications are disabled (use MailHog for testing).

#### Push Notifications

```bash
VAPID_PUBLIC_KEY="your-public-key"
VAPID_PRIVATE_KEY="your-private-key"
```

**Without this:** Push notifications are disabled.

### Environment Variable Reference

Full list of all 82 environment variables: See [turbo.json](../turbo.json#L2-L82)

## Development Modes

### Full Stack Development

Run everything:

```bash
pnpm run dev:offline
```

### Frontend-Only Development

Run just the frontends (requires backend to be running separately):

```bash
# In terminal 1: Start backend
turbo run dev --filter=@klicker-uzh/backend-docker

# In terminal 2: Start frontend
turbo run dev --filter=@klicker-uzh/frontend-pwa
```

### Backend-Only Development

```bash
turbo run dev --filter=@klicker-uzh/backend-docker
```

### Specific App Development

```bash
# Student frontend only
turbo run dev --filter=@klicker-uzh/frontend-pwa

# Lecturer frontend only
turbo run dev --filter=@klicker-uzh/frontend-manage

# Auth service only
turbo run dev --filter=@klicker-uzh/auth

# Multiple apps
turbo run dev --filter=@klicker-uzh/frontend-pwa --filter=@klicker-uzh/backend-docker
```

### Package Development

When developing shared packages, you need to rebuild them for changes to be picked up:

```bash
# Rebuild a specific package
pnpm run build --filter=@klicker-uzh/graphql

# Rebuild all packages
pnpm run build
```

**Hot reload:** Some packages (like `shared-components`) are not pre-built and hot-reload automatically.

### Test Environment

For running E2E tests:

```bash
# Build test environment
pnpm run build:test

# Start test environment
pnpm run start:test

# In another terminal, run tests
cd cypress
pnpm run cypress:open
```

### Assessment Mode

Special mode for assessments (exams):

```bash
pnpm run dev:assessment
```

### LTI Development

For LTI integration development:

```bash
pnpm run dev:lti
```

### Documentation Development

Run just the documentation site:

```bash
pnpm run dev:docs
```

Access at: http://localhost:5500

## Troubleshooting

### "Command not found: doppler"

**Solution:** Use `dev:offline` instead of `dev`:

```bash
pnpm run dev:offline
```

Alternatively, install Doppler (core team only):
```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux
curl -Ls https://cli.doppler.com/install.sh | sh
```

### "Port already in use"

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or kill all node processes (⚠️ nuclear option)
killall node
```

### "Cannot connect to database"

**Check Docker:**
```bash
docker-compose ps  # Should show postgres as "Up"
docker-compose logs postgres  # Check for errors
```

**Verify connection:**
```bash
# Using psql
psql postgres://klicker-prod:klicker@localhost:5432/klicker-prod

# Inside Docker
docker-compose exec postgres psql -U klicker-prod
```

**Reset database:**
```bash
docker-compose down postgres
docker-compose up -d postgres
pnpm run prisma:setup
```

### "Module not found" Errors

**Symptom:** `Cannot find module '@klicker-uzh/prisma'`

**Solution:**

```bash
# Rebuild required packages
pnpm run build --filter=@klicker-uzh/prisma
pnpm run build --filter=@klicker-uzh/graphql
pnpm run build --filter=@klicker-uzh/util
pnpm run build --filter=@klicker-uzh/markdown
pnpm run build --filter=@klicker-uzh/transactional

# Or rebuild everything
pnpm run build

# Clear turbo cache if issues persist
rm -rf .turbo
pnpm run build
```

### "GraphQL schema generation failed"

**Symptom:** Errors during `pnpm run dev` related to GraphQL schema

**Solution:**

```bash
# Ensure database is running and migrated
docker-compose up -d postgres
pnpm run prisma:setup

# Rebuild GraphQL package
pnpm run build --filter=@klicker-uzh/graphql

# Check for TypeScript errors
pnpm run check --filter=@klicker-uzh/graphql
```

### Docker Issues

**Services won't start:**
```bash
# Restart Docker Desktop
# Or reset all containers
docker-compose down
docker-compose up -d
```

**Out of disk space:**
```bash
# Clean up Docker
docker system prune -a

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune -a
```

### Slow Performance

**Symptoms:**
- Slow builds
- Slow hot reload
- High CPU usage

**Solutions:**

1. **Increase Docker resources:**
   - Docker Desktop → Settings → Resources
   - Increase CPUs to 4+
   - Increase RAM to 8GB+

2. **Exclude from antivirus:**
   - Add `node_modules` and `.turbo` to exclusions

3. **Use faster disk:**
   - SSD highly recommended
   - Avoid network drives

4. **Run fewer services:**
   ```bash
   # Instead of full stack
   turbo run dev --filter=@klicker-uzh/frontend-pwa --filter=@klicker-uzh/backend-docker
   ```

### Hatchet Token Issues

**Symptom:** Workers can't connect to Hatchet

**Solution:**

```bash
# Get token from Hatchet logs
docker-compose logs hatchet-server | grep HATCHET_CLIENT_TOKEN

# Update .env files
# apps/backend-docker/.env
# apps/hatchet-worker-general/.env
# apps/hatchet-worker-response-processor/.env

# Restart services
pnpm run dev:offline
```

### Tests Failing Locally

**Check environment:**
```bash
# Ensure test environment is configured
cp packages/graphql/test/docker/.env.example packages/graphql/test/docker/.env
```

**Reset test database:**
```bash
# Stop test environment
pnpm run prisma:reset

# Restart
pnpm run prisma:setup
```

### Still Stuck?

1. **Check logs:**
   ```bash
   # Docker logs
   docker-compose logs

   # App logs (in terminal where pnpm run dev is running)
   ```

2. **Search existing issues:**
   - [GitHub Issues](https://github.com/uzh-bf/klicker-uzh/issues)
   - [Discussions](https://github.com/uzh-bf/klicker-uzh/discussions)

3. **Ask for help:**
   - [Community Forum](https://community.klicker.uzh.ch)
   - [GitHub Discussions](https://github.com/uzh-bf/klicker-uzh/discussions)

When asking for help, include:
- Operating system and version
- Node.js and pnpm versions
- Error messages (full stack trace)
- Steps to reproduce
- What you've already tried

## Next Steps

Now that your environment is set up:

1. **Explore the codebase:**
   - Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system
   - Browse `packages/` and `apps/` directories
   - Check out the GraphQL schema in `packages/graphql/src/public/schema.graphql`

2. **Make your first change:**
   - Find a [good first issue](https://github.com/uzh-bf/klicker-uzh/labels/good%20first%20issue)
   - Create a feature branch
   - Make your changes
   - Run tests: `pnpm run test:run`
   - Submit a PR

3. **Learn the development workflow:**
   - Read [CONTRIBUTING.md](../CONTRIBUTING.md)
   - Understand our [coding standards](../CONTRIBUTING.md#coding-standards)
   - Review the [PR process](../CONTRIBUTING.md#submitting-changes)

4. **Join the community:**
   - Introduce yourself in [Discussions](https://github.com/uzh-bf/klicker-uzh/discussions)
   - Join the [Community Forum](https://community.klicker.uzh.ch)
   - Follow our [roadmap](https://klicker-uzh.feedbear.com)

**Happy coding! 🚀**

---

**Have suggestions for this guide?** [Submit a PR](https://github.com/uzh-bf/klicker-uzh/pulls) or [create a discussion](https://github.com/uzh-bf/klicker-uzh/discussions).
