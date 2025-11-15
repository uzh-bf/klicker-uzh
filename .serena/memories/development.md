# Development Workflow

## Initial Setup

### Prerequisites

**Required:**
- Node.js (LTS version via Volta - check .volta in package.json)
- pnpm (version specified in package.json)
- Docker Desktop
- Git

**Optional:**
- mkcert (for local HTTPS)
- Doppler CLI (core team only, not required)

### First-Time Setup

**1. Clone and install:**
```bash
git clone https://github.com/uzh-bf/klicker-uzh.git
cd klicker-uzh
pnpm install
```

**2. Start infrastructure:**
```bash
docker-compose up -d postgres redis-exec redis-cache redis-assessment hatchet-server hatchet-engine
```

**3. Configure environment:**
```bash
# Copy example files
cp apps/backend-docker/.env.example apps/backend-docker/.env
cp packages/graphql/.env.example packages/graphql/.env
cp apps/hatchet-worker-general/.env.example apps/hatchet-worker-general/.env
cp apps/hatchet-worker-response-processor/.env.example apps/hatchet-worker-response-processor/.env
cp apps/response-api/.env.example apps/response-api/.env

# Get Hatchet token from logs
docker-compose logs hatchet-server | grep HATCHET_CLIENT_TOKEN
# Copy token to .env files above
```

**4. Setup database:**
```bash
pnpm prisma:setup  # Runs migrations + seeds test data
```

**5. Start development:**
```bash
pnpm dev:offline  # Starts all services without Doppler
```

**6. Verify:**
- Student app: http://127.0.0.1:3001
- Lecturer app: http://127.0.0.1:3002
- API: http://127.0.0.1:3000/graphql
- Login: `lecturer@test.com` / `abcd1234`

## Development Modes

### Full Stack

```bash
pnpm dev:offline  # Self-contained (no Doppler or external services)
pnpm dev          # Full environment (requires Doppler)
pnpm dev:test     # E2E test environment
pnpm dev:assessment  # Assessment mode
pnpm dev:lti      # LTI integration development
```

### Single Application

```bash
# Specific app
turbo dev --filter=@klicker-uzh/frontend-pwa

# Multiple apps
turbo dev --filter=@klicker-uzh/frontend-pwa --filter=@klicker-uzh/backend-docker

# With dependencies (builds required packages first)
turbo dev --filter=@klicker-uzh/frontend-manage
```

### Infrastructure Only

```bash
# Just Docker services
docker-compose up -d postgres redis-exec redis-cache

# Then manually start apps as needed
cd apps/frontend-pwa && pnpm dev
```

## Daily Workflow

**Standard development cycle:**

1. **Start infrastructure** (if not running):
   ```bash
   docker-compose up -d postgres redis-exec redis-cache
   ```

2. **Start development servers:**
   ```bash
   pnpm dev:offline
   ```

3. **Make changes** (hot reload automatic)

4. **Format code** (or let pre-commit do it):
   ```bash
   pnpm format
   ```

5. **Run tests:**
   ```bash
   pnpm test:run
   ```

6. **Commit** (pre-commit hooks run automatically)

## Adding Features

### Database Changes

**Workflow:**
```bash
# 1. Edit schema
vim packages/prisma/src/prisma/course.prisma

# 2. Create migration
pnpm prisma:migrate
# Enter migration name when prompted

# 3. Sync across packages
./util/sync-schema.sh

# 4. If GraphQL types changed, rebuild
pnpm build --filter=@klicker-uzh/graphql

# 5. Update seed data if needed
vim packages/prisma-data/src/data/seedTEST.ts
```

**Migration naming:**
- Descriptive: `add_course_sharing_permissions`
- Not timestamps: ❌ `migration_20250101`

### GraphQL Changes

**Add new query/mutation:**
```bash
# 1. Define in schema
vim packages/graphql/src/schema/course.ts

# 2. Create operation file
vim packages/graphql/src/graphql/ops/QGetSharedCourses.graphql

# 3. Rebuild to generate types
pnpm build --filter=@klicker-uzh/graphql

# 4. Use in frontend
# Types are automatically available via codegen
```

