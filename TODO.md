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

## Message Resolution in Activity Log: Partially Implemented ⚠️

The ability for users to mark messages as resolved in the activity log has been partially implemented. The frontend components are ready, but the backend implementation is incomplete.

### Implementation Status

1. **Backend Changes**

   - ✅ Added database schema support with resolved field (default false) and resolvedAt timestamp
   - ✅ Created GraphQL mutation definition for resolving/unresolving messages
   - ❌ Backend resolver function returns null (not yet implemented)
   - ❌ Missing service function implementation in sharing.ts
   - ❌ GraphQL mutation parameters mismatch: frontend expects 'resolved' parameter, but mutation doesn't include it

2. **Frontend Implementation**

   - ✅ Updated ActivityLog component UI with resolution UI elements (partially commented out)
   - ✅ Added useActivityLogAction hook with resolution support
   - ✅ Implemented optimistic UI updates for resolution (will work once backend is complete)
   - ✅ Prepared visual indicators for resolved messages

3. **Current Limitations**
   - Resolution actions don't actually work (backend returns null)
   - Graphql mutation parameter mismatch between frontend and backend
   - Filtering option for resolved messages is commented out in ActivityLog component
   - Visual indicators are prepared but not fully utilized

### Next Implementation Steps
   - [ ] Implement missing resolveActivityLogEntry service function in sharing.ts
   - [ ] Fix GraphQL mutation parameter mismatch (add 'resolved' parameter)
   - [ ] Uncomment and finalize UI elements for resolution in ActivityLog component
   - [ ] Add proper validation for permission checks when resolving messages
   - [ ] Test with real data to ensure proper functionality

## Automatic Tracking of Element Modifications

Our next immediate priority is to implement automatic tracking of element modifications in the activity log, with a specific focus on title and status changes.

### Implementation Plan

#### Backend Changes

1. **Enhance Element Update Service**:
   - [ ] Modify the `updateElement` function in `questions.ts` service to compare before/after states
   - [ ] Detect changes to specific fields (title, status)
   - [ ] Create ActivityLogEntry records with type MODIFICATION for detected changes
   - [ ] Store structured data about the changes in the dedicated `modificationDetails` JSON field

2. **Data Structure for Change Records**:
   - [ ] Define format for storing change information in the `modificationDetails` field (field, old value, new value)
   - [ ] Implement PrismaActivityModificationDetails type to match schema comment
   - [ ] Ensure format is extensible for future tracked fields

3. **GraphQL Updates**:
   - [ ] Ensure ActivityLogEntry type includes the `modificationDetails` field for MODIFICATION entries
   - [ ] Update ActivityLogEntry GraphQL type to properly expose the JSON field
   - [ ] Add any TypeScript types needed to support frontend consumption of modification details
   - [ ] Verify that existing queries return all needed information

#### Frontend Changes

1. **ActivityLog Component Updates**:
   - [ ] Enhance the rendering of MODIFICATION type entries to interpret the `modificationDetails` field
   - [ ] Create distinct visual design for modification entries vs. messages
   - [ ] Implement proper formatting of field changes based on structured data (e.g., "Title changed from X to Y")
   - [ ] Add appropriate icons to indicate different types of changes
   - [ ] Create TypeScript types that mirror the PrismaActivityModificationDetails type

2. **UI/UX Improvements**:
   - [ ] Process multiple field changes stored in the `modificationDetails` field
   - [ ] Display changes in a user-friendly format with before/after values
   - [ ] Add timestamps and user attribution for modifications
   - [ ] Implement collapsible/expandable views for complex changes

### Testing Plan

1. **Test Cases**:
   - [ ] Test title changes are correctly recorded
   - [ ] Test status changes are correctly recorded
   - [ ] Test changes to multiple fields in one update
   - [ ] Verify permission checks are applied correctly

2. **Integration Testing**:
   - [ ] Verify modifications appear correctly in the ActivityLog component
   - [ ] Test with multiple elements and users to ensure correct attribution
   - [ ] Validate interaction with existing message functionality

## Future Enhancements (Post-MVP)

- [ ] Extend modification tracking to other object types (courses, activities)
- [ ] Implement pagination for large activity logs
- [ ] Add visual indicators (red dots) to show when there's new activity
- [ ] Create a system for tracking which activities a user has seen
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Optimize queries to check for new activity without excessive database load
- [ ] Implement caching for recently accessed activity data
