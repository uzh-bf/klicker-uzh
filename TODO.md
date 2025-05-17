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
- [ ] Test the unified query with different object types
  - [ ] Test with Element (numeric ID)
  - [ ] Test with AnswerCollection (numeric ID)
  - [ ] Test with Course (string ID)
  - [ ] Test with LiveQuiz (string ID)
  - [ ] Test with PracticeQuiz (string ID)
  - [ ] Test with MicroLearning (string ID)
  - [ ] Test with GroupActivity (string ID)
- [ ] Test permissions and access control
  - [ ] Verify users without permissions cannot see activity logs
  - [ ] Verify users with READ permissions can view but not add messages
  - [ ] Verify users with WRITE permissions can add messages
- [ ] Verify real-time updates 
- [ ] Test UI responsiveness and accessibility
- [ ] Test error handling and edge cases
  - [ ] Test with invalid IDs
  - [ ] Test with invalid object types
  - [ ] Test adding empty messages

#### Documentation
- [ ] Add documentation for the useObjectActivity hook
- [ ] Document appropriate use cases for activity logs
- [ ] Add code comments explaining ID handling expectations for each component

#### Development Practices
- [ ] Always run type-checks before completing a specific task to catch type errors early
- [ ] Fix any remaining TypeScript errors in the GraphQL imports

#### Backend Refactoring
- [x] Unify activity queries into a single polymorphic query
  - [x] Create a generic `getObjectActivity` query that takes objectType parameter
  - [x] Consolidate the existing type-specific resolvers into a single resolver
  - [x] Update schema with a unified query definition
  - [x] Make the resolver branch based on objectType to appropriate DB query
  - [x] Add proper validation for ID and objectType combinations

#### Frontend Refactoring
- [x] Update GraphQL operations to use the unified query
  - [x] Create new `QGetObjectActivity.graphql` operation
  - [x] Simplify `useObjectActivity` hook to use only one query
  - [ ] Remove type-specific query documents and hooks (after testing confirms the unified query works well)
  - [x] Ensure proper type checking with GraphQL codegen

## Manual Testing for Unified Query

Follow these steps to test the unified activity query implementation:

1. **Setup**
   - [ ] Run the application locally
   - [ ] Ensure you have access to various object types (Element, Course, LiveQuiz, etc.)

2. **Core Functionality Testing**
   - [ ] Open activity log for an Element
   - [ ] Open activity log for a Course
   - [ ] Open activity log for a LiveQuiz
   - [ ] Open activity log for a PracticeQuiz
   - [ ] Open activity log for a MicroLearning
   - [ ] Open activity log for a GroupActivity
   - [ ] Open activity log for an AnswerCollection

3. **Data Operations**
   - [ ] Add a message to an activity log
   - [ ] Verify the message appears in the list
   - [ ] Check that timestamps are displayed correctly
   - [ ] Verify user information is shown correctly

4. **Error Handling**
   - [ ] Attempt to open the activity log with an invalid ID
   - [ ] Try to add an empty message
   - [ ] Test with an unsupported object type

5. **Performance**
   - [ ] Monitor network requests to ensure only one query is being made
   - [ ] Check Apollo cache behavior with the unified query
   - [ ] Test with logs containing many entries

6. **Browser Console**
   - [ ] Check for any errors or warnings in the browser console
   - [ ] Verify that debug logging shows appropriate information

Once all tests pass, the implementation can be considered complete. If issues are found, fix them before removing the legacy queries and functions.

## Future Enhancements (Post-MVP)
- [ ] Add resolved status toggle for messages
- [ ] Implement pagination for large activity logs
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Add automatic tracking of modifications