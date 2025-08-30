# Development Patterns and Guidelines

## Architecture Patterns

### GraphQL-First API Design

- All business logic centralized in GraphQL services layer
- Type-safe operations with GraphQL schema builder
- Apollo Client for frontend data fetching
- Operations organized by business domain

### GraphQL Operation Patterns

#### Operation Naming Conventions

- **Queries**: Q prefix followed by descriptive operation name
- **Mutations**: M prefix for write operations
- **Subscriptions**: S prefix for real-time operations
- **Fragments**: F prefix for reusable data selections

#### Fragment Usage Strategy

- Complete data fragments for full object information
- Public fragments for student-safe data (without solutions)
- Permission-aware fragments for different user roles
- Consistent field selection across related operations

### Database-First Development

- Prisma schema as single source of truth for data modeling
- Schema migrations for all structural changes
- Cross-package schema synchronization utilities
- Proper use of relations and database constraints

### Shared Package Strategy

- Common functionality extracted to shared packages
- Clear package boundaries to prevent tight coupling
- TypeScript for all shared code to ensure type safety
- Minimal dependencies between packages

## Component Patterns

### React Component Architecture

- Functional components with hooks (no class components)
- Props interfaces defined with TypeScript
- Hooks positioned at component top
- Event handlers separated from render logic

### Custom Hook Patterns

- Extract complex logic into reusable hooks
- Consistent return interface with data, loading, error states
- Side effects properly managed within hooks
- Hook-specific unit tests for complex logic

### GraphQL Integration Patterns

- Apollo Client hooks for data fetching
- Proper loading and error state handling
- Generated TypeScript types for type safety
- Optimistic updates for mutations where appropriate

## Testing Patterns

### Unit Testing Strategy

- React Testing Library for component testing
- Hook testing with renderHook utility
- GraphQL resolver testing with mock contexts
- Business logic testing with arrange-act-assert pattern

### End-to-End Testing Philosophy

- Cypress for complete user journey testing
- Database seeding with consistent test data
- Authentication flow testing across user roles
- Real-time feature validation

### Test Data Management

- Seeded test data with predictable identifiers
- Scenario-specific test data isolation
- Clean state between test runs
- Realistic data for complex user workflows

## Permission and Security Patterns

### Authorization Pattern

- Three-layer permission checking in GraphQL resolvers:
  1. User authentication validation
  2. Permission level verification
  3. Business logic execution
- Consistent error responses for unauthorized access
- Permission inheritance and derivation

## Error Handling Patterns

### GraphQL Error Strategy

- Structured error responses with specific error types
- Client-side error boundary implementation
- Graceful degradation for non-critical failures
- User-friendly error messaging

## State Management Philosophy

- Apollo Client for server state management
- React hooks for local component state
- Minimal use of React Context for cross-component state
- Avoid complex state management libraries

## Performance Patterns

### Component Optimization

- React.memo for expensive components
- useMemo for expensive calculations
- useCallback for stable function references
- Proper dependency arrays for hooks

## Real-time Communication Patterns

### Subscription Management

- GraphQL subscriptions for real-time updates
- Proper subscription lifecycle management
- Event filtering to minimize client updates
- Connection error handling and recovery

## Development Workflow Patterns

### Database Development Flow

1. Schema modification in Prisma files
2. Migration creation and validation
3. Cross-package schema synchronization
4. GraphQL schema updates if needed

### Component Development Process

1. TypeScript interface definition
2. Component implementation following conventions
3. GraphQL operations if data fetching required
4. Comprehensive testing (unit and integration)

## Anti-Patterns to Avoid

- Class components in React applications
- Inline styling instead of design system
- Direct database access from frontend
- Hardcoded user-facing strings
- Monolithic components without feature boundaries
- Missing error boundaries in component hierarchy
- Unhandled loading states in async operations
- N+1 query problems in GraphQL operations
- Inconsistent operation naming across domains
- Missing permission checks in resolvers

For specific implementation examples and current code patterns, refer to:

- `packages/graphql/src/services/` for business logic patterns
- `packages/shared-components/src/` for component patterns
- Individual package source code for domain-specific patterns
