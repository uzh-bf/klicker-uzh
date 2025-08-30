# Suggested Commands for Development

## Essential Development Commands

### Starting Development

```bash
# Install dependencies
pnpm install

# Start full development environment with Doppler
pnpm dev
```

### Code Quality & Validation

```bash
# Run all checks (format, lint, syncpack)
pnpm check

# Format code
pnpm format

# Check formatting only
pnpm format:check

# Run linting
pnpm lint

# Type checking (in specific packages)
pnpm --filter @klicker-uzh/graphql check
```

### Building & Testing

```bash
# Build all packages
pnpm build

# Build for testing
pnpm build:test

# Run tests after build:test
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

## Environment Variables

- Uses Doppler for secret management
- Local development configs in doppler.yaml
- Override with .env files if needed

## Common Ports

- 3000: Backend
- 3001: Frontend PWA
- 3002: Frontend Manage
- 3003: Frontend Control
- 3010: Auth service
- 5432: PostgreSQL
- 6379: Redis
