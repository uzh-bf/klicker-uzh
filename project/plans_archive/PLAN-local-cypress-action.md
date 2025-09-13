# Implementation Plan: Local GitHub Actions Execution for Cypress Tests

## Executive Summary

### Problem Statement
Currently, the Klicker project's Cypress testing workflow (`.github/workflows/cypress-testing.yml`) can only be executed on GitHub Actions, leading to:
- Long feedback loops when debugging CI failures
- Inability to test workflow changes before pushing
- Difficulty reproducing CI environment locally
- Wasted GitHub Actions minutes during development

### Goals
1. Enable local execution of the GitHub Actions workflow using the `act` tool
2. Create reusable infrastructure that works both locally and in CI
3. Provide fast feedback loop for developers testing workflow changes
4. Maintain compatibility with existing CI/CD pipeline

### Key Benefits
- Verify GitHub Actions locally before pushing changes
- Debug failing tests more efficiently with access to local logs
- Reduce GitHub Actions minute consumption during development
- Enable offline testing of workflow changes
- Improve developer productivity with faster feedback loops

## Current State Analysis

### Workflow Complexity
The `cypress-testing.yml` workflow is sophisticated with:
- **Two execution strategies**: Parallel testing for draft PRs (10 containers) vs Cloud recording for production
- **Multiple services**: PostgreSQL (main + Hatchet), Redis (cache + exec), Hatchet orchestration engine
- **Complex caching**: pnpm store, Cypress cache, Turbo build artifacts
- **Service orchestration**: Health checks, service startup coordination
- **Matrix strategy**: Parallel test execution with cypress-split
- **Environment management**: Multiple DATABASE_URLs, secrets, tokens

### Technical Dependencies
- **Services**: PostgreSQL 15, Redis 7, Hatchet Lite
- **Runtime**: Node 20, pnpm 10.15.0, Ubuntu 24.04
- **Testing**: Cypress with electron browser, cypress-split for parallelization
- **Build tooling**: Turbo, Prisma migrations, custom service startup scripts

### Challenges for Local Execution
1. **Service Container Complexity**: 5 different services with interdependencies
2. **Matrix Strategy**: `act` has limited matrix support compared to GitHub Actions
3. **Secret Management**: Handling tokens and secrets locally
4. **Performance**: Local machine resource constraints vs GitHub's infrastructure
5. **Cypress Cloud**: Recording functionality requires different approach locally

## Solution Architecture

### Three-Tier Approach

#### Tier 1: GitHub Actions Emulation (`act`)
- Use `act` tool to execute workflow files locally
- Handle act limitations with configuration and workarounds
- Provide environment variable injection and secret management

#### Tier 2: Service Infrastructure (Docker Compose)
- Extract service definitions from GitHub Actions into `docker-compose.test.yml`
- Provide consistent service environment for both local and CI execution
- Handle networking, health checks, and data persistence

#### Tier 3: Test Orchestration (Shell Scripts)
- Create reusable scripts for common testing scenarios
- Abstract complexity from developers with simple commands
- Enable both full workflow execution and targeted testing

### Reusability Patterns

#### Configuration as Code
- Environment variables defined in template files
- Service configurations shared between Docker Compose and GitHub Actions
- Build steps abstracted into reusable scripts

#### Service Abstraction
- Database setup and migration logic in reusable functions
- Health check utilities that work in both environments
- Service startup orchestration with proper dependency management

#### Test Execution Flexibility
- Support for both parallel and sequential test execution
- Ability to run specific test suites or individual specs
- Environment-aware test configuration (local vs CI)

## Implementation Phases

### Phase 1: Act Setup & Basic Execution

#### 1.1 Install and Configure Act
```bash
# Install act via homebrew (macOS)
brew install act

# Or via GitHub release
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

#### 1.2 Create Act Configuration Files

**`.actrc`**
```
# Use larger Docker images that include more tools
-P ubuntu-24.04=catthehacker/ubuntu:act-24.04
-P ubuntu-latest=catthehacker/ubuntu:act-24.04

# Bind Docker socket for service containers
--container-daemon-socket /var/run/docker.sock

# Increase verbosity for debugging
-v

