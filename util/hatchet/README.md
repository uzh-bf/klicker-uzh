# Hatchet Integration for KlickerUZH

This directory contains the Hatchet workflow orchestration setup for KlickerUZH, including automated token generation and environment configuration.

## What is Hatchet?

[Hatchet](https://hatchet.run) is a distributed task queue and workflow engine that KlickerUZH uses for:

- Background job processing
- Scheduled tasks (e.g., microlearning notifications)
- Workflow orchestration
- Email processing and notifications

## Quick Start

### 1. Start Services

```bash
# From project root
./_run_app_dependencies_macos.sh
```

This starts all necessary services including:

- PostgreSQL (main + Hatchet)
- Redis
- RabbitMQ
- Hatchet Engine & Dashboard

### 2. Generate Hatchet Tokens

```bash
# From project root
./_generate_hatchet_token.sh
```

This automatically:

- Generates a JWT token using Hatchet CLI
- Updates `apps/backend-docker/.env`
- Updates `apps/hatchet/.env`

### 3. Start Your Applications

```bash
pnpm run dev
```

## What the Token Generation Does

The automated setup:

1. **Verifies Services** - Checks that Hatchet Engine and PostgreSQL are running
2. **Generates JWT Token** - Uses official `hatchet-admin` CLI with the default tenant
3. **Updates Environment Files** - Safely replaces tokens in both app `.env` files
4. **Sets TLS Strategy** - Configures `HATCHET_CLIENT_TLS_STRATEGY=none` for local development

## File Structure

```
util/hatchet/
├── README.md                           # This file
├── HATCHET-TOKEN-SETUP.md             # Detailed setup & troubleshooting
├── _generate_hatchet_token.sh         # Main token generation script
├── docker-compose.hatchet-token.yml   # Token generation services
├── token-generator.sh                 # Container script for JWT generation
└── env-updater.sh                     # Container script for .env updates
```

## Environment Variables

After running the token generation, these variables are automatically added to your `.env` files:

```bash
HATCHET_CLIENT_TOKEN=eyJhbGc...        # JWT token for authentication
HATCHET_CLIENT_TLS_STRATEGY=none       # Disable TLS for local development
HATCHET_LOG_LEVEL=INFO                 # Optional: Control log verbosity
```

## Hatchet Dashboard

Access the Hatchet web interface at: **http://localhost:8090**

Default credentials:

- **Email**: `admin@example.com`
- **Password**: `Admin123!!`

Use this to:

- Monitor workflow executions
- Debug failed jobs
- View task queues
- Manage tenants and workers

## Common Workflows

### First Time Setup

```bash
./_run_app_dependencies_macos.sh
./_generate_hatchet_token.sh
pnpm run dev
```

### Token Expired/Issues

```bash
# Regenerate tokens (services must be running)
./_generate_hatchet_token.sh
```

### Reset Everything

```bash
# Stop all services
docker compose down

# Start fresh
docker compose down -v
./_run_app_dependencies_macos.sh
./_generate_hatchet_token.sh
```

## Troubleshooting

### "Services not running" error

```bash
# Check if Hatchet services are up
docker compose ps | grep hatchet

# If not, start them
./_run_app_dependencies_macos.sh
```

### "Failed to generate token" error

```bash
# Check Hatchet engine logs
docker compose logs hatchet_engine

# Try restarting Hatchet services
docker compose restart hatchet_engine hatchet_postgres
```

### Token not working in app

1. Verify token exists in `.env` files:

   ```bash
   grep HATCHET_CLIENT_TOKEN apps/*/\.env
   ```

2. Check the token format (should start with `eyJ`):

   ```bash
   head -c 20 apps/backend-docker/.env | grep HATCHET_CLIENT_TOKEN
   ```

3. Regenerate if needed:
   ```bash
   ./_generate_hatchet_token.sh
   ```
