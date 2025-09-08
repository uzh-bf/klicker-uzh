# Comprehensive Audit Events System for Quiz Platform

## Overview

This document outlines a comprehensive audit events system designed to track critical user interactions, system events, and security-related activities in our quiz platform. The system is prioritized based on operational needs: debugging issues, verifying student responses, and proving correct data handling.

## Priority Framework

Events are categorized into four priority tiers based on their criticality for operations, student trust, and system reliability:

- **🔴 P0 (Critical)**: Essential for operations & student trust
- **🟡 P1 (High)**: Important for support & analysis  
- **🟢 P2 (Medium)**: Useful for analytics & optimization
- **🔵 P3 (Low)**: Nice to have for enhanced analytics

---

## Priority P0: Critical Events

### Response Processing & Verification

These events form the complete audit trail for student responses, essential for proving responses were saved correctly and debugging submission issues.

#### `PARTICIPANT_CHANGE_ANSWER`
**Purpose**: Track every answer change with full details  
**Logging**: Immediate for selections, debounced (3s) for text inputs  
**Retention**: 2 years (assessment compliance)

```typescript
interface AnswerChangeEvent {
  eventType: 'PARTICIPANT_CHANGE_ANSWER';
  timestamp: Date;
  participantId: string;
  affiliationUsed: string; // Which email they logged in with
  sessionId: string;
  
  changeData: {
    quizId: string;
    questionId: string;
    questionType: QuestionType;
    blockId?: string;
    
    // Answer details
    previousAnswer?: any;
    currentAnswer: any;
    changeNumber: number; // Nth change for this question
    
    // Timing context
    timeSpentOnQuestion: number; // milliseconds
    totalTimeInQuiz: number;
    
    // Input method
    inputMethod: 'click' | 'keyboard' | 'touch' | 'paste';
    isDebounced: boolean;
    debounceWindow?: number;
  };
}
```

#### `PARTICIPANT_SUBMIT_RESPONSE` 
**Purpose**: Critical proof of submission attempt  
**Logging**: Immediate  
**Retention**: 7 years (legal compliance)

```typescript
interface ResponseSubmissionEvent {
  eventType: 'PARTICIPANT_SUBMIT_RESPONSE';
  timestamp: Date;
  participantId: string;
  affiliationUsed: string;
  sessionId: string;
  requestId: string; // For request tracing
  
  submissionData: {
    quizId: string;
    questionId: string;
    blockId?: string;
    
    // Complete answer snapshot
    answer: any;
    answerHash: string; // SHA256 for verification
    
    // Submission context
    submissionType: 'manual' | 'auto' | 'timeout' | 'forced';
    clientTimestamp: Date;
    serverTimestamp: Date;
    
    // Network context
    connectionQuality?: 'good' | 'poor' | 'unstable';
    retryCount: number;
    
    // Client state
    browserTabActive: boolean;
    pageVisibilityState: 'visible' | 'hidden';
  };
}
```

#### `RESPONSE_SAVED_SUCCESS`
**Purpose**: Backend confirmation that response was persisted  
**Logging**: Immediate after DB write  
**Retention**: 7 years

```typescript
interface ResponseSaveSuccessEvent {
  eventType: 'RESPONSE_SAVED_SUCCESS';
  timestamp: Date;
  participantId: string;
  sessionId: string;
  requestId: string;
  
  saveData: {
    quizId: string;
    questionId: string;
    
    // Database confirmation
    recordId: string; // DB record ID
    version: number; // For optimistic locking
    saveLatency: number; // milliseconds to save
    
    // Integrity checks
    answerHashMatch: boolean;
    checksumValid: boolean;
    
    // Previous state
    overwrittenAnswer?: any;
    overwriteTimestamp?: Date;
  };
}
```

#### `RESPONSE_SAVE_FAILED`
**Purpose**: Critical for debugging save failures  
**Logging**: Immediate  
**Retention**: 2 years

