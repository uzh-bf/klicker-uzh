# Audit Logging Integration Plan

## Executive Summary

This document outlines the implementation plan for integrating the audit logging service into the KlickerUZH platform. The plan covers embedding audit logging clients in strategic locations across backend services and frontend applications, as well as migrating existing HTTP test files to Bruno format for better test management.

## Current State

### Completed Components
- ✅ **Audit Service** (`apps/audit`): Core service with Azure Table Storage, JWT authentication, and public endpoint
- ✅ **Backend Client** (`packages/util/src/audit.ts`): Simplified AuditClient with retry logic
- ✅ **Frontend Hooks** (`packages/shared-components/src/hooks/useAuditClient.ts`): Assessment-mode-only logging
- ✅ **Type Definitions** (`packages/types/src/audit.ts`): Shared audit event types
- ✅ **JWT Migration**: Centralized JWT verification in `packages/util`
- ✅ **Bruno Test Collection** (`bruno/audit/`): Comprehensive API test suite with 20+ test files
- ✅ **Initial Backend Integration**: Authentication functions with audit logging

### Integration Progress
- ✅ **Phase 2: Bruno Test Migration** - Complete test collection with environments, assertions, and scenarios
- 🟡 **Phase 3: Backend Authentication** - loginParticipant and logoutUser completed, 5 functions remaining
- 🔲 **Phase 4-7**: Content management, responses, frontend, and validation - pending

### Architecture Overview
- **Backend**: Direct service-to-service communication with internal token authentication
- **Frontend**: Cookie-based JWT authentication for student submissions (assessment mode only)
- **Storage**: Azure Table Storage with partition strategy for multi-tenant isolation

## Implementation Areas

### 1. Backend Service Integration (packages/graphql)

#### 1.1 Authentication & Session Management

**Location**: `packages/graphql/src/services/accounts.ts`

| Function | Event Type | Data to Log |
|----------|------------|-------------|
| `loginParticipant` | `auth.participant.login` | userId, success/failure, method |
| `loginTemporaryParticipant` | `auth.temporary.login` | sessionId, pseudonym |
| `loginParticipantMagicLink` | `auth.magiclink.login` | userId, tokenUsed |
| `loginParticipantWithLti` | `auth.lti.login` | userId, courseId, ltiProvider |
| `logoutParticipant` | `auth.participant.logout` | userId, sessionDuration |
| `logoutTemporaryParticipant` | `auth.temporary.logout` | sessionId |
| `logoutUser` | `auth.user.logout` | userId, sessionDuration |

**Implementation Example**:
```typescript
import { AuditClient } from '@klicker-uzh/util'

const auditClient = new AuditClient()

export async function loginParticipant(args: LoginArgs, ctx: Context) {
  const result = await performLogin(args)
  
  // Log the authentication attempt
  await auditClient.log({
    tenantId: ctx.tenantId,
    subject: `participant:${args.usernameOrEmail}`,
    action: result.success ? 'auth.participant.login.success' : 'auth.participant.login.failed',
    userId: result.userId,
    attributes: {
      method: 'password',
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent']
    }
  })
  
  return result
}
```

#### 1.2 Content Management Operations

**Location**: `packages/graphql/src/schema/mutation.ts`

| Operation | Event Type | Data to Log |
|-----------|------------|-------------|
| `createLiveQuiz` | `quiz.live.created` | quizId, courseId, elementCount |
| `createPracticeQuiz` | `quiz.practice.created` | quizId, courseId, resetTime |
| `createMicroLearning` | `microlearning.created` | activityId, courseId, schedule |
| `editActivity` | `activity.edited` | activityId, changes |
| `deleteActivity` | `activity.deleted` | activityId, type, reason |
| `publishActivity` | `activity.published` | activityId, type, visibility |

#### 1.3 Response Tracking

**Location**: `packages/graphql/src/services/stacks.ts`

