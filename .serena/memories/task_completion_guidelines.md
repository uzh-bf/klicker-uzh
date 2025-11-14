# Task Completion Guidelines

## Philosophy

When completing development tasks, ensure code quality, reliability, and consistency with project standards. Follow a systematic approach to validation before considering any task complete.

## Code Quality Validation

### Formatting and Style

**Principles:**
- All code must follow project formatting standards
- Use automated formatters to ensure consistency
- Check formatting before committing changes
- Apply formatting fixes when validation fails

### Linting and Code Quality

**Principles:**
- Code must pass all linting rules
- Address linting warnings for new code
- Follow established code quality patterns
- Maintain consistent coding standards across packages

### Type Safety

**Principles:**
- All TypeScript code must pass strict type checking
- No unchecked type assertions or `any` types without justification
- Ensure type safety across package boundaries
- Validate generated types after schema changes

## Testing Requirements

### Test Coverage

**Principles:**
- New features require corresponding tests
- Unit tests for business logic and utilities
- Integration tests for service interactions
- End-to-end tests for critical user workflows

### Test Types

**Required Testing:**
- **Unit Tests**: Business logic, calculations, utilities
- **Component Tests**: React components and hooks
- **Integration Tests**: GraphQL operations, API endpoints
- **E2E Tests**: Complete user journeys for UI changes

## Database Change Protocol

### Schema Modifications

**When Prisma schema changes:**
1. Create migration following naming conventions
2. Validate migration on test database
3. Synchronize schema across dependent packages
4. Update GraphQL schema if data model changes
5. Deploy migration following rollout process

**Migration Principles:**
- Migrations must be reversible when possible
- Test migrations on production-like data
- Coordinate schema changes with dependent services
- Document breaking changes clearly

## Documentation Requirements

### Code Documentation

**Principles:**
- Public functions require JSDoc comments
- Complex logic needs explanatory comments
- Architecture changes update relevant documentation
- API changes reflected in schema documentation

### Package Documentation

**Update when:**
- Adding new public APIs or exports
- Changing package architecture
- Modifying integration patterns
- Adding new features affecting consumers

## Pre-Commit Validation

### Automated Checks

**Git hooks validate:**
- Code formatting consistency
- Staged file validation
- Basic linting rules
- Commit message format

**Manual Pre-Commit:**
- Review changes for unintended modifications
- Verify test changes align with code changes
- Check for debugging code or console statements
- Validate internationalization for user-facing text

## Manual Verification Checklist

### Functional Validation

**Before completing task:**
- Test functionality in different scenarios
- Verify error handling and edge cases
- Check GraphQL operations return expected data
- Validate UI in different viewport sizes (responsive)

### Integration Validation

**Cross-cutting concerns:**
- Internationalization for all user-facing text
- Permission checks for protected operations
- Loading and error states for async operations
- Accessibility for new UI components

## Build Validation

### Development Build

**Verify:**
- All packages build without errors
- No TypeScript compilation errors
- Shared packages properly generated
- GraphQL schema correctly generated

### Production Build

**For significant changes:**
- Full production build succeeds
- No optimization warnings or errors
- Build artifacts properly generated
- Bundle sizes remain reasonable

## Quality Standards

### Code Quality Principles

**Always:**
- Use TypeScript strict typing
- Follow existing patterns in codebase
- Prefer functional components in React
- Keep files focused and reasonably sized
- Use design system for styling
- Handle loading and error states in UI

**Never:**
- Commit code without running checks
- Use inline comments in JSX
- Bypass TypeScript safety without justification
- Hardcode user-facing strings
- Create monolithic components
- Skip error boundaries in UI hierarchy

## Post-Completion Verification

### Self-Review

**Before marking complete:**
- Code meets all quality standards
- Tests are comprehensive and passing
- Documentation is updated
- No temporary debug code remains
- Changes aligned with task requirements

### Handoff Preparation

**For review:**
- Clear description of changes
- Test results documented
- Edge cases considered and tested
- Breaking changes clearly identified
- Migration path provided if needed

## Continuous Improvement

### Learn from Feedback

**Process improvement:**
- Note recurring issues for prevention
- Update patterns based on reviews
- Share learnings with team
- Refine validation checklists over time

This guideline ensures consistent quality and completeness across all development work while adapting to evolving project needs and standards.
