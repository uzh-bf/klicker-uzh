# Development Patterns and Guidelines

## Architecture Patterns

### GraphQL-First API Design

- All business logic in packages/graphql/src/services/
- Type-safe operations with Pothos GraphQL
- Apollo Client for frontend data fetching
- Operations defined in packages/graphql/src/graphql/ops/

### GraphQL Operation Patterns

#### Operation Naming Conventions

```
Q{OperationName}  # Queries (e.g., QGetUserCourses)
M{OperationName}  # Mutations (e.g., MCreateCourse)
S{OperationName}  # Subscriptions (e.g., SFeedbackCreated)
F{DataType}       # Fragments (e.g., FElementData)
```

#### Fragment Usage Pattern

```graphql
fragment FElementData on Element {
  id
  name
  content
  options
  # ... complete element fields
}

fragment FElementDataWithoutSolutions on Element {
  id
  name
  content
  # ... fields safe for students
}
```

### Database-First Development

- Prisma schema as single source of truth
- Migrations for all schema changes
- Sync schema across packages with ./util/sync-schema.sh
- Use relations and constraints appropriately

### Shared Package Strategy

- Common code in packages/ for reuse
- Avoid code duplication between apps
- Clear boundaries between packages
- Use TypeScript for all shared code

## Component Patterns

### React Component Structure

```typescript
interface ComponentProps {
  // Props interface first
}

function ComponentName({ prop }: ComponentProps) {
  // Hooks at the top
  // Event handlers
  // Render logic
  return <div>...</div>
}
```

### Custom Hooks Pattern

```typescript
function useFeatureName() {
  // State management
  // Side effects
  // Return consistent interface
  return { data, loading, error, actions }
}
```

### GraphQL Integration Pattern

```typescript
import { useQuery } from '@apollo/client'
import { GetDataDocument } from '@klicker-uzh/graphql'

function Component() {
  const { data, loading, error } = useQuery(GetDataDocument)

  if (loading) return <Spinner />
  if (error) return <Error />

  return <div>{/* Render data */}</div>
}
```

## Testing Patterns

### Unit Testing Patterns

```typescript
// For React hooks
import { renderHook } from '@testing-library/react'

describe('useCustomHook', () => {
  it('should return expected data', () => {
    const { result } = renderHook(() => useCustomHook())
    expect(result.current.data).toBeDefined()
  })
})

// For GraphQL resolvers
describe('CourseService', () => {
  it('should create course with valid input', async () => {
    const result = await createCourse(mockInput, mockContext)
    expect(result.id).toBeDefined()
  })
})
```

### E2E Testing Patterns

```typescript
// Cypress test structure
describe('Course Management', () => {
  beforeEach(() => {
    // Database seeding with known test data
    cy.seedDatabase()
    cy.login('test-lecturer')
  })

  it('should create and publish course', () => {
    cy.visit('/courses/create')
    cy.get('[data-cy=course-name]').type('Test Course')
    cy.get('[data-cy=create-button]').click()
    cy.url().should('include', '/courses/')
  })
})
```

### Test Data Patterns

- Use seeded test data with consistent UUIDs
- Separate test data per scenario
- Clean state between test runs
- Realistic data for complex scenarios

## Permission Patterns

### Permission Check Pattern

```typescript
// GraphQL resolver permission pattern
const resolver = async (parent, args, context) => {
  // 1. Authenticate user
  const user = await authenticate(context.token)
  if (!user) throw new AuthenticationError()

  // 2. Check permissions
  const hasPermission = await checkPermission(user, resource, action)
  if (!hasPermission) throw new ForbiddenError()

  // 3. Execute business logic
  return await performAction(args)
}
```

## Error Handling Patterns

### GraphQL Error Handling

```typescript
// Consistent error responses
if (!hasPermission) {
  throw new ForbiddenError('Insufficient permissions')
}

// Frontend error handling
const { data, loading, error } = useQuery(QUERY)
if (error) {
  return <ErrorBoundary error={error} />
}
```

## State Management Patterns

- **Apollo Client**: Server state management
- **React Hooks**: Local component state
- **Context**: Cross-component state (minimal use)
- **No Redux**: Avoid complex state management

## Performance Patterns

### Component Optimization

```typescript
// Memoize expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => processData(data), [data])
  return <div>{/* render */}</div>
})
```

## Real-time Patterns

### Subscription Management

```typescript
// GraphQL subscription pattern
const useRealtimeUpdates = (sessionId: string) => {
  const { data } = useSubscription(SRunningLiveQuizUpdated, {
    variables: { sessionId },
    onSubscriptionData: ({ subscriptionData }) => {
      // Handle real-time updates
    },
  })
}
```

## Development Workflow Patterns

### Database Development Pattern

```bash
# 1. Schema changes
# Edit packages/prisma/src/prisma/schema/*.prisma

# 2. Create migration
pnpm prisma:migrate

# 3. Sync to other packages
./util/sync-schema.sh

# 4. Update GraphQL schema if needed
# Edit packages/graphql/src/schema/*.ts
```

### Component Development Pattern

1. **Define Types**: Create TypeScript interfaces
2. **Create Component**: Follow naming conventions
3. **Add GraphQL**: Define operations if needed
4. **Test Component**: Unit and integration tests

## Common Anti-Patterns to Avoid

- **Class components** in React (use functions)
- **Inline styles** (use Tailwind)
- **Direct database access** in frontend
- **Hardcoded strings** (use i18n)
- **Large monolithic components** (split by feature)
- **Missing error boundaries**
- **Unhandled loading states**
- **N+1 GraphQL queries** (optimize with proper Prisma queries)
- **Inconsistent operation naming**
- **Missing permission checks**