| Function | Event Type | Data to Log |
|----------|------------|-------------|
| `respondToQuestion` | `response.submitted` | instanceId, participantId, responseTime |
| `submitGroupResponse` | `response.group.submitted` | groupId, instanceId |
| `resetResponse` | `response.reset` | instanceId, participantId, reason |

#### 1.4 Access Control & Sharing

**Location**: `packages/graphql/src/services/sharing.ts`

| Operation | Event Type | Data to Log |
|-----------|------------|-------------|
| `shareActivity` | `activity.shared` | activityId, targetUserId, permission |
| `revokeAccess` | `activity.access.revoked` | activityId, targetUserId |
| `changePermission` | `activity.permission.changed` | activityId, userId, oldPerm, newPerm |

### 2. Frontend Integration

#### 2.1 Student Application (apps/frontend-pwa)

**Assessment Mode Events Only**:
- `session.joined` - Student joins a live session
- `session.left` - Student leaves a session
- `question.viewed` - Question displayed to student
- `response.started` - Student begins answering
- `response.submitted` - Answer submitted
- `feedback.submitted` - Confusion feedback sent
- `quiz.completed` - Practice quiz finished

**Implementation Pattern**:
```tsx
// In assessment mode components
import { useAssessmentAudit } from '@klicker-uzh/shared-components'

function QuizComponent({ isAssessmentMode, sessionId }) {
  const audit = useAssessmentAudit(
    isAssessmentMode,
    process.env.NEXT_PUBLIC_API_URL
  )
  
  const handleResponseSubmit = async (response) => {
    // Submit response
    const result = await submitResponse(response)
    
    // Log only in assessment mode
    audit.logResponseSubmission(
      questionId,
      response,
      { sessionId, responseTime: Date.now() - startTime }
    )
    
    return result
  }
}
```

#### 2.2 Lecturer Application (apps/frontend-manage)

**Control Events** (Backend-initiated):
- Session control operations logged via GraphQL mutations
- No frontend logging needed (handled by backend)

### 3. Response API Service Integration

**Location**: `apps/response-api`

High-volume response processing with efficient batching:
- Implement audit logging for response validation
- Track processing success/failure rates
- Monitor performance metrics

### 4. Migration to Bruno Test Collection

#### 4.1 Directory Structure
```
bruno/audit/
├── collection.bru           # Collection metadata
├── environments/
│   ├── local.bru           # Local development
│   ├── staging.bru         # Staging environment
│   └── production.bru      # Production (read-only tests)
├── health/
│   ├── healthz.bru         # Health check
│   ├── ready.bru           # Readiness check
│   └── metrics.bru         # Prometheus metrics
├── auth/
│   ├── no-token.bru        # Missing auth token
│   ├── invalid-token.bru   # Wrong token
│   └── valid-token.bru     # Successful auth
├── events/
│   ├── minimal-event.bru   # Minimal valid event
│   ├── full-event.bru      # Complete event with all fields
│   ├── custom-timestamp.bru # Event with custom timestamp
│   └── idempotent.bru      # Idempotency testing
├── validation/
│   ├── missing-field.bru   # Missing required field
│   ├── field-too-long.bru  # Field length validation
│   ├── invalid-json.bru    # Malformed JSON
│   └── large-payload.bru   # Payload size limits
└── scenarios/
    ├── authentication-flow.bru
    ├── quiz-lifecycle.bru
    ├── response-tracking.bru
    └── security-events.bru
```

#### 4.2 Bruno File Format Example

```bruno
meta {
  name: Submit Valid Audit Event
  type: http
  seq: 1
}

post {
  url: {{AUDIT_URL}}/audit
  body: json
  auth: none
}

headers {
  Content-Type: application/json
  X-Internal-Token: {{INTERNAL_TOKEN}}
}

body:json {
  {
    "tenantId": "{{TENANT_ID}}",
    "subject": "user:{{USER_EMAIL}}",
    "action": "quiz.created",
    "resourceId": "quiz-{{$randomUUID}}",
    "sessionId": "session-{{$timestamp}}",
    "userId": "{{USER_ID}}",
    "attributes": {
      "quizType": "live",
      "questionCount": 10,
      "courseId": "{{COURSE_ID}}"
    }
  }
}

assert {
  res.status: 202
  res.body.status: accepted
  res.body.eventId: isString
}

script:post-response {
  if (res.body.eventId) {
    bru.setVar("lastEventId", res.body.eventId);
  }
}
```