# Use host network for service communication
--use-gitignore=false
```

**`act.secrets`** (gitignored)
```
APP_SECRET=abcd
CYPRESS_RECORD_KEY=dummy-key-for-local
GITHUB_TOKEN=dummy-token-for-local
```

#### 1.3 Create Act Helper Scripts

**`scripts/act-cypress.sh`**
```bash
#!/bin/bash
set -e

# Default to draft PR workflow (faster, no Cloud recording)
WORKFLOW=${1:-"cypress-run-parallel-draft"}
JOB_INDEX=${2:-0}

echo "Running workflow: $WORKFLOW (job index: $JOB_INDEX)"

# Set environment for act
export SPLIT_INDEX=$JOB_INDEX
export SPLIT=1  # Single container for local testing

# Run with act
act pull_request \
  --workflows .github/workflows/cypress-testing.yml \
  --job $WORKFLOW \
  --secret-file act.secrets \
  --env GITHUB_EVENT_NAME=pull_request \
  --env GITHUB_EVENT_PATH=/tmp/github_event.json
```

#### 1.4 Handle Act Limitations

**Known Limitations & Workarounds:**
1. **Service Containers**: Act has limited service container support
   - **Workaround**: Use external Docker Compose for services
2. **Matrix Strategy**: Limited matrix job support
   - **Workaround**: Run jobs sequentially or use wrapper scripts
3. **Secrets**: No GitHub secrets integration
   - **Workaround**: Use local secrets file (gitignored)
4. **Caching**: No native GitHub Actions cache support
   - **Workaround**: Use Docker volumes for persistence

### Phase 2: Docker Compose Infrastructure

#### 2.1 Extract Services Configuration

**`docker-compose.test.yml`**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: klicker-prod
      POSTGRES_PASSWORD: klicker
      POSTGRES_DB: klicker-prod
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "klicker-prod"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

  postgres_hatchet:
    image: postgres:15
    environment:
      POSTGRES_USER: hatchet
      POSTGRES_PASSWORD: hatchet
      POSTGRES_DB: hatchet
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "hatchet"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_hatchet_data:/var/lib/postgresql/data

  redis_cache:
    image: redis:7
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - redis_cache_data:/data

  redis_exec:
    image: redis:7
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - redis_exec_data:/data

  hatchet:
    image: ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest
    ports:
      - "8888:8888"
      - "7077:7077"
    environment:
      DATABASE_URL: 'postgresql://hatchet:hatchet@postgres_hatchet:5432/hatchet?sslmode=disable'
      SERVER_AUTH_COOKIE_DOMAIN: 127.0.0.1
      SERVER_AUTH_COOKIE_INSECURE: 't'
      SERVER_GRPC_BIND_ADDRESS: '0.0.0.0'
      SERVER_GRPC_INSECURE: 't'
      SERVER_GRPC_BROADCAST_ADDRESS: 127.0.0.1:7077
      SERVER_GRPC_PORT: '7077'
      SERVER_URL: http://127.0.0.1:8888
      SERVER_AUTH_SET_EMAIL_VERIFIED: 't'
      SERVER_DEFAULT_ENGINE_VERSION: 'V1'
    depends_on:
      postgres_hatchet:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8888/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  postgres_hatchet_data:
  redis_cache_data:
  redis_exec_data:
```

#### 2.2 Environment Configuration

**`.env.test.local`** (template)
```env
# Database
DATABASE_URL=postgres://klicker-prod:klicker@localhost:5432/klicker-prod

# Application
APP_SECRET=abcd
NODE_ENV=production

# Hatchet
HATCHET_API_URL=http://127.0.0.1:8888
HATCHET_TENANT_ID=707d0855-80ab-4e1f-a156-f1c4546cbf52
HATCHET_HOST_PORT=7077

# Cypress
CYPRESS_FAIL_FAST=false

# Services
SERVICE_ENDPOINTS=http://127.0.0.1:3000/healthz http://127.0.0.1:3001 http://127.0.0.1:3002 http://127.0.0.1:3003 http://127.0.0.1:3010
TIMEOUT_SECONDS=300
CHECK_INTERVAL=5
```

#### 2.3 Service Management Scripts