```typescript
interface ResponseSaveFailedEvent {
  eventType: 'RESPONSE_SAVE_FAILED';
  timestamp: Date;
  participantId: string;
  sessionId: string;
  requestId: string;
  
  failureData: {
    quizId: string;
    questionId: string;
    
    // Error details
    errorCode: string;
    errorMessage: string;
    errorCategory: 'network' | 'database' | 'validation' | 'permission' | 'timeout';
    
    // Context
    attemptNumber: number;
    willRetry: boolean;
    nextRetryAt?: Date;
    
    // State preservation
    answerBackupCreated: boolean;
    backupLocation?: string;
    
    // System state
    dbConnectionActive: boolean;
    systemLoad: number;
  };
}
```

#### `RESPONSE_VALIDATION_ERROR`
**Purpose**: Why a response was rejected  
**Logging**: Immediate  
**Retention**: 1 year

### System Errors & Failures

#### `PARTICIPANT_CLIENT_ERROR`
**Purpose**: JS errors that could affect responses  
**Logging**: Immediate  
**Retention**: 90 days

```typescript
interface ClientErrorEvent {
  eventType: 'PARTICIPANT_CLIENT_ERROR';
  timestamp: Date;
  participantId?: string;
  sessionId: string;
  
  errorData: {
    // Error classification
    category: 'javascript' | 'network' | 'ui' | 'storage';
    severity: 'critical' | 'high' | 'medium' | 'low';
    
    // Error details
    message: string;
    stack: string;
    filename?: string;
    lineNumber?: number;
    columnNumber?: number;
    
    // Context when error occurred
    context: {
      action: string; // What user was doing
      quizId?: string;
      questionId?: string;
      route: string;
      component?: string;
      
      // State at error
      formData?: any;
      pendingResponses: number;
      lastSavedAt?: Date;
    };
    
    // Browser context
    userAgent: string;
    browserVersion: string;
    deviceType: 'mobile' | 'tablet' | 'desktop';
    viewport: { width: number; height: number };
    
    // Recovery
    recoveryAttempted: boolean;
    recoverySuccessful?: boolean;
    dataLoss: boolean;
  };
}
```

#### `PARTICIPANT_NETWORK_ERROR`
**Purpose**: Connection issues during submission  
**Logging**: Immediate  
**Retention**: 90 days

#### `API_ERROR`
**Purpose**: Backend processing failures  
**Logging**: Immediate  
**Retention**: 1 year

#### `DATABASE_ERROR`
**Purpose**: Persistence layer failures  
**Logging**: Immediate  
**Retention**: 2 years

### Session Integrity

#### `PARTICIPANT_LOGIN`
**Purpose**: Who logged in and with which affiliation  
**Logging**: Immediate  
**Retention**: 2 years

#### `PARTICIPANT_JOIN_QUIZ`
**Purpose**: Establishes participation context  
**Logging**: Immediate  
**Retention**: 2 years

#### `SESSION_EXPIRED`
**Purpose**: Explains lost work/submissions  
**Logging**: Immediate  
**Retention**: 1 year

---

## Priority P1: High Events

### Quiz State & Progress

#### `PARTICIPANT_VIEW_QUESTION`
**Purpose**: Proves student saw the question  
**Logging**: Immediate  
**Retention**: 1 year

#### `PARTICIPANT_AUTO_SUBMIT`  
**Purpose**: Explains unexpected submissions  
**Logging**: Immediate  
**Retention**: 2 years

#### `PARTICIPANT_TIMEOUT`
**Purpose**: Time limit enforcements  
**Logging**: Immediate  
**Retention**: 2 years

#### `QUIZ_STATE_MISMATCH`
**Purpose**: Client/server sync issues  
**Logging**: Immediate  
**Retention**: 90 days

### Lecturer Control Actions

#### `LECTURER_START_ASSESSMENT`
**Purpose**: Session initialization  
**Logging**: Immediate  
**Retention**: 2 years

#### `LECTURER_END_ASSESSMENT`
**Purpose**: Session termination  
**Logging**: Immediate  
**Retention**: 2 years

#### `LECTURER_OPEN_BLOCK`
**Purpose**: Question availability  
**Logging**: Immediate  
**Retention**: 2 years