## Implementation Phases

### Phase 1: Documentation & Planning ✅ COMPLETED
- [x] Create comprehensive implementation plan
- [x] Review current audit service architecture
- [x] Define audit event taxonomy

### Phase 2: Bruno Test Migration ✅ COMPLETED
- [x] **Set up Bruno collection structure** at `bruno/audit/`
- [x] **Environment configurations**: local, staging, production
- [x] **Health check tests**: healthz.bru, ready.bru, metrics.bru
- [x] **Authentication tests**: no-token.bru, invalid-token.bru, valid-token.bru
- [x] **Event submission tests**: minimal-event.bru, full-event.bru, custom-timestamp.bru, idempotent.bru, repeat-idempotent.bru, delete-operation.bru, security-event.bru
- [x] **Validation tests**: missing-field.bru, field-too-long.bru, invalid-json.bru, large-payload.bru
- [x] **Scenario-based test suites**: authentication-flow.bru, quiz-lifecycle.bru, response-tracking.bru
- [x] **Bruno enhancements**: assertions, variables, post-response scripts

**Result**: Complete test collection with 20+ test files ready for manual execution

### Phase 3: Backend Integration - Authentication 🟡 IN PROGRESS
- [x] **Added AuditClient import** to `packages/graphql/src/services/accounts.ts`
- [x] **loginParticipant**: Success/failure logging with detailed attributes (IP, user-agent, method, reason)
- [x] **logoutUser**: Session termination logging with user context
- [ ] **loginTemporaryParticipant**: Temporary participant session tracking
- [ ] **loginParticipantMagicLink**: Magic link authentication audit
- [ ] **loginParticipantWithLti**: LTI provider integration tracking
- [ ] **logoutParticipant**: Participant session termination
- [ ] **logoutTemporaryParticipant**: Temporary session cleanup

**Status**: 2 of 7 authentication functions completed

### Phase 4: Backend Integration - Content 🔲 PENDING
- [ ] **Quiz Operations**: createLiveQuiz, createPracticeQuiz, editActivity, deleteActivity
- [ ] **Activity Management**: publishActivity, shareActivity
- [ ] **Access Control**: revokeAccess, changePermission
- [ ] **Content Lifecycle**: Full audit trail from creation to deletion

**Priority**: High - Critical for compliance and educational data governance

### Phase 5: Backend Integration - Responses 🔲 PENDING
- [ ] **Response Submission**: Individual and group response tracking
- [ ] **Response Management**: Reset operations and validation
- [ ] **Performance Optimization**: Handle high-volume response scenarios (1000+ events/sec)
- [ ] **Learning Analytics**: Response patterns and timing analysis

**Priority**: Medium - Important for learning insights and assessment integrity

### Phase 6: Frontend Integration 🔲 PENDING
- [ ] **Assessment Mode Hook**: useAssessmentAudit integration in student applications
- [ ] **Session Events**: Join/leave tracking for live sessions
- [ ] **Interaction Tracking**: Question views, response submissions, feedback
- [ ] **Client-side Performance**: Ensure no UX impact from audit logging

**Priority**: Medium - Required for comprehensive student activity tracking

### Phase 7: Testing & Validation 🔲 PENDING
- [ ] **End-to-end Testing**: Complete audit trail validation across all services
- [ ] **Performance Benchmarking**: < 50ms overhead, 99.9% availability, 1000+ events/sec
- [ ] **Security Validation**: Token security, data encryption, access controls
- [ ] **Load Testing**: High-volume scenarios with Bruno collection
- [ ] **Production Readiness**: Deployment scripts, monitoring, alerting

**Priority**: Critical - Must pass before production rollout

## Testing Strategy

### Bruno Test Collection Usage

