# Testing Infrastructure

## Overview

KlickerUZH uses a comprehensive testing strategy with different types of tests:

- **Cypress** for end-to-end (E2E) testing
- **Jest** for unit testing in packages
- **GitHub Actions** for automated CI testing

## Cypress E2E Testing

### Configuration

- Main config: `cypress/cypress.config.ts`
- Extensive configuration with database seeding and test data
- Supports both component and E2E testing
- Custom commands and utilities

### Test Data Setup

The cypress config includes seeded test data with specific IDs:

- **Users**: TEST (76047345-3801-4628-ae7b-adbebcfe8821) through TEST7
- **Courses**: TEST courses with specific IDs
- **Participants**: Array of participant IDs for testing scenarios

### Test Structure

- Tests located in `cypress/` directory
- Uses Prisma client for database operations during tests
- Includes custom element type definitions and test utilities
- Supports authentication testing with multiple user types

### Running Cypress Tests

```bash
cd cypress && pnpm cypress open    # Interactive mode
pnpm test:cypress                  # Headless mode
```

### Key Features

- Database reset and seeding for consistent test state
- Support for testing all element types (SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY)
- Authentication testing with different user roles
- Live quiz testing with real-time features
- Group activity testing
- Permission and access control testing

## Jest Unit Testing

### Package-Level Testing

Each package in `packages/` can have its own Jest configuration:

- Tests located in package-specific directories
- Focus on business logic and utility functions
- GraphQL resolver testing
- Grading logic testing

### Common Test Patterns

```bash
pnpm test:run      # Run all tests
pnpm test:watch    # Watch mode for development
```

## GitHub Actions CI

### Cypress Testing Workflow

- **File**: `.github/workflows/cypress-testing.yml`
- **Triggers**: Push to v3 branches, PRs affecting apps/packages/cypress
- **Services**: PostgreSQL 15, Redis (cache and exec)
- **Platform**: Ubuntu latest (can use self-hosted)

### Test Services Setup

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: klicker-prod
      POSTGRES_PASSWORD: klicker
      POSTGRES_DB: klicker-prod
  redis_cache:
    image: redis:7
    ports:
      - 6380:6379
  redis_exec:
    image: redis:7
```

### Additional Test Workflows

- **check-types.yml**: TypeScript type checking across all packages
- **check-lint.yml**: ESLint checks
- **check-format.yml**: Prettier formatting checks
- **test-grading.yml**: Specific grading package tests
- **test-graphql.yml**: GraphQL package tests
- **test-olat-api.yml**: OLAT API tests

## Testing Best Practices

### Test Commands by Context

```bash
# Root level
pnpm test:run              # All tests
pnpm check                 # Types + format + lint

# Package level (in specific package)
pnpm test                  # Package-specific tests
pnpm test:watch            # Watch mode

# Cypress specific
cd cypress
pnpm cypress open          # Interactive testing
pnpm cypress run           # Headless CI mode
```

### Test Data Management

- Use seeded test data for consistent scenarios
- Reset database state between test suites
- Include realistic test data for complex scenarios (courses, quizzes, participants)

### Testing Scope

- **Unit Tests**: Business logic, utilities, pure functions
- **Integration Tests**: GraphQL operations, database queries
- **E2E Tests**: Complete user workflows, real-time features, authentication flows

### Database Testing

- Tests use the same PostgreSQL setup as production
- Prisma migrations applied before testing
- Database seeding with realistic test data
- Clean state management between test runs

## Troubleshooting

### Common Issues

- Database connection issues: Check PostgreSQL service status
- Redis connection: Ensure both cache and exec Redis instances are running
- Test data conflicts: Verify database is properly reset between runs
- Environment variables: Ensure test environment configuration is correct

### Local Test Setup

```bash
# Prepare test environment
pnpm dev:prepare-prod

# Run specific test suites
cd cypress && pnpm cypress open
pnpm test:run -w @klicker-uzh/grading
```

## Test Coverage

- Focus on critical business logic
- Authentication and authorization flows
- Live quiz real-time functionality
- Grading and scoring algorithms
- Database migrations and data integrity
- GraphQL API endpoints
