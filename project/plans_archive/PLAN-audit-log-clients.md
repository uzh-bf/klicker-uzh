# Audit Log Client Implementation Plan

## 🎯 IMPLEMENTATION STATUS: CORE COMPLETED & SIMPLIFIED ✅

### ✅ Completed (Phase 1 - Simplified Implementation)
- **JWT Migration**: ✅ Centralized JWT verification in packages/util
- **Backend AuditClient**: ✅ **SIMPLIFIED** - Clean implementation without batching complexity
- **Frontend Hook**: ✅ **ENHANCED** - Assessment-mode-only with retry mechanism & base URL support
- **Type Definitions**: ✅ Comprehensive audit types in packages/types  
- **Environment Configuration**: ✅ Updated .env templates for all services

### 🚀 Key Improvements Made
- **Backend**: Removed overengineered batching/queuing - now returns clear success/failure
- **Frontend**: Added retry mechanism (3 attempts with exponential backoff)
- **Frontend**: Added configurable base URL parameter
- **Both**: Much cleaner, maintainable code with proper error handling

### 🟡 Ready for Integration (Phase 2)
- Backend services can import and use simplified `AuditClient` from @klicker-uzh/util
- Frontend applications can use `useAuditClient` and `useAssessmentAudit` hooks
- All authentication and networking is handled automatically

## Overview
Implement audit logging clients for both backend services and frontend applications in the Klicker platform, enabling standardized audit event tracking across all components.

## 1. Backend AuditClient (packages/util) - **SIMPLIFIED ✅**

### File: `packages/util/src/audit.ts`
```typescript
interface AuditClientConfig {
  serviceUrl?: string     // Default from AUDIT_SERVICE_URL env
  internalToken?: string  // Default from INTERNAL_TOKEN env  
  timeout?: number       // Default: 5000ms
  enabled?: boolean      // Default: AUDIT_ENABLED !== 'false'
}

class AuditClient {
  constructor(config?: AuditClientConfig)
  
  // Simple event logging with clear success/failure
  async log(event: AuditEvent): Promise<AuditResponse | null>
  
  // Convenience methods (return AuditResponse | null)
  async logLogin(tenantId: string, userId: string, success: boolean, metadata?: any)
  async logDataAccess(tenantId: string, userId: string, resource: string, action: string, resourceId?: string)
  async logError(tenantId: string, subject: string, error: Error, context?: any)
  async logUserAction(tenantId: string, userId: string, action: string, resourceId?: string, metadata?: any)
}
```

### **Simplified Features:**
- ✅ **Clear success/failure responses** - Returns `AuditResponse | null`
- ✅ **Simple retry logic** - 2 attempts max with 500ms delay
- ✅ **Automatic `X-Internal-Token` header inclusion**
- ✅ **Clean error handling** - Console logging, graceful degradation
- ❌ **Removed**: Batching, queuing, complex retry logic, background timers
- Structured logging of failures via pino

### Export Update:
```typescript
// packages/util/src/index.ts
export { AuditClient } from './audit'
export type { AuditEvent, AuditClientConfig } from './audit'
```

## 2. Frontend Audit Hook (packages/shared-components) - **ENHANCED ✅**

### File: `packages/shared-components/src/hooks/useAuditClient.ts`
```typescript
interface UseAuditClientOptions {
  enabled?: boolean        // Default: true
  assessmentMode?: boolean // Default: false - ONLY logs in assessment mode
  baseUrl?: string        // Configurable endpoint base URL
  onError?: (error: Error) => void
}

interface AuditClientAPI {
  log: (event: Omit<AuditEvent, 'tenantId'>) => Promise<void>
  logAsync: (event: Omit<AuditEvent, 'tenantId'>) => void
  isLoading: boolean
  error: Error | null
}

function useAuditClient(options?: UseAuditClientOptions): AuditClientAPI
function useAssessmentAudit(assessmentMode: boolean, baseUrl?: string): ConvenienceAPI
```

### **Enhanced Features:**
- ✅ **Assessment-mode-only logging** - Only logs when `assessmentMode: true`
- ✅ **Automatic cookie handling** - Domain-wide cookies sent automatically
- ✅ **Retry mechanism** - 3 attempts with exponential backoff (500ms, 1s, 2s)
- ✅ **Configurable base URL** - Support for different environments
- ✅ **Silent failures** - Won't disrupt user experience
- ✅ **Convenience methods** - `logQuizAction`, `logElementInteraction`, etc.

### Implementation Details:
- Uses `fetch('/audit/public')` with `credentials: 'include'`
- Retries on network failures with exponential backoff
- Console warnings on final failure (no UI disruption)
- Loading states and error handling for debugging

