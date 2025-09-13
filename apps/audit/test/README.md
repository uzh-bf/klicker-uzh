# Audit Service Testing Guide

This document explains the testing setup for the KlickerUZH Audit Service and how to run different types of tests efficiently.

## Test Categories

The audit service has tests organized into three main categories based on their dependencies:

### 1. Database Tests (`test:db`)

- **Files**: `database-verification.test.ts`
- **Requirements**: Only Azurite (Azure Table Storage emulator)
- **What they test**: Data persistence, partition keys, serialization, query performance
- **Runtime**: ~30 seconds

```bash
pnpm test:db
```

### 2. API Tests (`test:api`)

- **Files**: `api.test.ts`, `public-endpoint.test.ts`
- **Requirements**: Running audit service on port 7080
- **What they test**: HTTP endpoints, authentication, request validation
- **Runtime**: ~20 seconds

```bash
pnpm test:api
```

### 3. Integration Tests (`test:integration`)

- **Files**: `integration.test.ts`, `scenarios.test.ts`, `performance.test.ts`
- **Requirements**: Both running service and Azurite
- **What they test**: End-to-end workflows, business scenarios, performance
- **Runtime**: ~2-5 minutes

```bash
pnpm test:integration
```

### 4. All Tests (`test`)

Runs all test categories together.

```bash
pnpm test
```

## Quick Start

### Prerequisites

1. **For Database Tests**: Start Azurite

   ```bash
   # From project root
   npm run deps
   ```

2. **For API Tests**: Start the audit service

   ```bash
   pnpm dev
   ```

3. **For Integration Tests**: Start both Azurite and the service

### Using the Test Script

The provided `test-audit.sh` script handles dependencies automatically:

```bash
# Run all tests (with automatic setup)
./test-audit.sh

# Run only database tests
./test-audit.sh --db

# Run only API tests
./test-audit.sh --api

# Run only integration tests
./test-audit.sh --integration

# Show help
./test-audit.sh --help
```

## Development Workflow

### When developing new features:

1. **Start with database tests** - Fast feedback on data layer
2. **Add API tests** - Verify HTTP interface
3. **Finish with integration tests** - Ensure end-to-end functionality

### When debugging issues:

- **Connection errors**: Check if service is running (`pnpm dev`)
- **Database errors**: Check if Azurite is running (`npm run deps`)
- **Test timeouts**: Integration tests may take longer, especially performance tests

## Test Environment

All tests use these environment variables:

- `NODE_ENV=test`
- `INTERNAL_TOKEN=test-secret-token-123`
- `AZURE_STORAGE_CONNECTION_STRING` (points to Azurite)
- `AZURE_STORAGE_TABLE_NAME=auditlogs`

## File Structure

```
test/
├── README.md                     # This file
├── fixtures/
│   └── events.json              # Test data
├── utils/
│   └── azure-table-helper.js    # Database test utilities
├── api.test.ts                  # HTTP endpoint tests
├── database-verification.test.ts # Data layer tests
├── integration.test.ts          # End-to-end tests
├── performance.test.ts          # Load testing
├── public-endpoint.test.ts      # Public API tests
└── scenarios.test.ts            # Business workflow tests
```

## Common Issues

### "ECONNREFUSED" errors

The service isn't running. Start it with:

```bash
pnpm dev
```

### "Table does not exist" errors

Azurite isn't running or accessible. Start it with:

```bash
# From project root
npm run deps
```

### Tests are slow

- Use specific test categories instead of running all tests
- Check if you're running performance tests unnecessarily
- Consider using `test:watch` for development

### Memory issues during performance tests

Performance tests intentionally stress the system. Run them separately:

```bash
pnpm test:integration
```

## CI/CD Usage

For continuous integration, you can run tests in stages:

```bash
# Stage 1: Fast feedback (database layer)
pnpm test:db

# Stage 2: API validation
pnpm test:api

# Stage 3: Full integration (slower)
pnpm test:integration
```

This allows for fail-fast behavior and better resource utilization in CI pipelines.