#### `LECTURER_CLOSE_BLOCK`
**Purpose**: Submission cutoff  
**Logging**: Immediate  
**Retention**: 2 years

#### `LECTURER_RESET_PARTICIPANT`
**Purpose**: Manual interventions  
**Logging**: Immediate  
**Retention**: 2 years

### Security & Integrity

#### `MULTIPLE_TABS_DETECTED`
**Purpose**: Potential cheating  
**Logging**: Immediate  
**Retention**: 2 years

#### `BROWSER_FOCUS_LOST`
**Purpose**: Context switches during quiz  
**Logging**: Immediate  
**Retention**: 1 year

#### `IP_LOCATION_CHANGE`
**Purpose**: Session hijacking detection  
**Logging**: Immediate  
**Retention**: 1 year

---

## Priority P2: Medium Events

### Performance & UX

#### `QUIZ_LOAD_TIME`
**Purpose**: Performance metrics  
**Logging**: Sampled (10%)  
**Retention**: 30 days

#### `QUESTION_RENDER_TIME`
**Purpose**: UI responsiveness  
**Logging**: Sampled (5%)  
**Retention**: 30 days

#### `PARTICIPANT_NAVIGATE_BACK/FORWARD`
**Purpose**: Navigation patterns  
**Logging**: Immediate  
**Retention**: 90 days

#### `PARTICIPANT_SKIP_QUESTION`
**Purpose**: Difficulty indicators  
**Logging**: Immediate  
**Retention**: 1 year

### Content Management

#### `LECTURER_CREATE_ASSESSMENT`
**Purpose**: Audit trail  
**Logging**: Immediate  
**Retention**: 7 years

#### `LECTURER_EDIT_ASSESSMENT`
**Purpose**: Change tracking  
**Logging**: Immediate  
**Retention**: 7 years

#### `LECTURER_CONFIGURE_SETTINGS`
**Purpose**: Configuration changes  
**Logging**: Immediate  
**Retention**: 2 years

---

## Priority P3: Low Events

### Behavioral Analytics

#### `PARTICIPANT_FLAG_QUESTION`
**Purpose**: Quality feedback  
**Logging**: Immediate  
**Retention**: 1 year

#### `COPY_PASTE_ATTEMPT`
**Purpose**: Behavioral tracking  
**Logging**: Immediate  
**Retention**: 90 days

#### `TIME_WARNING_SHOWN`
**Purpose**: UX events  
**Logging**: Immediate  
**Retention**: 30 days

#### `PARTICIPANT_LOGOUT`
**Purpose**: Clean exits  
**Logging**: Immediate  
**Retention**: 30 days

---

## Database Schema

### Core Audit Table

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  eventType     String   // Enum value
  priority      String   // P0, P1, P2, P3
  timestamp     DateTime @default(now())
  
  // User identification
  participantId String?
  userId        String?   // For lecturer events
  affiliationUsed String? // Which email/ID was used for login
  
  // Session tracking
  sessionId     String?
  requestId     String?   // For request tracing
  
  // Context
  ipAddress     String?
  userAgent     String?
  deviceType    String?
  
  // Event data (flexible JSON)
  metadata      Json
  
  // Data management
  retentionClass String  // Based on priority and event type
  expiresAt     DateTime? // Auto-deletion timestamp
  indexed       Boolean @default(false) // For fast P0 queries
  
  // Relationships
  user          User?        @relation(fields: [userId], references: [id])
  participant   Participant? @relation(fields: [participantId], references: [id])
  
  // Performance indexes
  @@index([participantId, eventType, timestamp]) // Response proof queries
  @@index([eventType, priority, timestamp]) // Critical event monitoring  
  @@index([requestId]) // Request tracing
  @@index([sessionId, timestamp]) // Session reconstruction
  @@index([expiresAt]) // Cleanup jobs
  @@index([indexed, priority]) // Fast P0 access
  
  // JSON field indexes (PostgreSQL)
  @@index([metadata(ops: JsonbPathOps)]) // quizId, questionId lookups
}
```

### Supporting Tables

```prisma
// For high-frequency events that need special handling
model ResponseTrace {
  id           String   @id @default(cuid())
  requestId    String   @unique
  participantId String
  quizId       String
  questionId   String
  
  // Timeline
  clientSubmitAt  DateTime
  serverReceiveAt DateTime
  dbSaveAt       DateTime?
  
  // Status
  status       String // 'pending' | 'saved' | 'failed'
  retryCount   Int    @default(0)
  
  // Data integrity
  answerHash   String
  finalAnswer  Json
  
  participant  Participant @relation(fields: [participantId], references: [id])
  
  @@index([participantId, quizId])
  @@index([status, serverReceiveAt])
  @@index([clientSubmitAt]) // For debugging time discrepancies
}
```

---

## Enhanced Audit Service

### Core Service Implementation

```typescript
class PrioritizedAuditService {
  private textInputDebounce = new Map<string, NodeJS.Timeout>();
  private batchQueue: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  
  constructor() {
    // Batch flush every 5 seconds for non-critical events
    this.flushInterval = setInterval(() => {
      this.flushBatchQueue();
    }, 5000);
  }
  