**Pattern:**
- Schema definition (TypeScript)
- Operation file (.graphql)
- Rebuild generates types
- Import and use types in components

### Frontend Changes

**Add component:**
```bash
# 1. Create component file
vim apps/frontend-manage/src/components/courses/CourseCard.tsx

# 2. Add GraphQL operation if needed
vim packages/graphql/src/graphql/ops/QGetCourseDetails.graphql

# 3. Rebuild GraphQL for types
pnpm build --filter=@klicker-uzh/graphql

# 4. Test locally (hot reload)

# 5. Add E2E test
vim cypress/cypress/e2e/course-workflow.cy.ts
```

### Backend Changes

**Add service function:**
```bash
# 1. Add function to service
vim packages/graphql/src/services/courses.ts

# 2. Add resolver
vim packages/graphql/src/schema/course.ts

# 3. Rebuild
pnpm build --filter=@klicker-uzh/graphql

# 4. Test with GraphQL operation
```

## Testing

### Unit Tests

```bash
# All unit tests
pnpm test:run

# Specific package
pnpm --filter=@klicker-uzh/graphql test

# Watch mode (re-run on changes)
pnpm test:watch

# With coverage
pnpm test:run --coverage
```

### E2E Tests

```bash
# Build test environment
pnpm build:test

# Start test servers
pnpm start:test

# In another terminal, run Cypress
cd cypress
pnpm cypress:open  # Interactive mode
pnpm test:cypress  # Headless mode
```

### Testing Specific Features

**Database-heavy features:**
```bash
# Reset database to known state
pnpm prisma:reset

# Re-seed with test data
pnpm prisma:setup
```

**GraphQL operations:**
- Use GraphQL Playground: http://127.0.0.1:3000/graphql
- Operations auto-documented from schema

## Quality Checks

### Pre-Commit (Automatic)

```bash
# Runs automatically on git commit
- Prettier format check
- ESLint validation
- Lint-staged for changed files
```

### Manual Checks

```bash
# Format
pnpm format:check  # Check only
pnpm format        # Fix formatting

# Lint
pnpm lint          # All packages

# Type check
pnpm check         # TypeScript validation
pnpm check:all     # Types + format + lint + syncpack

# All at once
pnpm check:all
```

### Build Validation

```bash
# Development build
pnpm build

# Production build
NODE_ENV=production pnpm build

# Test build (with coverage instrumentation)
pnpm build:test
```

## Package Management

### Rebuild Packages

**When needed:**
- After pulling changes
- After `pnpm install`
- When types are out of sync

```bash
# Core packages (most common)
pnpm build --filter=@klicker-uzh/prisma
pnpm build --filter=@klicker-uzh/graphql

# All packages
pnpm build

# Clear cache if issues
rm -rf .turbo
pnpm build
```

### Add Dependencies

```bash
# To workspace root
pnpm add <package> -w

# To specific package
pnpm add <package> --filter=@klicker-uzh/frontend-pwa

# Dev dependency
pnpm add -D <package> --filter=@klicker-uzh/backend-docker
```

## Troubleshooting

### Port Conflicts

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or kill all node processes (nuclear option)
killall node
```

### Database Issues

```bash
# Check if running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart
docker-compose restart postgres

# Full reset
docker-compose down postgres
docker-compose up -d postgres
pnpm prisma:setup
```

### Module Not Found

```bash
# Rebuild required packages
pnpm build --filter=@klicker-uzh/prisma --filter=@klicker-uzh/graphql

# Or rebuild everything
pnpm build

# Clear Turbo cache
rm -rf .turbo
pnpm build

# Nuclear option: clean install
rm -rf node_modules
pnpm install
pnpm build
```

### GraphQL Schema Issues

```bash
# Ensure database is migrated
pnpm prisma:setup

# Rebuild GraphQL package
pnpm build --filter=@klicker-uzh/graphql

# Check for TypeScript errors
pnpm check --filter=@klicker-uzh/graphql
```

### Docker Issues

```bash
# Restart all services
docker-compose restart

# Stop and remove containers
docker-compose down

# Rebuild containers
docker-compose build