**`scripts/services-start.sh`**
```bash
#!/bin/bash
set -e

echo "Starting test services with Docker Compose..."

# Start services in background
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be ready..."
docker-compose -f docker-compose.test.yml wait

# Additional health checks
scripts/wait-for-services-local.sh

echo "All services are ready!"
```

**`scripts/services-stop.sh`**
```bash
#!/bin/bash
set -e

echo "Stopping test services..."
docker-compose -f docker-compose.test.yml down

# Optional: clean up volumes
if [[ "$1" == "--clean" ]]; then
  echo "Cleaning up volumes..."
  docker-compose -f docker-compose.test.yml down -v
fi
```

### Phase 3: Reusable Test Orchestration

#### 3.1 Universal Test Script

**`scripts/test-runner.sh`**
```bash
#!/bin/bash
set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"local"}
PARALLEL=${PARALLEL:-"false"}
SPEC_PATTERN=${SPEC_PATTERN:-""}
BROWSER=${BROWSER:-"electron"}
RECORD=${RECORD:-"false"}

# Function to setup environment
setup_environment() {
  case $ENVIRONMENT in
    "local")
      # Load local environment
      if [ -f .env.test.local ]; then
        export $(cat .env.test.local | grep -v '^#' | xargs)
      fi
      ;;
    "ci")
      # CI environment variables are already set
      echo "Running in CI environment"
      ;;
  esac
}

# Function to build application
build_application() {
  echo "Building application..."
  pnpm run --filter @klicker-uzh/prisma build:test
  pnpm run build:test
}

# Function to setup database
setup_database() {
  echo "Setting up database..."
  cd packages/prisma
  pnpm run prisma:reset:raw -f
  cd ../..
}

# Function to start services (local only)
start_services() {
  if [[ "$ENVIRONMENT" == "local" ]]; then
    echo "Starting local services..."
    scripts/services-start.sh
  fi
}

# Function to run Cypress tests
run_cypress_tests() {
  local cypress_args=""
  
  if [[ "$PARALLEL" == "true" ]]; then
    cypress_args="--env split=${SPLIT:-1},splitIndex=${SPLIT_INDEX:-0}"
  fi
  
  if [[ -n "$SPEC_PATTERN" ]]; then
    cypress_args="$cypress_args --spec $SPEC_PATTERN"
  fi
  
  if [[ "$RECORD" == "true" && "$ENVIRONMENT" == "ci" ]]; then
    cypress_args="$cypress_args --record"
  fi

  echo "Running Cypress with args: $cypress_args"
  
  cd cypress
  npx cypress run \
    --browser $BROWSER \
    $cypress_args
  cd ..
}

# Function to cleanup
cleanup() {
  if [[ "$ENVIRONMENT" == "local" ]]; then
    echo "Cleaning up local services..."
    scripts/services-stop.sh
  fi
}

# Set up trap for cleanup
trap cleanup EXIT

# Main execution
main() {
  echo "=== Klicker Cypress Test Runner ==="
  echo "Environment: $ENVIRONMENT"
  echo "Parallel: $PARALLEL"
  echo "Browser: $BROWSER"
  echo "Record: $RECORD"
  echo "==============================="

  setup_environment
  build_application
  setup_database
  start_services
  
  # Wait a moment for services to settle
  sleep 5
  
  run_cypress_tests
  
  echo "Tests completed successfully!"
}

# Execute main function
main "$@"
```

#### 3.2 Parallel Testing Support

**`scripts/test-parallel.sh`**
```bash
#!/bin/bash
set -e

CONTAINERS=${1:-3}
SPEC_PATTERN=${2:-""}

echo "Running parallel Cypress tests with $CONTAINERS containers"

# Start services once
scripts/services-start.sh

# Function to run single container
run_container() {
  local index=$1
  local total=$2
  
  echo "Starting container $((index + 1))/$total"
  
  SPLIT=$total \
  SPLIT_INDEX=$index \
  ENVIRONMENT=local \
  PARALLEL=true \
  SPEC_PATTERN="$SPEC_PATTERN" \
  scripts/test-runner.sh
}

# Run containers in parallel
pids=()
for i in $(seq 0 $((CONTAINERS - 1))); do
  run_container $i $CONTAINERS &
  pids+=($!)
done

# Wait for all containers to complete
exit_code=0
for pid in "${pids[@]}"; do
  if ! wait $pid; then
    exit_code=1
  fi
done

# Cleanup
scripts/services-stop.sh

exit $exit_code
```

