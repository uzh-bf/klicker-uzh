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

## Automatic Activity Tracking: Element Modifications

Implementing automatic tracking of element modifications to provide a comprehensive history of changes.

### Implementation Plan

#### Backend Changes

1. **Element Modification Tracking**:

   - [x] Enhance the `manipulateQuestion` function in `questions.ts` to detect changes
   - [x] Compare before/after states of title and status fields
   - [x] Create ActivityLogEntry records with type MODIFICATION for detected changes
   - [x] Store structured data in the `modificationDetails` JSON field
   - [x] Generate human-readable messages for change summaries

2. **Element Creation Tracking**:

   - [x] Add logic to detect when elements are newly created (no existing ID)
   - [x] Create ActivityLogEntry records with type CREATION for new elements
   - [x] Include initial metadata in the activity log entry

3. **Element Sharing Tracking**:

   - [ ] Enhance permission-granting functions to log sharing activities
   - [ ] Create ActivityLogEntry records with type SHARING when sharing occurs
   - [ ] Include information about who shared and with whom

4. **PrismaActivityLogModificationDetails Type**:
   - [x] Create TypeScript type definition that matches schema comment
   - [x] Implement interface for title modifications
   - [x] Implement interface for status modifications
   - [x] Design extensible structure for future modification types

#### GraphQL Schema Updates

1. **ActivityLogEntry Type Updates**:

   - [x] Update ActivityLogEntry GraphQL type to expose modificationDetails field
   - [x] Add resolvers for processing modificationDetails data
   - [x] Add fragment for including modificationDetails in queries

2. **Type Definitions**:
   - [x] Define appropriate TypeScript interfaces for modification data
   - [x] Create TypeScript enums for modification field types
   - [x] Add documentation for type structure and usage

#### Frontend Updates

1. **ActivityLog Component Enhancement**:

   - [ ] Update component to handle different activity types (MESSAGE, MODIFICATION, CREATION, SHARING)
   - [ ] Create distinct visual styles for each activity type
   - [ ] Implement parsing of modificationDetails field
   - [ ] Format modification data in a user-friendly display

2. **Modification Display**:
   - [ ] Add icons for different modification types (title changes, status changes)
   - [ ] Create formatted display of before/after values
   - [ ] Implement collapsible view for complex modifications
   - [ ] Add timestamps and user attribution

### Testing Tasks

1. **Unit Tests**:

   - [ ] Test element change detection logic
   - [ ] Test modification data structure generation
   - [ ] Verify permissions for viewing activity logs

2. **Integration Tests**:
   - [ ] Test full flow from element update to activity log display
   - [ ] Verify multiple modifications are properly tracked
   - [ ] Test UI rendering of different modification types

### Documentation

1. **Code Documentation**:

   - [ ] Document modificationDetails field structure
   - [ ] Add comprehensive JSDocs to new functions
   - [ ] Create examples for different modification types

2. **User Documentation**:
   - [ ] Update user guide with information about activity tracking
   - [ ] Create visual examples of how modifications appear
   - [ ] Document permissions for viewing activity history

## Future Enhancements (Post-MVP)

- [ ] Implement pagination for large activity logs
- [ ] Add visual indicators (red dots) to show when there's new activity
- [ ] Implement logic to determine when activity is "new" versus already viewed
- [ ] Create a system for tracking which activities a user has seen
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Optimize queries to check for new activity without excessive database load
- [ ] Implement caching for recently accessed activity data
- [ ] Use efficient state management to minimize unnecessary re-renders
