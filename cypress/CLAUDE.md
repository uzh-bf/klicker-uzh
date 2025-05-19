# CLAUDE.md - Cypress E2E Tests

This file provides guidance to Claude Code for working with the end-to-end testing infrastructure in the KlickerUZH project.

## Package Overview

The Cypress package contains comprehensive end-to-end tests that validate the functionality of all KlickerUZH applications and features. These tests simulate real user interactions across the entire system, ensuring that all components work together correctly.

### Key Responsibilities

- End-to-end validation of user workflows across all applications
- Testing integration between frontend and backend components
- Validating complex user interactions like drag-and-drop operations
- Ensuring cross-browser and responsive behavior works as expected
- Regression testing for critical features

## Test Organization

The tests are organized alphabetically to ensure they run in a specific sequence:

1. **Login/Auth Tests (A-\*)**: Authentication workflows
2. **Feature Access Tests (B-\*)**: Access control and permissions
3. **Control Tests (C-\*)**: Live quiz controller functionality
4. **Element Tests (D-L\*)**: Element creation and management for different element types
5. **Course Management Tests (N-\*)**: Course creation and management
6. **Activity Tests (O-Q\*)**: Activity-specific workflows (Live Quiz, Microlearning, Practice Quiz)
7. **Bookmarking Tests (R-\*)**: Content bookmarking functionality
8. **Group Activity Tests (S-\*)**: Group activity management and participation
9. **Resource Tests (T-\*)**: Answer collection management
10. **Catalog Tests (U-\*)**: Template and sharing catalog functionality
11. **Template Tests (V-\*)**: Activity template functionality

Each test file follows a consistent structure with setup, test cases, and cleanup.

## Test Data Strategy

Tests rely on two primary sources of test data:

### 1. Database Seeding

The database is seeded at the beginning of test runs with test data in `seedDatabase()`:

- Test user accounts (lecturer, student roles)
- Course data
- Participant accounts and groups
- Activity data (Microlearning, Practice Quiz)
- Achievement definitions

### 2. Fixture Files

JSON fixture files in `cypress/fixtures/` contain test-specific data:

- `A-login.json`: Login credentials and test values
- `DM-questions.json`: Question data for element tests
- `N-course.json`: Course configuration data
- Various activity fixtures (`O-live-quiz.json`, `P-microlearning.json`, etc.)

## Custom Commands

The system uses an extensive set of custom Cypress commands defined in `support/commands.ts` that abstract common operations:

### Authentication Commands

- `loginLecturer()`: Auth as a lecturer with admin permissions
- `loginStudent()`: Auth as a student account
- Various other role-specific logins

### Element Creation Commands

- `createQuestionSC()`: Create a single-choice question
- `createQuestionMC()`: Create a multiple-choice question
- `createQuestionKPRIM()`: Create a KPRIM question
- `createQuestionNR()`: Create a numerical response question
- `createQuestionFT()`: Create a free text question
- `createQuestionSE()`: Create a selection question
- `createQuestionCS()`: Create a case study question
- `createFlashcard()`: Create a flashcard
- `createContent()`: Create a content element

### Activity Management Commands

- `createLiveQuiz()`: Create a live quiz activity
- `createPracticeQuiz()`: Create a practice quiz activity
- `createMicroLearning()`: Create a microlearning activity
- `createGroupActivity()`: Create a group activity
- `createStacks()`: Arrange elements into stacks or blocks for activities

### Resource Management Commands

- `createAnswerCollection()`: Create an answer collection
- `deleteAnswerCollection()`: Delete an answer collection
- `addObjectToCatalog()`: Add objects to the catalog for sharing

### Test Data Commands

- `seed()`: Initialize the database with test data
- `cleanup()`: Clean up test data after tests

## Task-Specific Commands

Specialized commands enable complex interactions:

- **Case Study Testing**: Commands like `answerCaseStudy()` and `verifyCaseStudyInputs()` simplify testing complex case studies
- **Drag-and-Drop**: The `createStacks()` command handles drag-and-drop operations for building activities
- **Multi-step Forms**: Activity creation commands navigate through multi-step wizards

## Test Data Lifecycle

