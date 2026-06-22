# Common Patterns

## GraphQL Operations

**Naming convention:**
- `QGetUserCourses` - Query to fetch user's courses
- `MCreateCourse` - Mutation to create new course
- `SFeedbackAdded` - Subscription for new feedback events
- `FElementData` - Fragment for element data fields

**Query patterns:**
- List operations: Paginated, filterable, sortable
- Detail operations: Full object with nested relations
- Permission-aware: Different data based on user role

**Mutation patterns:**
- CRUD: Create, Read, Update, Delete
- State transitions: Start, end, publish, close activities
- Bulk operations: Multiple objects in one mutation

**Subscription patterns:**
- Live quiz real-time updates
- Feedback creation events
- Activity completion notifications
- Group coordination events

**Fragment patterns:**
- Complete data: Full object with all relations
- Public data: Student-safe (no solutions)
- Summary data: List previews
- Permission-specific: Different fragments per role

## Database Workflow

**When modifying Prisma schema:**

1. Edit schema: `packages/prisma/src/prisma/*.prisma`
2. Create migration: `pnpm prisma:migrate`
3. Sync across packages: `./util/sync-schema.sh`
4. Update GraphQL schema (if data model changed)
5. Deploy: `pnpm prisma:deploy`

**Migration rules:**
- Named migrations (descriptive, not timestamps)
- Test on production-like data before deploying
- Reversible when possible
- Document breaking changes

**Schema patterns:**
- UUID primary keys (`@db.Uuid`)
- Soft deletes (`isDeleted Boolean @default(false)`)
- Timestamps (`createdAt`, `updatedAt`)
- Cascading deletes for referential integrity

## Permission System

**Three-layer authorization in GraphQL resolvers:**

1. **User authentication** - Is user logged in?
2. **Permission level** - Does user have required level?
   - READ < WRITE < EXECUTE < ADMIN < OWNER
3. **Business logic execution** - Perform the operation

**Permission levels:**
- **READ**: View content
- **WRITE**: Edit content
- **EXECUTE**: Use in activities (e.g., add question to quiz)
- **ADMIN**: Manage permissions
- **OWNER**: Full control

**User roles:**
- **PARTICIPANT**: Student accounts
- **USER**: Lecturer accounts
- **ADMIN**: System administrators

**Scopes:**
- **ACCOUNT_OWNER**: Owns the account
- **FULL_ACCESS**: Complete access to resources
- **SESSION_EXEC**: Can execute sessions
- **READ_ONLY**: View-only access

## State Management

**Required patterns:**
- **Server state**: Apollo Client cache (GraphQL data)
- **Local state**: React hooks (`useState`, `useReducer`)
- **Cross-component**: React Context (minimal use)
- **Form state**: Formik + Yup validation

**Apollo Client patterns:**
```typescript
// Query with loading/error handling
const { data, loading, error } = useQuery(QGetUserCourses)

// Mutation with optimistic update
const [createCourse] = useMutation(MCreateCourse, {
  refetchQueries: [{ query: QGetUserCourses }],
})

// Subscription for real-time updates
const { data } = useSubscription(SFeedbackAdded, {
  variables: { sessionId },
})
```

**State rules:**
- Never store server data in React state (use Apollo cache)
- Keep local state close to where it's used
- Lift state only when necessary
- Use Context sparingly (props preferred)

## Component Patterns

**Standard structure:**
```typescript
// 1. Imports
// 2. Type definitions
// 3. Component function
// 4. Hooks (at top of component)
// 5. Event handlers
// 6. Render logic
```

**Hook placement:**
- All hooks at component top (before any conditional logic)
- Hooks cannot be conditional
- Custom hooks extracted for complex logic

**Event handlers:**
- Separate from render logic
- Named with `handle` prefix: `handleSubmit`, `handleChange`
- Use `useCallback` for stable references when passed as props

