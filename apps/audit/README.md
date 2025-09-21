# Audit Service

A high-performance audit logging service built with Hono, TypeScript, and Azure Table Storage. Designed for the klicker-uzh platform to handle 1000+ events per second with idempotent writes and comprehensive observability.

## Features

- ✅ **Fast & Lightweight**: Built with Hono framework for minimal overhead
- ✅ **Type-Safe**: Full TypeScript with strict validation using Zod
- ✅ **Idempotent**: Deterministic event IDs prevent duplicate events
- ✅ **Scalable Storage**: Azure Table Storage with optimized partitioning
- ✅ **Observable**: Prometheus metrics, structured logging, health checks
- ✅ **Production Ready**: Error handling, authentication, proper shutdown

## Quick Start

### Prerequisites

- Node.js 20 (exact version required)
- pnpm package manager
- Docker (for local Azure Storage emulation)

### 1. Environment Setup

```bash
# At root-level
./_run_app_dependencies.sh

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# For local testing, the defaults work with Azurite
```

### 2. Install & Build

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build
```

### 4. Run the Service

```bash
# Development mode (auto-rebuild)
pnpm dev

# Production mode
pnpm start
```

The service will be available at:

- **API**: http://localhost:7080
- **Health**: http://localhost:7080/healthz
- **Metrics**: http://localhost:7080/metrics

### 6. Verify Setup

```bash
# Check service health
curl http://localhost:7080/healthz

# Test audit event submission
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: test-secret-token-123" \
  -d '{"subject":"user:test","action":"test.setup"}'
```

## API Usage

### Basic Event Submission

```bash
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:john.doe@uzh.ch",
    "action": "session.started",
    "resourceId": "live-session-abc",
    "userId": "user-456",
    "attributes": {
      "sessionType": "quiz",
      "questionCount": 10
    }
  }'
```

### Real-World Examples

#### User Authentication Flow

```bash
# Login attempt
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:alice@uzh.ch",
    "action": "auth.login.attempt",
    "sessionId": "session-abc123",
    "attributes": {
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "method": "password"
    }
  }'

# Successful login
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:alice@uzh.ch",
    "action": "auth.login.success",
    "sessionId": "session-abc123",
    "userId": "alice",
    "attributes": {
      "sessionDuration": 3600,
      "mfaUsed": true,
      "roles": ["instructor", "admin"]
    }
  }'
```

#### Document Operations

```bash
# Document creation
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:professor@uzh.ch",
    "action": "document.created",
    "resourceId": "lecture-notes-2024",
    "userId": "professor",
    "attributes": {
      "documentType": "lecture_notes",
      "classification": "internal",
      "courseId": "CS101",
      "format": "pdf"
    }
  }'

# Document sharing
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:professor@uzh.ch",
    "action": "document.shared",
    "resourceId": "lecture-notes-2024",
    "userId": "professor",
    "attributes": {
      "sharedWith": ["students-cs101@uzh.ch"],
      "permissions": ["read"],
      "expirationDate": "2024-12-31T23:59:59Z"
    }
  }'
```

#### Security Events

```bash
# Failed login attempt
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:suspicious@external.com",
    "action": "auth.login.failed",
    "attributes": {
      "reason": "invalid_credentials",
      "attemptCount": 5,
      "ipAddress": "203.0.113.42",
      "blocked": true
    }
  }'

# Administrative action
curl -X POST http://localhost:7080/audit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret-token" \
  -d '{
    "subject": "user:admin@uzh.ch",
    "action": "system.user.suspended",
    "resourceId": "user-suspicious-123",
    "userId": "admin",
    "attributes": {
      "reason": "security_policy_violation",
      "duration": 7200,
      "reviewRequired": true
    }
  }'
```

### Event Schema

| Field        | Type   | Required | Description                               |
| ------------ | ------ | -------- | ----------------------------------------- |
| `subject`    | string | ✅       | Who performed the action (1-500 chars)    |
| `action`     | string | ✅       | What action was performed (1-200 chars)   |
| `timestamp`  | number | -        | Unix timestamp (defaults to server time)  |
| `eventId`    | string | -        | Custom ID for idempotency (1-100 chars)   |
| `resourceId` | string | -        | Resource that was acted upon (≤500 chars) |
| `sessionId`  | string | -        | Session identifier (≤100 chars)           |
| `userId`     | string | -        | User identifier (≤100 chars)              |
| `attributes` | object | -        | Additional event metadata                 |

### Response

```json
{
  "status": "accepted",
  "eventId": "01HN2K8X9QGJ1K8H3P4M7R2N8T"
}
```

## Testing

### Quick Testing with Test Script

The easiest way to test the audit service is using the comprehensive testing script:

```bash
# Run all tests with automatic setup
./test-audit.sh
```

This script will:

- ✅ Check and optionally start Azurite storage emulator
- ✅ Install dependencies and build the service
- ✅ Run the complete test suite
- ✅ Optionally start the service for manual testing
- ✅ Submit test events to verify end-to-end functionality
- ✅ Provide color-coded results and clear status

### Manual Test Commands

Alternatively, run individual test suites:

```bash
# Basic API functionality tests
pnpm test