1. **Setup**: `before()` hooks call `cy.seed()` to populate the database
2. **Test Execution**: Tests use Cypress commands to interact with the application
3. **Verification**: Assertions validate the expected state
4. **Cleanup**: `after()` hooks call `cy.cleanup()` to remove test data

## Environment Configuration

Tests run against a local development environment with:

- Student app: http://127.0.0.1:3001
- Manage app: http://127.0.0.1:3002
- Control app: http://127.0.0.1:3003
- Auth app: http://127.0.0.1:3010

Environment variables are defined in `cypress.config.ts` and made available via `Cypress.env()`.

## Creating New Tests

When creating new tests:

1. **Follow naming conventions**:

   - Use alphabetical prefixes for proper sequencing
   - Use descriptive suffixes (e.g., `-workflow.cy.ts`)

2. **Organize test steps logically**:

   - Group related actions in describe blocks
   - Use before/beforeEach for setup
   - Use after/afterEach for cleanup

3. **Use data attributes**:

   - Target elements with `data-cy` attributes
   - Avoid targeting elements by CSS classes or structure

4. **Use custom commands**:

   - Prefer existing commands for common operations
   - Create new commands for repeated patterns

5. **Handle async behavior properly**:

   - Use `.wait()` or `.should()` for dynamic elements
   - Avoid fixed timeouts when possible

6. **Create fixtures for test data**:
   - Define test data in JSON fixtures
   - Load fixtures in `beforeEach`

## Test Execution Patterns

Tests typically follow one of these patterns:

### User Workflow Tests

```typescript
describe('User workflow', () => {
  before(() => cy.seed())
  after(() => cy.cleanup())

  beforeEach(function () {
    cy.fixture('fixture-name.json').then((data) => {
      this.data = data
    })
  })

  it('completes a workflow successfully', function () {
    // Login
    cy.loginLecturer()

    // Perform actions
    cy.get('[data-cy="element"]').click()

    // Assert results
    cy.get('[data-cy="result"]').should('contain', this.data.expectedValue)
  })
})
```

### Component-Focused Tests

```typescript
describe('Component functionality', () => {
  before(() => cy.seed())
  after(() => cy.cleanup())

  beforeEach(() => {
    cy.loginLecturer()
    cy.visit('/specific-page')
  })

  it('performs specific function', () => {
    // Test specific functionality
    cy.get('[data-cy="component"]').click()
    cy.get('[data-cy="result"]').should('exist')
  })
})
```

## Troubleshooting Common Issues

### Element Not Found

- Check if the element has a `data-cy` attribute
- Verify the element is visible (not hidden by CSS)
- Use `.should('exist')` to wait for the element
- Check if a previous action completed successfully

### Test Data Issues

- Ensure `cy.seed()` is called before tests that need data
- Verify fixtures are loaded correctly in `beforeEach`
- Use correct IDs that match the seeded data

### Timing Problems

- Replace hard-coded waits with assertions
- Use `.should()` with retry logic for dynamic elements
- Add appropriate waiting for network requests

### Authentication Problems

- Ensure cookies and local storage are cleared between tests
- Check if auth tokens are properly set
- Verify the login command completes successfully

## Best Practices

1. **Keep tests focused**: Each test should validate a specific workflow or feature
2. **Maintain independence**: Tests should not depend on the outcome of previous tests
3. **Use appropriate selectors**: Prefer `data-cy` attributes for targeting elements
4. **Handle async properly**: Use built-in waiting mechanisms instead of arbitrary delays
5. **Clean up after tests**: Use `after()` hooks to reset the database
6. **Structure tests logically**: Group related tests in describe blocks
7. **Add comments for complex logic**: Explain non-obvious test steps
8. **Use custom commands**: Abstract repetitive operations into commands
9. **Use fixtures for test data**: Keep test data separate from test logic
10. **Test responsive behavior**: Run tests with different viewport sizes

## Testing Environment Setup

To run the tests locally:

```bash
# Install dependencies
cd cypress
pnpm install

# Open Cypress test runner
pnpm cypress open

# Run tests headlessly
pnpm cypress run
```

Tests are also run in CI pipelines with each pull request and merge to main branches.
