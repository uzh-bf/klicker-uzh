# Assessment-Focused Audit Logging Implementation Plan

## Key Understanding: Assessment Mode Focus

After thorough analysis, the audit logging should focus EXCLUSIVELY on:
1. **Lecturer actions** on assessment courses, quizzes, and elements
2. **Student actions** in assessment mode quizzes
3. **NO temporary participants** - they're not relevant for assessment
4. **NO course PIN enrollment** - assessment uses invitations only

## Current Implementation Status (Assessment-Focused)

### ✅ What's Already Working for Assessment

**1. Lecturer Quiz Control (Partial)**
- ✅ `USER_START_QUIZ` - Logged when starting assessment quiz
- ✅ `USER_OPEN_BLOCK` - Logged when activating quiz blocks
- ❌ `USER_END_QUIZ` - NOT logged when ending quiz
- ❌ `USER_CLOSE_BLOCK` - NOT logged when deactivating blocks

**2. Student Authentication (Assessment Relevant Only)**
- ✅ `loginParticipant` - Regular student login (⚠️ success audit missing)
- ✅ `loginParticipantMagicLink` - Magic link authentication
- ✅ `loginParticipantWithLti` - LTI integration for assessments
- ✅ `logoutParticipant` - Student logout
- ❌ `logoutTemporaryParticipant` - NOT NEEDED (not assessment)
- ❌ `loginTemporaryParticipant` - NOT NEEDED (not assessment)

**3. Student Response Tracking**
- ⚠️ `PARTICIPANT_SUBMIT_RESPONSE` - Emitted by PWA but blocked by audit gateway allow-list
- ❌ `PARTICIPANT_UPDATE_ANSWER` - Commented out, needs smart implementation
- ❌ `PARTICIPANT_VIEW_INSTANCE` - Not implemented
- ❌ `PARTICIPANT_JOIN_QUIZ` - Not implemented

### 🔴 Critical Gaps for Assessment

**1. Live Quiz PIN Validation (Assessment Mode)**
- Still needed for assessment live quizzes (not course enrollment)
- Currently COMPLETELY commented out in `setLiveQuizPinCookie`
- Critical for tracking assessment quiz access

**2. Client-Side Error Logging**
- No error capture in assessment PWA
- Critical for debugging assessment issues
- Need comprehensive error boundary

**3. Answer Update Tracking**
- Currently saves every 10 seconds (commented out)
- Need change detection to log only actual changes
- Critical for academic integrity monitoring

**4. Missing Lecturer Actions**
- Quiz end event not logged
- Block close/deactivation not logged
- Content creation/editing not tracked
- Assessment settings changes not logged

**5. Audit Gateway Allow-List Misalignment**
- Public endpoint currently only allows `PARTICIPANT_VIEW_INSTANCE`
- PWA events like `PARTICIPANT_SUBMIT_RESPONSE`, `PARTICIPANT_UPDATE_ANSWER`, `PARTICIPANT_JOIN_QUIZ`, `PARTICIPANT_QUIZ_PIN_*` get rejected

## Detailed Implementation Plan

### Phase 0: Audit Gateway Alignment (0.5 day)

**0.1 Expand Public Allow-List**
- Add `PARTICIPANT_SUBMIT_RESPONSE`, `PARTICIPANT_UPDATE_ANSWER`, `PARTICIPANT_JOIN_QUIZ`, `PARTICIPANT_QUIZ_PIN_SUCCESS`, `PARTICIPANT_QUIZ_PIN_FAILED`, and `CLIENT_ERROR`
- Update tests in audit service to cover new actions

**0.2 Environment Wiring**
- Ensure `NEXT_PUBLIC_AUDIT_SERVICE_URL` is set in assessment PWA envs

### Phase 1: Complete Lecturer Control Events (1 day)

**1.1 Add Missing Quiz Control Events**
```typescript
// packages/graphql/src/services/liveQuizzes.ts

// In endLiveQuiz function (around line 1950)
if (quiz.isAssessmentEnabled) {
  await ctx.auditClient.log({
    scope: AuditScope.INTERNAL,
    action: AuditAction.USER_END_QUIZ,
    subject: `user:${ctx.user.sub}`,
    resource: `live-quiz:${quiz.id}`,
    attributes: {
      duration: finishedAt - quiz.startedAt,
      blocksCompleted: completedBlocks,
    }
  })
}

// In deactivateLiveQuizBlock function
if (quiz.isAssessmentEnabled) {
  await ctx.auditClient.log({
    scope: AuditScope.INTERNAL,
    action: AuditAction.USER_CLOSE_BLOCK,
    subject: `user:${ctx.user.sub}`,
    resource: `live-quiz:${quiz.id}`,
    attributes: { blockId: String(blockId) }
  })
}
```