The comprehensive Bruno test collection at `bruno/audit/` provides:

#### 1. Manual Testing Workflow
```bash
# 1. Start audit service locally
cd apps/audit && pnpm dev

# 2. Open Bruno and load collection
# - Select 'local' environment
# - Execute tests individually or as collection
# - Verify all assertions pass

# 3. Review test results
# - Health checks should return 200
# - Auth tests validate token handling
# - Event tests confirm proper audit logging
# - Validation tests verify input sanitization
```

#### 2. Test Categories
- **Health Tests** (3 files): Service availability and metrics
- **Authentication Tests** (3 files): Token validation and security
- **Event Tests** (7 files): Complete audit event lifecycle
- **Validation Tests** (4 files): Input validation and error handling
- **Scenario Tests** (3 files): End-to-end workflows

#### 3. Environment Testing
- **Local**: Full test suite against localhost:7080
- **Staging**: Subset of safe tests against staging environment
- **Production**: Read-only health checks and monitoring

### Integration Testing with GraphQL

#### Authentication Flow Testing
1. **loginParticipant Testing**
   - Success case: Valid credentials → audit event created
   - Failure cases: Invalid user, wrong password → failure events logged
   - Performance: < 50ms additional overhead measured

2. **logoutUser Testing**
   - Session termination → logout event with duration
   - User context preservation in audit attributes

#### Verification Steps
1. Execute GraphQL authentication mutations
2. Query Azure Table Storage for corresponding audit events
3. Validate event attributes match expected schema
4. Confirm proper tenant isolation and data security

## Configuration Requirements

### Environment Variables

#### Backend Services
```bash
# Audit Service Configuration
AUDIT_SERVICE_URL=http://audit-service:7080
INTERNAL_TOKEN=<secure-random-token>
AUDIT_ENABLED=true
```

#### Frontend Applications
```typescript
// Environment configuration
NEXT_PUBLIC_API_URL=https://api.klicker.uzh.ch
NEXT_PUBLIC_AUDIT_ENABLED=true
```

#### Audit Service
```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
AZURE_TABLE_NAME=AuditLogs

# Authentication
APP_SECRET=<shared-secret>
INTERNAL_TOKEN=<secure-random-token>

# Service Configuration
PORT=7080
LOG_LEVEL=info
```

## Risk Assessment & Current Status

### Identified Implementation Risks

#### 1. Multi-Tenant Support
- **Current State**: TenantId hardcoded as 'klicker-uzh' in authentication functions
- **Risk**: When multi-tenant support is added, audit events may not be properly isolated
- **Mitigation Plan**: Extract tenantId from context when available
- **Code Location**: `packages/graphql/src/services/accounts.ts:line 118, 138, 168`
- **TODO**: Replace hardcoded value with `ctx.tenantId || 'klicker-uzh'`

#### 2. Request Context Availability
- **Current State**: Using optional chaining for IP and user-agent (`ctx.req?.ip`)
- **Risk**: Missing request context in some GraphQL execution environments
- **Mitigation**: Graceful degradation - audit events created without optional attributes
- **Status**: ✅ Handled - No blocking issues if context is missing

#### 3. Audit Service Availability
- **Current State**: AuditClient has built-in retry logic and graceful degradation
- **Risk**: Main application functionality blocked if audit service fails
- **Mitigation**: ✅ Async fire-and-forget logging with error handling
- **Performance**: No impact on primary user flows even during audit failures

#### 4. Performance Impact
- **Current State**: 2 authentication functions integrated
- **Measured Impact**: To be tested with Bruno collection against local service
- **Target**: < 50ms overhead per operation
- **Risk**: High-volume operations (responses) may need batching optimization

### Security Considerations

#### 1. Data Privacy
- **Implemented**: No plaintext passwords in audit logs
- **Implemented**: User identifiers (username/email) in subject field only
- **TODO**: Evaluate if additional data sanitization needed for attributes