  async logEvent(event: Partial<AuditEvent>) {
    const priority = this.getEventPriority(event.eventType);
    const enrichedEvent = await this.enrichEvent(event);
    
    // Handle special event types
    if (event.eventType === 'PARTICIPANT_CHANGE_ANSWER') {
      return this.handleAnswerChange(enrichedEvent);
    }
    
    // Critical events - immediate processing
    if (priority === 'P0') {
      await this.processCriticalEvent(enrichedEvent);
      await this.saveEventImmediate(enrichedEvent);
      
      if (this.isCriticalFailure(enrichedEvent)) {
        await this.sendAlert(enrichedEvent);
      }
    } else {
      // Non-critical events - batch processing
      this.batchQueue.push(enrichedEvent);
    }
  }
  
  private async handleAnswerChange(event: AuditEvent) {
    const answerData = event.metadata?.changeData;
    const questionType = answerData?.questionType;
    
    // Determine if debouncing is needed
    const needsDebouncing = this.isTextInputType(questionType);
    
    if (needsDebouncing) {
      return this.logDebouncedAnswerChange(event);
    } else {
      // Log selections immediately
      await this.saveEventImmediate(event);
    }
  }
  
  private isTextInputType(questionType: string): boolean {
    return [
      'FREE_TEXT',
      'NUMERIC', 
      'ESSAY',
      'FILL_BLANK'
    ].includes(questionType);
  }
  
  private logDebouncedAnswerChange(event: AuditEvent) {
    const key = `${event.participantId}-${event.metadata?.changeData?.questionId}`;
    
    // Clear existing timeout
    if (this.textInputDebounce.has(key)) {
      clearTimeout(this.textInputDebounce.get(key)!);
    }
    
    // Set new timeout (3 seconds)
    const timeout = setTimeout(async () => {
      await this.saveEventImmediate(event);
      this.textInputDebounce.delete(key);
    }, 3000);
    
    this.textInputDebounce.set(key, timeout);
  }
  
  private async processCriticalEvent(event: AuditEvent) {
    switch(event.eventType) {
      case 'RESPONSE_SAVE_FAILED':
        await this.scheduleResponseRetry(event);
        break;
        
      case 'PARTICIPANT_CLIENT_ERROR':
        await this.validateResponseIntegrity(event);
        break;
        
      case 'SESSION_EXPIRED':
        await this.savePendingResponses(event);
        break;
    }
  }
  
  private async saveEventImmediate(event: AuditEvent) {
    const retentionClass = this.getRetentionClass(event.eventType);
    const expiresAt = this.calculateExpiry(retentionClass);
    
    // For response tracking, also create ResponseTrace record
    if (this.isResponseEvent(event.eventType)) {
      await this.createResponseTrace(event);
    }
    
    await prisma.auditLog.create({
      data: {
        ...event,
        retentionClass,
        expiresAt,
        indexed: this.getEventPriority(event.eventType) === 'P0',
      }
    });
  }
  