#### 3.3 Health Check Utilities

**`scripts/wait-for-services-local.sh`**
```bash
#!/bin/bash
set -e

# Reusable version of the GitHub Actions wait-for-services.sh
# that works with Docker Compose services

TIMEOUT_SECONDS=${TIMEOUT_SECONDS:-300}
CHECK_INTERVAL=${CHECK_INTERVAL:-5}

# Service endpoints to check
ENDPOINTS=(
  "http://127.0.0.1:8888/healthz"  # Hatchet
  "tcp://127.0.0.1:5432"           # PostgreSQL
  "tcp://127.0.0.1:6379"           # Redis exec
  "tcp://127.0.0.1:6380"           # Redis cache
)

check_endpoint() {
  local endpoint=$1
  
  if [[ $endpoint == tcp://* ]]; then
    # TCP check
    local host_port=${endpoint#tcp://}
    local host=${host_port%:*}
    local port=${host_port#*:}
    
    if nc -z "$host" "$port" 2>/dev/null; then
      echo "✅ $endpoint is up"
      return 0
    else
      echo "❌ $endpoint is not ready"
      return 1
    fi
  else
    # HTTP check
    if curl -s -f "$endpoint" > /dev/null 2>&1; then
      echo "✅ $endpoint is up"
      return 0
    else
      echo "❌ $endpoint is not ready"
      return 1
    fi
  fi
}

check_all_endpoints() {
  local all_up=true
  
  for endpoint in "${ENDPOINTS[@]}"; do
    if ! check_endpoint "$endpoint"; then
      all_up=false
      break
    fi
  done
  
  $all_up
}

# Main wait loop
elapsed=0
echo "⚙️ Waiting for services to be ready..."
echo "🔍 Monitoring endpoints: ${ENDPOINTS[*]}"
echo "⏲️ Timeout: ${TIMEOUT_SECONDS}s, Check interval: ${CHECK_INTERVAL}s"

while [ $elapsed -lt $TIMEOUT_SECONDS ]; do
  if check_all_endpoints; then
    echo "✨ All services are ready!"
    exit 0
  fi
  
  sleep $CHECK_INTERVAL
  elapsed=$((elapsed + CHECK_INTERVAL))
  echo "⏳ Still waiting... ($elapsed seconds elapsed)"
done

echo "⚠️ Timeout waiting for services to be ready"
exit 1
```

### Phase 4: Workflow Refactoring

#### 4.1 Composite Actions

**`.github/actions/setup-environment/action.yml`**
```yaml
name: 'Setup Test Environment'
description: 'Common setup steps for Cypress testing'
inputs:
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'
  pnpm-version:
    description: 'PNPM version to use'
    required: false
    default: '10.15.0'

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ inputs.node-version }}

    - name: Setup PNPM
      uses: pnpm/action-setup@v2
      with:
        version: ${{ inputs.pnpm-version }}
        run_install: false

    - name: Get pnpm store directory
      shell: bash
      run: |
        echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

    - name: Setup pnpm cache
      uses: actions/cache@v4
      with:
        path: |
          ${{ env.STORE_PATH }}
          ~/.cache/Cypress
        key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: |
          ${{ runner.os }}-pnpm-store-

    - name: Cache turbo build artifacts
      uses: actions/cache@v4
      with:
        path: |
          .turbo
        key: ${{ runner.os }}-turbo-${{ hashFiles('**/pnpm-lock.yaml', 'turbo.json') }}-${{ github.ref_name }}
        restore-keys: |
          ${{ runner.os }}-turbo-${{ hashFiles('**/pnpm-lock.yaml', 'turbo.json') }}-
          ${{ runner.os }}-turbo-

    - name: Install dependencies
      shell: bash
      run: pnpm install
```

#### 4.2 Updated Workflow Integration

