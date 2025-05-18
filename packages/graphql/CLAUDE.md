# CLAUDE.md - GraphQL Package

This file provides guidance to Claude Code for working specifically with the GraphQL layer in the KlickerUZH project.

## Package Overview

The GraphQL package is the central API layer of KlickerUZH, providing a unified interface for accessing and manipulating data across all components of the application. It connects frontend applications with the database through type-safe GraphQL operations and implements all business logic.

### Key Responsibilities

- Schema definition using Pothos GraphQL
- Type-safe GraphQL resolver implementation
- Business logic encapsulation in service modules
- Permission and access control enforcement
- Real-time data with GraphQL subscriptions
- Integration with Prisma for database access

## Architecture Overview

The package is structured around a schema-first approach with code organized by domain:

### Schema Structure

- **Builder**: Core schema builder with plugin configuration (Pothos)
- **Schema Files**: Domain-specific schema type definitions
  - `achievement.ts`: Gamification achievement models
  - `activities.ts`: Shared activity type definitions
  - `course.ts`: Course and participation models
  - `elementData.ts`: Question/content element definitions
  - `evaluation.ts`: Activity result evaluation types
  - `query.ts`: Root query definitions with permission checks
  - `mutation.ts`: Root mutation definitions with permission checks
  - `subscription.ts`: Real-time event stream definitions
  - `sharing.ts`: Permissions and access control types
  - And others for specific domains (user, participant, etc.)

### Service Modules

Business logic is contained in domain-specific service modules that implement resolver functionality:

- `accounts.ts`: User authentication and account management
- `activities.ts`: Generic activity lifecycle management
- `analytics.ts`: Analytics data aggregation and computation
- `courses.ts`: Course creation and management
- `email.ts`: Email notifications and templates
- `feedbacks.ts`: Feedback handling for live quizzes
- `groups.ts`: Group management for collaborative activities
- `liveQuizzes.ts`: Live quiz execution and control
- `microLearning.ts`: Microlearning management
- `participants.ts`: Student participation and progress tracking
- `practiceQuizzes.ts`: Self-paced practice quiz management
- `questions.ts`: Question manipulation and evaluation
- `resources.ts`: Answer collections and resource management
- `sharing.ts`: Permission management and access control
- `stacks.ts`: Element stack handling for activities
- `templates.ts`: Activity template management

### GraphQL Operations

The `src/graphql/ops` directory contains all GraphQL document definitions:

- **Queries** (prefixed with `Q`): Data retrieval operations
- **Mutations** (prefixed with `M`): Data modification operations
- **Fragments** (prefixed with `F`): Reusable field selections
- **Subscriptions** (prefixed with `S`): Real-time event streams

## Permission System

The package implements a sophisticated permission system through the Pothos ScopeAuth plugin:

### Authentication Scopes

- `authenticated`: Basic authenticated user check
- `role`: User role enforcement (USER, ADMIN, PARTICIPANT)
- `scope`: User login scope validation (ACCOUNT_OWNER, FULL_ACCESS, etc.)
- `catalyst`: Special access for users with catalyst status

### Permission Levels

Permission levels are defined in the Prisma schema and used throughout GraphQL resolvers:

- `READ`: Basic viewing access
- `WRITE`: Ability to modify content
- `EXECUTE`: Ability to run/execute activities
- `ADMIN`: Administrative capabilities
- `OWNER`: Full ownership controls

### Permission Checking

The `withPermission` wrapper and `checkAccess` utility functions are used throughout resolvers to enforce access control:

```typescript
resolve: withPermission(
  (args) => ({ courseId: args.id }),
  DB.PermissionLevel.READ,
  async (_, args, ctx) => {
    return await CourseService.getCourseData(args, ctx)
  }
)
```

## Development Workflow

### Adding a New GraphQL Operation

1. Define the operation in `src/graphql/ops/` using GraphQL SDL
2. Add the corresponding field in the appropriate schema file
3. Implement business logic in the relevant service module
4. Run code generation to update TypeScript types

### Adding a New Feature

1. Identify which domain the feature belongs to
2. Create or update GraphQL type definitions in schema files
3. Implement business logic in service modules
4. Add appropriate query/mutation/subscription operations
5. Update unit tests

