# Implementation Plan: Resilient Audit Service with p-queue

## Overview
Implement resilient buffering using p-queue while maintaining compatibility with existing Kubernetes deployment artifacts in the Helm chart. The queue can be disabled via configuration to maintain backward compatibility with direct writes.

## Existing Infrastructure Review
Based on the Helm chart analysis:
- **Current replicas**: 2 (min), 10 (max with HPA)
- **Resources**: 512Mi-1Gi memory per pod
- **Probes**: `/healthz` (liveness), `/ready` (readiness)
- **ConfigMap**: `cm-audit.yaml` for configuration
- **Table name**: Currently "auditlogs" in values.yaml

## Architecture

### Node.js Concurrency Model
- **Single JavaScript thread**: All JavaScript code runs on one thread
- **Async I/O**: Network calls to Azure don't block the main thread
- **p-queue concurrency**: Manages how many promises are "in-flight" simultaneously
- **No OS threads**: Concurrency setting controls concurrent async operations, not threads

### Kubernetes Deployment Model
- **Multiple pods**: Each pod has its own isolated queue
- **No shared state**: Queues are not shared between pods
- **Acceptable data loss**: If pod crashes, queued events are lost (OK for audit logs)
- **Horizontal scaling**: Total capacity = pods × queue_size

## Phase 1: Core Implementation

### 1. Install p-queue
```bash
cd apps/audit
pnpm add p-queue@^9.0.0
```

### 2. Create Queue Manager (`src/queue/queue-manager.ts`)
```typescript
import PQueue from 'p-queue';
import { AuditTableClient } from '../storage/table-client.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';
import type { AuditTableEntity } from '../storage/entities.js';

export class QueueManager {
  private queue: PQueue | null = null;
  private tableClient: AuditTableClient;
  private droppedEventsCount = 0;
  private isEnabled: boolean;
  
  constructor(tableClient: AuditTableClient) {
    this.tableClient = tableClient;
    this.isEnabled = process.env.QUEUE_ENABLED === 'true';
    
    if (this.isEnabled) {
      // Conservative settings for 512Mi-1Gi pods
      this.queue = new PQueue({
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3'),
        interval: 1000,
        intervalCap: parseInt(process.env.QUEUE_INTERVAL_CAP || '15'),
        timeout: 30000,
      });
      
      logger.info({
        concurrency: this.queue.concurrency,
        interval: 1000,
        intervalCap: this.queue.intervalCap
      }, 'Queue manager initialized');
    } else {
      logger.info('Queue disabled, using direct writes');
    }
  }
  
  async addEvent(entity: AuditTableEntity): Promise<{ queued: boolean }> {
    // If queue is disabled, write directly
    if (!this.isEnabled || !this.queue) {
      await this.tableClient.upsertEntity(entity);
      return { queued: false };
    }
    
    // Check queue size limit
    const maxSize = parseInt(process.env.QUEUE_MAX_SIZE || '500');
    if (this.queue.size >= maxSize) {
      this.droppedEventsCount++;
      metrics.droppedEventsTotal.inc({ 
        pod: process.env.HOSTNAME || 'unknown',
        reason: 'queue_full' 
      });
      throw new Error('Queue full');
    }
    
    // Add to queue for async processing
    this.queue.add(async () => {
      try {
        await this.tableClient.upsertEntity(entity);
        metrics.queueProcessedTotal.inc();
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error',
          eventId: entity.rowKey
        }, 'Failed to process queued event after retries');
        metrics.queueFailedTotal.inc();
        throw error; // Re-throw for p-queue error handling
      }
    });
    
    return { queued: true };
  }
  
  getQueueSize(): number {
    return this.queue?.size || 0;
  }
  
  getPendingCount(): number {
    return this.queue?.pending || 0;
  }
  
  getDroppedCount(): number {
    return this.droppedEventsCount;
  }
  
  isQueueEnabled(): boolean {
    return this.isEnabled;
  }
  
  async onIdle(): Promise<void> {
    if (this.queue) {
      await this.queue.onIdle();
    }
  }
}
```

### 3. Update Table Client with Retry (`src/storage/table-client.ts`)
Add retry configuration to existing constructor:
```typescript
constructor(connectionString: string, tableName: string) {
  // ... existing connection parsing ...
  
  this.client = new TableClient(accountUrl, tableName, credential, {
    allowInsecureConnection: accountUrl.startsWith('http:'),
    retryOptions: {
      maxRetries: parseInt(process.env.AZURE_MAX_RETRIES || '5'),
      retryDelayInMs: parseInt(process.env.AZURE_RETRY_DELAY_MS || '1000'),
      maxRetryDelayInMs: parseInt(process.env.AZURE_MAX_RETRY_DELAY_MS || '30000')
    }
  });
  
  logger.info({
    tableName,
    maxRetries: process.env.AZURE_MAX_RETRIES || '5',
    retryDelayMs: process.env.AZURE_RETRY_DELAY_MS || '1000'
  }, 'Table client initialized with retry policy');
}
```

