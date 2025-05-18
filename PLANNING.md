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

### Current Implementation Status

1. **Backend**:

   - ✅ Basic ActivityLogEntry model with polymorphic relations
   - ✅ GraphQL types and resolvers for all object types
   - ✅ Unified query with object type parameter (`getObjectActivity`)
   - ✅ Permission checking for all supported object types

2. **Frontend**:
   - ✅ Reusable ActivityLog component
   - ✅ Generic useObjectActivity hook supporting all object types
   - ✅ ActivityLogDialog modal for standalone access
   - ✅ Integration with Element, Course, Activity, and AnswerCollection views

### Current Limitations

- Only supports basic message creation and viewing
- No notification system implemented
- No automatic tracking of modifications yet
- No centralized activity dashboard

## High-Level Tasks Remaining

1. **Complete Backend Implementation**:

   - ✅ Expand service functionality in `sharing.ts` to fully support all entity types
   - ✅ Implement unified query with object type as parameter (`getObjectActivity`)
   - Create automatic logging for modifications (field changes)
   - Add resolvers and subscriptions for real-time updates

2. **Expand Frontend Integration**:

   - ✅ Add ActivityLog to course views
   - ✅ Add ActivityLog to activity management pages
   - ✅ Add ActivityLog to answer collection management
   - ✅ Create standalone dialog for accessing activity logs from list views
   - ✅ Add ActivityLog access to dropdown menus on list items
   - ✅ Implement consistent positioning within different contexts

3. **User Experience Enhancements**:

   - Add "resolved" status toggle for messages requiring action
   - Improve visual differentiation between message types
   - Add formatting options for messages (markdown, mentions)
   - Implement pagination for large activity logs
   - Add visual notification indicators for new activity
   - Create system for tracking read/unread status

4. **Notification System**:

   - Design scalable notification concept
   - Implement badge/indicator system for new activity
   - Add email notification options for important activity
   - Create notification preferences settings
   - Add red dot indicators on dropdown buttons and menu items
   - Track which activities have been viewed by users

5. **Testing and Documentation**:
   - Write unit tests for activity log logic
   - Add E2E tests for activity log UI
   - Update user documentation to explain activity log features
   - Provide administrator guide for managing activity logs
   - Test notification indicators in various contexts

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

### Current Priority: Automatic Activity Tracking

With the generic ActivityLog dialog now implemented, our current focus is on automated tracking of important actions:

1. **Track Element Modifications**:

   - Automatically create MODIFICATION entries when elements are updated:
     - Track title changes with before/after values
     - Track status changes (DRAFT, REVIEW, READY)
     - Store structured data in the modificationDetails JSON field
     - Show user-friendly messages in the activity log
   - Add CREATION entries when new elements are created
   - Add SHARING entries when elements are shared with other users

2. **Track Course Modifications**:

   - Record course creation events
   - Log changes to course properties (name, description, dates)
   - Track adding/removing elements from courses
   - Log registration code changes

3. **Track Activity Modifications**:

   - Record creation of activities (LiveQuiz, PracticeQuiz, etc.)
   - Log changes to activity settings
   - Track status changes (draft, published, scheduled, ended)
   - Record when activities are shared with other users

4. **Enhanced Activity Display**:
   - Create distinct visual representations for different activity types
   - Show appropriate icons for each modification type
   - Format modification details to be user-friendly and clear
   - Group related modifications where appropriate

### Implementation Approach

The implementation will follow this approach:

1. **Service Layer Integration**:

   - Enhance existing service functions (e.g., `manipulateQuestion`) to log modifications
   - Add before/after comparison logic to detect changes
   - Create structured records in the modificationDetails field
   - Use consistent message formatting across different object types

2. **User Experience**:

   - Show modification details in a user-friendly format
   - Display appropriate icons for different modification types
   - Provide clear indication of who made changes and when
   - Allow filtering activities by type (messages, modifications, sharing)

3. **First Phase Implementation**:
   - Focus first on element modifications (title, status)
   - Then implement element creation tracking
   - Finally add sharing activity tracking
   - Extend to other object types in subsequent phases

### Subsequent Tasks

After completing the automatic activity tracking:

1. Implement notification system for new activity
2. Enhance UI with additional features (resolved status, formatting)
3. Create comprehensive filtering and search capabilities
4. Add user-specific read/unread tracking

## Future Enhancements (Post-MVP)

1. Activity filters and search functionality
2. User mentions in messages (@username)
3. Attachments in activity messages
4. Activity analytics and reporting
5. Integration with external notification systems

## End-to-End Testing Plan

To ensure the stability and correctness of the ActivityLog implementation, we will create comprehensive end-to-end tests using Cypress. These tests will focus on the currently implemented functionality while providing a framework for testing future enhancements.

### Testing Approach

1. **Test Coverage Areas**:

   - ActivityLog access from element dropdown menus in the library
   - ActivityLog access from element edit modals as a tabbed interface
   - Message creation and submission
   - Display of title modification entries

2. **Test File Structure**:

   - Create a new test file named `W-activity-log-workflow.cy.ts`
   - Follow the existing alphabetical naming convention
   - Organize tests in logical describe blocks

3. **Test Scenarios**:

   - **Basic Access Tests**:

     - Verify ActivityLog dialog opens from element dropdown menu
     - Verify ActivityLog tab is accessible in element edit modal
     - Ensure both entry points show the same data

   - **Message Functionality Tests**:
     - Create a new message in the activity log
     - Verify message appears in the log immediately
     - Confirm message persistence when reopening logs
   - **Modification Tracking Tests**:
     - Modify an element's title
     - Verify a MODIFICATION entry appears in the activity log
     - Confirm the entry shows the previous and new title values
     - Test modifying element status and verify tracking

