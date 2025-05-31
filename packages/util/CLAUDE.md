# CLAUDE.md - Utilities Package

This file provides guidance to Claude Code for working specifically with the shared utilities package in the KlickerUZH project.

## Package Overview

The `@klicker-uzh/util` package provides essential shared utilities and helper functions used throughout the KlickerUZH platform, including element data processing, permission handling, and gamification calculations.

### Key Responsibilities

- Processing and managing element data across different element types
- Handling permission calculations and derived permission propagation
- Level and experience point calculations for gamification
- Providing type definitions and constants for use across the application

## Module Organization

The utilities package is organized into logical modules:

- `elements.ts`: Element data processing functions and utilities
- `permissions.ts`: Permission system entry point and orchestration
- `levels.ts`: Experience point and level calculation for gamification
- `types.ts`: Common type definitions for the utilities package
- `permissions/`: Directory of permission-specific modules by entity type
  - `accessRequest.ts`: Access request management
  - `answerCollection.ts`: Answer collection permissions
  - `catalog.ts`: Catalog collection permissions
  - `constants.ts`: Permission system constants and types
  - `course.ts`: Course permissions
  - `element.ts`: Element permissions
  - `groupActivity.ts`: Group activity permissions
  - `liveQuiz.ts`: Live quiz permissions
  - `microlearning.ts`: Microlearning permissions
  - `practiceQuiz.ts`: Practice quiz permissions
  - `util.ts`: Common permission utilities
  - `pendingOperations.ts`: Pending permission operations for v3.0 async processing

## Permission System

The KlickerUZH permission system is a sophisticated hierarchical model that supports:

### 1. Permission Types

- **Direct Permissions**: Explicitly granted to users or user groups for an object
- **Derived Permissions**: Propagated permissions from parent objects to related objects
- **Owner Access**: Automatic OWNER access for object creators

### 2. Permission Levels

```typescript
enum PermissionLevel {
  NONE = 'NONE',
  READ = 'READ',
  EXECUTE = 'EXECUTE',
  WRITE = 'WRITE',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}
```

### 3. Permission Propagation

Permissions flow through the system in several ways:

- **Parent to Child**: Courses propagate permissions to activities
- **Activity to Elements**: Activities propagate permissions to their elements
- **Resource to Consumer**: Elements share permissions with answer collections

### 4. Derived Permission Computation

The system uses a sophisticated algorithm to compute effective permissions:

1. Start with direct permissions granted to a user or their groups
2. Consider permissions from parent objects (e.g., course → activity)
3. Apply propagation rules based on permission levels
4. Select the highest effective permission level for each user
5. Update database with computed derived permissions

## Element Data Processing

Element data processing ensures consistent handling of different element types:

### Element Types

- `SC/MC/KPRIM`: Single choice, multiple choice, and KPRIM elements
- `NUMERICAL`: Numerical questions
- `FREE_TEXT`: Free text questions
- `CONTENT`: Content elements without questions
- `FLASHCARD`: Flashcard elements
- `SELECTION`: Selection elements
- `CASE_STUDY`: Case study elements

### Key Functions

- `processElementData()`: Transforms database elements into frontend-ready data
- `getInitialInstanceResults()`: Creates initial result structures for elements
- `getInitialInstanceStatistics()`: Initializes statistics tracking for instances
- `getActivityInstanceConnectOrCreate()`: Manages element instance creation/connection

## Gamification Level System

The package provides XP to level mapping functions:

- `xpForLevel()`: Calculates the XP threshold for a given level
- `levelFromXp()`: Determines the level achieved from a given XP amount

The level system uses a quadratic formula that ensures:

- Progressive difficulty in level advancement
- Configurable tuning for game balance
- Consistent behavior across the platform

## Development Workflow

### Using Permission Functions

```typescript
// Recompute permissions for a specific object
await recomputeDerivedPermissions({ elementId: 123 }, prisma)

// Recompute permissions for a specific user on an object
await recomputeElementPermissionsUser({ id: 123, userId: 'user-id' }, prisma)
```

### Processing Element Data

```typescript
// Transform a database element into frontend-ready data
const elementData = processElementData(element)

// Get initial results structure for a new element instance
const results = getInitialInstanceResults(elementData)

// Get initial statistics for a new element instance
const statistics = getInitialInstanceStatistics(instanceType)
```

### Working with Levels

```typescript
// Calculate the XP needed for level 5
const xpNeeded = xpForLevel(5)

// Determine the level from 10000 XP
const level = levelFromXp(10000)
```

## Integration with Other Packages

The utilities package is used by several other components:

- **GraphQL Package**: Uses permission functions to verify access
- **Backend Docker**: Leverages element processing for instance manipulation
- **Frontend Applications**: Use level calculations for gamification displays

## Best Practices

1. **Permission Checks**:

   - Always use the permission system to verify access before operations
   - Include permission checks in GraphQL resolvers
   - Consider propagation effects when granting permissions

2. **Element Processing**:

   - Handle all element types consistently
   - Validate element options before processing
   - Include proper error handling for missing options

3. **Performance Considerations**:

   - Permission recomputation can be expensive for complex hierarchies
   - Consider using user-scoped recomputation when possible
   - Use transactions for operations that update multiple permissions

4. **Type Safety**:
   - Use provided types when interacting with the utilities package
   - Consider prisma transaction client for database operations
   - Follow the established patterns for each module

## Troubleshooting

### Permission Issues

- Check direct permissions with `getMaxAccessLevelIndividual`
- Verify parent object permissions (e.g., course for activities)
- Examine propagation settings on permissions
- Use derived permission origin queries to trace permission sources

### Element Data Processing

- Ensure element options match the expected format for the element type
- Verify answer collections are properly connected for selection/case study elements
- Check for missing fields in element data
- Validate that element instances are properly initialized with results structures

## Pending Permission Operations (v3.0)

The utilities package includes support for the new asynchronous permission operation system via the `pendingOperations.ts` module:

### Operation Building

```typescript
// Build operations for different permission scenarios
const operations = buildOperationsForDirectPermission(permission)
const updateOps = buildOperationsForPermissionUpdate(permission, oldLevel, newLevel)
const revokeOps = buildOperationsForPermissionRevoke(permission)
```

### Type Guards

```typescript
// Check operation types
isGroupExpansionOperation(operation)
isUserAccessOperation(operation)
isPermissionUpdateOperation(operation)
isRevokeOperation(operation)
isOperationComplete(operation)
canRetryOperation(operation, maxRetries)
```

### Feature Control

```typescript
// Simple feature flag control
if (shouldCreateOperations()) {
  // Create operations alongside existing permissions
}

// Logging for operations
logOperation('info', 'Operations created', { count: operations.length })
```

## Future Enhancements

Planned improvements for the utilities package include:

1. Enhanced caching for permission calculations
2. Bulk permission recomputation for improved performance
3. Extended element type support for new question formats
4. Advanced permission visualization helpers
5. Improved error reporting and diagnostics
