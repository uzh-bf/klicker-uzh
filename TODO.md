# TODO: ActivityLog Implementation

## Generic ActivityLog Dialog Implementation

### Backend
- [ ] Create GraphQL query for `getCourseActivity` in `/packages/graphql/src/graphql/ops/QGetCourseActivity.graphql`
- [ ] Create GraphQL query for `getLiveQuizActivity` in `/packages/graphql/src/graphql/ops/QGetLiveQuizActivity.graphql`
- [ ] Create GraphQL query for `getPracticeQuizActivity` in `/packages/graphql/src/graphql/ops/QGetPracticeQuizActivity.graphql`
- [ ] Create GraphQL query for `getMicroLearningActivity` in `/packages/graphql/src/graphql/ops/QGetMicroLearningActivity.graphql`
- [ ] Create GraphQL query for `getGroupActivityActivity` in `/packages/graphql/src/graphql/ops/QGetGroupActivityActivity.graphql`
- [ ] Create GraphQL query for `getAnswerCollectionActivity` in `/packages/graphql/src/graphql/ops/QGetAnswerCollectionActivity.graphql`
- [ ] Add query resolvers in `/packages/graphql/src/schema/query.ts`
- [ ] Implement service functions in `/packages/graphql/src/services/sharing.ts`:
  - [ ] `getCourseActivity`
  - [ ] `getLiveQuizActivity`
  - [ ] `getPracticeQuizActivity`
  - [ ] `getMicroLearningActivity`
  - [ ] `getGroupActivityActivity`
  - [ ] `getAnswerCollectionActivity`

### Frontend
- [ ] Create ActivityLogDialog component in `/apps/frontend-manage/src/components/sharing/ActivityLogDialog.tsx`
- [ ] Create custom hooks for different object types:
  - [ ] `useCourseActivity` in `/apps/frontend-manage/src/lib/hooks/useCourseActivity.ts`
  - [ ] `useLiveQuizActivity` in `/apps/frontend-manage/src/lib/hooks/useLiveQuizActivity.ts`
  - [ ] `usePracticeQuizActivity` in `/apps/frontend-manage/src/lib/hooks/usePracticeQuizActivity.ts`
  - [ ] `useMicroLearningActivity` in `/apps/frontend-manage/src/lib/hooks/useMicroLearningActivity.ts`
  - [ ] `useGroupActivityActivity` in `/apps/frontend-manage/src/lib/hooks/useGroupActivityActivity.ts`
  - [ ] `useAnswerCollectionActivity` in `/apps/frontend-manage/src/lib/hooks/useAnswerCollectionActivity.ts`
- [ ] Integrate activity log buttons/icons:
  - [ ] Add to Element library list items
  - [ ] Add to Activity Overview list items
  - [ ] Add to Course Overview list items
  - [ ] Add to Answer Collection Overview list items
- [ ] Update UI components:
  - [ ] Create consistent button/icon for activity log access
  - [ ] Add tooltips for activity log buttons
  - [ ] Ensure mobile-friendly design

### Testing
- [ ] Test with different object types
- [ ] Test permissions and access control
- [ ] Verify real-time updates 
- [ ] Test UI responsiveness and accessibility
- [ ] Test error handling and edge cases

### Documentation
- [ ] Add documentation for new components and hooks
- [ ] Update user documentation if needed
- [ ] Document appropriate use cases for activity logs

## Future Enhancements (Post-MVP)
- [ ] Add resolved status toggle for messages
- [ ] Implement pagination for large activity logs
- [ ] Add formatting options for messages (markdown)
- [ ] Implement user mentions (@username)
- [ ] Create notification system for new activity
- [ ] Add automatic tracking of modifications

## Implementation Workflow
1. Start with the ActivityLogDialog component
2. Implement backend for one object type at a time
3. Create corresponding hook for each object type
4. Integrate with list views incrementally
5. Test thoroughly at each step