### Common Commands

```bash
# Build the package
pnpm run build

# Generate GraphQL types
pnpm run generate

# Run development mode with auto-reloading
pnpm run dev

# Run a script with proper environment
pnpm run script src/scripts/example.ts

# Check TypeScript types
pnpm run check

# Run tests
pnpm run test
```

## TypeScript Integration

The package uses several approaches to ensure type safety:

### GraphQL Code Generation

TypeScript types are generated from GraphQL operations using `@graphql-codegen`:

```bash
# Generate types from schema and operations
pnpm run generate
```

### Pothos Type Builder

The Pothos schema builder provides type-safe schema definition:

```typescript
// Example type definition with Pothos
const User = builder.objectType('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    role: t.field({
      type: UserRole,
      resolve: (user) => user.role,
    }),
  }),
})
```

## Context System

The GraphQL context is enhanced with user authentication and Prisma client:

```typescript
export interface Context {
  prisma: PrismaClient
  user?: JWTPayload
  redis?: Redis
  tx?: PrismaTransaction
}

export interface ContextWithUser extends Context {
  user: JWTPayload
}
```

## Optimization and Performance

Several strategies are used to optimize GraphQL resolver performance:

### Dataloader Pattern

- Used implicitly through Prisma client caching
- Enhanced with custom loaders for specific queries

### Prisma Integration

- Direct Prisma integration via Pothos plugin
- Optimized nested queries with proper relation loading

### Transaction Management

Service functions support transaction contexts for atomic operations:

```typescript
// Example transaction usage in a service function
export async function createObject(
  args: CreateObjectArgs,
  ctx: PrismaTransactionContext
): Promise<Object> {
  // Operations will be part of the transaction from the context
  return await ctx.prisma.object.create({
    data: {...},
  })
}
```

## Script System

The `src/scripts` directory contains maintenance and migration scripts:

- Database migrations that are too complex for Prisma alone
- Data verification and cleanup utilities
- Development utilities for testing

Run scripts with:

```bash
pnpm run script src/scripts/scriptName.ts
```

## Testing Approach

The package uses Jest for testing with a focus on service modules:

- Unit tests for individual service functions
- Integration tests for resolver combinations
- Mock strategies for external dependencies

## Schema Evolution Best Practices

When evolving the GraphQL schema:

1. Follow the principle of backward compatibility
2. Add fields as nullable when extending types
3. Use deprecation directives before removing fields
4. Consider query complexity for nested relationships
5. Add unit tests for new resolvers

## Common Error Handling Patterns

The package uses consistent error handling:

```typescript
// Example error pattern in service functions
export async function exampleOperation(args, ctx) {
  // Validation checks
  if (!args.requiredField) {
    throw new GraphQLError('REQUIRED_FIELD_MISSING')
  }

  try {
    // Operation logic
  } catch (error) {
    // Error logging
    console.error('Failed to perform operation', error)

    // Error translation
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new GraphQLError('DUPLICATE_ENTRY')
      }
    }

    // Generic error
    throw new GraphQLError('OPERATION_FAILED')
  }
}
```

## Integration with Other Packages

The GraphQL package integrates with:

- **@klicker-uzh/prisma**: Database layer
- **@klicker-uzh/grading**: Grading logic
- **@klicker-uzh/types**: Shared TypeScript types

## Troubleshooting Common Issues

### Schema Generation Problems

If GraphQL schema generation fails:

1. Check syntax in GraphQL operation files
2. Ensure all referenced types are properly defined
3. Verify schema imports and type references

### Resolver Errors

For resolver implementation issues:

1. Verify context setup is correct
2. Check permission validation logic
3. Ensure proper error handling
4. Verify null handling for optional fields

### Type Safety Issues

For TypeScript errors:

1. Run `pnpm run generate` to update GraphQL types
2. Check nullable vs. non-nullable field definitions
3. Verify scalar type mappings
4. Check resolver return types match schema definitions

## Learning Resources

- [Pothos GraphQL Documentation](https://pothos-graphql.dev/)
- [GraphQL Specification](https://spec.graphql.org/)
- [Prisma Documentation](https://www.prisma.io/docs)