### Phase 2: Assessment Quiz Access Control (2 days)

**2.1 Live Quiz PIN Validation (Assessment Only)**
```typescript
// packages/graphql/src/services/liveQuizzes.ts - setLiveQuizPinCookie

// Only log for assessment quizzes
if (liveQuiz.isAssessmentEnabled) {
  const pinHash = hashSensitiveData(pin)
  const sessionId = ctx.sessionId || generateSessionId()
  
  if (!liveQuiz.pinCode || pin !== liveQuiz.pinCode) {
    await ctx.auditClient.log({
      scope: AuditScope.INTERNAL,
      action: AuditAction.PARTICIPANT_QUIZ_PIN_FAILED,
      subject: `session:${sessionId}`,
      resource: `live-quiz:${liveQuizId}`,
      attributes: {
        pinHash,
        reason: 'incorrect_pin',
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent']
      }
    })
  } else {
    await ctx.auditClient.log({
      scope: AuditScope.INTERNAL,
      action: AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
      subject: `session:${sessionId}`,
      resource: `live-quiz:${liveQuizId}`,
      attributes: {
        pinHash,
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent']
      }
    })
  }
}
```

### Phase 3: Smart Student Response Tracking (2 days)

**3.1 Implement Change Detection**
```typescript
// apps/frontend-pwa/src/components/liveQuiz/QuestionArea.tsx

// Add change detection
const previousResponseRef = useRef<any>(null)

useEffect(() => {
  if (!currentInstance || !isAssessmentMode) return
  
  const interval = setInterval(async () => {
    const current = latestStudentResponseRef.current
    const previous = previousResponseRef.current
    
    // Only log if there's an actual change
    if (current?.response && 
        JSON.stringify(current.response) !== JSON.stringify(previous)) {
      
      await localforage.setItem(tempKey, current.response)
      
      if (isAssessmentMode) {
        auditLog.logAsync({
          action: AuditAction.PARTICIPANT_UPDATE_ANSWER,
          scope: AuditScope.PUBLIC,
          resource: `instance:${currentInstance.id}`,
          correlationId: currentInstance.correlationKey,
          attributes: {
            changeType: previous ? 'update' : 'initial',
            charactersChanged: calculateDiff(previous, current.response)
          }
        })
      }
      
      previousResponseRef.current = current.response
    }
  }, 10000)
  
  return () => clearInterval(interval)
}, [currentInstance, isAssessmentMode])
```

**3.2 Add View and Join Events**
```typescript
// When student views a question
useEffect(() => {
  if (currentInstance && isAssessmentMode) {
    auditLog.logAsync({
      action: AuditAction.PARTICIPANT_VIEW_INSTANCE,
      scope: AuditScope.PUBLIC,
      resource: `instance:${currentInstance.id}`,
      attributes: {
        questionType: currentInstance.elementType,
        blockIndex: activeBlock
      }
    })
  }
}, [currentInstance])

// When student joins quiz
useEffect(() => {
  if (quizId && isAssessmentMode) {
    auditLog.logAsync({
      action: AuditAction.PARTICIPANT_JOIN_QUIZ,
      scope: AuditScope.PUBLIC,
      resource: `quiz:${quizId}`,
      attributes: {
        timestamp: Date.now()
      }
    })
  }
}, [quizId])
```

### Phase 4: Client-Side Error Logging (2 days)

**4.1 Create Error Tracking System**
```typescript
// apps/frontend-pwa/src/lib/assessmentErrorTracking.ts

export class AssessmentErrorTracker {
  private auditClient: ReturnType<typeof useAuditClient>
  
  constructor(auditClient) {
    this.auditClient = auditClient
    this.setupGlobalHandlers()
  }
  
  setupGlobalHandlers() {
    // Only in assessment mode
    if (process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true') return
    
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'uncaught_exception',
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      })
    })
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandled_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      })
    })
  }
  
  logError(errorDetails) {
    this.auditClient.logAsync({
      action: AuditAction.CLIENT_ERROR,
      scope: AuditScope.PUBLIC,
      attributes: {
        ...errorDetails,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    })
  }
}

// apps/frontend-pwa/src/pages/_app.tsx
// Add ErrorBoundary component wrapping the app
class AssessmentErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    if (process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true') {
      // Log to audit service
      errorTracker.logError({
        type: 'react_error_boundary',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }
  }
  
  render() {
    return this.props.children
  }
}
```

### Phase 5: Assessment Content Management (3 days)