# Integration tests with database verification
pnpm test:integration

# Database integrity and partition validation
pnpm test:database

# Performance and load testing
pnpm test:performance

# Real-world scenario workflows
pnpm test:scenarios

# Complete test suite (recommended for CI)
pnpm test:all

# CI-appropriate subset (faster execution)
pnpm test:ci
```

### Test Categories

#### 1. **API Tests** (`test/api.test.js`)

- ✅ Health endpoints (`/healthz`, `/ready`, `/metrics`)
- ✅ Authentication (valid/invalid tokens)
- ✅ Event validation (required fields, field lengths)
- ✅ Idempotency (same `eventId` handling)
- ✅ Error handling (400, 401, 500 responses)

#### 2. **Integration Tests** (`test/integration.test.js`)

- ✅ End-to-end event persistence verification
- ✅ Complex attribute serialization
- ✅ Multi-tenant data isolation
- ✅ Timestamp handling (custom vs server-generated)
- ✅ Partition key distribution

#### 3. **Database Verification** (`test/database-verification.test.js`)

- ✅ Direct Azure Table Storage queries
- ✅ Partition key structure validation
- ✅ Data integrity after persistence
- ✅ Row key uniqueness enforcement
- ✅ Serialization/deserialization accuracy

#### 4. **Performance Tests** (`test/performance.test.js`)

- ✅ Single request latency (target: <100ms)
- ✅ Concurrent request handling (50-200 events)
- ✅ Sustained load testing
- ✅ Memory usage and leak detection
- ✅ Throughput measurement (events/second)

#### 5. **Scenario Tests** (`test/scenarios.test.js`)

Real-world audit trail workflows:

- ✅ User authentication flows (login, MFA, session management)
- ✅ Document lifecycle tracking (create, edit, share, approve)
- ✅ Security incident response workflows
- ✅ Administrative operations and privilege escalation
- ✅ Financial approval and payment workflows
- ✅ GDPR compliance and data request fulfillment

### Test Prerequisites

Before running tests, ensure:

1. **Docker** is installed and running
2. **Azurite** is started
3. **Environment variables** are configured (`.env` file)
4. **Service port 7080** is available

## Configuration

### Environment Variables

| Variable                        | Description              | Default       | Required |
| ------------------------------- | ------------------------ | ------------- | -------- |
| `PORT`                          | HTTP server port         | `7080`        | -        |
| `NODE_ENV`                      | Environment mode         | `development` | -        |
| `AUDIT_TABLE_CONNECTION_STRING` | Azure/Azurite connection | -             | ✅       |
| `AUDIT_TABLE_NAME`              | Table name for events    | `auditevents` | -        |
| `AUDIT_TOKEN`                   | Authentication token     | -             | ✅       |
| `LOG_LEVEL`                     | Logging level            | `info`        | -        |

### Local Development (Azurite)

```bash
AUDIT_TABLE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;
AUDIT_TOKEN=test-secret-token-123
```

### Production (Azure Storage)

```bash
AUDIT_TABLE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=your-key;EndpointSuffix=core.windows.net
AUDIT_TOKEN=your-production-secret-token
LOG_LEVEL=warn
```

## Architecture

### Data Model

Events are stored in Azure Table Storage with optimized partitioning:

```
PartitionKey: <YYYYMMDDHHmm>-<shard>
RowKey: <eventId> or <ULID>
```

**Example**: `202501031425-a`

- `202501031425`: Time bucket (January 3, 2025, 14:25)
- `a`: Shard (first char of eventId, or '0')

This partitioning strategy:

- ✅ **Distributes load** across Azure's physical partitions with time-based buckets
- ✅ **Enables efficient queries** by time range
- ✅ **Supports high throughput** with minimal hotspotting

### Performance Optimizations

1. **Simple hash functions** (no MD5/crypto overhead)
2. **Direct writes** (no batching complexity in MVP)
3. **Minimal JSON serialization** (removed validation overhead)
4. **Low-cardinality metrics** (efficient Prometheus scraping)
5. **Structured logging** with sensitive data redaction

## Integration Guide

### Using in Node.js Applications

#### Basic Integration

```typescript
// audit-client.ts
import fetch from 'node-fetch'