4. **Setup Requirements**:
   - Extend existing element fixtures with activity-related data
   - Create helper functions for common activity operations
   - Ensure test isolation for reliable results

This testing plan focuses on currently implemented functionality while providing a structure that can be expanded as new features like message resolution are fully implemented.

## Centralized Activity Dashboard

A dedicated Activity Dashboard will provide users with a centralized overview of all activities across their accessible resources. This comprehensive view will enhance collaboration and awareness.

### Key Features

1. **Unified Activity Feed**:

   - Real-time aggregated view of all activity on user-accessible objects
   - Chronological display with newest activities first
   - Visual indicators for different activity types (comments, modifications, actions)

2. **Advanced Filtering Options**:

   - Filter by object type (Elements, Courses, Activities, Answer Collections)
   - Filter by activity type (messages, modifications, actions)
   - Filter by time period (today, this week, this month)
   - Filter by collaboration context (owned by me, shared with me, etc.)

3. **Interactive Components**:

   - Quick response functionality directly from feed
   - Jump-to-object navigation
   - Batch actions for similar activities
   - Read/unread status tracking

4. **Notification Integration**:
   - Visual indicators for new activities
   - Option to mark activities as read/resolved
   - Email notification preferences per object or activity type
   - Muting options for specific objects or threads

### Technical Implementation

1. **Data Requirements**:

   - ✅ Unified query interface (`getObjectActivity`) supporting all object types
   - Optimized loading with pagination and infinite scroll
   - Real-time updates using subscriptions or polling
   - ✅ Proper permission validation for all displayed activities

2. **Frontend Implementation**:

   - Dedicated route at `/manage/activities`
   - Responsive layout supporting various device sizes
   - Optimized rendering for large activity volumes
   - Progressive loading and virtualization for performance

3. **Backend Support**:
   - ✅ Base foundation with unified `getObjectActivity` query
   - New aggregate query `getAllUserActivity` with comprehensive filtering options
   - Efficient database joins to minimize query complexity
   - Caching strategy for frequently accessed activity data
   - Rate limiting to prevent performance issues

### Development Phases

1. **Phase 1: Foundation**

   - Create basic Activity Dashboard page structure
   - Implement simple aggregated activity feed
   - Add essential filtering by object type

2. **Phase 2: Enhanced Functionality**

   - Add advanced filtering options
   - Implement interactive response capabilities
   - Integrate with existing activity log dialogs

3. **Phase 3: Notification Integration**

   - Add read/unread status tracking
   - Implement notification preferences
   - Create email notification system for important activity

4. **Phase 4: Performance Optimization**
   - Optimize querying and rendering for large volumes
   - Implement virtualization for infinite scrolling
   - Add caching for improved response times

This feature will significantly enhance collaboration capabilities within KlickerUZH, providing users with complete visibility into the development and discussion of shared resources.

## Enhanced Activity Details Modal

The current Activity Details Modal provides basic information about activities but lacks interactive elements and efficient navigation. An improved modal will streamline the user experience and integrate activity logs directly into the workflow.

### Key Features

1. **Interactive Timeline Navigation**:

   - Visual step-by-step timeline of activity instances
   - Click-through navigation between instances
   - Progress indicators showing completion status
   - Immediate preview of selected instance content

2. **Split-Panel Interface**:

   - Left panel: Instance content preview with full details
   - Right panel: Activity log feed specific to the activity
   - Responsive design adapting to various screen sizes
   - Collapsible panels for focusing on specific content

3. **Content Preview**:

   - Direct embedding of instance content (questions, options, media)
   - Preview of participant responses and statistics when available
   - Quick links to full editing interface
   - Visual indicators for instance status (draft, published, etc.)

4. **Integrated Collaboration**:
   - Comment directly on specific instances from the preview
   - @mention colleagues for targeted notifications
   - Add context-specific notes visible to collaborators
   - Activity timestamps showing when changes were made

### Technical Implementation

1. **UI Components**:

   - Timeline component with interactive steps
   - Split-pane layout with adjustable divider
   - Content preview cards for different element types
   - Real-time activity feed with filtering

2. **Data Requirements**:

   - Efficient loading of instance content in the modal
   - Integration with existing activity log system
   - Optimized queries to reduce loading time
   - Cached content to improve navigation performance

3. **Navigation Logic**:
   - Maintain modal state during instance navigation
   - History support for browser back/forward buttons
   - Deep linking capabilities for sharing specific views
   - Keyboard shortcuts for quick navigation

### Development Phases

1. **Phase 1: Modal Redesign**

   - Create new modal layout with timeline and split-panel design
   - Implement basic navigation between instances
   - Add content preview for basic element types

2. **Phase 2: Activity Log Integration**

   - Integrate activity log component in right panel
   - Implement context-specific filtering
   - Add commenting capabilities for visible instances

3. **Phase 3: Enhanced Interactivity**

   - Add animation and transitions for smoother navigation
   - Implement keyboard navigation and shortcuts
   - Create mobile-friendly responsive design

4. **Phase 4: Performance Optimization**
   - Optimize content loading strategies
   - Implement lazy loading for timeline items
   - Add caching for frequently accessed content

This enhanced modal will transform the activity management experience, making it more intuitive and efficient for users to navigate, preview, and collaborate on activities without leaving the context of their workflow.