## 3. JWT Handling Update (packages/util)

### Migrate JWT Logic to packages/util
```typescript
// packages/util/src/jwt.ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

export interface JWTConfig {
  jwksUri: string
  audience?: string
  issuer?: string
}

export class JWTVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet>
  
  constructor(config: JWTConfig)
  
  async verify(token: string): Promise<JWTPayload>
  async verifyWithClaims<T extends JWTPayload>(token: string, validator: (payload: JWTPayload) => T): Promise<T>
}

// Singleton instance for participant tokens
export const participantJWTVerifier = new JWTVerifier({
  jwksUri: process.env.AUTH_JWKS_URI || 'https://auth.klicker.uzh.ch/.well-known/jwks.json',
  audience: 'participant',
  issuer: 'klicker-uzh'
})
```

### Update Audit Service:
- Remove local jose implementation
- Import JWTVerifier from packages/util
- Use shared verification logic

## 4. Type Definitions (packages/types)

### File: `packages/types/src/audit.ts`
```typescript
export interface AuditEvent {
  tenantId: string
  subject: string
  action: string
  resourceId?: string
  sessionId?: string
  userId?: string
  timestamp?: number
  eventId?: string
  attributes?: Record<string, any>
}

export type AuditAction = 
  | 'login.success'
  | 'login.failed'
  | 'logout'
  | 'data.create'
  | 'data.read'
  | 'data.update'
  | 'data.delete'
  | 'permission.granted'
  | 'permission.denied'
  | 'error.system'
  | 'error.user'
```

## 5. Environment Configuration

### Backend Services (.env):
```bash
# Audit Service Configuration
AUDIT_SERVICE_URL=http://audit-service:3000  # Internal K8s service
INTERNAL_TOKEN=<secure-random-token>
AUDIT_ENABLED=true  # Feature flag
AUDIT_BATCH_SIZE=100  # Max events per batch
AUDIT_FLUSH_INTERVAL=5000  # ms between batch flushes
```

### Frontend Applications:
```typescript
// apps/frontend-*/src/config.ts
export const auditConfig = {
  enabled: process.env.NEXT_PUBLIC_AUDIT_ENABLED === 'true',
  endpoint: process.env.NEXT_PUBLIC_AUDIT_ENDPOINT || '/api/audit',
  batchSize: 20,
  flushInterval: 10000
}
```

## 6. Implementation Phases

### ✅ Phase 1: Core Implementation (COMPLETED)
1. ✅ Create AuditClient in packages/util
2. ✅ Migrate JWT logic to packages/util  
3. ✅ Update audit service to use shared JWT verifier
4. ✅ Add type definitions to packages/types

### ✅ Phase 2: Frontend Integration (COMPLETED)
1. ✅ Create useAuditClient hook
2. ✅ Add assessment mode detection
3. ✅ Implement error handling and loading states
4. ✅ Add convenience hooks for common actions

### 🟡 Phase 3: Service Integration (READY FOR ROLLOUT)
1. 🟡 Add AuditClient to backend services (one by one)
2. ✅ Configure environment variables  
3. 🟡 Add audit calls to critical operations
4. 🟡 Monitor and tune performance

### 📋 Phase 4: Testing & Documentation (NEXT)
1. 📋 Unit tests for AuditClient
2. 📋 Integration tests for hook  
3. 📋 Update service documentation
4. 📋 Add usage examples

## 7. Usage Examples - **SIMPLIFIED ✅**

### Backend Service:
```typescript
import { AuditClient } from '@klicker-uzh/util'

const audit = new AuditClient()

// In API handler - returns AuditResponse | null
const result = await audit.log({
  tenantId: req.user.tenantId,
  subject: `user:${req.user.email}`,
  action: 'quiz.created',
  resourceId: quiz.id,
  userId: req.user.id,
  attributes: {
    quizType: 'live',
    questionCount: 5
  }
})

if (result) {
  console.log('Audit logged successfully:', result.eventId)
} else {
  console.warn('Audit logging failed')
}

// Convenience methods
await audit.logLogin(tenantId, userId, true, { ip: req.ip })
await audit.logUserAction(tenantId, userId, 'quiz.started', quizId)
```

