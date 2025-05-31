# CLAUDE.md - Prisma Package

This file provides guidance to Claude Code for working specifically with the Prisma database layer in the KlickerUZH project.

## Package Overview

The Prisma package is the foundation of KlickerUZH's data layer, providing the database schema definition, migrations, and client for all other components to interact with the PostgreSQL database.

### Key Responsibilities

- Database schema definition through Prisma schema files
- Database migrations management
- Providing type-safe database client to other packages
- Data seeding for development and testing

## Schema Organization

The Prisma schema is organized into domain-specific files to keep the codebase maintainable:

- `analytics.prisma`: Analytics models for tracking performance metrics
- `course.prisma`: Course and related models
- `datasource.prisma`: Database connection configuration
- `element.prisma`: Question and content elements models
- `gamification.prisma`: Achievements, levels, and gamification features
- `js.prisma`: Prisma client configuration
- `other.prisma`: Email templates and utility models
- `participant.prisma`: Student participation models
- `quiz.prisma`: Activity models (LiveQuiz, PracticeQuiz, MicroLearning, GroupActivity)
- `resources.prisma`: Answer collections and related resources
- `response.prisma`: Response tracking models
- `sharing.prisma`: Permissions, sharing, activity logging, and pending permission operations
- `user.prisma`: User, authentication, and access models

## JSON Field Typing System

KlickerUZH uses a sophisticated system to provide type safety for JSON fields in Prisma:

### 1. Schema Documentation with Comments

JSON fields in the schema files are documented with special triple-slash comments that identify the TypeScript type:

```prisma
model Element {
  // Other fields...

  /// [PrismaElementOptions]
  options Json
}

model ActivityLogEntry {
  // Other fields...

  /// [PrismaActivityLogModificationDetails]
  modificationDetails Json?
}
```

### 2. Type Generation

The project uses `prisma-json-types-generator` to automatically generate TypeScript interfaces from these comments. The generator is configured in `schema.prisma`:

```prisma
generator json {
  provider = "prisma-json-types-generator"
}
```

### 3. Type Structure

The generated types are then referenced in the code, and the actual type definitions are maintained in `@klicker-uzh/types` package:

```typescript
// Example ActivityLogModificationDetails type in types package
export interface ActivityLogModificationDetails {
  field: ActivityLogModificationFieldType | string
  oldValue: string
  newValue: string
}
```

### 4. Usage Pattern

When working with JSON fields:

1. Add the field to the appropriate schema file with a triple-slash comment
2. Define the corresponding type in the types package if needed
3. Access the typed data through the Prisma client and GraphQL resolvers
4. When adding new JSON fields, add appropriate migrations for existing data

This approach combines Prisma's flexibility with TypeScript's type safety.

## Development Workflow

### Common Commands

```bash
# Build the package (generates Prisma client)
pnpm run build

# Create a new migration
pnpm run prisma:migrate

# Create a migration without applying it
pnpm run prisma:migrate:create

# Apply pending migrations
pnpm run prisma:deploy

# Reset database and apply all migrations
pnpm run prisma:reset

# Reset with confirmation bypass (for scripts)
pnpm run prisma:reset:yes

# Seed the database with test data
pnpm run seed

# Open Prisma Studio to browse/edit data
pnpm run prisma:studio

# Run a script with environment variables
pnpm run script src/scripts/your-script.ts

# Run database push (for development, skips migrations)
pnpm run prisma:push
```

### Making Schema Changes

1. Edit the appropriate schema file(s) in `src/prisma/schema/`
2. Generate a migration with `pnpm run prisma:migrate`
3. Review the generated migration in `src/prisma/migrations/`
4. Test the changes locally
5. Deploy with `pnpm run prisma:deploy` in other environments

### Migration Strategy

Follow these guidelines for migrations:

1. **Non-breaking changes**: Adding optional fields, adding tables

   - Create regular migrations

2. **Breaking changes**: Adding required fields, changing field types

   - Add default values for new required fields
   - Consider using migration scripts (in `src/scripts/`) for complex data transformations

3. **Schema refactoring**:
   - Prefer creating new fields/tables and migrating data over direct renames
   - Implement temporary dual-write patterns for critical transitions
   - Follow the pattern in `src/scripts/` for complex migrations

