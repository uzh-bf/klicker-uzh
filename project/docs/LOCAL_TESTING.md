# Local GitHub Actions Testing

This setup allows you to run your GitHub Actions Cypress workflow locally using the `act` tool.

## Prerequisites

You need the following installed:

1. **Docker** - Act will create service containers automatically
2. **Act** - For simulating GitHub Actions
3. **GitHub CLI (gh)** - For authentication with GitHub Actions repositories
4. **pnpm** - Your package manager (should already be installed)  
5. **Node 20** - Should already be configured via Volta

### Installing Required Tools

```bash
# macOS - Install both act and GitHub CLI
brew install act gh

# Or manually (Linux/macOS)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Install GitHub CLI separately if needed
# See: https://cli.github.com/
```

## Quick Start

### 1. One-time Setup

```bash
# Authenticate with GitHub CLI (required for act)
gh auth login

# The setup script will automatically handle act.secrets creation
# No manual copying or editing needed!
```

### 2. Run the Complete Workflow

```bash
npm run test:act
```

This command will:
- Automatically authenticate with GitHub using your gh CLI credentials
- Run the complete `cypress-run-parallel-draft` GitHub Actions workflow using act
- Act will automatically create service containers (PostgreSQL, Redis, Hatchet) as defined in the workflow
- The workflow itself will handle:
  - Installing dependencies
  - Building the application
  - Creating Hatchet tokens
  - Running database migrations
  - Starting application services
  - Waiting for services to be ready
  - Running Cypress tests (single container for local testing)
- Clean up when complete

## How It Works

Act simulates the GitHub Actions environment by:

1. **Creating Service Containers** - PostgreSQL, Redis, Hatchet (from workflow definition)
2. **Running the Workflow** - Executes the exact same steps as in CI
3. **Single Container Mode** - Runs one test container instead of 10 parallel ones (to avoid port conflicts)

This approach ensures that your local testing environment matches CI exactly, including testing the service configuration.

## Manual Commands

If you need more control:

```bash
# Run act manually with specific options (from util/act directory)
cd util/act
act pull_request \
  --workflows ../../.github/workflows/cypress-testing.yml \
  --job cypress-run-parallel-draft \
  --secret-file act.secrets \
  --matrix containers:1 \
  --eventpath ../../.github/events/pull_request_draft.json

# Check running containers created by act
docker ps

# Clean up any leftover containers
docker container prune
```

## Troubleshooting

### Common Issues

**1. GitHub CLI not authenticated**
```bash
# Check authentication status
gh auth status

# Authenticate if needed
gh auth login

# Verify token works
gh auth token
```

**2. Act fails to start services**
```bash
# Check if Docker is running
docker info

# Check for existing containers using the same ports
docker ps | grep -E "(5432|6379|8888|7077)"

# Clean up any existing containers
docker container prune
docker system prune
```

**3. Act fails with "authentication required"**
```bash
# This usually means gh CLI authentication failed
# Re-run with debugging to see the error
cd util/act
./run-act-local.sh

# Or manually check the GitHub token
echo "Token: $(gh auth token)"
```

**4. Act fails with "pull access denied"**
```bash
# Try with explicit architecture (for Apple Silicon Macs)
# The .actrc file should handle this automatically
cd util/act
./run-act-local.sh
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

1. **Use verbose mode**: The `.actrc` already includes `-v` for detailed output
2. **Check Docker logs**: `docker logs <container-name>` for specific service containers
3. **Monitor resource usage**: `docker stats` (act can be resource-intensive)
4. **Clean up**: `docker container prune` and `docker system prune` to remove leftover containers

## What Gets Created

When you run the setup, these files are used:

- `.actrc` - Act configuration for Docker and container settings
- `act.secrets` - Local secrets (auto-generated with GitHub token from gh CLI)
- `act.secrets.template` - Template with instructions for manual setup
- `run-act-local.sh` - Main runner script with gh CLI integration
- `.github/events/pull_request_draft.json` - Mock event data for act

The script automatically:
- Gets your GitHub token from gh CLI
- Creates/updates act.secrets with the token
- Runs act with the correct parameters

Act will automatically create and manage all service containers based on the workflow definition.

## Performance Notes

- Act downloads and runs CI containers locally, which requires significant resources
- First run will be slow due to Docker image downloads
- Subsequent runs should be much faster due to Docker layer caching
- On Apple Silicon Macs, you may need to use `--container-architecture linux/amd64`

## Alternative: Manual Testing (Without Act)

If act is too resource-intensive, you can run tests manually, but this won't test your service configuration:

```bash
# 1. Start services manually (you'll need to create your own docker-compose.yml)
docker run -d --name postgres -p 5432:5432 -e POSTGRES_USER=klicker-prod -e POSTGRES_PASSWORD=klicker -e POSTGRES_DB=klicker-prod postgres:15
docker run -d --name redis -p 6379:6379 redis:7
# ... (set up all other services)

# 2. Build the application
pnpm install
pnpm run --filter @klicker-uzh/prisma build:test
pnpm run build:test

# 3. Setup environment and run tests manually
# (This is much more complex and doesn't test CI configuration)
```

**However, using `act` is strongly recommended** as it:
- Tests your actual GitHub Actions workflow configuration
- Ensures service definitions work correctly
- Matches your CI environment exactly