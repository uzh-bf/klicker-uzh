# Audit Service Testing Guide

This directory contains comprehensive tests for the audit logging service, including API tests, integration tests, database verification, performance tests, and real-world scenario tests.

## Test Architecture

The test suite is designed to thoroughly validate the audit service's functionality:

- **API Tests** (`api.test.js`) - Basic API functionality and validation
- **Integration Tests** (`integration.test.js`) - End-to-end event persistence with database verification
- **Database Verification** (`database-verification.test.js`) - Direct Azure Table Storage queries and data integrity
- **Performance Tests** (`performance.test.js`) - Load testing, throughput, and resource usage
- **Scenario Tests** (`scenarios.test.js`) - Real-world audit trail workflows

## Prerequisites

1. **Node.js 20+** - Required for running the tests
2. **Docker** - For running Azurite (Azure Storage Emulator)
3. **pnpm** - Package manager used by the project

## Test Environment Setup

### Azurite (Local Azure Storage)

Tests use Azurite to emulate Azure Table Storage locally:

```bash
# Start Azurite and required services
pnpm docker:up

# Stop services
pnpm docker:down

# Clean up volumes and data
pnpm docker:clean
```

### Environment Variables

The service requires these environment variables (set in `.env` file):

```bash
# Copy example environment file
cp .env.example .env

# Key variables for testing:
PORT=7080
AZURE_TABLES_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;
AZURE_TABLES_TABLE_NAME=auditlogs
INTERNAL_TOKEN=test-secret-token-123
LOG_LEVEL=info
```

## Running Tests

### Individual Test Suites

```bash
# Basic API functionality tests
pnpm test

# Integration tests with database persistence verification
pnpm test:integration

# Database verification and data integrity tests
pnpm test:database

# Performance and load tests
pnpm test:performance

# Real-world scenario tests
pnpm test:scenarios
```

### Combined Test Runs

```bash
# Run all tests (comprehensive test suite)
pnpm test:all

# CI-appropriate test suite (excludes long-running performance tests)
pnpm test:ci

# Quick performance check (single request performance only)
pnpm test:perf-quick
```

### Test Cleanup

```bash
# Stop services and clean up test data
pnpm test:cleanup
```

## Test Details

### API Tests (`api.test.js`)

Tests basic service functionality:

- Health endpoints (`/healthz`, `/ready`, `/metrics`)
- Authentication and authorization
- Request validation
- Error handling
- Idempotency

**Key Scenarios:**

- Valid and invalid event submissions
- Authentication token validation
- Malformed request handling
- Large payload handling

### Integration Tests (`integration.test.js`)

Tests end-to-end event persistence:

- Event submission and database persistence
- Complex attribute serialization
- Multi-tenant data isolation
- Timestamp handling
- Partition key distribution

**Key Scenarios:**

- Minimal and complete event persistence
- Custom vs server-generated timestamps
- Tenant data isolation verification
- Large payload handling

### Database Verification Tests (`database-verification.test.js`)

Tests database layer directly:

- Direct Azure Table Storage queries
- Partition key generation validation
- Row key uniqueness
- Data serialization/deserialization
- Query performance

**Key Scenarios:**

- Partition key structure validation
- Data integrity after persistence
- Complex attribute serialization
- Database performance with existing data

### Performance Tests (`performance.test.js`)

Tests system performance characteristics:

- Single request latency
- Concurrent request handling
- Sustained load performance
- Memory usage and resource management
- Error rates under load

**Performance Benchmarks:**

- Single events: < 100ms processing time
- 50 concurrent requests: < 5 seconds total
- 200 concurrent requests: > 95% success rate
- Memory growth: < 50% over extended load

**Key Scenarios:**

- Concurrent request batches (50, 200 events)
- Sustained load over time
- Memory leak detection
- Database performance impact

### Scenario Tests (`scenarios.test.js`)

Tests real-world audit trail workflows:

- User authentication flows
- Document lifecycle tracking
- Security incident response
- Administrative operations
- Financial approval workflows
- GDPR compliance scenarios

**Key Scenarios:**

- Complete user login session with MFA
- Document creation → editing → approval → sharing
- Security threat detection → incident response → resolution
- Privileged access escalation → administrative tasks → privilege revocation
- Financial expense submission → approvals → payment
- GDPR data request → validation → export → fulfillment

## Test Utilities

### Azure Table Helper (`utils/azure-table-helper.js`)

Utility class for direct Azure Table Storage operations:

- Table setup and cleanup
- Direct entity queries
- Tenant-based filtering
- Partition and row key validation
- Performance measurement helpers

### Test Fixtures (`fixtures/events.json`)

Pre-defined test events for various scenarios:

- Minimal and complete events
- Authentication flows
- System and business events
- Multi-tenant data
- Large payload examples

## Understanding Test Output

### Success Indicators

- All HTTP responses return expected status codes (202 for submissions)
- Events are verified in database after submission
- Performance metrics are within acceptable thresholds
- No memory leaks or resource issues

### Performance Metrics

Tests report various performance metrics:

- **Duration**: Time to complete operations
- **Throughput**: Events processed per second
- **Success Rate**: Percentage of successful operations
- **Memory Usage**: Heap growth and resource consumption
- **Persistence Rate**: Percentage of events successfully stored

### Debugging Test Failures

1. **Check Service Status**: Ensure audit service is running on port 7080
2. **Verify Azurite**: Confirm Azurite is accessible at `127.0.0.1:10002`
3. **Environment Variables**: Validate `.env` file configuration
4. **Network Issues**: Check for port conflicts or firewall issues
5. **Resource Constraints**: Ensure sufficient memory and CPU for load tests

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Audit Service Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm test:ci
```

### Test Results Interpretation

- **API Tests**: Should have 100% pass rate
- **Integration Tests**: Should verify database persistence for all events
- **Database Tests**: Should validate data integrity and partitioning
- **Performance Tests**: Should meet established performance benchmarks
- **Scenario Tests**: Should complete real-world workflows successfully

## Troubleshooting

### Common Issues

1. **"Connection refused" errors**

   - Ensure Azurite is running: `pnpm docker:up`
   - Check port 10002 availability

2. **"Authentication failed" errors**

   - Verify `INTERNAL_TOKEN` in `.env` matches test expectations
   - Default test token: `test-secret-token-123`

3. **Timeout errors in tests**

   - Increase wait times in tests for slower systems
   - Check system resource availability

4. **Memory issues in performance tests**

   - Run with `--max-old-space-size=4096` for larger heap
   - Consider reducing test iterations for resource-constrained environments

5. **Database persistence failures**
   - Verify Azurite container is healthy
   - Check Azure Table Storage connection string format
   - Ensure table creation permissions

### Test Data Cleanup

Tests automatically clean up data, but manual cleanup can be done:

```bash
# Stop all services and remove volumes
pnpm docker:clean

# Restart clean environment
pnpm docker:up
```

## Contributing to Tests

When adding new tests:

1. **Follow existing patterns** - Use the established test structure
2. **Clean up data** - Ensure tests clean up after themselves
3. **Use meaningful names** - Test names should describe the scenario
4. **Verify database state** - Integration tests should verify persistence
5. **Performance considerations** - Long-running tests should be in performance suite
6. **Document scenarios** - Complex workflows should be well-documented

### Test Naming Conventions

- Use descriptive test names: `should track complete user login session with audit trail`
- Group related tests in describe blocks
- Use consistent naming for test IDs and identifiers
- Include expected outcomes in test names

This comprehensive test suite ensures the audit service is production-ready with verified data persistence, established performance characteristics, and proven handling of real-world scenarios.