**Modified sections of `.github/workflows/cypress-testing.yml`**
```yaml
# In both jobs, replace the setup steps with:
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Environment
        uses: ./.github/actions/setup-environment

      - name: Build and Setup
        run: |
          pnpm run --filter @klicker-uzh/prisma build:test && pnpm run build:test
          ./util/_create_hatchet_token_cypress.sh

      - name: Setup Database
        run: |
          cd packages/prisma
          pnpm run prisma:reset:raw -f
        env:
          DATABASE_URL: postgres://klicker-prod:klicker@localhost:5432/klicker-prod

      - name: Start Services and Run Tests
        run: |
          chmod +x scripts/test-runner.sh
          ENVIRONMENT=ci \
          PARALLEL=${{ matrix.containers && 'true' || 'false' }} \
          SPLIT=${{ strategy.job-total || 1 }} \
          SPLIT_INDEX=${{ strategy.job-index || 0 }} \
          RECORD=${{ matrix.containers && 'false' || 'true' }} \
          scripts/test-runner.sh
        env:
          APP_SECRET: abcd
          DATABASE_URL: postgres://klicker-prod:klicker@127.0.0.1:5432/klicker-prod
          NODE_ENV: production
          HATCHET_API_URL: http://127.0.0.1:8888
          HATCHET_TENANT_ID: 707d0855-80ab-4e1f-a156-f1c4546cbf52
          HATCHET_HOST_PORT: 7077
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Phase 5: Developer Experience

#### 5.1 Package.json Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test:cypress:local": "scripts/test-runner.sh",
    "test:cypress:parallel": "scripts/test-parallel.sh",
    "test:cypress:spec": "SPEC_PATTERN",
    "services:start": "scripts/services-start.sh",
    "services:stop": "scripts/services-stop.sh",
    "services:restart": "scripts/services-stop.sh && scripts/services-start.sh",
    "act:cypress": "scripts/act-cypress.sh",
    "act:cypress:debug": "scripts/act-cypress.sh cypress-run-parallel-draft 0"
  }
}
```

#### 5.2 Makefile for Complex Scenarios

**`Makefile`**
```makefile
.PHONY: help test-local test-parallel test-spec services-up services-down act-test

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Local testing
test-local: ## Run Cypress tests locally with services
	@echo "Running Cypress tests locally..."
	@npm run test:cypress:local

test-parallel: ## Run Cypress tests in parallel locally (3 containers)
	@echo "Running parallel Cypress tests..."
	@npm run test:cypress:parallel 3

test-spec: ## Run specific spec file (usage: make test-spec SPEC=path/to/spec.cy.js)
	@echo "Running specific spec: $(SPEC)"
	@SPEC_PATTERN="$(SPEC)" npm run test:cypress:spec

# Service management
services-up: ## Start all test services
	@echo "Starting test services..."
	@npm run services:start

services-down: ## Stop all test services
	@echo "Stopping test services..."
	@npm run services:stop

services-restart: ## Restart all test services
	@echo "Restarting test services..."
	@npm run services:restart

services-clean: ## Stop services and clean volumes
	@echo "Cleaning up services and volumes..."
	@scripts/services-stop.sh --clean

# Act (GitHub Actions local)
act-test: ## Run GitHub Actions workflow locally with act
	@echo "Running GitHub Actions with act..."
	@npm run act:cypress

act-debug: ## Run GitHub Actions with act in debug mode
	@echo "Running GitHub Actions with act (debug)..."
	@npm run act:cypress:debug

# Development helpers
setup: ## Initial setup for local development
	@echo "Setting up local development environment..."
	@cp .env.test.local.template .env.test.local || echo "Please create .env.test.local from template"
	@cp act.secrets.template act.secrets || echo "Please create act.secrets from template"
	@docker-compose -f docker-compose.test.yml pull
	@echo "Setup complete! Edit .env.test.local and act.secrets with your values"

clean: ## Clean all test artifacts
	@echo "Cleaning test artifacts..."
	@rm -rf cypress/cypress/videos cypress/cypress/screenshots
	@rm -f service.log
	@docker system prune -f
```

#### 5.3 VS Code Tasks

