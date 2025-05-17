# ActivityLog Implementation

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

#### Bug Fixes

- [x] Fix issue with object-specific queries not being used
- [x] Add null checks and error handling for missing IDs
- [x] Fix variable type mismatch in ActivityListEntry.tsx (convert ID to string with String())
- [x] Add event.stopPropagation() and event.preventDefault() to ActivityLogButton click handler
- [x] Update network policies to ensure fresh data is fetched

### 🔍 Remaining Tasks

#### Documentation

- [ ] Add documentation for the useObjectActivity hook
- [ ] Document appropriate use cases for activity logs
- [ ] Add code comments explaining ID handling expectations for each component

#### Development Practices

- [ ] Always run type-checks before completing a specific task to catch type errors early
- [ ] Fix any remaining TypeScript errors in the GraphQL imports
- [ ] Remove type-specific activity query documents and imports

### ✅ Recent Accomplishments

- [x] Added simplified activity log translations for all components
- [x] Implemented message resolution functionality in the activity log
- [x] Added filtering options to show/hide resolved messages
- [x] Created visual indicators for resolved messages

## Message Resolution in Activity Log: Completed ✅

The ability for users to mark messages as resolved in the activity log has been implemented. This helps users track which issues or discussions have been addressed.

### Implementation Summary

1. **Backend Changes**

   - ✅ Confirmed that ActivityLogEntry model already had the resolved status field (default false)
   - ✅ Created GraphQL mutation for resolving/unresolving messages
   - ✅ Implemented resolver and service function with proper checks
   - ✅ Added validation and permission checks

2. **Frontend Implementation**

   - ✅ Updated ActivityLog component to show resolution status
   - ✅ Added toggle button for marking messages as resolved/unresolved
   - ✅ Implemented optimistic UI updates for better user experience
   - ✅ Added visual indicators for resolved messages (strikethrough text, green checkmark, "Resolved" label)

3. **UX Improvements**
   - ✅ Added filtering options to show/hide resolved messages with a checkbox
   - ✅ Added clear visual indicators for resolution status
   - ✅ Implemented proper error handling and feedback for resolution actions

### Future Enhancements
   - [ ] Add resolution metadata (who resolved, when)
   - [ ] Add bulk resolution actions for multiple messages

## Future Enhancements (Post-MVP)

- [ ] Implement pagination for large activity logs
- [ ] Add visual indicators (red dots) to show when there's new activity
- [ ] Implement logic to determine when activity is "new" versus already viewed
- [ ] Create a system for tracking which activities a user has seen
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Add automatic tracking of modifications
- [ ] Optimize queries to check for new activity without excessive database load
- [ ] Implement caching for recently accessed activity data
- [ ] Use efficient state management to minimize unnecessary re-renders