  private async flushBatchQueue() {
    if (this.batchQueue.length === 0) return;
    
    const events = [...this.batchQueue];
    this.batchQueue = [];
    
    // Batch insert for performance
    await prisma.auditLog.createMany({
      data: events.map(event => ({
        ...event,
        retentionClass: this.getRetentionClass(event.eventType),
        expiresAt: this.calculateExpiry(this.getRetentionClass(event.eventType)),
      }))
    });
  }
  
  // Support query methods
  async getStudentResponseProof(participantId: string, quizId: string) {
    const events = await prisma.auditLog.findMany({
      where: {
        participantId,
        eventType: {
          in: [
            'PARTICIPANT_JOIN_QUIZ',
            'PARTICIPANT_CHANGE_ANSWER',
            'PARTICIPANT_SUBMIT_RESPONSE', 
            'RESPONSE_SAVED_SUCCESS'
          ]
        },
        OR: [
          { metadata: { path: ['quizId'], equals: quizId } },
          { metadata: { path: ['changeData', 'quizId'], equals: quizId } },
          { metadata: { path: ['submissionData', 'quizId'], equals: quizId } }
        ]
      },
      orderBy: { timestamp: 'asc' }
    });
    
    return {
      participantId,
      quizId,
      loginTime: events.find(e => e.eventType === 'PARTICIPANT_JOIN_QUIZ')?.timestamp,
      affiliationUsed: events[0]?.affiliationUsed,
      answerHistory: events.filter(e => e.eventType === 'PARTICIPANT_CHANGE_ANSWER'),
      submissions: events.filter(e => e.eventType === 'PARTICIPANT_SUBMIT_RESPONSE'),
      savedConfirmations: events.filter(e => e.eventType === 'RESPONSE_SAVED_SUCCESS'),
      totalEvents: events.length,
      timeSpan: {
        start: events[0]?.timestamp,
        end: events[events.length - 1]?.timestamp
      }
    };
  }
  
  async getQuestionResponseHistory(participantId: string, questionId: string) {
    return prisma.auditLog.findMany({
      where: {
        participantId,
        eventType: 'PARTICIPANT_CHANGE_ANSWER',
        metadata: {
          path: ['changeData', 'questionId'],
          equals: questionId
        }
      },
      orderBy: { timestamp: 'asc' }
    });
  }
  
  async getFailedSubmissions(timeRange: { start: Date; end: Date }) {
    return prisma.auditLog.findMany({
      where: {
        eventType: 'RESPONSE_SAVE_FAILED',
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      orderBy: { timestamp: 'desc' }
    });
  }
}
```

---

## Client-Side Integration

### Event Tracking SDK

```typescript
class QuizEventTracker {
  private auditService: PrioritizedAuditService;
  private sessionId: string;
  private requestTracker = new Map<string, string>();
  
  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupErrorHandling();
    this.setupNetworkMonitoring();
  }
  
  // Answer change tracking
  trackAnswerChange(
    questionId: string,
    questionType: string,
    answer: any,
    previousAnswer?: any
  ) {
    const changeNumber = this.getChangeNumber(questionId);
    
    this.auditService.logEvent({
      eventType: 'PARTICIPANT_CHANGE_ANSWER',
      participantId: this.getCurrentParticipantId(),
      affiliationUsed: this.getLoginAffiliation(),
      sessionId: this.sessionId,
      metadata: {
        changeData: {
          quizId: this.getCurrentQuizId(),
          questionId,
          questionType,
          previousAnswer,
          currentAnswer: answer,
          changeNumber,
          timeSpentOnQuestion: this.getTimeOnQuestion(questionId),
          totalTimeInQuiz: this.getTotalQuizTime(),
          inputMethod: this.getLastInputMethod(),
          isDebounced: this.isTextInputType(questionType),
          debounceWindow: this.isTextInputType(questionType) ? 3000 : undefined
        }
      }
    });
  }
  