### Environment Management

The project uses Doppler for environment variables:

```bash
# Using different environments
pnpm run prisma:deploy     # dev environment
pnpm run prisma:deploy:qa  # staging
pnpm run prisma:deploy:prod # production
```

## Data Seeding

The package includes several seeding files in `src/data/` for different types of entities:

- `seedTEST.ts`: Main test data seeding
- `seedAchievements.ts`: Achievement-specific data
- `seedUsers.ts`: Test user accounts
- `seedCompetencyTree.ts`: Competency structure
- `seedEmailTemplates.ts`: Email template data
- `seedFlashcards.ts`: Sample flashcard content
- `helpers.js`: Shared utilities for seeding

Seed data is crucial for development and testing. Modify these files when new models are added.

## Migration Scripts

The `src/scripts/` directory contains specialized scripts for complex data migrations:

- Used for multistage migrations or data transformations too complex for SQL
- Run with `pnpm run script src/scripts/script-name.ts`
- Examples include migrating question instances, updating element options, etc.

When using these scripts:

1. Follow the naming pattern: `YYYY-MM-DD_description.ts`
2. Add type checking and validation
3. Use transactions for data integrity
4. Add logging for monitoring progress
5. Include rollback capabilities where possible

## Integration with GraphQL

The Prisma models are exposed through GraphQL via the `@klicker-uzh/graphql` package. When making schema changes:

1. Update GraphQL schema in `packages/graphql/src/schema/`
2. Update resolvers in `packages/graphql/src/services/`
3. Generate GraphQL types with the appropriate command
4. Add new operations in `packages/graphql/src/graphql/ops/`

## Pending Permission Operations

The `PendingPermissionOperation` table (added in v3.0) provides an asynchronous processing queue for permission operations:

### Purpose

- Breaks down large permission operations into smaller, independently processable tasks
- Eliminates transaction timeout issues when sharing with large user groups
- Enables parallel processing of permission calculations
- Provides fault tolerance and retry mechanisms

### Key Features

- **Generic object model**: Uses `objectId` and `objectType` fields instead of specific foreign keys
- **Operation hierarchy**: Supports parent-child relationships for recursive operations
- **Idempotency**: Operation fingerprints prevent duplicate processing
- **Priority-based processing**: Higher priority operations are processed first
- **Comprehensive indexing**: Optimized for queue processing and queries

### Operation Types

- `EXPAND_GROUP_TO_USER_OPERATIONS`: Expands user group permissions to individual users
- `PROCESS_USER_*_ACCESS`: Processes individual user permissions for various object types
- `UPDATE_PERMISSION_LEVEL`: Updates existing permission levels
- `REVOKE_USER_PERMISSION`: Removes user permissions

## Troubleshooting Common Issues

### Migration Conflicts

If you get "Migration conflict" errors:

1. Check if someone else deployed migrations
2. Use `pnpm run prisma:diff` to see differences
3. Consider resetting your local development database

### Type Generation Issues

If Prisma client types aren't updating:

1. Clean the `src/prisma/client` and `dist` directories
2. Rebuild with `pnpm run build`
3. Check for errors in the generated output

## Best Practices

1. Place models in the appropriate domain file
2. Document JSON fields with comments (e.g., `/// [PrismaElementOptions]`)
3. Consider cascading deletes and referential integrity
4. Use appropriate field types and constraints
5. Include appropriate indexes for query performance
6. Test migrations against a copy of production data when possible
7. Update seed data files when adding new required fields
8. Use transactions for data integrity in scripts
9. For complex model changes, prefer multiple smaller migrations over one large one

## Performance Considerations

1. **Indexes**: Add strategic indexes on fields used for frequent lookups
2. **Query optimization**: Use `include` and `select` to limit data fetched
3. **Batching**: Use `createMany` and `updateMany` for bulk operations
4. **Transaction boundaries**: Use transactions to ensure data consistency
5. **Connection pooling**: Configure properly for production environments

## Testing Database Code

- Use a separate test database for integration tests
- Reset to a known state before tests (using `prisma:reset:yes`)
- Create utility functions for common test data setup
- Use transactions to isolate test cases
- Mock the Prisma client when appropriate for unit tests
