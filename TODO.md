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

## Next Steps: Activity Log Integration in Dropdown Menus

Now that we have a working unified query implementation for activity logs, our next priority is integrating the ActivityLog functionality into dropdown menus across the application. This will make it easier for users to access activity logs from any context.

### Implementation Progress

1. **Dropdown Integration**

   - ✅ Created reusable `useActivityLogAction` hook for consistent dropdown integration
   - ✅ Added ActivityLog option to dropdown menus:
     - ✅ Element list items in the library
     - ✅ Answer collection list items
     - ✅ Activity list items
   - ✅ Replaced standalone buttons with textual buttons:
     - ✅ Course Overview header
   - ✅ Replaced standalone buttons with icon buttons:
     - ✅ Course list items
   - ✅ Added i18n translations for viewActivityLog key in English and German
   - ✅ Simplified the viewActivityLog translation to "View activity log" without the type parameter
   - ✅ Ensure proper event handling (stopPropagation) to prevent navigation issues
   - ✅ Use consistent positioning and styling within all dropdown menus

2. **Visual Indicator Implementation**

   - Add visual indicators (red dots) to show when there's new activity
   - Implement logic to determine when activity is "new" versus already viewed
   - Create a system for tracking which activities a user has seen

3. **User Experience Enhancements**

   - Ensure consistent labeling and iconography across all dropdown instances
   - Add tooltips for improved discoverability
   - Implement mobile-friendly touch targets

4. **Performance Considerations**
   - Optimize queries to check for new activity without excessive database load
   - Implement caching for recently accessed activity data
   - Use efficient state management to minimize unnecessary re-renders

This integration will significantly improve the usability and discoverability of the ActivityLog feature throughout the application.

## Future Enhancements (Post-MVP)

- [ ] Add resolved status toggle for messages
- [ ] Implement pagination for large activity logs
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Add automatic tracking of modifications