### 4. Update app.ts
Replace direct writes with queue manager:
```typescript
import { QueueManager } from './queue/queue-manager.js';

// Initialize queue manager with table client
const queueManager = new QueueManager(tableClient);

// In the audit endpoint handler:
app.post('/audit', authMiddleware, zValidator('json', AuditEventSchema), async (c) => {
  const startTime = Date.now();
  const event = c.req.valid('json');
  
  metrics.requestsTotal.inc();
  
  try {
    logger.info({
      requestId: c.get('requestId'),
      action: event.action,
      eventId: event.eventId,
    }, 'Processing audit event');
    
    // Convert event to Azure Table entity
    const entity = createAuditEntity(event);
    
    // Add to queue or write directly based on configuration
    const { queued } = await queueManager.addEvent(entity);
    
    if (queued) {
      // Event was queued for async processing
      metrics.eventsQueuedTotal.inc();
      logger.info({
        requestId: c.get('requestId'),
        eventId: entity.rowKey,
        queueSize: queueManager.getQueueSize()
      }, 'Audit event queued for processing');
      
      return c.json({
        status: 'queued',
        eventId: entity.rowKey,
        stored: true
      }, 202); // Accepted for processing
    } else {
      // Event was written directly (queue disabled)
      metrics.writesTotal.inc();
      metrics.writeLatency.observe((Date.now() - startTime) / 1000);
      
      logger.info({
        requestId: c.get('requestId'),
        partitionKey: entity.partitionKey,
        rowKey: entity.rowKey,
        duration: Date.now() - startTime,
      }, 'Audit event written directly');
      
      return c.json({
        status: 'stored',
        eventId: entity.rowKey,
        stored: true
      }, 200); // OK, written immediately
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Queue full') {
      logger.warn({
        requestId: c.get('requestId'),
        queueSize: queueManager.getQueueSize()
      }, 'Queue full, rejecting event');
      
      return c.json({
        error: 'Service temporarily at capacity',
        retry: true,
        retryAfter: 5,
        eventId: event.eventId
      }, 503);
    }
    
    // Handle other errors as before...
    metrics.writeErrorsTotal.inc();
    logger.error({
      requestId: c.get('requestId'),
      eventId: event.eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to process audit event');
    
    return c.json({
      error: 'Failed to store event',
      retry: true,
      retryAfter: 10,
      eventId: event.eventId
    }, 503);
  }
});

export { app, tableClient, queueManager };
```

## Phase 2: Update Health Endpoints

### 1. Fix Liveness Endpoint (`/healthz`)
```typescript
app.get('/healthz', (c) => {
  // Simple liveness check - no external dependencies
  return c.text('OK', 200);
});
```

### 2. Enhance Readiness Endpoint (`/ready`)
```typescript
app.get('/ready', authMiddleware, async (c) => {
  const readinessData: any = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    storage: 'unknown',
    queue: {
      enabled: queueManager.isQueueEnabled()
    }
  };
  
  // If queue is enabled, check its health
  if (queueManager.isQueueEnabled()) {
    const queueSize = queueManager.getQueueSize();
    const maxSize = parseInt(process.env.QUEUE_MAX_SIZE || '500');
    
    readinessData.queue = {
      enabled: true,
      size: queueSize,
      pending: queueManager.getPendingCount(),
      dropped: queueManager.getDroppedCount(),
      maxSize: maxSize
    };
    
    // Mark not ready if queue is >90% full
    if (queueSize > maxSize * 0.9) {
      logger.warn({
        queueSize,
        maxSize,
        pod: process.env.HOSTNAME
      }, 'Queue nearly full, marking not ready');
      
      return c.json({
        ...readinessData,
        status: 'not_ready',
        reason: 'queue_full'
      }, 503);
    }
  }
  
  // Check Azure connectivity
  try {
    await tableClient.checkConnection();
    readinessData.storage = 'connected';
  } catch (error) {
    return c.json({
      ...readinessData,
      status: 'not_ready',
      storage: 'disconnected',
      reason: 'storage_disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 503);
  }
  
  return c.json(readinessData, 200);
});
```

## Phase 3: Update Helm Chart Configuration

### 1. Update ConfigMap (`deploy/charts/klicker-uzh-v2/templates/cm-audit.yaml`)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "chart.fullname" . }}-config-audit
  labels:
    {{- include "chart.labels" . | nindent 4 }}
