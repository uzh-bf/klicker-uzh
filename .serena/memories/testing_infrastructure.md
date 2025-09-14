# Testing Infrastructure

## Testing Philosophy

KlickerUZH employs a comprehensive testing strategy that prioritizes user-centric testing while maintaining critical business logic validation:

- **End-to-End Focus**: Cypress E2E tests for complete user workflows
- **Business Logic Testing**: Unit tests for critical algorithms and calculations
- **Integration Testing**: GraphQL operations and service integrations
- **Continuous Integration**: Automated testing in all environments

## Testing Stack

### Cypress E2E Testing

Primary testing approach for user-facing functionality:

- **Configuration**: Centralized config with database seeding
- **Test Data**: Consistent seeded data for reliable test scenarios
- **Multi-User Testing**: Support for different user roles and permissions
- **Real-Time Features**: Testing of live quiz and subscription functionality

#### E2E Test Scope

- Complete user journeys (registration, course enrollment, quiz participation)
- Authentication flows across different methods
- Live quiz real-time interactions
- Group activity collaboration
- Permission and access control validation
- Multi-device and responsive behavior

### Jest Unit Testing

Focused on critical business logic and utilities:

- **Package-Level**: Each package maintains its own test suite
- **Algorithm Testing**: Scoring, grading, and XP calculation validation
- **Utility Functions**: Common functions and helpers
- **GraphQL Resolvers**: Business logic validation

#### Unit Test Focus Areas

- Mathematical calculations (scoring algorithms)
- Data transformation utilities
- Validation functions
- Permission checking logic
- Complex business rules

### Integration Testing

Service and API integration validation:

- **GraphQL Operations**: End-to-end API testing
- **External Integrations**: LTI, authentication providers
- **Database Operations**: Data integrity and migration testing
- **Message Queue Processing**: Asynchronous operation validation

## Test Environment Setup

### Local Testing

Local test environment mirrors production:

- **Database**: PostgreSQL with consistent test data
- **Cache Layer**: Redis instances for execution and caching
- **Service Dependencies**: All required services running locally
- **Authentication**: Test accounts and authentication flows

### CI/CD Testing

Automated testing in GitHub Actions:

- **Service Orchestration**: Docker Compose setup for all dependencies
- **Database Seeding**: Automated test data generation
- **Multi-Environment**: Testing across different configurations
- **Artifact Management**: Test results and failure analysis

## Test Data Strategy

### Data Consistency

- **Seeded Data**: Predictable test data for reliable scenarios
- **User Accounts**: Standard test accounts for different roles
- **Course Structures**: Pre-built courses and activities for testing
- **Content Library**: Test elements and questions across all types

### Data Isolation

- **Test Isolation**: Each test suite operates with clean state
- **Database Reset**: Automated cleanup between test runs
- **Parallel Testing**: Safe parallel execution without data conflicts

## Testing Patterns

### E2E Testing Patterns

```cypress
// Standard test structure
describe('Feature Name', () => {
  beforeEach(() => {
    // Database seeding and user authentication
  })

  it('should complete user workflow', () => {
    // Page navigation and user interactions
    // Assertions for expected outcomes
  })
})
```

### Unit Testing Patterns

```typescript
// Business logic testing
describe('GradingService', () => {
  it('should calculate correct scores', () => {
    // Arrange: Setup test data
    // Act: Execute function
    // Assert: Validate results
  })
})
```

## Test Categories

### User Journey Testing

- **Student Experience**: Registration, course participation, quiz completion
- **Instructor Workflow**: Course creation, quiz management, analytics
- **Authentication**: Login flows, permission validation
- **Collaboration**: Group activities and multi-user interactions

### Feature Testing

- **Live Quiz Functionality**: Real-time quiz execution and participation
- **Practice Quiz System**: Self-paced learning with spaced repetition
- **Microlearning**: Scheduled learning activities
- **Content Management**: Question and content creation workflow

### System Testing

- **Performance**: Load testing for concurrent users
- **Security**: Authentication and authorization validation
- **Integration**: External service integration testing
- **Data Integrity**: Database consistency and migration testing

## Quality Gates

### Test Requirements

All features must include:

- E2E tests covering primary user workflows
- Unit tests for complex business logic
- Integration tests for external dependencies
- Error handling and edge case validation

### Coverage Metrics

- **Functional Coverage**: All user-facing features tested
- **Critical Path Coverage**: Essential workflows thoroughly tested
- **Error Path Coverage**: Error conditions and edge cases
- **Regression Coverage**: Historical bug prevention

## Test Execution

### Local Development

```bash
# E2E testing
cd cypress && pnpm cypress open    # Interactive mode
pnpm test:cypress                  # Headless execution

# Unit testing
pnpm test:run                      # All package tests
pnpm test:watch                    # Development mode
```

### Continuous Integration

- **Parallel Execution**: Tests run concurrently for faster feedback
- **Service Dependencies**: Automated setup of required services
- **Result Reporting**: Detailed test results and failure analysis
- **Artifact Storage**: Screenshots and videos for failed tests

## Test Maintenance

### Data Management

- **Test Data Evolution**: Maintain test data as features evolve
- **Schema Migrations**: Update test data for database changes
- **User Management**: Maintain test accounts and permissions

### Test Reliability

- **Flaky Test Prevention**: Robust selectors and wait conditions
- **Environment Consistency**: Standardized test environments
- **Failure Analysis**: Systematic investigation of test failures

For specific test configurations and current test suites, refer to:

- `cypress/` directory for E2E test specifications
- Individual package `__tests__/` directories for unit tests
- `.github/workflows/` for CI testing configurations
