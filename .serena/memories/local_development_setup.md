# Local Development Setup

## Overview

KlickerUZH uses a sophisticated local development setup with custom domains, HTTPS certificates, and a Traefik reverse proxy to closely mirror the production environment.

## Architecture

- **Reverse Proxy**: Traefik handles routing between services
- **Custom Domains**: \*.klicker.com domains for all services
- **HTTPS**: Local certificates generated with mkcert
- **Docker Services**: PostgreSQL, Redis, and reverse proxy in containers
- **Host Applications**: Next.js/Node.js apps running on host system

## Domain Configuration

### Local Domains (add to /etc/hosts)

```
127.0.0.1	api.klicker.com
127.0.0.1	pwa.klicker.com
127.0.0.1	manage.klicker.com
127.0.0.1	control.klicker.com
127.0.0.1	auth.klicker.com
127.0.0.1	func-responses.klicker.com
127.0.0.1	func-response-processor.klicker.com
```

### Service Mapping

| Domain                              | Service            | Port | Description         |
| ----------------------------------- | ------------------ | ---- | ------------------- |
| api.klicker.com                     | Backend Docker     | 3000 | GraphQL API         |
| pwa.klicker.com                     | Frontend PWA       | 3001 | Student interface   |
| manage.klicker.com                  | Frontend Manage    | 3002 | Lecturer interface  |
| control.klicker.com                 | Frontend Control   | 3003 | Mobile controller   |
| auth.klicker.com                    | Auth Service       | 3010 | Authentication      |
| func-responses.klicker.com          | Incoming Responses | 7072 | Live quiz responses |
| func-response-processor.klicker.com | Response Processor | 7073 | Response processing |

## HTTPS Setup

### mkcert Installation

```bash
# macOS
brew install mkcert

# Linux
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Windows
choco install mkcert
# or download from GitHub releases
```

### Certificate Generation

```bash
# Install the local CA
mkcert -install

# Create SSL directory and generate certificates
mkdir -p util/traefik/ssl
cd util/traefik/ssl
mkcert klicker.com "*.klicker.com"

# This creates:
# - klicker.com+1.pem (certificate)
# - klicker.com+1-key.pem (private key)
```

## Docker Configuration

### Platform-Specific Services

**macOS**:

```bash
docker compose up -d postgres redis_exec redis_cache reverse_proxy_macos
```

**WSL**:

```bash
docker compose up -d postgres redis_exec redis_cache reverse_proxy_wsl
```

### Traefik Configuration

Traefik is configured via `util/traefik/rules_docker.yaml` with:

- HTTP (port 80) and HTTPS (port 443) entrypoints
- Automatic routing to local services
- SSL certificate mounting from util/traefik/ssl/
- Dashboard accessible at http://localhost:8080

## Database Setup

### PostgreSQL Configuration

- **Container**: postgres:15
- **Port**: 5432
- **Database**: klickerv3
- **User**: postgres
- **Password**: (configured in Doppler)

### Redis Configuration

- **Execution Cache**: redis_exec (port 6379)
- **General Cache**: redis_cache (port 6380)

### Initial Database Setup

```bash
# Setup database with migrations
pnpm run prisma:setup

# Or reset existing database
pnpm run prisma:reset

# Deploy specific migrations
pnpm run prisma:deploy
```

## Environment Management

### Doppler Configuration

Doppler configs in `doppler.yaml`:

- `dev`: Main development config
- `dev_cypress`: Cypress testing config
- `dev_lti`: LTI integration config
- `dev_cleverreach`: CleverReach integration config

### Key Environment Variables

```bash
# API Configuration
API_DOMAIN=https://api.klicker.com
APP_SECRET=<secret>

# Database
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/klickerv3

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Service Bus (for Azure functions)
SERVICE_BUS_CONNECTION_STRING=<connection_string>

# Node Environment
NODE_ENV=development
```

## Development Users

### Default Accounts

**Lecturer Account** (for manage.klicker.com):

- Username: `lecturer`
- Password: `abcd`

**Student Account** (for pwa.klicker.com):

- Username: `testuser1`
- Password: `abcd`

## Development Workflow

### Standard Development

```bash
# 1. Start infrastructure
pnpm run dev:prepare-prod
# OR for full setup with Doppler
pnpm dev

# 2. Access applications
open https://manage.klicker.com    # Lecturer interface
open https://pwa.klicker.com       # Student interface
open https://control.klicker.com   # Mobile controller
```

### Production Data Development

```bash
# Prepare environment with production dumps
./util/_prepare_local_prod.sh

# This script:
# 1. Resets docker compose with volumes
# 2. Loads postgres dump from util/dump.tar
# 3. Loads redis dump from util/redis.dump
# 4. Applies prisma migrations
```

## Troubleshooting

### Common Issues

1. **Certificate Issues**

   - Ensure mkcert is installed and CA is trusted
   - Regenerate certificates if expired
   - Check browser certificate warnings

2. **Domain Resolution**

   - Verify /etc/hosts entries
   - Clear DNS cache: `sudo dscacheutil -flushcache` (macOS)

3. **Port Conflicts**

   - Check for services using ports 80, 443, 3000-3010
   - Kill conflicting processes: `lsof -i :PORT`

4. **Docker Issues**
   - Ensure Docker is running
   - Reset volumes: `docker compose down -v`
   - Check container logs: `docker compose logs SERVICE_NAME`

### Verification

```bash
# Test domain resolution
ping api.klicker.com

# Test HTTPS certificates
curl -I https://manage.klicker.com

# Check running services
docker compose ps

# Test database connection
pnpm --filter @klicker-uzh/prisma prisma:studio
```

## Platform Considerations

### macOS

- Uses `reverse_proxy_macos` Docker service
- Native Docker Desktop integration
- mkcert integrates with Keychain

### WSL (Windows Subsystem for Linux)

- Uses `reverse_proxy_wsl` Docker service
- May require Docker Desktop with WSL2 backend
- Network configuration might need adjustments

### Linux

- Similar to WSL configuration
- May need manual certificate trust setup
- Ensure Docker permissions are configured