data:
  LOG_LEVEL: {{ .Values.audit.logLevel | quote }}
  AZURE_TABLES_TABLE_NAME: {{ .Values.audit.azureStorage.tableName | quote }}
  CORS_ORIGINS: {{ .Values.audit.corsOrigins | quote }}
  # Queue Configuration
  QUEUE_ENABLED: {{ .Values.audit.queue.enabled | quote }}
  QUEUE_MAX_SIZE: {{ .Values.audit.queue.maxSize | quote }}
  QUEUE_CONCURRENCY: {{ .Values.audit.queue.concurrency | quote }}
  QUEUE_INTERVAL_CAP: {{ .Values.audit.queue.intervalCap | quote }}
  # Azure Retry Configuration
  AZURE_MAX_RETRIES: {{ .Values.audit.azureRetry.maxRetries | quote }}
  AZURE_RETRY_DELAY_MS: {{ .Values.audit.azureRetry.retryDelayMs | quote }}
  AZURE_MAX_RETRY_DELAY_MS: {{ .Values.audit.azureRetry.maxRetryDelayMs | quote }}
```

### 2. Update values.yaml
```yaml
audit:
  priorityClassName: production-workload
  
  replicaCount: 2
  
  image:
    repository: ghcr.io/uzh-bf/klicker-uzh/audit
    pullPolicy: Always
  
  service:
    type: ClusterIP
    port: 80
  
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 80
  
  # Configuration
  logLevel: "info"
  
  # Queue configuration for resilience
  queue:
    enabled: "true"          # Set to "false" for direct writes
    maxSize: "500"           # Conservative for 512Mi-1Gi memory
    concurrency: "3"         # Per-pod concurrent writes
    intervalCap: "15"        # Max ops per second per pod
  
  # Azure SDK retry configuration
  azureRetry:
    maxRetries: "5"
    retryDelayMs: "1000"
    maxRetryDelayMs: "30000"
  
  azureStorage:
    tableName: "auditevents"  # Standardized from "auditlogs"
    connectionString: ""
  
  internalToken: ""
  
  nodeSelector: {}
  tolerations: []
  affinity: {}
```

### 3. Update Deployment (add graceful shutdown)
```yaml
# In deployment-audit.yaml template
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 40  # Give time to drain queue
      containers:
        - name: audit
          # ... existing config ...
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "7080"
            - name: HOSTNAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name  # Pod name for logging
```

## Phase 4: Graceful Shutdown

### Update index.ts
```typescript
let isShuttingDown = false;

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info({
    pod: process.env.HOSTNAME,
    queueEnabled: queueManager.isQueueEnabled(),
    queueSize: queueManager.getQueueSize()
  }, 'Received SIGTERM, starting graceful shutdown');
  
  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Only wait for queue if it's enabled
  if (queueManager.isQueueEnabled()) {
    // Kubernetes gives 30s default terminationGracePeriodSeconds
    const shutdownTimeout = setTimeout(() => {
      logger.error({
        queueSize: queueManager.getQueueSize(),
        pending: queueManager.getPendingCount()
      }, 'Forced shutdown with events still in queue');
      process.exit(1);
    }, 25000);  // Leave 5s buffer
    
    try {
      // Wait for queue to drain
      await queueManager.onIdle();
      logger.info('Queue drained successfully');
    } catch (error) {
      logger.error({ error }, 'Error during queue drain');
    }
    
    clearTimeout(shutdownTimeout);
  }
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
});

// Also handle SIGINT for local development
process.on('SIGINT', () => {
  logger.info('Received SIGINT');
  process.emit('SIGTERM' as any);
});

// Prevent new events during shutdown
app.use('*', async (c, next) => {
  if (isShuttingDown) {
    return c.json({ 
      error: 'Service is shutting down',
      retry: true,
      retryAfter: 30
    }, 503);
  }
  await next();
});
```

## Phase 5: Monitoring & Metrics

### 1. Update metrics.ts
```typescript
// Queue metrics
export const queueSize = new client.Gauge({
  name: 'audit_queue_size',
  help: 'Current number of events in queue',
  labelNames: ['pod']
});

export const queuePending = new client.Gauge({
  name: 'audit_queue_pending',
  help: 'Number of events currently being processed',
  labelNames: ['pod']
});

export const eventsQueuedTotal = new client.Counter({
  name: 'audit_events_queued_total',
  help: 'Total number of events added to queue',
  labelNames: ['pod']
});

export const queueProcessedTotal = new client.Counter({
  name: 'audit_queue_processed_total',
  help: 'Total number of events successfully processed from queue',
  labelNames: ['pod']
});

export const queueFailedTotal = new client.Counter({
  name: 'audit_queue_failed_total',
  help: 'Total number of events that failed processing from queue',
  labelNames: ['pod']
});

