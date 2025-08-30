# Suggested Commands for Development

## Local Development Setup

### Initial Setup (One-time)

```bash
# 1. Add local domains to /etc/hosts (requires sudo)
sudo vim /etc/hosts
# Add these lines:
127.0.0.1	api.klicker.com
127.0.0.1	pwa.klicker.com
127.0.0.1	manage.klicker.com
127.0.0.1	control.klicker.com
127.0.0.1	auth.klicker.com
127.0.0.1	func-responses.klicker.com
127.0.0.1	func-response-processor.klicker.com

# 2. Install mkcert for local HTTPS
# macOS:
brew install mkcert
# Other platforms: https://github.com/FiloSottile/mkcert#installation

# 3. Setup mkcert and generate certificates
mkcert -install
mkdir -p util/traefik/ssl
cd util/traefik/ssl
mkcert klicker.com "*.klicker.com"
cd ../../..

# 4. Install dependencies
pnpm install

# 5. Setup database (first time)
pnpm run prisma:setup
```

### Starting Development

```bash
# Option 1: Full development environment with Doppler
pnpm dev

# Option 2: Offline development (no external services)
pnpm dev:offline

# Option 3: Start only infrastructure (DB, Redis, reverse proxy)
pnpm run dev:prepare-prod

# Option 4: Use production data dumps (if available)
./util/_prepare_local_prod.sh
```

### Platform-Specific Commands

```bash
# macOS Docker setup
docker compose up -d postgres redis_exec redis_cache reverse_proxy_macos

# WSL Docker setup
docker compose up -d postgres redis_exec redis_cache reverse_proxy_wsl
```

## Essential Development Commands

### Code Quality & Validation

```bash
# Run all checks (format, lint, syncpack)
pnpm run check

# Format code
pnpm format

# Check formatting only
pnpm format:check

# Run linting
pnpm lint

# Type checking (in specific packages)
cd apps/frontend-manage && pnpm check
```

### Building & Testing

```bash
# Build all packages
pnpm build

# Build for testing
pnpm build:test

# Run tests
pnpm test:run           # Run all tests
pnpm test:watch         # Watch mode
cd cypress && pnpm cypress open  # Open Cypress UI
```

### Database Management

```bash
# Deploy Prisma migrations
pnpm run prisma:deploy

# Create new migration
pnpm run prisma:migrate

# Reset database
pnpm run prisma:reset

# Open Prisma Studio (database GUI)
pnpm run prisma:studio

# Sync Prisma schema between packages
pnpm run prisma:sync
# OR
./util/sync-schema.sh
```

### Release Management

```bash
# Create releases
pnpm release        # Standard release
pnpm release:alpha  # Alpha release
pnpm release:beta   # Beta release
pnpm release:rc     # Release candidate

# Dry run (preview)
pnpm release:dry
```

### Utility Commands

```bash
# List tasks/scripts in a package
pnpm run --filter @klicker-uzh/frontend-manage

# Run command in specific package
pnpm --filter @klicker-uzh/graphql dev

# Clean and rebuild
pnpm prune
pnpm install
pnpm build
```

## System Commands (macOS/Darwin)

### File Operations

```bash
ls -la              # List files with details
find . -name "*.ts" # Find TypeScript files
grep -r "pattern"   # Search in files
cat filename        # View file contents
```

### Git Operations

```bash
git status
git diff
git log --oneline -10
git checkout v3     # Main branch
```

### Process Management

```bash
lsof -i :3000       # Check port usage
ps aux | grep node  # Find Node processes
kill -9 PID         # Force kill process
```

## Local Development URLs

Access the applications via these local domains:

- **API/Backend**: https://api.klicker.com
- **Student PWA**: https://pwa.klicker.com
- **Lecturer Management**: https://manage.klicker.com
- **Mobile Control**: https://control.klicker.com
- **Authentication**: https://auth.klicker.com
- **Traefik Dashboard**: http://localhost:8080

## Default Development Users

- **Manage Interface**: username `lecturer`, password `abcd`
- **PWA Interface**: username `testuser1`, password `abcd`

## Environment Variables

- Uses Doppler for secret management
- Local development configs in doppler.yaml
- Override with .env files if needed

## Common Ports

- 80/443: Traefik reverse proxy
- 3000: Backend GraphQL API
- 3001: Frontend PWA
- 3002: Frontend Manage
- 3003: Frontend Control
- 3010: Auth service
- 5432: PostgreSQL
- 6379: Redis
- 8080: Traefik dashboard