  // Response submission tracking
  async trackResponseSubmission(
    questionId: string,
    answer: any,
    submissionType: 'manual' | 'auto' | 'timeout' | 'forced'
  ) {
    const requestId = this.generateRequestId();
    const answerHash = await this.hashAnswer(answer);
    
    this.requestTracker.set(questionId, requestId);
    
    this.auditService.logEvent({
      eventType: 'PARTICIPANT_SUBMIT_RESPONSE',
      participantId: this.getCurrentParticipantId(),
      affiliationUsed: this.getLoginAffiliation(),
      sessionId: this.sessionId,
      requestId,
      metadata: {
        submissionData: {
          quizId: this.getCurrentQuizId(),
          questionId,
          answer,
          answerHash,
          submissionType,
          clientTimestamp: new Date(),
          serverTimestamp: new Date(), // Will be updated by server
          connectionQuality: this.assessConnectionQuality(),
          retryCount: 0,
          browserTabActive: document.visibilityState === 'visible',
          pageVisibilityState: document.visibilityState
        }
      }
    });
    
    return requestId;
  }
  
  // Error tracking with context
  trackClientError(error: Error, context: any) {
    this.auditService.logEvent({
      eventType: 'PARTICIPANT_CLIENT_ERROR',
      participantId: this.getCurrentParticipantId(),
      sessionId: this.sessionId,
      metadata: {
        errorData: {
          category: this.categorizeError(error),
          severity: this.assessErrorSeverity(error, context),
          message: error.message,
          stack: error.stack || '',
          filename: (error as any).filename,
          lineNumber: (error as any).lineNumber,
          columnNumber: (error as any).columnNumber,
          context: {
            action: context.action || 'unknown',
            quizId: this.getCurrentQuizId(),
            questionId: context.questionId,
            route: window.location.pathname,
            component: context.component,
            formData: this.sanitizeFormData(context.formData),
            pendingResponses: this.getPendingResponsesCount(),
            lastSavedAt: this.getLastSaveTimestamp()
          },
          userAgent: navigator.userAgent,
          browserVersion: this.getBrowserVersion(),
          deviceType: this.getDeviceType(),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          recoveryAttempted: false,
          dataLoss: this.assessDataLoss(context)
        }
      }
    });
  }
  
  private setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackClientError(event.error, {
        action: 'global_error',
        component: 'window'
      });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackClientError(new Error(event.reason), {
        action: 'unhandled_rejection'
      });
    });
  }
  
  private setupNetworkMonitoring() {
    // Track network status changes
    window.addEventListener('online', () => {
      this.auditService.logEvent({
        eventType: 'NETWORK_STATUS_CHANGE',
        participantId: this.getCurrentParticipantId(),
        sessionId: this.sessionId,
        metadata: {
          status: 'online',
          timestamp: new Date()
        }
      });
    });
    
    window.addEventListener('offline', () => {
      this.auditService.logEvent({
        eventType: 'NETWORK_STATUS_CHANGE', 
        participantId: this.getCurrentParticipantId(),
        sessionId: this.sessionId,
        metadata: {
          status: 'offline',
          timestamp: new Date()
        }
      });
    });
  }
}
```

---

## Monitoring & Alerting

### Real-Time Monitoring

```typescript
class AuditMonitor {
  async monitorCriticalEvents() {
    // Set up real-time alerts for critical failures
    const criticalEventTypes = [
      'RESPONSE_SAVE_FAILED',
      'DATABASE_ERROR', 
      'API_ERROR',
      'SESSION_EXPIRED'
    ];
    
    for (const eventType of criticalEventTypes) {
      this.setupEventAlert(eventType);
    }
  }
  
  private setupEventAlert(eventType: string) {
    // Monitor for event frequency spikes
    setInterval(async () => {
      const recentCount = await prisma.auditLog.count({
        where: {
          eventType,
          timestamp: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        }
      });
      
      if (recentCount > this.getThreshold(eventType)) {
        await this.sendAlert({
          type: 'SPIKE_DETECTED',
          eventType,
          count: recentCount,
          timeWindow: '5 minutes'
        });
      }
    }, 60000); // Check every minute
  }
  
