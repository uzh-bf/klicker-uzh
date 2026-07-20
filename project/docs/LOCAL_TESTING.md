# Local GitHub Actions Testing

This setup allows you to run your GitHub Actions Cypress workflow locally using the `act` tool.

## Prerequisites

You need the following installed:

1. **Docker & Docker Compose** - For running services
2. **Act** - For simulating GitHub Actions
3. **pnpm** - Your package manager (should already be installed)
4. **Node 20** - Should already be configured via Volta

### Installing Act

```bash
# macOS
brew install act

# Or manually (Linux/macOS)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

## Quick Start

### 1. One-time Setup

```bash
# Copy secrets template (if not already done)
cp act.secrets.template act.secrets

# Edit act.secrets if needed (default values should work for local testing)
# vim act.secrets
```

### 2. Run the Complete Workflow

```bash
npm run test:act
```

This command will:
- Start infrastructure services (PostgreSQL, Redis, Hatchet) via Docker Compose
- Run the complete `cypress-run-parallel-draft` GitHub Actions workflow
- The workflow itself will handle:
  - Installing dependencies
  - Building the application
  - Creating Hatchet tokens
  - Running database migrations
  - Starting application services
  - Waiting for services to be ready
  - Running Cypress tests
- Clean up when complete

## How It Works

The setup uses a **three-layer approach**:

1. **Infrastructure Services** (Docker Compose) - PostgreSQL, Redis, Hatchet
2. **GitHub Actions Simulation** (Act) - Runs the complete CI workflow
3. **Application Services** (Started by the workflow) - Your actual applications

This approach ensures that your local testing environment matches CI exactly.

## Manual Commands

If you need more control:

```bash
# Start infrastructure services only
npm run test:services:up

# Run act manually with specific options
act pull_request \
  -j cypress-run-parallel-draft \
  --secret-file act.secrets \
  --container-architecture linux/amd64

# Stop infrastructure services
npm run test:services:down

# Check service status
docker-compose -f docker-compose.test.yml ps
```

## Troubleshooting

### Common Issues

**1. Services won't start**
```bash
# Check if Docker is running
docker info

# Check for port conflicts
lsof -i :5432 -i :6379 -i :8888

# Clean up and retry
docker-compose -f docker-compose.test.yml down -v
npm run test:services:up
```

**2. Act fails with "pull access denied"**
```bash
# Try with explicit architecture (for Apple Silicon Macs)
act pull_request -j cypress-run-parallel-draft --secret-file act.secrets --container-architecture linux/amd64
```

**3. "act.secrets file not found"**
```bash
cp act.secrets.template act.secrets
```

**4. Workflow fails during build/test steps**
- This means act is working, but there's an issue in the workflow steps
- Check the act output for specific error messages
- Common issues: missing environment variables, build failures, test failures

**5. Application services fail to start**
```bash
# Check the service logs from within the act container
# The workflow will show detailed error messages if services fail
```

**6. Tests fail but pass in CI**
- Ensure your local environment matches CI (Node version, etc.)
- Check if there are any local files interfering
- Verify all secrets in act.secrets are correct

### Debugging Tips

1. **Use verbose mode**: Edit `.actrc` to add `-v` for more detailed output
2. **Check Docker logs**: `docker-compose -f docker-compose.test.yml logs`
3. **Monitor resource usage**: `docker stats` (act can be resource-intensive)
4. **Test services individually**: Start services manually and test connectivity

## What Gets Created

When you run the setup, these files are created/used:

- `.actrc` - Act configuration for Docker and container settings
- `docker-compose.test.yml` - Infrastructure service definitions matching CI
- `act.secrets` - Local secrets (gitignored, created from template)
- `run-act-local.sh` - Main runner script that orchestrates everything
- `.github/events/pull_request_draft.json` - Mock event data for act

## Performance Notes

- Act downloads and runs CI containers locally, which requires significant resources
- First run will be slow due to Docker image downloads
- Subsequent runs should be much faster due to Docker layer caching
- On Apple Silicon Macs, you may need to use `--container-architecture linux/amd64`

## Alternative: Manual Testing (Without Act)

If act is too resource-intensive or complex, you can also run tests manually:

```bash
# 1. Start infrastructure services
npm run test:services:up

# 2. Build the application
pnpm install
pnpm run --filter @klicker-uzh/prisma build:test
pnpm run build:test

# 3. Setup environment
./util/_create_hatchet_token_cypress.sh

# 4. Run database migrations
cd packages/prisma
pnpm run prisma:reset:raw -f
cd ../..

# 5. Start application services
pnpm run start:test:ci &

# 6. Wait for services and run tests manually
# (This is more complex and doesn't guarantee CI parity)
```

However, using `act` is recommended as it ensures your local environment exactly matches CI.