# Remove all containers and volumes (nuclear)
docker-compose down -v
docker-compose up -d
```

### Hatchet Token Issues

```bash
# Get token from logs
docker-compose logs hatchet-server | grep HATCHET_CLIENT_TOKEN

# Update in .env files:
# - apps/backend-docker/.env
# - apps/hatchet-worker-general/.env
# - apps/hatchet-worker-response-processor/.env

# Restart services
pnpm dev:offline
```

### Performance Issues

**Slow builds:**
```bash
# Clear caches
rm -rf .turbo
rm -rf node_modules/.cache

# Docker resource limits (increase in Docker Desktop settings):
# - CPUs: 4+
# - RAM: 8GB+
```

**Slow hot reload:**
```bash
# Run fewer services
turbo dev --filter=@klicker-uzh/frontend-pwa --filter=@klicker-uzh/backend-docker

# Check file watchers
# macOS/Linux: May need to increase fs.inotify.max_user_watches
```

## Environment Variables

### Required Variables

**Database:**
- `DATABASE_URL` - PostgreSQL connection string
- `SHADOW_DATABASE_URL` - For migrations (optional)

**Redis:**
- `REDIS_HOST`, `REDIS_PORT` - Main Redis
- `REDIS_CACHE_HOST`, `REDIS_CACHE_PORT` - Cache Redis

**Application:**
- `APP_SECRET` - Session encryption key
- `API_DOMAIN` - API domain for CORS
- `COOKIE_DOMAIN` - Cookie domain
- `APP_ORIGIN_*` - App origins for CORS

**Hatchet:**
- `HATCHET_CLIENT_TOKEN` - From Hatchet server logs
- `HATCHET_CLIENT_HOST_PORT` - localhost:7077
- `HATCHET_CLIENT_TLS_STRATEGY` - none (local)

### Optional Variables

**Azure Services (disable features if not set):**
- `BLOB_STORAGE_*` - File uploads
- `AZURE_API_KEY` - AI chat

**Authentication (basic auth works without):**
- `EDUID_CLIENT_SECRET` - Edu-ID OAuth

**Email (use MailHog locally):**
- `EMAIL_*` - SMTP configuration

**Push Notifications:**
- `VAPID_*` - Web push keys

## Default Test Accounts

**Lecturer:**
- Email: `lecturer@test.com`
- Password: `abcd1234`

**Students:**
- Email: `participant1@test.com` through `participant50@test.com`
- Password: `abcd1234`

**All seeded by:** `pnpm prisma:setup`

## Git Workflow

**Branching:**
```bash
# Update v3 branch
git checkout v3
git pull upstream v3

# Create feature branch
git checkout -b feature/course-sharing

# Make changes and commit
git add .
git commit -m "feat(courses): add sharing permissions"

# Push
git push origin feature/course-sharing

# Create PR on GitHub
```

**Commit message format:**
```
type(scope): description

feat(graphql): add course sharing permissions
fix(frontend): resolve quiz timer issue
docs(readme): update setup instructions
refactor(grading): simplify score calculation
test(courses): add sharing permission tests
chore(deps): update dependencies
```

## Command Reference

**Most used commands:**
```bash
pnpm dev:offline           # Start development
pnpm format               # Format code
pnpm lint                 # Lint code
pnpm check:all            # All quality checks
pnpm test:run             # Run tests
pnpm prisma:setup         # Reset + seed database
pnpm prisma:studio        # Database GUI
pnpm build                # Build all packages
docker-compose up -d      # Start infrastructure
docker-compose logs <service>  # View logs
```

**Less common:**
```bash
pnpm prisma:migrate       # Create migration
pnpm prisma:deploy        # Deploy migrations
./util/sync-schema.sh     # Sync Prisma schema
pnpm release:alpha        # Create alpha release
pnpm syncpack:fix         # Fix version mismatches
```

## Resources

- **GraphQL API:** http://127.0.0.1:3000/graphql
- **Hatchet UI:** http://localhost:8888
- **Prisma Studio:** `pnpm prisma:studio`
- **Documentation:** http://localhost:5500 (run `pnpm dev:docs`)
