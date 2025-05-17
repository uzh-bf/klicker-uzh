# TODO: ActivityLog Implementation

## Current Implementation Status

The ActivityLog component has been successfully implemented and integrated across the application. It provides a consistent way to view and add activity entries for various object types.

### ✅ Completed Features

#### Backend
- [x] Create GraphQL query for `getCourseActivity` in `/packages/graphql/src/graphql/ops/QGetCourseActivity.graphql`
- [x] Create GraphQL query for `getLiveQuizActivity` in `/packages/graphql/src/graphql/ops/QGetLiveQuizActivity.graphql`
- [x] Create GraphQL query for `getPracticeQuizActivity` in `/packages/graphql/src/graphql/ops/QGetPracticeQuizActivity.graphql`
- [x] Create GraphQL query for `getMicroLearningActivity` in `/packages/graphql/src/graphql/ops/QGetMicroLearningActivity.graphql`
- [x] Create GraphQL query for `getGroupActivityActivity` in `/packages/graphql/src/graphql/ops/QGetGroupActivityActivity.graphql`
- [x] Create GraphQL query for `getAnswerCollectionActivity` in `/packages/graphql/src/graphql/ops/QGetAnswerCollectionActivity.graphql`
- [x] Add query resolvers in `/packages/graphql/src/schema/query.ts`
- [x] Implement service functions in `/packages/graphql/src/services/sharing.ts`:
  - [x] `getCourseActivity`
  - [x] `getLiveQuizActivity`
  - [x] `getPracticeQuizActivity`
  - [x] `getMicroLearningActivity`
  - [x] `getGroupActivityActivity`
  - [x] `getAnswerCollectionActivity`

#### Frontend
- [x] Create `useObjectActivity` generic hook to handle all object types
  - [x] Add support for all object types with a single, reusable implementation
  - [x] Implement proper query document selection based on object type
  - [x] Handle ID type conversion properly (string vs number) for each object type
  - [x] Add strong type checking and validation for query parameters

- [x] Implement ActivityLog and ActivityLogDialog components
  - [x] Create ActivityLogDialog component in `/apps/frontend-manage/src/components/sharing/ActivityLogDialog.tsx`
  - [x] Use dynamic query document selection based on objectType
  - [x] Extract result data from appropriate response field based on object type
  - [x] Add robust error handling and fallbacks

- [x] Add null safety and validation throughout the component chain
  - [x] Prevent GraphQL queries from running with null IDs
  - [x] Add clear error messages for missing IDs
  - [x] Add safeguards to prevent dialog opening with null IDs
  - [x] Add debug logging to trace ID values

- [x] Update UI components:
  - [x] Create consistent button/icon for activity log access (`ActivityLogButton.tsx`)
  - [x] Add tooltips for activity log buttons
  - [x] Use generic "Activity" title for consistency
  - [x] Ensure mobile-friendly design

- [x] Integrate activity log buttons/icons:
  - [x] Add to Element library list items ✅
  - [x] Add to Activity Overview list items ✅
  - [x] Add to Course Overview list items ✅
  - [x] Add to Answer Collection Overview list items ✅
  - [x] Add to Course Detail page header ✅

#### Bug Fixes
- [x] Fix issue with object-specific queries not being used
- [x] Add null checks and error handling for missing IDs
- [x] Fix variable type mismatch in ActivityListEntry.tsx (convert ID to string with String())
- [x] Add event.stopPropagation() and event.preventDefault() to ActivityLogButton click handler
- [x] Update network policies to ensure fresh data is fetched

### 🔍 Remaining Tasks

#### Modal Refactoring
- [x] Refactor ActivityLogDialog to use `Modal` from `@uzh-bf/design-system` instead of `Dialog` from future components
  - [x] Replace Dialog, DialogContent, DialogHeader, DialogTitle, and DialogTrigger with Modal component
  - [x] Update props to match Modal component API (open, onClose, title, etc.)
  - [x] Keep functionality for controlled/uncontrolled state pattern
  - [x] Maintain styling and layout similar to other sharing modals
  - [x] Ensure proper button handling for closing the modal
  - [ ] Test refactored component with all object types

#### Testing
- [ ] Test with different object types
- [ ] Test permissions and access control
- [ ] Verify real-time updates 
- [ ] Test UI responsiveness and accessibility
- [ ] Test error handling and edge cases

#### Documentation
- [ ] Add documentation for the useObjectActivity hook
- [ ] Document appropriate use cases for activity logs
- [ ] Add code comments explaining ID handling expectations for each component

#### Development Practices
- [ ] Always run type-checks before completing a specific task to catch type errors early
- [ ] Fix any remaining TypeScript errors in the GraphQL imports

#### Backend Refactoring
- [ ] Unify activity queries into a single polymorphic query
  - [ ] Create a generic `getObjectActivity` query that takes objectType parameter
  - [ ] Consolidate the existing type-specific resolvers into a single resolver
  - [ ] Update schema with a unified query definition
  - [ ] Make the resolver branch based on objectType to appropriate DB query
  - [ ] Add proper validation for ID and objectType combinations

#### Frontend Refactoring
- [ ] Update GraphQL operations to use the unified query
  - [ ] Create new `QGetObjectActivity.graphql` operation
  - [ ] Simplify `useObjectActivity` hook to use only one query
  - [ ] Remove type-specific query documents and hooks
  - [ ] Ensure proper type checking with GraphQL codegen

## Future Enhancements (Post-MVP)
- [ ] Add resolved status toggle for messages
- [ ] Implement pagination for large activity logs
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Add automatic tracking of modifications