#### 2. Token Security
- **Implemented**: Internal token authentication between services
- **Status**: Uses existing APP_SECRET for JWT verification
- **TODO**: Rotate INTERNAL_TOKEN regularly in production

## Success Metrics

### Functional Requirements
- [x] **Bruno Test Collection**: 20+ comprehensive tests ready for execution
- [x] **Authentication Events**: loginParticipant (success/failure) and logoutUser implemented
- [ ] **Complete Authentication Coverage**: 5 additional auth functions pending
- [ ] **Content lifecycle events**: Quiz creation, editing, deletion tracking
- [ ] **Response submissions**: Individual and group response audit trails
- [ ] **Assessment mode events**: Frontend hook integration
- [ ] **End-to-end audit trail**: Complete user journey tracking

### Technical Implementation Metrics
- [x] **Audit Client Integration**: Successfully imported and initialized
- [x] **Error Handling**: Graceful degradation when audit service unavailable
- [x] **Event Structure**: Comprehensive attributes with context data
- [x] **Test Coverage**: All audit service endpoints covered by Bruno tests
- [ ] **Performance Baseline**: < 50ms overhead measurement pending
- [ ] **High-Volume Testing**: 1000+ events/second capability validation

### Performance Requirements
- [x] **Async Implementation**: Non-blocking audit logging implemented
- [x] **Retry Logic**: Built-in AuditClient retry mechanism with exponential backoff
- [ ] **< 50ms overhead**: To be measured with Bruno tests against integrated functions
- [ ] **99.9% availability**: Service monitoring and alerting setup pending
- [ ] **1000+ events/second**: Load testing with high-volume scenarios
- [ ] **Zero user impact**: Confirmed through graceful degradation design

### Security Requirements
- [x] **PII Protection**: No passwords or sensitive data in audit events
- [x] **Secure Authentication**: Internal token validation implemented
- [x] **Data Classification**: Subject identifiers and sanitized attributes only
- [x] **Encrypted Storage**: Azure Table Storage encryption at rest enabled
- [ ] **Access Control**: Audit query permissions and role-based access
- [ ] **Security Testing**: Penetration testing of audit endpoints

## Immediate Next Steps (Priority Order)

### 🔥 High Priority - Complete Authentication Integration (1-2 days)

1. **Remaining Authentication Functions**
   ```typescript
   // packages/graphql/src/services/accounts.ts
   
   // Add to loginTemporaryParticipant:
   await auditClient.log({
     tenantId: 'klicker-uzh',
     subject: `temp-participant:${pseudonym}`,
     action: 'auth.temporary.login.success',
     sessionId: `live-quiz-${liveQuizId}`,
     attributes: { pseudonym, liveQuizId, avatar }
   })
   
   // Add to loginParticipantMagicLink, loginParticipantWithLti
   // Add to logoutParticipant, logoutTemporaryParticipant
   ```

2. **Testing Validation**
   - Execute Bruno collection against local service
   - Verify audit events in Azure Table Storage
   - Measure performance overhead (target: < 50ms)
   - Confirm all auth flows create appropriate events

### 🔶 Medium Priority - Content Management (2-3 days)

1. **Quiz Creation Operations**
   ```typescript
   // packages/graphql/src/schema/mutation.ts or related resolvers
   
   await auditClient.log({
     tenantId: 'klicker-uzh',
     subject: `instructor:${ctx.user.email}`,
     action: 'quiz.live.created',
     resourceId: quiz.id,
     userId: ctx.user.id,
     attributes: {
       quizName: quiz.name,
       questionCount: quiz.elements.length,
       courseId: quiz.courseId,
       publicationStatus: quiz.status
     }
   })
   ```

2. **Critical Operations to Prioritize**
   - createLiveQuiz, createPracticeQuiz (high usage)
   - deleteActivity (compliance critical)
   - publishActivity (state change tracking)

### 🔷 Lower Priority - Response Tracking (2-3 days)

1. **High-Volume Considerations**
   - Implement in `packages/graphql/src/services/stacks.ts`
   - Consider batching for performance
   - Focus on assessment-mode responses first

