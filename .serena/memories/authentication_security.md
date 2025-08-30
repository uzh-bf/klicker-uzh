# Authentication & Security

## Overview

KlickerUZH implements a comprehensive authentication and authorization system supporting multiple authentication methods and role-based access control for educational environments.

## Authentication Methods

### 1. Edu-ID Integration

- **Primary Method**: Swiss educational identity federation
- **Service**: Dedicated authentication frontend (`apps/auth`)
- **User Type**: Lecturers and educational staff
- **Configuration**: Environment-specific client secrets

### 2. Magic Link Authentication

- **Method**: Email-based passwordless authentication
- **Operations**: `MSendMagicLink`, `MLoginParticipantMagicLink`
- **Use Case**: Participant authentication without passwords
- **Security**: Time-limited, single-use tokens
- **Flow**: Email → Click → Automatic login

### 3. LTI (Learning Tools Interoperability) Authentication

- **Purpose**: Integration with Learning Management Systems
- **Operation**: `MLoginParticipantWithLti`
- **Integration**: OLAT, Moodle, Canvas support
- **Context**: Course-specific authentication

### 4. Traditional Login

- **Method**: Username/password authentication
- **Operations**: `MLoginParticipant`, `MCreateParticipantAccount`
- **Security**: Bcrypt password hashing
- **Features**: Account activation, password reset

### 5. Temporary Participants

- **Purpose**: Anonymous participation in live sessions
- **Operations**: `MLoginTemporaryParticipant`, `MLogoutTemporaryParticipant`
- **Scope**: Session-limited access
- **Use Case**: Guest participation without registration

## User Roles & Permissions

### User Types

#### 1. Users (Lecturers)

- **Account Type**: Full platform access
- **Capabilities**: Create courses, manage content, analytics
- **Authentication**: Edu-ID, traditional login
- **Data**: Profile, preferences, subscription status

#### 2. Participants (Students)

- **Account Type**: Learning-focused access
- **Capabilities**: Join courses, complete activities, track progress
- **Authentication**: Magic link, LTI, traditional login
- **Data**: Learning progress, achievements, group memberships

#### 3. Temporary Participants

- **Account Type**: Session-only access
- **Capabilities**: Participate in live sessions only
- **Authentication**: Anonymous session tokens
- **Data**: Session responses only (no persistent profile)

### Permission Levels

#### Direct Permissions

```typescript
enum PermissionLevel {
  READ     // View content
  WRITE    // Edit content
  EXECUTE  // Use content in activities (e.g., add questions to quizzes)
  ADMIN    // Manage permissions
  OWNER    // Full control
}
```

#### Derived Permissions

- **Automatic Computation**: Permissions inherited from parent objects
- **Efficient Access**: Pre-calculated permission cache
- **Operations**: `QGetDerivedPermissionOrigin`, `QGetDerivedObjectPermissions`

## Permission System Architecture

### Object-Based Permissions

- **Elements**: Questions and content
- **Courses**: Course management and enrollment
- **Activities**: Live quizzes, practice quizzes, microlearnings
- **Collections**: Catalog sharing collections

### Permission Operations

- **Grant Access**: `MShareObject`
- **Change Level**: `QChangePermissionLevel`
- **Revoke Access**: `MRevokeObjectAccess`
- **Transfer Ownership**: `MTransferObjectOwnership`
- **Check Permissions**: `QGetObjectPermissions`

### Access Requests

- **Request System**: `MRequestCatalogObject`
- **Approval Flow**: `MApproveObjectSharingRequest`, `MDeclineObjectSharingRequest`
- **Cancellation**: `MCancelObjectSharingRequest`
- **Listing**: `QGetCatalogSharingRequests`

## Catalog Sharing System

### Public Sharing

- **Catalog Collections**: Organized shared content
- **Access Levels**: PUBLIC, RESTRICTED, PRIVATE
- **Operations**: `MCreateCatalogCollection`, `MAddObjectToCatalog`
- **Discovery**: `QGetCatalogObjects`, `QGetCatalogElements`

### Sharing Workflow

1. **Create Collection**: Organize objects for sharing
2. **Set Access Level**: Define who can access
3. **Handle Requests**: Approve/decline access requests
4. **Import Content**: Users import to their accounts

### Private Preview Access

- **Feature**: Preview private content before sharing
- **Operation**: `MGrantPrivatePreviewAccess`
- **Use Case**: Content review and collaboration

## Security Patterns

### Authentication Security

- **Token Management**: Secure JWT handling
- **Password Security**: Bcrypt hashing with salts
- **Rate Limiting**: Basic rate limiting (planned enhancement)

### Authorization Checks

- **Middleware**: GraphQL resolver-level authorization
- **Context-Based**: User role and object permissions
- **Least Privilege**: Minimal required permissions

### Data Protection

- **Input Validation**: Sanitize all user inputs
- **SQL Injection**: Prisma ORM prevents SQL injection
- **Type Safety**: TypeScript prevents many runtime errors

## Access Control Patterns

### Course Enrollment

- **PIN-Based**: `MJoinCourseWithPin` for easy enrollment
- **LTI Integration**: Automatic enrollment through LMS
- **Validation**: `QCheckValidCoursePin`

### Group Management

- **Participant Groups**: `MCreateParticipantGroup`
- **Group Activities**: Collaborative work with permissions
- **Random Assignment**: Automated group formation

### Leaderboard Privacy

- **Opt-in System**: `MJoinCourseLeaderboard`, `MLeaveCourseLeaderboard`
- **Privacy Control**: Users control visibility
- **Anonymous Options**: Participate without public ranking

## Development vs Production Security

### Development Environment

- **Relaxed Policies**: Development-friendly settings
- **Test Data**: Seeded accounts for testing
- **Debug Options**: Additional logging and tools

### Production Environment

- **Strict Policies**: Enhanced security measures
- **SSL/TLS**: Encrypted communication
- **Secret Management**: Doppler for secure secret storage