interface AuditEvent {
  subject: string
  action: string
  timestamp?: number
  eventId?: string
  resourceId?: string
  sessionId?: string
  userId?: string
  attributes?: Record<string, any>
}

class AuditClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  async submitEvent(event: AuditEvent): Promise<{ eventId: string }> {
    const response = await fetch(`${this.baseUrl}/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': this.token,
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      throw new Error(`Audit submission failed: ${response.status}`)
    }

    return response.json()
  }
}

// Usage
const auditClient = new AuditClient('http://localhost:7080', 'your-token')

await auditClient.submitEvent({
  subject: 'user:john@example.com',
  action: 'document.created',
  resourceId: 'doc-456',
  attributes: { documentType: 'invoice' },
})
```

#### With Retry Logic

```typescript
class ResilientAuditClient extends AuditClient {
  async submitEventWithRetry(
    event: AuditEvent,
    maxRetries: number = 3
  ): Promise<{ eventId: string }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.submitEvent(event)
      } catch (error) {
        if (attempt === maxRetries) throw error

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
    throw new Error('Max retries exceeded')
  }
}
```

#### Batch Submission Pattern

```typescript
class BatchAuditClient extends AuditClient {
  private batchQueue: AuditEvent[] = []
  private batchTimer?: NodeJS.Timeout

  queueEvent(event: AuditEvent) {
    this.batchQueue.push(event)

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), 5000)
    }

    if (this.batchQueue.length >= 50) {
      this.flushBatch()
    }
  }

  private async flushBatch() {
    if (this.batchQueue.length === 0) return

    const events = this.batchQueue.splice(0)
    clearTimeout(this.batchTimer)
    this.batchTimer = undefined

    // Submit events concurrently
    await Promise.allSettled(events.map((event) => this.submitEvent(event)))
  }
}
```

### Best Practices

#### Event ID Generation

```typescript
import { ulid } from 'ulidx'

// Generate deterministic event IDs for idempotency
function generateEventId(action: string, resourceId?: string): string {
  // For operations that should be unique per resource
  if (resourceId && ['created', 'deleted'].some((op) => action.includes(op))) {
    return `${action}-${resourceId}`
  }

  // For general events, use ULID for uniqueness
  return ulid()
}

// Usage
await auditClient.submitEvent({
  subject: 'user:john@example.com',
  action: 'document.created',
  resourceId: 'doc-456',
  eventId: generateEventId('document.created', 'doc-456'),
})
```

#### Error Handling Patterns

```typescript
try {
  await auditClient.submitEvent(event)
} catch (error) {
  if (error.message.includes('401')) {
    // Authentication failed - check token
    logger.error('Audit authentication failed', { token: 'REDACTED' })
  } else if (error.message.includes('400')) {
    // Validation error - check event structure
    logger.error('Audit validation failed', { event })
  } else if (error.message.includes('503')) {
    // Service unavailable - queue for retry
    auditQueue.add(event)
  } else {
    // Unexpected error - log and continue
    logger.error('Audit submission failed', { error: error.message })
  }
}
```

## Deployment

### Docker Container

The service includes a production-ready Dockerfile:

```bash
# Build image
docker build -t audit-service .

# Run container
docker run -p 7080:7080 \
  -e AUDIT_TABLE_CONNECTION_STRING="your-connection-string" \
  -e AUDIT_TOKEN="your-production-token" \
  audit-service
```

### Kubernetes Deployment

Deploy using the included manifests:

```bash
# Deploy to Kubernetes
kubectl apply -f deploy/charts/klicker-uzh-v2/templates/deployment-audit.yaml
kubectl apply -f deploy/charts/klicker-uzh-v2/templates/service-audit.yaml
kubectl apply -f deploy/charts/klicker-uzh-v2/templates/cm-audit.yaml
kubectl apply -f deploy/charts/klicker-uzh-v2/templates/secret-audit.yaml
kubectl apply -f deploy/charts/klicker-uzh-v2/templates/hpa-audit.yaml
```

Or using Helm:

```bash
# Install with Helm
helm install audit-service ./deploy/charts/klicker-uzh-v2 \
  --set audit.azureStorage.connectionString="your-connection-string" \
  --set audit.internalToken="your-production-token"
```

### Production Configuration

#### Resource Requirements

- **CPU**: 500m request, 1000m limit
- **Memory**: 512Mi request, 1Gi limit
- **Replicas**: 2 minimum (for high availability)
- **Autoscaling**: 2-10 replicas based on 60% CPU utilization

#### Environment-Specific Settings

**QA Environment:**

```yaml
audit:
  replicaCount: 1
  autoscaling:
    enabled: false
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
  azureStorage:
    tableName: 'auditlogs-qa'
```

**Production Environment:**

```yaml
audit:
  replicaCount: 2
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 60
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  azureStorage:
    tableName: 'auditlogs-prod'
```

### Production Readiness Checklist

- ✅ **Authentication**: Strong internal tokens configured
- ✅ **TLS**: HTTPS enabled for all communications
- ✅ **Monitoring**: Prometheus metrics collection setup
- ✅ **Logging**: Centralized log aggregation configured
- ✅ **Health Checks**: Kubernetes liveness/readiness probes
- ✅ **Autoscaling**: HPA configured for traffic spikes
- ✅ **Backup**: Azure Table Storage backup strategy
- ✅ **Disaster Recovery**: Multi-region deployment considerations

### Performance Tuning

#### Service Configuration

```bash
# Increase Node.js heap for high load
NODE_OPTIONS="--max-old-space-size=2048"

# Optimize for production
NODE_ENV=production
LOG_LEVEL=warn
```

#### Azure Table Storage Optimization

- **Partition strategy**: Optimized for even distribution
- **Batch operations**: Considered for future enhancement
- **Connection pooling**: Built into Azure SDK
- **Regional placement**: Deploy close to Azure storage region

## Monitoring & Operations

### Key Metrics to Monitor

#### Application Metrics

- `audit_requests_total` - Request volume and trends
- `audit_write_errors_total` - Error rate (should be <1%)
- `audit_write_latency_seconds` - Response time percentiles
- `audit_writes_total` - Successful event processing

#### System Metrics

- CPU utilization (target: <60% average)
- Memory usage (watch for leaks)
- Network I/O (Azure Table Storage traffic)
- Disk I/O (minimal for this service)

### Recommended Alerts

```yaml
# High error rate
- alert: AuditHighErrorRate
  expr: rate(audit_write_errors_total[5m]) > 0.01
  for: 2m
  annotations:
    summary: 'Audit service error rate above 1%'

# High latency
- alert: AuditHighLatency
  expr: histogram_quantile(0.95, audit_write_latency_seconds_bucket) > 0.5
  for: 5m
  annotations:
    summary: 'Audit service 95th percentile latency above 500ms'

# Service down
- alert: AuditServiceDown
  expr: up{job="audit-service"} == 0
  for: 1m
  annotations:
    summary: 'Audit service is down'
```

### Log Analysis Patterns

#### Successful Operations

```json
{
  "level": "INFO",
  "msg": "Audit event written successfully",
  "partitionKey": "202501031425-a",
  "duration": 45
}
```

#### Error Patterns

```json
{
  "level": "ERROR",
  "msg": "Failed to write audit event",
  "error": "EntityTooLarge",
  "subject": "user:example"
}
```

Look for:

- **EntityTooLarge**: Events exceeding 1MB Azure limit
- **ServerBusy**: Azure throttling (consider retry logic)
- **Authentication failures**: Invalid tokens
- **Network timeouts**: Azure connectivity issues

## Observability

### Metrics (Prometheus)

- `audit_requests_total` - Total requests received
- `audit_writes_total` - Successfully written events
- `audit_write_errors_total` - Write failures
- `audit_write_latency_seconds` - Write latency histogram
- Standard process metrics (CPU, memory, etc.)

Access at: http://localhost:7080/metrics

### Logging (Structured JSON)

```json
{
  "level": "INFO",
  "time": "2025-01-03T14:25:30.123Z",
  "service": "audit-service",
  "partitionKey": "202501031425-a",
  "rowKey": "01HN2K8X9QGJ1K8H3P4M7R2N8T",
  "duration": 45,
  "msg": "Audit event written successfully"
}
```

### Health Checks

- **Liveness**: `GET /healthz` - Basic service health
- **Readiness**: `GET /ready` - Ready to accept traffic

## Scripts Reference

| Command      | Description                              |
| ------------ | ---------------------------------------- |
| `pnpm dev`   | Start in development mode (auto-rebuild) |
| `pnpm build` | Build production bundle                  |
| `pnpm start` | Start production server                  |
| `pnpm test`  | Run API tests                            |
| `pnpm check` | TypeScript type checking                 |