### 📈 Continuous - Testing and Monitoring

1. **Bruno Test Execution**
   - Run full collection after each integration
   - Monitor response times and error rates
   - Validate Azure Table Storage entries

2. **Performance Monitoring**
   - Establish baseline metrics
   - Set up alerts for service degradation
   - Track audit event volume and patterns

## Team Handoff Information

### What's Ready for Use
- ✅ **Bruno Test Collection**: Complete API testing framework
- ✅ **AuditClient**: Ready for import in any backend service
- ✅ **Authentication Examples**: loginParticipant and logoutUser as reference implementation
- ✅ **Azure Integration**: Service configured and running

### What Needs Developer Attention
- 🛠️ **Multi-tenant Support**: Replace hardcoded tenantId when context available
- 🛠️ **Remaining Auth Functions**: 5 functions need audit logging added
- 🛠️ **Content Operations**: Quiz and activity management integration
- 🛠️ **Performance Testing**: Measure and optimize overhead

### Quick Start for Developers
1. Import AuditClient: `import { AuditClient } from '@klicker-uzh/util'`
2. Initialize: `const auditClient = new AuditClient()`
3. Log events: `await auditClient.log({ tenantId, subject, action, ...attributes })`
4. Test with Bruno collection in local environment
5. Verify events appear in Azure Table Storage

## Risk Mitigation

### Performance Impact
- **Risk**: Audit logging slows down operations
- **Mitigation**: Async logging, batching, circuit breakers

### Storage Growth
- **Risk**: Rapid growth of audit data
- **Mitigation**: Retention policies, archival strategy, partitioning

### Service Availability
- **Risk**: Audit service downtime blocks operations
- **Mitigation**: Graceful degradation, local buffering, retry logic

### Data Privacy
- **Risk**: Sensitive data in audit logs
- **Mitigation**: Data classification, encryption, access controls

## Monitoring & Alerting

### Key Metrics
- Event ingestion rate
- Processing latency (p50, p95, p99)
- Error rates by event type
- Storage usage and growth
- API endpoint availability

### Alerts
- High error rate (> 1% failed events)
- Service unavailable (> 30 seconds)
- Storage quota approaching (> 80%)
- Unusual activity patterns

## Documentation Updates

### Developer Documentation
- [ ] Update API documentation with audit events
- [ ] Add audit client usage examples
- [ ] Document event taxonomy
- [ ] Create troubleshooting guide

### Operations Documentation
- [ ] Audit log query procedures
- [ ] Retention policy documentation
- [ ] Backup and recovery procedures
- [ ] Security incident response

## Appendix

### A. Event Taxonomy

```
auth.*                  # Authentication events
  .user.login
  .user.logout
  .participant.login
  .participant.logout
  
content.*               # Content management
  .quiz.created
  .quiz.edited
  .quiz.deleted
  .quiz.published
  
response.*              # Response tracking
  .submitted
  .reset
  .validated
  
access.*                # Access control
  .granted
  .revoked
  .changed
  
system.*                # System events
  .error
  .maintenance
  .migration
```

### B. Bruno Collection Variables

```javascript
// Collection variables
{
  "AUDIT_URL": "http://localhost:7080",
  "INTERNAL_TOKEN": "test-secret-token-123",
  "TENANT_ID": "test-tenant",
  "USER_ID": "test-user-123",
  "USER_EMAIL": "test@example.com",
  "COURSE_ID": "cs101-2024"
}
```

### C. Sample Audit Queries

```typescript
// Query audit logs by tenant and time range
const logs = await queryAuditLogs({
  tenantId: 'tenant-123',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
  action: 'auth.*'
})

// Get user activity trail
const userActivity = await getUserAuditTrail({
  userId: 'user-456',
  limit: 100
})
```

## Conclusion

This implementation plan provides a structured approach to integrating audit logging throughout the KlickerUZH platform. By following these phases, we ensure comprehensive coverage while maintaining system performance and security. The migration to Bruno testing format will improve test maintainability and enable better CI/CD integration.