### Frontend Component:
```tsx
import { useAssessmentAudit } from '@klicker-uzh/shared-components'

function QuizComponent({ isAssessmentMode }: { isAssessmentMode: boolean }) {
  // Only logs when isAssessmentMode is true
  const audit = useAssessmentAudit(isAssessmentMode, 'https://api.klicker.uzh.ch')
  
  const handleQuizStart = () => {
    // Fire-and-forget logging with retries
    audit.logQuizAction('started', quizId, { 
      timestamp: Date.now() 
    })
  }

  const handleResponse = (elementId: string, response: any) => {
    audit.logResponseSubmission(elementId, response)
  }
}
```

## 8. Security Considerations

- Internal token must be kept secure (use K8s secrets)
- Rate limiting on public endpoint (per IP/tenant)
- Input validation with Zod schemas
- No PII in audit attributes (hash/pseudonymize)
- Regular audit log rotation and archival
- Encryption at rest in Azure Table Storage

## 9. Performance Considerations

- Batch processing for high-volume events
- Async/non-blocking audit calls
- Circuit breaker pattern for service failures
- Connection pooling for database writes
- Partition key strategy for Azure Tables (tenant-based)
- Consider event sampling for very high-frequency actions

## 10. Monitoring & Alerting

- Prometheus metrics for audit service health
- Alert on high error rates
- Dashboard for audit event volume
- Tenant-based usage analytics
- Performance metrics (p50, p95, p99 latencies)

## 11. Dependencies to Add

### packages/util:
```json
{
  "dependencies": {
    "jose": "^5.9.4"
  }
}
```

### packages/shared-components:
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x.x"
  }
}
```

## 12. Migration Steps

1. **Week 1**: Implement core backend client and JWT migration
2. **Week 2**: Add frontend hook and test in one service
3. **Week 3**: Roll out to all backend services
4. **Week 4**: Enable in frontend applications
5. **Week 5**: Monitor, tune, and document

## 13. Success Criteria - **FINAL STATUS ✅**

### ✅ **CORE IMPLEMENTATION - 100% COMPLETE**

- [x] **JWT verification is centralized in packages/util** ✅ COMPLETED
  - Audit service now uses shared `verifyJWT` from @klicker-uzh/util
  - Removed duplicate jose implementation
  - All JWT verification unified

- [x] **Backend AuditClient implemented & SIMPLIFIED** ✅ COMPLETED
  - ✨ **SIMPLIFIED**: Removed overengineered batching/queuing complexity
  - ✨ **IMPROVED**: Clear success/failure responses (`AuditResponse | null`)
  - ✨ **RELIABLE**: Simple retry logic (2 attempts with 500ms delay)
  - Created `packages/util/src/audit.ts` with clean, maintainable code
  - Automatic internal token authentication
  - Essential convenience methods only

- [x] **Frontend audit client hook implemented & ENHANCED** ✅ COMPLETED  
  - ✨ **ENHANCED**: Added retry mechanism (3 attempts with exponential backoff)
  - ✨ **ENHANCED**: Added configurable base URL parameter
  - ✨ **REQUIREMENT**: Only logs events in assessment mode (as requested)
  - ✨ **AUTOMATIC**: Domain-wide cookie handling (no explicit management needed)
  - Created `packages/shared-components/src/hooks/useAuditClient.ts`
  - Includes `useAssessmentAudit` convenience hook

- [x] **Type definitions centralized** ✅ COMPLETED
  - Added comprehensive audit types to packages/types
  - Includes AuditEvent, AuditAction, AuditClientConfig, AuditResponse interfaces
  - Shared between all packages

- [x] **Environment configuration updated** ✅ COMPLETED
  - Added AUDIT_SERVICE_URL, INTERNAL_TOKEN to backend .env.template
  - Added APP_SECRET to audit service .env.example
  - All required environment variables documented

- [x] **All packages build successfully** ✅ COMPLETED
  - TypeScript compilation passes for all packages
  - No build errors or warnings
  - Ready for production deployment

### 🚀 **READY FOR INTEGRATION**

- [ ] **All backend services can send audit events** 🟡 READY FOR ROLLOUT
  - Simplified AuditClient ready for integration
  - Clear documentation and examples provided

- [ ] **Frontend applications log user actions** 🟡 READY FOR ROLLOUT
  - Enhanced hooks ready for integration
  - Assessment mode and base URL support implemented

### 📊 **QUALITY METRICS (TO BE MEASURED POST-INTEGRATION)**

- [ ] No performance degradation (< 50ms overhead)
- [ ] 99.9% audit event delivery rate  
- [ ] Zero security vulnerabilities in implementation
- [ ] Complete documentation and examples
- [ ] Monitoring dashboards operational

## 14. Rollback Plan

- Feature flags to disable audit logging
- Graceful degradation if audit service unavailable
- Local buffering during outages
- Manual replay capability for lost events