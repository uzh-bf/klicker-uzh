# Audit Events Mapping - Version 1 Implementation

## Overview

This document maps the comprehensive audit events from [PLAN-audit-events.md](./PLAN-audit-events.md) to our simplified implementation using the existing audit service infrastructure.

## Priority P0 Events - Critical for Operations & Student Trust

### Response Processing & Verification

| Comprehensive Event | Our Event Action | Location | Status | Implementation Notes |
|-------------------|-----------------|----------|---------|---------------------|
| `PARTICIPANT_SUBMIT_RESPONSE` | `response.submitted` | `packages/graphql/src/services/stacks.ts` | 🔲 Pending | Track submission attempt with answer hash |
| `RESPONSE_SAVED_SUCCESS` | `response.saved` | `packages/graphql/src/services/stacks.ts` | 🔲 Pending | Backend confirmation of successful persistence |
| `RESPONSE_SAVE_FAILED` | `response.failed` | `packages/graphql/src/services/stacks.ts` | 🔲 Pending | Critical for debugging save failures |
| `RESPONSE_VALIDATION_ERROR` | `response.validation.failed` | `packages/graphql/src/services/stacks.ts` | 🔲 Pending | When response doesn't pass validation |

### Session Integrity & Authentication

| Comprehensive Event | Our Event Action | Location | Status | Implementation Notes |
|-------------------|-----------------|----------|---------|---------------------|
| `PARTICIPANT_LOGIN` | `auth.participant.login.success/failed` | `packages/graphql/src/services/accounts.ts` | ✅ Completed | Already implemented for loginParticipant |
| `PARTICIPANT_JOIN_QUIZ` | `session.joined` | TBD - Quiz join flow | 🔲 Pending | Establishes participation context |
| `SESSION_EXPIRED` | `session.expired` | Session management | 🔲 Pending | Explains lost work/submissions |

### System Errors & Failures

| Comprehensive Event | Our Event Action | Location | Status | Implementation Notes |
|-------------------|-----------------|----------|---------|---------------------|
| `API_ERROR` | `api.error` | GraphQL error handlers | 🔲 Pending | Backend processing failures |
| `DATABASE_ERROR` | `database.error` | Prisma error handlers | 🔲 Pending | Persistence layer failures |

## Our Simplified Event Schema

### Standard Event Structure
```typescript
interface SimpleAuditEvent {
  tenantId: string;           // 'klicker-uzh' (hardcoded for now)
  subject: string;            // 'participant:email' or 'user:email'
  action: string;             // Simple action like 'response.submitted'
  resourceId?: string;        // questionId, quizId, or other resource
  sessionId?: string;         // Session tracking
  userId?: string;            // participantId or userId
  attributes: {               // Simplified attributes object
    [key: string]: any;
  };
}
```

### Response Events Attributes

#### `response.submitted`
```typescript
attributes: {
  questionId: string;
  questionType: string;       // 'MULTIPLE_CHOICE', 'FREE_TEXT', etc.
  answerHash: string;         // SHA256 hash for verification
  submissionType: 'manual' | 'auto' | 'timeout';
  timestamp: string;          // ISO timestamp
  retryCount?: number;
}
```

#### `response.saved`
```typescript
attributes: {
  questionId: string;
  recordId: string;           // Database record ID
  saveLatency: number;        // milliseconds
  version?: number;           // For optimistic locking
  timestamp: string;
}
```

#### `response.failed`
```typescript
attributes: {
  questionId: string;
  errorCode: string;
  errorMessage: string;
  errorCategory: 'network' | 'database' | 'validation' | 'permission';
  attemptNumber: number;
  willRetry: boolean;
  timestamp: string;
}
```

#### `session.joined`
```typescript
attributes: {
  quizId: string;
  sessionType: 'live' | 'practice' | 'microlearning';
  joinMethod: 'direct' | 'invitation' | 'magic_link';
  affiliationUsed: string;    // Which email they used to login
  timestamp: string;
}
```

## Implementation Locations & Priorities

### Phase 1: Core Response Tracking (Week 1)
**Priority: 🔥 Critical**

1. **`packages/graphql/src/services/stacks.ts`**
   - Function: `respondToQuestion`
   - Events: `response.submitted`, `response.saved`, `response.failed`
   - Key requirement: Prove responses were saved correctly

