# Development Patterns and Guidelines

## Architecture Patterns

### GraphQL-First API Design

- All business logic in packages/graphql/src/services/
- Type-safe operations with Pothos GraphQL
- Apollo Client for frontend data fetching
- Operations defined in packages/graphql/src/graphql/ops/

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

## Permission & Access Control

- Use Permission and DerivedPermission models
- Check permissions at GraphQL resolver level
- Frontend components should respect user roles
- Activity logging for audit trails

## Error Handling

- GraphQL errors handled at Apollo Client level
- UI components should handle loading/error states
- User-friendly error messages with i18n
- Log errors for debugging

## State Management

- Apollo Client for server state
- React hooks for local component state
- Context for cross-component shared state (minimal use)
- No Redux or complex state management

## Styling Patterns

- Utility-first with TailwindCSS
- Responsive design by default
- Design system components from @uzh-bf/design-system
- Consistent spacing and colors

## Testing Patterns

- Unit tests for business logic and hooks
- Integration tests for GraphQL resolvers
- E2E tests for critical user flows
- Test data factories in Prisma seed files

## Performance Patterns

- Next.js SSG/SSR where appropriate
- React.memo for expensive components
- Virtualization for long lists
- Optimize GraphQL queries

## Security Patterns

- Authentication through JWT tokens
- Role-based access control (RBAC)
- Input validation at GraphQL schema level
- CORS configuration for frontend access

## Internationalization

- All user-facing strings through i18n package
- Messages organized by feature domain
- Support for en/de languages
- Namespace organization for scalability

## Development Workflow

1. Schema changes → migration → sync
2. GraphQL operations → type generation
3. Component development with types
4. Testing at multiple levels
5. Quality checks before commit

## Common Anti-Patterns to Avoid

- Class components in React (use functions)
- Inline styles (use Tailwind)
- Direct database access in frontend
- Hardcoded strings (use i18n)
- Large monolithic components (split by feature)
- Missing error boundaries
- Unhandled loading states
