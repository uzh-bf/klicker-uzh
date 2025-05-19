# CLAUDE.md - Frontend Manage Application

This file provides guidance to Claude Code for working specifically with the frontend-manage application in the KlickerUZH project.

## Application Overview

The frontend-manage application is the lecturer-facing administration interface of KlickerUZH. It provides a comprehensive dashboard for managing questions, activities, courses, analytics, and user settings. This Next.js application serves as the primary interface for content creators.

### Key Responsibilities

- Question/element creation and management
- Activity creation and management (LiveQuiz, PracticeQuiz, MicroLearning, GroupActivity)
- Course management and monitoring
- Analytics and student performance tracking
- Resource sharing and collaboration
- User settings and profile management

## Architecture

This is a Next.js application built with React and GraphQL using a component-based architecture.

### Directory Structure

- `/src/components/`: UI components organized by feature domain

  - `/activities/`: Activity creation and management components
  - `/analytics/`: Data visualization and analytics components
  - `/catalog/`: Content sharing and catalog management
  - `/common/`: Shared UI components
  - `/courses/`: Course management and monitoring
  - `/evaluation/`: Activity evaluation components
  - `/groups/`: Group and user management
  - `/interaction/`: Real-time audience interaction
  - `/liveQuiz/`: Live quiz execution components
  - `/questions/`: Question creation and management
  - `/resources/`: Resource management (answer collections, media)
  - `/sharing/`: Permission management and activity logs
  - `/user/`: User profile and settings

- `/src/pages/`: Next.js page components following file-based routing

  - `/analytics/`: Analytics dashboards and visualizations
  - `/courses/`: Course management and details
  - `/instances/`: Element instance pages
  - `/questions/`: Question management
  - `/quizzes/`: Quiz management and execution
  - `/resources/`: Resource management
  - `/templates/`: Activity templates

- `/src/lib/`: Utility functions and hooks
  - `/hooks/`: Custom React hooks
  - `/utils/`: Utility functions

## Key Technologies

- **Framework**: Next.js 15
- **UI**: React 18 with functional components and hooks
- **Styling**: TailwindCSS with tailwind-merge
- **State Management**: Apollo Client (GraphQL)
- **Forms**: Formik with Yup validation
- **Data Visualization**: Recharts
- **Internationalization**: next-intl
- **Rich Text Editing**: Slate.js
- **Component Library**: @uzh-bf/design-system

## Development Workflow

### Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start with Doppler environment variables
pnpm dev:doppler

# Build for production
pnpm build

# Type checking
pnpm check

# Linting
pnpm lint

# Start production server
pnpm start
```

### Development Best Practices

1. **Component Creation**

   - Group components by feature domain in appropriate subdirectories
   - Follow functional component pattern with TypeScript props interface
   - Create dedicated hooks for complex logic
   - Use consistent naming conventions (PascalCase for components)

2. **GraphQL Integration**

   - Import operation documents from `@klicker-uzh/graphql`
   - Use the Apollo Client for data fetching and mutations
   - Handle loading, error, and success states consistently
   - Implement type-safe GraphQL operations

3. **Styling Approach**
   - Use Tailwind classes for styling
   - Use tailwind-merge for conditional class application
   - Follow responsive design patterns for all components
   - Maintain consistent styling with the design system

## Key Features and Implementation

### Question/Element Management

The application supports creating and managing various element types:

- Single choice (SC)
- Multiple choice (MC)
- KPRIM
- Numerical (NR)
- Free text (FT)
- Content (CT)
- Flashcards (FC)
- Case studies (CS)

Elements are created through the `ElementEditForm` component with type-specific options. The form handles both creation and editing workflows with auto-save functionality.

### Activity Management

Activities are created through wizard-based interfaces:

- **LiveQuiz**: Multi-step live polling for synchronous teaching
- **PracticeQuiz**: Self-paced practice activities for students
- **MicroLearning**: Scheduled learning activities with notifications
- **GroupActivity**: Collaborative activities for student groups

Each activity type has a dedicated wizard component and form submission handler.

### Analytics

The analytics dashboard provides insights into:

- Student participation and engagement
- Performance and correctness rates
- Activity completion and progress
- Time-series activity data

Analytics components are organized by domain (activity, performance, quiz).

### Course Management

Courses serve as containers for activities and participants with features for:

- Student registration and tracking
- Activity organization and scheduling
- Leaderboards and gamification
- Student grouping and collaboration

### ActivityLog System

The ActivityLog feature tracks all activities, messages, and modifications to objects:

- Components in `/components/sharing/` handle activity logs
- `useObjectActivity` hook manages activity data loading
- ActivityLogDialog provides a modal interface for all object types
- Modifications are tracked automatically during element updates

## Testing

When implementing or modifying features:

1. Ensure component props are properly typed
2. Test in different viewport sizes for responsive behavior
3. Validate form submission and error handling
4. Check integration with GraphQL operations
5. Verify state management and side effects

## Common Tasks

### Adding a New Component

1. Create a new component file in the appropriate feature directory
2. Define TypeScript interface for props
3. Implement the component with proper hooks and state management
4. Add internationalization using the messages from `@klicker-uzh/i18n`
5. Style using Tailwind classes
6. Import and use in parent components

### Creating a New Page

1. Add a new file in the `/src/pages/` directory following Next.js routing
2. Import necessary components and hooks
3. Implement data fetching using Apollo Client or SWR
4. Set up proper layouts and page structure
5. Handle authentication and permissions appropriately

### Implementing a New Feature

1. Plan the component hierarchy and state management approach
2. Create necessary GraphQL operations in the graphql package
3. Implement UI components in the appropriate directories
4. Create custom hooks for complex logic or data fetching
5. Add form validation if needed
6. Implement error handling and loading states
7. Test across different devices and scenarios

## Troubleshooting Common Issues

### GraphQL Type Errors

If you encounter TypeScript errors related to GraphQL operations:

1. Ensure the GraphQL operations are properly generated
2. Check imports from the `@klicker-uzh/graphql` package
3. Verify that the query variables match the expected types
4. Use proper type casting if necessary

### Component Rendering Issues

For components that don't render as expected:

1. Check for conditional rendering logic bugs
2. Verify that props are correctly passed
3. Ensure that data is properly loaded before rendering
4. Check for CSS conflicts or responsive design issues

## Performance Considerations

1. **Component Optimization**

   - Use React.memo for expensive renders
   - Implement virtualization for long lists
   - Use proper key props for lists

2. **Data Fetching**

   - Apply appropriate caching strategies
   - Use pagination for large datasets
   - Implement optimistic UI updates

3. **Bundle Size**
   - Lazy load components when possible
   - Use dynamic imports for large dependencies
   - Minimize unused imports

## Best Practices

1. Follow established component patterns in the codebase
2. Keep components focused and maintainable (under 300 lines)
3. Extract complex logic into custom hooks
4. Use TypeScript interfaces for all props and state
5. Implement proper error boundaries and fallbacks
6. Add descriptive comments for complex logic
7. Use the i18n system for all user-facing strings
8. Follow the established permission checking patterns
9. Maintain consistent styling with the design system
10. Optimize for both desktop and mobile viewports

## Integration with Other Packages

- **@klicker-uzh/graphql**: GraphQL operations and types
- **@klicker-uzh/prisma**: Database types and models
- **@klicker-uzh/i18n**: Internationalization messages
- **@klicker-uzh/shared-components**: Shared React components
- **@klicker-uzh/markdown**: Markdown rendering utilities

When making changes, ensure compatibility with these shared packages.