export const droppedEventsTotal = new client.Counter({
  name: 'audit_dropped_events_total',
  help: 'Total number of events dropped due to queue overflow',
  labelNames: ['pod', 'reason']
});
```

### 2. Add metrics collection
```typescript
// Update metrics periodically
setInterval(() => {
  if (queueManager.isQueueEnabled()) {
    const podName = process.env.HOSTNAME || 'unknown';
    metrics.queueSize.set({ pod: podName }, queueManager.getQueueSize());
    metrics.queuePending.set({ pod: podName }, queueManager.getPendingCount());
  }
}, 5000);  // Every 5 seconds
```

## Phase 6: Testing

### 1. Unit Tests (`test/queue.test.ts`)
```typescript
describe('QueueManager', () => {
  it('should write directly when queue is disabled', async () => {
    process.env.QUEUE_ENABLED = 'false';
    const queueManager = new QueueManager(mockTableClient);
    const result = await queueManager.addEvent(mockEntity);
    expect(result.queued).toBe(false);
    expect(mockTableClient.upsertEntity).toHaveBeenCalledWith(mockEntity);
  });
  
  it('should queue events when enabled', async () => {
    process.env.QUEUE_ENABLED = 'true';
    const queueManager = new QueueManager(mockTableClient);
    const result = await queueManager.addEvent(mockEntity);
    expect(result.queued).toBe(true);
  });
  
  it('should reject events when queue is full', async () => {
    process.env.QUEUE_ENABLED = 'true';
    process.env.QUEUE_MAX_SIZE = '1';
    const queueManager = new QueueManager(mockTableClient);
    await queueManager.addEvent(mockEntity);
    await expect(queueManager.addEvent(mockEntity2)).rejects.toThrow('Queue full');
  });
});
```

### 2. Integration Tests
- Test with `QUEUE_ENABLED=true` and `QUEUE_ENABLED=false`
- Simulate Azure outages
- Test graceful shutdown with pending events
- Verify memory usage stays within limits

### 3. Load Testing
```bash
# Test with queue enabled
QUEUE_ENABLED=true k6 run --vus 100 --duration 5m load-test.js

# Test with queue disabled (direct writes)
QUEUE_ENABLED=false k6 run --vus 100 --duration 5m load-test.js
```

## Migration Strategy

### 1. Staged Rollout
1. Deploy with `QUEUE_ENABLED=false` first (no behavior change)
2. Monitor metrics and logs
3. Enable queue on one pod for testing
4. Gradually enable on all pods

### 2. Configuration Changes
- Update table name from "auditlogs" to "auditevents"
- Set appropriate queue sizes based on pod memory
- Configure retry policies based on Azure SLA

### 3. Rollback Plan
- Set `QUEUE_ENABLED=false` to revert to direct writes
- No code changes needed, just configuration

## Benefits

- **Backward compatible**: Can be disabled via configuration
- **Zero data loss** during temporary Azure outages (within queue limits)
- **Immediate response** to clients when queue enabled (202 Accepted)
- **Memory safe** with configured limits for container environment
- **Pod-aware** metrics and logging
- **Graceful degradation** via readiness probe
- **Minimal changes** to existing Helm charts

## Trade-offs

- Events can be lost if pod crashes (acceptable for audit logs)
- Queue fills if Azure is down for extended period
- Slightly increased memory usage when queue is enabled
- 202 response when queued vs 200 for direct writes (clients should handle both)

## Configuration Reference

### Environment Variables
```bash
# Queue Configuration
QUEUE_ENABLED=true|false        # Enable/disable queue (default: false)
QUEUE_MAX_SIZE=500              # Max events in queue
QUEUE_CONCURRENCY=3             # Concurrent Azure writes
QUEUE_INTERVAL_CAP=15           # Max ops per second

# Azure Retry Configuration
AZURE_MAX_RETRIES=5             # Max retry attempts
AZURE_RETRY_DELAY_MS=1000       # Initial retry delay
AZURE_MAX_RETRY_DELAY_MS=30000  # Max retry delay

# Azure Storage
AZURE_TABLES_TABLE_NAME=auditevents
AZURE_TABLES_CONNECTION_STRING=...
```

### Recommended Settings by Environment

#### Development
```yaml
queue:
  enabled: "false"  # Direct writes for immediate feedback
```

#### Staging
```yaml
queue:
  enabled: "true"
  maxSize: "100"    # Small queue for testing
  concurrency: "2"
```

#### Production
```yaml
queue:
  enabled: "true"
  maxSize: "500"    # Balanced for 512Mi pods
  concurrency: "3"
  intervalCap: "15"
```