**Optimization:**
- `React.memo` for expensive components that re-render often
- `useMemo` for expensive calculations
- `useCallback` for functions passed to child components
- Proper dependency arrays (no empty deps unless truly static)

## Error Handling

**GraphQL errors:**
- Structured error types from API
- Client-side error boundaries required
- User-friendly error messages
- Log errors to monitoring (Sentry)

**Form errors:**
- Formik + Yup for validation
- Display errors inline near fields
- Prevent submission with errors
- Clear errors on field change

**Network errors:**
- Apollo Client error handling
- Retry logic for transient failures
- Graceful degradation (show cached data)
- Offline detection

**UI error patterns:**
- Error boundaries catch React errors
- Fallback UI for errors
- "Retry" action when appropriate
- Never crash the entire app

## Testing Patterns

**E2E test structure:**
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Database seeding + authentication
  })

  it('should complete user workflow', () => {
    // Navigate and interact
    // Assert outcomes
  })
})
```

**Unit test structure:**
```typescript
describe('ServiceFunction', () => {
  it('should return expected result', () => {
    // Arrange: Setup test data
    const input = { /* ... */ }

    // Act: Execute function
    const result = functionUnderTest(input)

    // Assert: Validate result
    expect(result).toEqual(expected)
  })
})
```

**Test data principles:**
- Predictable IDs for assertions
- Realistic data volumes
- Clean state between tests
- Parallel-safe execution

## Real-Time Patterns

**GraphQL subscriptions:**
- WebSocket connection (graphql-ws protocol)
- Subscribe in useEffect with cleanup
- Filter events server-side (don't send unnecessary updates)
- Handle connection errors gracefully

**Redis pub/sub:**
- Backend publishes events to Redis
- GraphQL subscriptions listen to Redis channels
- Multiple backend instances coordinate via Redis

**Live quiz flow:**
1. Student submits response → Response API
2. Response API → Queue to Hatchet worker
3. Worker processes → Calculate score
4. Worker → Update database + Redis cache
5. Worker → Publish event to Redis
6. GraphQL subscription → Push to connected clients

## Integration Patterns

**External services:**
- **LTI**: Learning Management System integration
- **Edu-ID**: Swiss academic authentication
- **Azure AI**: Chat functionality
- **Email**: Transactional emails (SMTP)

**Integration rules:**
- Graceful degradation if service unavailable
- Retry with exponential backoff
- Circuit breaker for repeated failures
- Timeout on all external calls

## Code Organization

**Feature-based:**
- Group related code by feature, not by type
- Components, hooks, and utilities together
- Shared utilities in `/lib`
- Feature-specific in `/components/{feature}`

**Package boundaries:**
- Clear public API for packages
- Minimal dependencies between packages
- Circular dependencies prohibited
- Export only what's needed

## Performance Patterns

**Frontend:**
- Code splitting via Next.js dynamic imports
- Image optimization with Next.js Image component
- Lazy load below-the-fold content
- Debounce search inputs
- Throttle scroll handlers

**GraphQL:**
- DataLoader for N+1 prevention
- Fragments for consistent field selection
- Persisted queries for bandwidth reduction
- Query complexity limits

**Database:**
- Indexes on frequently queried fields
- Efficient joins with Prisma
- Pagination for large datasets
- Caching with Redis

## Anti-Patterns (Avoid)

**React:**
- ❌ Class components
- ❌ Inline styles
- ❌ Monolithic components (>500 lines)
- ❌ Deeply nested components
- ❌ Missing error boundaries

**GraphQL:**
- ❌ N+1 queries (use DataLoader)
- ❌ Over-fetching (use fragments)
- ❌ Missing permission checks
- ❌ Unvalidated inputs

**General:**
- ❌ Hardcoded strings (use i18n)
- ❌ Global mutable state
- ❌ Missing loading states
- ❌ Missing error handling
- ❌ Bypassing TypeScript safety