**`.vscode/tasks.json`**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Test Services",
      "type": "shell",
      "command": "npm run services:start",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "Stop Test Services",
      "type": "shell",
      "command": "npm run services:stop",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "Run Cypress Tests Locally",
      "type": "shell",
      "command": "npm run test:cypress:local",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": true,
        "panel": "dedicated"
      },
      "problemMatcher": []
    },
    {
      "label": "Run GitHub Actions Locally (act)",
      "type": "shell",
      "command": "npm run act:cypress",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": true,
        "panel": "dedicated"
      },
      "problemMatcher": []
    }
  ]
}
```

## Technical Deep Dive

### Service Configuration Details

#### PostgreSQL Configuration
- **Main Database**: `klicker-prod` for application data
- **Hatchet Database**: Separate PostgreSQL instance for Hatchet orchestration
- **Volume Persistence**: Named volumes for data persistence between runs
- **Health Checks**: `pg_isready` command for readiness verification

#### Redis Configuration
- **Cache Redis**: Port 6380 for application caching
- **Execution Redis**: Port 6379 for job execution
- **Persistence**: Volume mounting for data persistence
- **Health Checks**: `redis-cli ping` for readiness verification

#### Hatchet Configuration
- **Image**: `ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest`
- **Ports**: 8888 (HTTP API), 7077 (gRPC)
- **Dependencies**: Requires PostgreSQL to be healthy before starting
- **Configuration**: Cookie domain set to 127.0.0.1 for local development

### Environment Variable Management

#### Local vs CI Differentiation
```bash
# Local environment detection
if [[ "${GITHUB_ACTIONS}" != "true" ]]; then
  echo "Running locally"
  # Load local environment
else
  echo "Running in GitHub Actions"
  # Use GitHub secrets and environment
fi
```

#### Secret Handling Strategy
- **Local Development**: Use `act.secrets` file (gitignored)
- **CI Environment**: Use GitHub secrets
- **Template Files**: Provide `.template` files for easy setup
- **Environment Isolation**: Separate configs for different environments

### Parallel Test Execution Strategies

#### Cypress-Split Integration
```javascript
// cypress.config.js modification for split support
const { defineConfig } = require('cypress')
const cypressSplit = require('cypress-split')

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      cypressSplit(on, config)
      return config
    },
  },
})
```

#### Matrix Strategy Simulation
```bash
# Simulating GitHub Actions matrix locally
for i in $(seq 0 $((CONTAINERS - 1))); do
  SPLIT_INDEX=$i \
  SPLIT=$CONTAINERS \
  run_cypress_container &
done
```

### Performance Optimization

#### Local Resource Management
- **Memory**: Monitor Docker container memory usage
- **CPU**: Limit parallel containers based on available cores
- **Disk**: Use Docker volumes for efficient I/O

#### Caching Strategies
```yaml
# Local Docker volume caching
volumes:
  - node_modules_cache:/app/node_modules
  - cypress_cache:/root/.cache/Cypress
  - turbo_cache:/app/.turbo
```

## Known Limitations & Workarounds

### Act Tool Limitations

#### 1. Service Containers
**Limitation**: Act has limited support for service containers defined in GitHub Actions
**Workaround**: Use external Docker Compose for services, connect via host networking
**Implementation**:
```bash
# Start services with Docker Compose before running act
docker-compose -f docker-compose.test.yml up -d
act --network host
```

#### 2. Matrix Strategy
**Limitation**: Act doesn't fully support matrix builds
**Workaround**: Run matrix jobs sequentially or use wrapper scripts
**Implementation**:
```bash
# Sequential matrix execution
for container in 1 2 3; do
  MATRIX_CONTAINER=$container act
done
```

#### 3. GitHub Context
**Limitation**: Limited GitHub context information available
**Workaround**: Mock GitHub event data and environment variables
**Implementation**:
```json
{
  "pull_request": {
    "draft": false,
    "number": 123
  }
}
```

#### 4. Secrets and Environment
**Limitation**: No access to GitHub secrets
**Workaround**: Use local secrets file and environment variable substitution
**Implementation**:
```bash
# Create mock secrets for local testing
echo "CYPRESS_RECORD_KEY=local-dummy-key" > act.secrets
```

### Docker Compose Limitations

#### 1. GitHub Actions Services Parity
**Limitation**: Slight differences between GitHub Actions services and Docker Compose
**Workaround**: Use exact same Docker images and configuration
**Implementation**:
```yaml
# Match GitHub Actions service configuration exactly
services:
  postgres:
    image: postgres:15  # Same as GitHub Actions
    environment:
      POSTGRES_USER: klicker-prod  # Exact match
