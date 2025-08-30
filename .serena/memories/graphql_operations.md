# GraphQL Operations

## Overview

KlickerUZH has an extensive GraphQL API with 200+ operations organized in a clear, structured way. The GraphQL operations are located in `packages/graphql/src/graphql/ops/` and follow consistent naming conventions.

## Operation Naming Conventions

### Prefixes

- **Q**: Queries (read operations)
- **M**: Mutations (write operations)
- **S**: Subscriptions (real-time operations)
- **F**: Fragments (reusable GraphQL fragments)

### Examples

- `QGetUserCourses` - Query to get user's courses
- `MCreateCourse` - Mutation to create a new course
- `SFeedbackCreated` - Subscription for when feedback is created
- `FElementData` - Fragment for element data

## Core Operation Categories

### User & Account Management

- **QUserProfile**: Get current user profile
- **QSelf**: Get current user basic info
- **MChangeUserLocale**: Change user's locale preference
- **MChangeShortname**: Update user shortname
- **MUpdateUserLogin**: Update login credentials
- **MCreateUserLogin**: Create new user login
- **MDeleteUserLogin**: Remove user login

### Course Management

- **QGetUserCourses**: List user's courses
- **QGetSingleCourse**: Get detailed course information
- **MCreateCourse**: Create new course
- **MDeleteCourse**: Delete course
- **MUpdateCourseSettings**: Update course configuration
- **MToggleArchiveCourse**: Archive/unarchive course
- **QGetCourseOverviewData**: Course dashboard data

### Live Quiz Operations

- **QGetRunningLiveQuiz**: Get active live quiz
- **QGetSingleLiveQuiz**: Get specific live quiz details
- **MCreateLiveQuiz**: Create new live quiz
- **MStartLiveQuiz**: Start live quiz execution
- **MEndLiveQuiz**: End live quiz
- **MCancelLiveQuiz**: Cancel live quiz
- **MEditLiveQuiz**: Modify live quiz settings
- **MActivateSessionBlock**: Activate quiz block
- **SRunningLiveQuizUpdated**: Real-time quiz updates

### Practice Quiz Operations

- **QGetPracticeQuizList**: List available practice quizzes
- **QGetSinglePracticeQuiz**: Get specific practice quiz
- **MCreatePracticeQuiz**: Create new practice quiz
- **MEditPracticeQuiz**: Modify practice quiz
- **MPublishPracticeQuiz**: Make practice quiz available
- **MUnpublishPracticeQuiz**: Remove practice quiz availability
- **MDeletePracticeQuiz**: Delete practice quiz

### Microlearning Operations

- **QGetSingleMicroLearning**: Get microlearning details
- **MCreateMicroLearning**: Create new microlearning
- **MEditMicroLearning**: Modify microlearning
- **MPublishMicroLearning**: Publish microlearning
- **MUnpublishMicroLearning**: Unpublish microlearning
- **MExtendMicroLearning**: Extend microlearning deadline
- **SMicroLearningEnded**: Subscription for microlearning completion

### Group Activities

- **QGetGroupActivity**: Get group activity details
- **MCreateGroupActivity**: Create group activity
- **MEditGroupActivity**: Modify group activity
- **MStartGroupActivity**: Start group activity
- **MEndGroupActivity**: End group activity
- **MPublishGroupActivity**: Publish group activity
- **MUnpublishGroupActivity**: Unpublish group activity
- **SGroupActivityStarted**: Real-time group activity updates

### Element/Question Management

- **QGetUserElements**: List user's elements
- **QGetSingleElement**: Get specific element
- **MDeleteElement**: Delete element
- **MChangeElementStatus**: Update element status
- **MManipulateChoicesQuestion**: Edit multiple choice questions
- **MManipulateNumericalQuestion**: Edit numerical questions
- **MManipulateFreeTextQuestion**: Edit free text questions
- **MManipulateContentElement**: Edit content elements
- **MManipulateFlashcardElement**: Edit flashcard elements
- **MManipulateSelectionQuestion**: Edit selection questions
- **MManipulateCaseStudyQuestion**: Edit case study questions

### Participant Operations

- **MCreateParticipantAccount**: Create participant account
- **MLoginParticipant**: Participant login
- **MLogoutParticipant**: Participant logout
- **MUpdateParticipantProfile**: Update participant profile
- **MJoinCourseWithPin**: Join course using PIN
- **QParticipations**: Get participant's course participations

### Feedback & Communication

- **QGetFeedbacks**: Get quiz feedbacks
- **MCreateFeedback**: Create new feedback
- **MResolveFeedback**: Mark feedback as resolved
- **MDeleteFeedback**: Delete feedback
- **MUpvoteFeedback**: Upvote feedback
- **MPinFeedback**: Pin important feedback
- **SFeedbackCreated**: Real-time feedback creation
- **SFeedbackAdded**: Real-time feedback addition
- **SFeedbackUpdated**: Real-time feedback updates

