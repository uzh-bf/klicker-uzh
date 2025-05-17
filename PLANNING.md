# ActivityLog Feature Planning

## Overview and Goals

The ActivityLog feature aims to track changes, actions, and comments on various objects in the KlickerUZH system. This creates a complete history of interactions with these objects and enables collaboration between users with access to the same resources.

### Main Goals

1. **Comprehensive Activity Tracking**: Log all activity on key objects in the system:
   - Elements (questions and content)
   - Courses
   - Activities (LiveQuizzes, PracticeQuizzes, MicroLearnings, GroupActivities)
   - Answer Collections

2. **Activity Types**:
   - **User Messages/Comments**: Allow users to communicate about specific objects
   - **Modifications**: Track changes made to objects (field modifications, status changes)
   - **Actions**: Record important events like sharing, publishing, or status changes

3. **UI Integration**:
   - Display activity logs directly in edit modals (e.g., ElementEditForm)
   - Provide dedicated activity log dialog for all object types
   - Contextual access from list views (e.g., element library page)

4. **Notifications**:
   - Develop a system to notify users about new activity on their content
   - Particularly highlight comments from other users requiring attention

## Current Implementation Status

### Completed

1. **Database Schema**:
   - Added `ActivityLogEntry` model in `sharing.prisma`
   - Defined fields for type, message, resolved status, timestamps
   - Created polymorphic relations to supported object types
   - Established migration script (20250517154709_activity_log)

2. **GraphQL Layer**:
   - Defined GraphQL types in `sharing.ts` schema
   - Created query for fetching activity (`getElementActivity`)
   - Implemented mutation for adding messages (`addActivityMessage`)
   - Added necessary fragment (`ActivityEntryData`)

3. **Frontend Components**:
   - Created reusable `ActivityLog` component with message display and input
   - Implemented `useElementActivity` hook for data management
   - Added integration in `ElementEditForm` as a tabbed interface

### Current Limitations

- Only supports basic message creation and viewing
- Currently primarily integrated with Elements only
- No notification system implemented
- No automatic tracking of modifications yet

## High-Level Tasks Remaining

1. **Complete Backend Implementation**:
   - Expand service functionality in `sharing.ts` to fully support all entity types
   - Create automatic logging for modifications (field changes)
   - Implement additional query operations for other object types
   - Add resolvers and subscriptions for real-time updates

2. **Expand Frontend Integration**:
   - Add ActivityLog to course views
   - Add ActivityLog to activity management pages
   - Add ActivityLog to answer collection management
   - Create standalone dialog for accessing activity logs from list views

3. **User Experience Enhancements**:
   - Add "resolved" status toggle for messages requiring action
   - Improve visual differentiation between message types
   - Add formatting options for messages (markdown, mentions)
   - Implement pagination for large activity logs

4. **Notification System**:
   - Design scalable notification concept
   - Implement badge/indicator system for new activity
   - Add email notification options for important activity
   - Create notification preferences settings

5. **Testing and Documentation**:
   - Write unit tests for activity log logic
   - Add E2E tests for activity log UI
   - Update user documentation to explain activity log features
   - Provide administrator guide for managing activity logs

## Technical Considerations

1. **Performance**:
   - Consider pagination for objects with extensive activity history
   - Implement efficient querying for polymorphic relationships
   - Use read/unread status to optimize notification checks

2. **Security**:
   - Ensure activity logs respect permission models
   - Validate user access before displaying activity data
   - Consider privacy implications of detailed activity tracking

3. **Scaling**:
   - Design notification system to scale with increasing user base
   - Consider approaches for reducing database load from activity queries
   - Plan for data retention/archiving of older activity entries

## Implementation Priorities and Next Tasks

### Current Priority: Generic ActivityLog Dialog

The current implementation works within the element edit modal. Our immediate priority is to:

1. **Create Generic ActivityLog Dialog Component**:
   - Build a standalone, reusable dialog component for activity logs
   - Ensure it works with all object types (elements, courses, activities, answer collections)
   - Support consistent UI/UX across all contexts

2. **Integration with List Views**:
   - Add activity log access from Activity Overview
   - Add activity log access from Course Overview
   - Add activity log access from Answer Collection Overview
   - Implement consistent access pattern (icon/button in list items)

3. **Comment Functionality**:
   - Ensure robust comment posting works across all object types
   - Support proper user attribution and timestamps
   - Implement basic formatting if feasible

### Subsequent Tasks

Once the generic dialog is implemented and integrated across these primary views:

1. Add automatic tracking of modifications
2. Design and implement notification concept  
3. Enhance UI with additional features (resolved status, formatting)
4. Extend to additional object types if needed

## Future Enhancements (Post-MVP)

1. Activity filters and search functionality
2. User mentions in messages (@username)
3. Attachments in activity messages
4. Activity analytics and reporting
5. Integration with external notification systems