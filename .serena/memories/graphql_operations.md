# GraphQL Operations

## Overview

KlickerUZH has an extensive GraphQL API with 200+ operations organized in `packages/graphql/src/graphql/ops/`. The operations follow consistent naming conventions and are organized by business domain.

## Operation Naming Conventions

### Prefixes

- **Q**: Queries (read operations) - e.g., `QGetUserCourses`
- **M**: Mutations (write operations) - e.g., `MCreateCourse`
- **S**: Subscriptions (real-time operations) - e.g., `SFeedbackCreated`
- **F**: Fragments (reusable GraphQL fragments) - e.g., `FElementData`

### Naming Patterns

Operations use clear, descriptive names that follow the pattern:

- `{Prefix}{Action}{DomainObject}` for CRUD operations
- `{Prefix}{DomainConcept}{Action}` for domain-specific actions

## Operation Categories

### Core Business Domains

- **User & Account Management**: User profiles, authentication, preferences
- **Course Management**: Course CRUD, enrollment, settings
- **Live Quiz Operations**: Real-time quiz execution and management
- **Practice Quiz Operations**: Self-paced learning activities
- **Microlearning Operations**: Scheduled learning with notifications
- **Group Activities**: Collaborative activities for participant groups
- **Element/Question Management**: Question and content element CRUD
- **Participant Operations**: Student accounts and course participation
- **Feedback & Communication**: Quiz feedback and Q&A functionality
- **Analytics & Reporting**: Performance metrics and analytics
- **Permission & Sharing**: Access control and content sharing
- **Catalog Operations**: Public content catalog and sharing

## GraphQL Patterns

### Query Patterns

- **List Operations**: Paginated results with optional filtering
- **Detail Operations**: Full object data with nested relations
- **Permission-aware**: Different data based on user permissions

### Mutation Patterns

- **CRUD Operations**: Standard create, read, update, delete
- **State Transitions**: Activity lifecycle operations (start, end, publish)
- **Bulk Operations**: Operations affecting multiple objects

### Subscription Patterns

- **Real-time Updates**: Live quiz state changes
- **Event Notifications**: Feedback creation, activity completion
- **Multi-user Coordination**: Group activity synchronization

## Fragment Strategy

### Fragment Types

- **Complete Data**: Full object data with all relations
- **Public Data**: Data safe for student consumption (without solutions)
- **Summary Data**: Basic information for lists and previews
- **Permission-specific**: Different fragments for different user roles

### Reuse Patterns

Fragments are extensively used to:

- Share common field selections across operations
- Maintain consistency in data fetching
- Support different permission levels for the same data

## Real-time Architecture

### Subscription Management

- **Connection Lifecycle**: Proper subscription setup and teardown
- **Event Filtering**: Server-side filtering to reduce client load
- **Error Handling**: Graceful degradation for connection issues

### Use Cases

- Live quiz real-time updates during active sessions
- Feedback system for instructor-student communication
- Group activity coordination and progress tracking
- Microlearning completion notifications

## Schema Organization

### Type System

- **Scalars**: Custom scalars for dates, JSON, and domain-specific data
- **Enums**: Status types, user roles, element types, permission levels
- **Interfaces**: Common patterns across activity types
- **Unions**: Polymorphic result types for diverse data

### Domain Object Hierarchy

- **User/Participant**: Authentication and profile management
- **Course**: Container for all learning activities
- **Activities**: Polymorphic activity types with shared interfaces
- **Elements**: Question and content types with type-specific options
- **Responses**: Student interaction tracking and evaluation

## Development Integration

### Client-Side Usage

```typescript
// Standard query pattern
const { data, loading, error } = useQuery(QSomeOperation)

// Mutation with optimistic updates
const [mutate] = useMutation(MSomeAction, {
  refetchQueries: [{ query: QRelatedData }],
})

// Real-time subscription
const { data } = useSubscription(SSomeUpdates, {
  variables: { contextId },
})
```

### Type Safety

- Generated TypeScript types from GraphQL schema
- Compile-time verification of query structure
- IDE autocompletion and error checking

## Best Practices

### Operation Design

- Single responsibility per operation
- Consistent permission checking in resolvers
- Proper input validation and sanitization
- Error handling with structured error responses

### Performance Considerations

- DataLoader pattern for N+1 query prevention
- Appropriate use of fragments to minimize over-fetching
- Subscription scope limiting to prevent performance issues
- Query complexity analysis to prevent expensive operations

For the complete list of operations and their detailed implementations, refer to `packages/graphql/src/graphql/ops/` in the codebase.