```

#### 2. Networking
**Limitation**: Different networking model than GitHub Actions
**Workaround**: Use host networking or service names consistently
**Implementation**:
```bash
# Use host networking for act
act --network host
```

### Cypress-Specific Limitations

#### 1. Cloud Recording
**Limitation**: Cypress Cloud features not available locally
**Workaround**: Conditional recording based on environment
**Implementation**:
```javascript
// Conditional Cypress configuration
const config = {
  e2e: {
    // Base configuration
  }
}

if (process.env.CI) {
  config.projectId = "your-project-id"
  config.video = true
}

module.exports = config
```

#### 2. Parallel Test Distribution
**Limitation**: Local parallel execution differs from Cloud orchestration
**Workaround**: Use cypress-split for consistent test distribution
**Implementation**:
```bash
# Use cypress-split for local parallelization
SPLIT=3 SPLIT_INDEX=0 cypress run
```

### Resource Limitations

#### 1. Local Machine Constraints
**Limitation**: Limited CPU/memory compared to GitHub Actions runners
**Workaround**: Reduce parallel containers or use more powerful local machine
**Implementation**:
```bash
# Detect available resources and adjust
CONTAINERS=$(nproc)
if [ $CONTAINERS -gt 4 ]; then CONTAINERS=4; fi
```

#### 2. Service Startup Time
**Limitation**: Services may take longer to start locally
**Workaround**: Increase timeout values and improve health checks
**Implementation**:
```bash
# Longer timeouts for local development
TIMEOUT_SECONDS=600  # 10 minutes vs 5 minutes in CI
```

## Validation & Testing

### Validation Criteria

#### Phase 1 Success Criteria
- [ ] Act can execute basic workflow steps
- [ ] Environment variables are properly injected
- [ ] Docker containers can be spawned from act
- [ ] Basic Cypress test can run via act

#### Phase 2 Success Criteria
- [ ] All services start and pass health checks
- [ ] Database migrations complete successfully
- [ ] Application can connect to all services
- [ ] Services can be stopped and restarted cleanly

#### Phase 3 Success Criteria
- [ ] Test runner works in both local and CI modes
- [ ] Parallel test execution produces correct results
- [ ] Test results are identical between local and CI
- [ ] Service orchestration scripts work reliably

#### Phase 4 Success Criteria
- [ ] Refactored workflow maintains backward compatibility
- [ ] CI build times remain unchanged or improve
- [ ] All existing test functionality preserved
- [ ] New local testing capabilities work as expected

#### Phase 5 Success Criteria
- [ ] Developers can run tests with simple commands
- [ ] Documentation is clear and comprehensive
- [ ] Common issues have documented solutions
- [ ] Setup process takes less than 10 minutes

### Performance Benchmarks

#### Test Execution Time Targets
- **Local Single Container**: < 15 minutes (vs ~12 minutes in CI)
- **Local Parallel (3 containers)**: < 8 minutes (vs ~6 minutes in CI)
- **Service Startup**: < 2 minutes (vs ~1 minute in CI)
- **Total Setup Time**: < 3 minutes (first run), < 1 minute (subsequent runs)

#### Resource Usage Targets
- **Memory**: < 8GB total (Docker + services + tests)
- **CPU**: Should scale with available cores
- **Disk**: < 10GB for all services and caches
- **Network**: Minimal external dependencies after initial setup

### Testing Strategy

#### Unit Testing
```bash
# Test individual components
./scripts/test-services-health.sh
./scripts/test-environment-setup.sh
./scripts/test-database-migration.sh
```

#### Integration Testing
```bash
# Test full workflow execution
make test-local
make test-parallel
npm run act:cypress
```

#### Regression Testing
```bash
# Ensure CI compatibility
git commit -m "test: verify local changes work in CI"
git push origin feature-branch
# Verify GitHub Actions still pass
```

#### Performance Testing
```bash
# Measure execution times
time make test-local
time make test-parallel
# Compare with CI execution times
```

## Rollback Procedures

### If Act Integration Fails
1. **Remove act configuration files**
   ```bash
   rm .actrc act.secrets
   rm -rf scripts/act-*.sh
   ```

2. **Revert workflow changes**
   ```bash
   git checkout HEAD -- .github/workflows/cypress-testing.yml
   ```

3. **Continue using existing CI-only approach**

### If Docker Compose Issues
1. **Stop and remove containers**
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   docker system prune -f
   ```

