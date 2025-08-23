# CLAUDE.md - Types Package

This file provides guidance to Claude Code for working specifically with the TypeScript type definitions in the KlickerUZH project.

## Package Overview

The Types package serves as the central repository for TypeScript type definitions used across the KlickerUZH platform. It provides consistent and reusable type definitions for core entities, ensuring type safety and consistency between frontend applications and backend services.

### Key Responsibilities

- Defining TypeScript interfaces and types for domain entities
- Extending and complementing Prisma-generated types
- Supporting polymorphic type relationships for complex structures
- Providing type safety for GraphQL operations and UI components
- Maintaining enumerations for system-wide constants

## Type Organization

The types package is organized around several key domain areas:

- **Activity Log Types**: For tracking changes and comments on objects
- **Element Types**: Question and content element structures
- **Activity Types**: LiveQuiz, PracticeQuiz, MicroLearning, and GroupActivity
- **Sharing Types**: Permission models and access control
- **Response Types**: User responses and evaluations
- **Catalog Types**: Shared content collections
- **Analytics Types**: Learning analytics and performance metrics
- **Avatar Settings**: User profile customization

## Key Type Categories

### Enum Types

The package defines various enumeration types that establish consistent value sets:

```typescript
export enum ActivityType {
  LIVE_QUIZ = 'LIVE_QUIZ',
  PRACTICE_QUIZ = 'PRACTICE_QUIZ',
  MICRO_LEARNING = 'MICRO_LEARNING',
  GROUP_ACTIVITY = 'GROUP_ACTIVITY',
}

export enum SharingType {
  OWNED = 'OWNED',
  SHARED = 'SHARED',
  DEPENDENCY = 'DEPENDENCY',
}

export enum DisplayMode {
  LIST = 'LIST',
  GRID = 'GRID',
}
```

### Input Types

Types that define the structure of data provided to API operations:

```typescript
export type ElementManipulationInput = {
  id?: number | null
  status?: ElementStatus | null
  type: ElementType
  name?: string | null
  content?: string | null
  explanation?: string | null
  options?: ElementOptionsInput | null
  // Additional fields...
}
```

### Element Data Types

Comprehensive type definitions for various question types:

```typescript
export type ElementData =
  | ChoicesElementData
  | FreeTextElementData
  | NumericalElementData
  | FlashcardElementData
  | ContentElementData
  | SelectionElementData
  | CaseStudyElementData
```

### Evaluation Types

Types related to scoring, feedback, and response evaluation:

```typescript
export type InstanceEvaluation =
  | IInstanceEvaluationChoices
  | IInstanceEvaluationNumerical
  | IInstanceEvaluationFreeText
  | IInstanceEvaluationFlashcard
  | IInstanceEvaluationContent
  | IInstanceEvaluationSelection
  | IInstanceEvaluationCaseStudy
```

## Integration with Prisma

The Types package extends and complements the types generated from Prisma schema:

1. **Type References**: References Prisma-generated types

   ```typescript
   import type {
     Element,
     ElementStatus,
     ElementType,
   } from '@klicker-uzh/prisma/client'
   ```

2. **JSON Field Types**: Provides structured interfaces for Prisma JSON fields

   ```typescript
   export interface ActivityLogModificationDetails {
     field: ActivityLogModificationFieldType | string
     oldValue: string
     newValue: string
   }
   ```

3. **Extensions**: Extends Prisma types with additional properties needed by the application
   ```typescript
   export type ElementKeys = keyof Element
   ```

## Development Workflow

### Working with Types

1. **Adding New Types**:

   - Place types in the appropriate domain section of `index.ts`
   - Use meaningful names that reflect domain concepts
   - Document complex types with comments
   - Group related types with region comments (`// #region`, `// #endregion`)

2. **Modifying Existing Types**:

   - Check for usages across the project before making changes
   - Update all dependent GraphQL operations when changing input types
   - Consider backwards compatibility for existing data

3. **Best Practices**:
   - Use interfaces for type extension/inheritance
   - Use type unions for polymorphic relationships
   - Prefer explicit typing over 'any'
   - Create dedicated type aliases for complex structures

## Common Patterns

### Polymorphic Type Unions

The codebase uses type unions to handle polymorphic relationships:

```typescript
export type ElementData =
  | ChoicesElementData
  | FreeTextElementData
  | NumericalElementData
// Additional types...
```

### Generic Type Constraints

Generic types with constraints are used for flexible yet type-safe operations:

```typescript
interface IElementData<Type extends ElementType, Options extends ElementOptions>
  extends Omit<Element, 'id'> {
  id: string
  type: Type
  options: Options
  elementId: number
}
```

### Field Mapping Types

Types that define mappings between different structures:

```typescript
export type ElementKeys = keyof Element
```

## Integration with GraphQL

The Types package is closely integrated with GraphQL operations:

1. **Input Types**: Used to define GraphQL input structures
2. **Response Types**: Define the structure of GraphQL query responses
3. **Enum Exports**: Used in GraphQL schema definitions

When adding or modifying types:

- Update corresponding GraphQL schema definitions
- Ensure resolvers handle the type correctly
- Update relevant GraphQL operation files

## Common Use Cases

### Element Type Handling

The codebase uses type discrimination to handle different element types:

```typescript
if (
  elementData.type === 'SC' ||
  elementData.type === 'MC' ||
  elementData.type === 'KPRIM'
) {
  // Handle choices element type
} else if (elementData.type === 'FREE_TEXT') {
  // Handle free text element type
}
```

### Response Processing

Types support complex response processing and evaluation:

```typescript
function evaluateResponse(
  response: SingleQuestionResponse,
  element: ElementData
): InstanceEvaluation {
  // Evaluation logic using types for safety
}
```

## Best Practices

1. **Type Consistency**: Maintain consistency between frontend and backend types
2. **Documentation**: Document complex types, especially polymorphic relationships
3. **Naming Conventions**: Use clear, descriptive naming
   - `I` prefix for interfaces
   - `Input` suffix for input types
   - `Type` suffix for enum-like string unions
4. **Organization**: Group related types with region comments
5. **Type Safety**: Avoid type assertions and `any` whenever possible
6. **Performance**: Consider tree-shaking impact when organizing types
7. **Backwards Compatibility**: Be cautious when modifying types used by multiple packages

## Troubleshooting

### Type Mismatches

If you encounter type mismatches between packages:

1. Check import paths (ensure you're importing from @klicker-uzh/types)
2. Verify that all packages are using the same version of the types package
3. Check for circular dependencies between packages

### Missing Type Exports

If types aren't being exported correctly:

1. Ensure the type is exported from the main index.ts file
2. Check that the package has been built after changes
3. Verify that dependent packages have the types package as a dependency

## Testing Type Safety

- When making significant changes to types, test the build process for all dependent packages
- Consider adding TypeScript compilation tests for edge cases
- Use TypeScript's strict mode to catch potential issues