  async generateDashboard() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      criticalEvents: await this.getCriticalEventCounts(last24Hours),
      failureRates: await this.getFailureRates(last24Hours),
      responseIntegrity: await this.getResponseIntegrityMetrics(last24Hours),
      performance: await this.getPerformanceMetrics(last24Hours)
    };
  }
}
```

---

## Data Retention & Cleanup

### Retention Policies

```typescript
class AuditRetentionManager {
  private retentionPolicies = {
    'PARTICIPANT_CHANGE_ANSWER': '2 years',
    'PARTICIPANT_SUBMIT_RESPONSE': '7 years', // Legal compliance
    'RESPONSE_SAVED_SUCCESS': '7 years',
    'RESPONSE_SAVE_FAILED': '2 years',
    'PARTICIPANT_CLIENT_ERROR': '90 days',
    'LECTURER_CREATE_ASSESSMENT': '7 years',
    // ... other policies
  };
  
  async scheduleCleanup() {
    // Daily cleanup job
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupExpiredEvents();
    });
  }
  
  private async cleanupExpiredEvents() {
    const expiredEvents = await prisma.auditLog.findMany({
      where: {
        expiresAt: {
          lte: new Date()
        }
      },
      select: { id: true, eventType: true }
    });
    
    if (expiredEvents.length > 0) {
      // Archive before deletion for critical events
      const criticalExpired = expiredEvents.filter(e => 
        this.isCriticalEventType(e.eventType)
      );
      
      if (criticalExpired.length > 0) {
        await this.archiveToColdStorage(criticalExpired);
      }
      
      // Delete expired events
      await prisma.auditLog.deleteMany({
        where: {
          id: {
            in: expiredEvents.map(e => e.id)
          }
        }
      });
      
      console.log(`Cleaned up ${expiredEvents.length} expired audit events`);
    }
  }
}
```

---

## Integration Points

### API Middleware Integration

```typescript
// Express middleware for automatic API event logging
export function auditMiddleware(auditService: PrioritizedAuditService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || generateRequestId();
    
    // Override res.json to capture responses
    const originalJson = res.json;
    res.json = function(body) {
      const duration = Date.now() - startTime;
      
      // Log API events
      auditService.logEvent({
        eventType: 'API_REQUEST',
        userId: req.user?.id,
        participantId: req.participant?.id,
        sessionId: req.sessionId,
        requestId: requestId as string,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      });
      
      return originalJson.call(this, body);
    };
    
    next();
  };
}
```

### GraphQL Integration

```typescript
// GraphQL plugin for mutation tracking
const auditPlugin = {
  requestDidStart() {
    return {
      willSendResponse(requestContext) {
        const { request, response } = requestContext;
        
        // Track mutations that affect responses
        if (request.operationName?.includes('SubmitResponse')) {
          auditService.logEvent({
            eventType: 'GRAPHQL_MUTATION',
            metadata: {
              operationName: request.operationName,
              variables: request.variables,
              errors: response.errors?.map(e => e.message)
            }
          });
        }
      }
    };
  }
};
```

---

## Success Metrics

### Operational Metrics
- Response save success rate > 99.9%
- Critical event detection latency < 1 second  
- Student proof generation time < 500ms
- Data retention compliance = 100%

### Support Metrics
- Time to resolve response disputes < 2 minutes
- False positive cheating alerts < 1%
- Student satisfaction with response reliability > 95%

### Technical Metrics
- P0 event processing latency < 100ms
- Database query performance maintained
- Storage growth rate predictable and managed
- Alert fatigue minimized (< 5 false alarms/day)

---

## Future Enhancements

### Advanced Analytics
- Machine learning for anomaly detection
- Predictive failure analysis
- Student engagement pattern analysis
- Performance optimization recommendations

### Enhanced Security
- Advanced cheating detection algorithms
- Behavioral biometrics integration
- Real-time fraud prevention
- Cross-quiz pattern analysis

### Compliance & Privacy
- GDPR compliance automation
- Enhanced data anonymization
- Audit trail encryption
- Right to be forgotten implementation