2. **Revert to GitHub Actions services**
   - Remove docker-compose.test.yml
   - Continue using service containers in CI

### If Performance Degradation
1. **Reduce parallel containers**
   ```bash
   # Modify default container count
   CONTAINERS=2 make test-parallel
   ```

2. **Disable local testing temporarily**
   ```bash
   # Use CI-only for critical testing
   git push origin branch-name
   ```

3. **Investigate resource constraints**
   - Check Docker Desktop resource allocation
   - Monitor system performance during tests

## Documentation & Training

### Setup Guide

#### Prerequisites
```bash
# Required software
brew install docker docker-compose
brew install act
npm install -g pnpm@10.15.0
```

#### Quick Start
```bash
# 1. Clone repository
git clone <repository-url>
cd klicker-uzh

# 2. Setup local environment
make setup
# Edit .env.test.local and act.secrets with your values

# 3. Start services
make services-up

# 4. Run tests
make test-local
```

#### Troubleshooting

##### Common Issues

**Services won't start**
```bash
# Check Docker daemon
docker info

# Check port conflicts
lsof -i :5432 -i :6379 -i :8888

# Clean up and retry
make services-clean
make services-up
```

**Tests fail locally but pass in CI**
```bash
# Check environment differences
env | grep -E "(DATABASE|REDIS|HATCHET)"

# Verify service health
curl http://127.0.0.1:8888/healthz
nc -z localhost 5432
```

**Act execution fails**
```bash
# Check act configuration
cat .actrc

# Verify Docker socket access
docker ps

# Run with verbose output
act -v
```

### Best Practices

#### Development Workflow
1. **Before making changes**:
   ```bash
   make services-up
   make test-local  # Verify baseline
   ```

2. **During development**:
   ```bash
   # Test specific changes
   make test-spec SPEC="cypress/e2e/your-test.cy.js"
   ```

3. **Before committing**:
   ```bash
   make test-parallel  # Full test suite
   npm run act:cypress  # Verify workflow
   ```

4. **After pushing**:
   - Monitor GitHub Actions for CI confirmation
   - Compare local vs CI execution times

#### Resource Management
```bash
# Monitor resource usage
docker stats

# Clean up regularly
make services-clean
docker system prune -f

# Adjust based on machine capabilities
# Edit docker-compose.test.yml resource limits
```

### Examples and Use Cases

#### Running Specific Tests
```bash
# Single spec file
make test-spec SPEC="cypress/e2e/auth/login.cy.js"

# Pattern matching
SPEC_PATTERN="cypress/e2e/auth/*.cy.js" npm run test:cypress:spec

# Headless vs headed
CYPRESS_HEADED=true npm run test:cypress:local
```

#### Debugging Failed Tests
```bash
# Run with service logs
docker-compose -f docker-compose.test.yml logs -f

# Run single container for debugging
SPLIT=1 SPLIT_INDEX=0 npm run test:cypress:local

# Access service directly
docker-compose -f docker-compose.test.yml exec postgres psql -U klicker-prod
```

#### Performance Testing
```bash
# Measure execution time
time make test-parallel

# Profile resource usage
docker stats > resource-usage.log &
make test-local
kill %1
```

#### CI/CD Integration
```bash
# Test workflow changes
npm run act:cypress  # Local verification
git push origin feature-branch  # CI verification

# Compare results
# Local: check cypress/cypress/videos
# CI: check GitHub Actions artifacts
```

This comprehensive plan provides a roadmap for implementing local GitHub Actions execution while maintaining full compatibility with the existing CI/CD pipeline. The phased approach ensures minimal risk and maximum reusability of the infrastructure components.