### Phase 2: Session Management (Week 2)  
**Priority: 🟡 High**

2. **Quiz Join Flow** (Location TBD)
   - Event: `session.joined`
   - Links responses to quiz participation
   - Critical for establishing participation context

3. **Complete Authentication Functions**
   - Remaining functions in `accounts.ts`
   - `loginTemporaryParticipant`, `loginParticipantMagicLink`, etc.

### Phase 3: Error Handling (Week 3)
**Priority: 🔵 Medium**

4. **Error Tracking Integration**
   - GraphQL error middleware
   - Database error handlers
   - Validation error tracking

## What We're Deferring to Version 2

### Complex Events (From Comprehensive Plan)
- ❌ `PARTICIPANT_CHANGE_ANSWER` - Too complex with debouncing logic
- ❌ `PARTICIPANT_CLIENT_ERROR` - Full client-side error tracking
- ❌ `QUIZ_LOAD_TIME` - Performance metrics
- ❌ `MULTIPLE_TABS_DETECTED` - Advanced cheating detection
- ❌ `BROWSER_FOCUS_LOST` - Behavioral tracking

### Advanced Features
- ❌ Debounced text input tracking (3-second delays)
- ❌ Complex retry mechanisms with exponential backoff
- ❌ Real-time alerting and monitoring dashboards
- ❌ ResponseTrace table for high-frequency events
- ❌ Advanced performance optimization and batching

## Data Retention (Simplified)

| Event Category | Retention Period | Justification |
|----------------|------------------|---------------|
| Response Events | 2 years | Assessment compliance requirements |
| Authentication Events | 1 year | Security and access tracking |
| Error Events | 90 days | Debugging and system health |
| Session Events | 1 year | Participation verification |

## Integration Guidelines

### Adding New Events
1. **Use existing AuditClient** from `@klicker-uzh/util`
2. **Follow simple event structure** above
3. **Include meaningful attributes** but avoid over-engineering
4. **Consider privacy** - use hashes, not raw answers
5. **Test with Bruno collection** to verify events are logged

### Error Handling
- All audit logging should be **fire-and-forget**
- Never block primary functionality if audit fails
- Use try-catch around audit calls
- Let AuditClient handle retries and failures gracefully

### Example Implementation Pattern
```typescript
// In GraphQL mutation
try {
  // Perform main operation
  const result = await performResponse(args);
  
  // Log success
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `participant:${participantId}`,
    action: 'response.submitted',
    resourceId: instanceId,
    attributes: {
      questionId: instanceId,
      answerHash: hashAnswer(response),
      submissionType: 'manual',
      timestamp: new Date().toISOString()
    }
  });
  
  return result;
} catch (error) {
  // Log failure
  await auditClient.log({
    tenantId: 'klicker-uzh',
    subject: `participant:${participantId}`,
    action: 'response.failed',
    resourceId: instanceId,
    attributes: {
      questionId: instanceId,
      errorCode: error.code,
      errorMessage: error.message,
      errorCategory: categorizeError(error),
      timestamp: new Date().toISOString()
    }
  });
  
  throw error; // Re-throw for GraphQL error handling
}
```

## Success Metrics for Version 1

### Functional Requirements
- ✅ Response submission attempts are logged
- ✅ Response save confirmations are tracked
- ✅ Save failures are captured with error details
- ✅ Session join events establish participation context
- ✅ Complete audit trail for student response disputes

### Performance Requirements
- < 50ms overhead per operation
- No blocking of primary user flows
- Graceful degradation when audit service unavailable
- 99.9% event delivery rate

### Compliance Requirements
- Prove student responses were saved correctly
- Track which affiliation/email was used for login
- Maintain audit trail for assessment disputes
- Meet educational data retention requirements

## Future Roadmap (Version 2+)

1. **Advanced Response Tracking**
   - Real-time answer change tracking with debouncing
   - Client-side error detection and recovery
   - Performance metrics and optimization

2. **Enhanced Security**
   - Behavioral analysis for cheating detection
   - Advanced session integrity monitoring
   - Real-time alerting for suspicious activity

3. **Analytics & Insights**
   - Student engagement pattern analysis
   - Question difficulty assessment
   - Learning outcome correlation

This mapping ensures we build the essential audit capabilities while keeping the implementation manageable for the first version.