### Analytics & Reporting

- **QGetCourseActivityAnalytics**: Course activity analytics
- **QGetActivityAnalytics**: General activity analytics
- **QGetCoursePerformanceAnalytics**: Performance metrics
- **QGetLiveQuizEvaluation**: Live quiz evaluation results
- **QGetPracticeQuizEvaluation**: Practice quiz evaluation
- **QGetMicroLearningEvaluation**: Microlearning evaluation

### Permission & Sharing

- **QGetObjectPermissions**: Get object permission details
- **MShareObject**: Share object with users
- **MRevokeObjectAccess**: Remove object access
- **MTransferObjectOwnership**: Transfer object ownership
- **QGetDerivedPermissionOrigin**: Get permission inheritance

### Catalog Operations

- **QGetCatalogObjects**: Browse catalog objects
- **QGetCatalogElements**: Browse catalog elements
- **MAddObjectToCatalog**: Add object to catalog
- **MRequestCatalogObject**: Request catalog object access
- **MImportCatalogObject**: Import from catalog
- **MCopyCatalogObjectToAccount**: Copy catalog object

## Fragment Usage

### Common Fragments

- **FElementData**: Complete element data with solutions
- **FElementDataWithoutSolutions**: Element data for students
- **FElementDataInfo**: Basic element information
- **FPracticeQuizData**: Complete practice quiz data
- **FPracticeQuizDataWithoutSolutions**: Practice quiz for students
- **FMicroLearningData**: Complete microlearning data
- **FMicroLearningDataWithoutSolutions**: Microlearning for students
- **FEvaluationResults**: Evaluation and analytics data
- **FActivityInfoData**: Basic activity information
- **FCatalogObjectData**: Catalog object data

## Real-time Subscriptions

### Live Quiz Subscriptions

- **SRunningLiveQuizUpdated**: Live quiz state changes
- **SLiveQuizSettingsChanged**: Quiz settings updates

### Feedback Subscriptions

- **SFeedbackCreated**: New feedback created
- **SFeedbackAdded**: Feedback added to quiz
- **SFeedbackUpdated**: Feedback modified
- **SFeedbackRemoved**: Feedback deleted
- **SFeedbackPinned**: Feedback pinned/unpinned

### Group Activity Subscriptions

- **SGroupActivityStarted**: Group activity started
- **SGroupActivityEnded**: Group activity ended
- **SSingleGroupActivityEnded**: Single group's activity ended

### Microlearning Subscriptions

- **SMicroLearningEnded**: Microlearning session completed

## Schema Organization

### Type System

- **Scalars**: Custom scalars for dates, JSON, etc.
- **Enums**: Status types, user roles, element types
- **Interfaces**: Common interfaces for activities
- **Unions**: Polymorphic result types
- **Input Types**: Mutation input parameters

### Key Domain Objects

- **User**: Lecturer accounts and profiles
- **Participant**: Student accounts and participation
- **Course**: Course structure and settings
- **Element**: Questions and content elements
- **Activity**: All activity types (LiveQuiz, PracticeQuiz, etc.)
- **Session**: Live quiz sessions and blocks
- **Response**: Student responses and evaluations

## Development Patterns

### Operation Implementation

1. **GraphQL Operation File**: Define operation in `.graphql` file
2. **TypeScript Types**: Generated from schema
3. **Resolver Implementation**: Business logic in services
4. **Authentication**: Role-based access control
5. **Validation**: Input validation and sanitization

### Error Handling

- **Structured Errors**: Consistent error response format
- **Error Codes**: Specific error identification
- **Client Handling**: GraphQL error propagation

### Performance Optimization

- **DataLoader**: Batch database queries
- **Query Complexity**: Prevent expensive operations
- **Caching**: Redis-based query caching
- **Pagination**: Cursor-based pagination

## Usage Examples

### Client-Side Usage

```typescript
// Query example
const { data } = useQuery(QGetUserCourses)

// Mutation example
const [createCourse] = useMutation(MCreateCourse, {
  refetchQueries: [{ query: QGetUserCourses }],
})

// Subscription example
const { data } = useSubscription(SFeedbackCreated, {
  variables: { sessionId },
})
```

### Common Query Patterns

- **List Operations**: Paginated results with filters
- **Detail Operations**: Full object data with relations
- **Nested Operations**: Related data in single query
- **Conditional Operations**: Field selection based on permissions

## Best Practices

### Operation Design

- **Single Responsibility**: One operation per business action
- **Consistent Naming**: Follow prefix conventions
- **Input Validation**: Validate all mutation inputs
- **Permission Checks**: Implement proper authorization

### Fragment Usage

- **Reusable Fragments**: Share common field selections
- **Type-specific**: Fragments for specific object types
- **Permission-aware**: Different fragments for different user roles

### Subscription Management

- **Connection Management**: Proper connection lifecycle
- **Error Handling**: Graceful degradation
- **Performance**: Limit subscription scope