**5.1 Track Assessment Quiz Creation/Modification**
```typescript
// packages/graphql/src/schema/mutation.ts resolvers

// When creating assessment quizzes
if (quiz.isAssessmentEnabled) {
  await ctx.auditClient.log({
    scope: AuditScope.INTERNAL,
    action: 'assessment.quiz.created',
    subject: `user:${ctx.user.sub}`,
    resource: `quiz:${quiz.id}`,
    attributes: {
      name: quiz.name,
      courseId: quiz.courseId,
      elementCount: quiz.elements.length,
      assessmentSettings: quiz.assessmentSettings
    }
  })
}

// When modifying assessment settings
if (quiz.isAssessmentEnabled && settingsChanged) {
  await ctx.auditClient.log({
    scope: AuditScope.INTERNAL,
    action: 'assessment.settings.modified',
    subject: `user:${ctx.user.sub}`,
    resource: `quiz:${quiz.id}`,
    attributes: {
      changes: diff(oldSettings, newSettings)
    }
  })
}
```

## Assessment Mode Audit Requirements

### Scope Definition
- ONLY assessment courses, quizzes, and elements
- NO temporary participants (not relevant)
- NO course PIN (assessments use invitations)
- Focus on academic integrity and compliance

### Lecturer Actions (Assessment Context)
- Quiz lifecycle: create, start, open block, close block, end
- Content management: element creation/editing for assessments
- Settings changes: assessment configuration modifications
- Access control: student invitations and permissions

### Student Actions (Assessment Mode)
- Authentication: login, logout (no temporary)
- Quiz access: PIN validation for assessment quizzes
- Responses: view question, update answer (with changes), submit
- Errors: client-side errors during assessment

### Explicitly Out of Scope
- Temporary participant actions
- Course PIN enrollment
- Non-assessment quiz activities
- Gamification events

## Priority Implementation Order

### Pre-Week 0 - Gateway Alignment
1. Expand public allow-list and tests in audit service
2. Wire `NEXT_PUBLIC_AUDIT_SERVICE_URL` in assessment PWA envs

### Week 1 - Critical Assessment Gaps
1. **Complete lecturer control events** (USER_END_QUIZ, USER_CLOSE_BLOCK)
2. **Fix Live Quiz PIN validation** for assessment quizzes
3. **Implement smart answer update** with change detection

### Week 2 - Student Experience & Reliability
1. **Add client-side error logging** for assessment PWA
2. **Implement remaining student events** (VIEW_INSTANCE, JOIN_QUIZ)
3. **Test full assessment flow** end-to-end

### Week 3 - Content Management
1. **Assessment quiz creation/modification** logging
2. **Assessment settings change** tracking
3. **Access control and invitation** logging

## Success Metrics

- ✅ All lecturer control actions logged for assessment quizzes
- ✅ Student journey fully tracked in assessment mode
- ✅ Client errors captured for debugging
- ✅ Answer updates logged only on actual changes
- ✅ Zero impact on non-assessment functionality
- ✅ < 50ms performance overhead maintained
- ✅ Public audit endpoint accepts intended assessment actions (no rejections)

## Technical Considerations

### Performance
- Use fire-and-forget async logging
- Implement change detection to reduce event volume
- Consider batching for high-frequency events
- Enforce 32KB attributes size cap; trim/obfuscate large fields before logging

### Security
- Hash PINs before logging
- No PII in audit logs except user identifiers
- Session-based tracking for anonymous access

### Reliability
- Graceful degradation if audit service unavailable
- Local buffering for critical events
- Retry logic with exponential backoff

## Testing Strategy

### Unit Tests
- Change detection logic
- Error boundary behavior
- Event payload validation

### Integration Tests
- Full assessment quiz flow
- Error scenarios
- Performance under load
- Audit public endpoint allow-list accepts assessment actions

### End-to-End Tests
- Lecturer creates and runs assessment
- Student completes assessment
- Verify all events in audit trail

## Rollout Plan

### Phase 1: Development Environment
- Implement all features
- Comprehensive testing
- Performance benchmarking

### Phase 2: Staging Environment
- Deploy with feature flag
- Test with real assessment scenarios
- Monitor performance impact

### Phase 3: Production
- Gradual rollout by course
- Monitor audit event volume
- Adjust based on feedback

## Monitoring & Alerting

### Key Metrics
- Event ingestion rate
- Error event frequency
- Response time impact
- Storage growth rate

### Alerts
- High error rate (> 1%)
- Audit service downtime
- Performance degradation (> 50ms)
- Unusual activity patterns

## Documentation Updates

### Developer Documentation
- Audit event schema
- Implementation examples
- Troubleshooting guide

### Operations Documentation
- Query procedures
- Data retention policies
- Incident response

## Conclusion

This plan focuses exclusively on assessment mode audit logging, eliminating unnecessary complexity around temporary participants and course PINs. The implementation prioritizes academic integrity, compliance requirements, and debugging capabilities for the assessment platform.

By focusing on what matters - lecturer actions and student behavior in assessments - we can deliver a robust audit trail that serves the actual needs of the assessment use case without unnecessary overhead.
