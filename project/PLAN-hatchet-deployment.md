# Hatchet Deployment Plan for KlickerUZH

## Overview

Deploy Hatchet workflow orchestration platform as an internal service in the Kubernetes cluster. Hatchet will centralize and enhance KlickerUZH's async processing capabilities by replacing scattered CronJobs, providing durable workflow execution with retry logic, and offering better observability into background processes. The Hatchet dashboard will be accessed via kubectl port-forwarding, with no public exposure.

## Current State Assessment

KlickerUZH currently has significant async processing needs:

- **7 Kubernetes CronJobs** handling scheduled tasks (activity publications, group scores, notifications, timeline updates, group creation)
- **Response processing pipeline** (backend-responses → backend-response-processor) for live quiz handling
- **Redis** for caching and potentially job queuing
- **Complex workflows** around activities, quizzes, and participant interactions

Hatchet will provide:

- **Unified workflow orchestration** replacing scattered CronJobs
- **Durable execution** with built-in retry logic and error handling
- **Observable workflows** with monitoring and debugging capabilities
- **Event-driven architecture** for complex multi-step processes
- **Rate limiting and concurrency controls** crucial for handling quiz response spikes

## Architecture Overview

### Service Architecture

- **Internal Communication**: All Hatchet services exposed as ClusterIP services
- **Dashboard Access**: Via kubectl port-forward for administrative tasks
- **Application Integration**: KlickerUZH services connect to Hatchet via internal Kubernetes DNS
- **No Public Exposure**: No ingress resources or external load balancers

### Component Layout

```
Namespace: klicker-v2-qa / klicker-v2-prod
├── Hatchet Stack
│   ├── hatchet-api (ClusterIP service)
│   ├── hatchet-engine (ClusterIP service)
│   ├── hatchet-frontend (ClusterIP service)
│   ├── PostgreSQL (QA: in-cluster, Prod: external)
│   └── RabbitMQ (embedded)
└── KlickerUZH Services
    ├── backend-docker (connects to hatchet-engine)
    ├── backend-responses (phased integration - critical path)
    └── backend-response-processor (phased integration - critical path)
```

### Integration Strategy

**Critical Path Considerations**: Live quiz response processing is the most sensitive integration point. Students expect immediate feedback when submitting answers. This requires:

- Sub-second workflow initiation times
- Careful capacity planning for peak loads (hundreds of concurrent submissions)
- Circuit breakers to fall back to direct processing if Hatchet is unavailable

## QA/Staging Environment Configuration

### Directory Structure

```
deploy/
  charts/
    hatchet/                    # New Hatchet Helm chart
      Chart.yaml
      values.yaml
      templates/
        deployment-api.yaml
        deployment-engine.yaml
        deployment-frontend.yaml
        service-api.yaml
        service-engine.yaml
        service-frontend.yaml
        configmap.yaml
        secret.yaml
  env-qa-v3/
    helmfile.yaml               # Update to include Hatchet
    values-hatchet.yaml         # Hatchet-specific values
```

### Helmfile Configuration

Update `deploy/env-qa-v3/helmfile.yaml`:

```yaml
repositories:
  - name: bitnami
    url: https://charts.bitnami.com/bitnami
  - name: hatchet
    url: https://hatchet-dev.github.io/hatchet-charts

releases:
  - name: klicker-v2-qa
    # ... existing configuration ...

  - name: hatchet-qa
    namespace: klicker-v2-qa
    chart: hatchet/hatchet-stack
    values:
      - values-hatchet.yaml
      - .values-hatchet-SECRET.yaml # Generated from Doppler
```

### QA Values Configuration

Key configurations for `values-hatchet.yaml`:

```yaml
# Use embedded PostgreSQL for QA
postgresql:
  enabled: true
  auth:
    database: hatchet
    username: hatchet
    # Password from Doppler
  persistence:
    enabled: true
    size: 10Gi
    storageClass: default

# Use embedded RabbitMQ
rabbitmq:
  enabled: true
  auth:
    username: hatchet
    # Password from Doppler
  persistence:
    enabled: true
    size: 5Gi

# API Configuration
api:
  replicaCount: 1
  service:
    type: ClusterIP
    port: 8080
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

# Engine Configuration
engine:
  replicaCount: 1
  service:
    type: ClusterIP
    port: 7070
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 2Gi

# Frontend Configuration
frontend:
  replicaCount: 1
  service:
    type: ClusterIP
    port: 8080
  resources:
    requests:
      cpu: 50m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi

# Shared Configuration
sharedConfig:
  serverUrl: 'http://hatchet-stack-api:8080'
  grpcBroadcastAddress: 'hatchet-stack-engine:7070'
  # Admin credentials from Doppler
```

### Access Configuration for QA

Document port-forwarding commands:

```bash
# Access Hatchet Dashboard
kubectl port-forward -n klicker-v2-qa svc/hatchet-stack-frontend 8080:8080

# Access Hatchet API (for debugging)
kubectl port-forward -n klicker-v2-qa svc/hatchet-stack-api 8081:8080

# Access Hatchet Engine (for debugging)
kubectl port-forward -n klicker-v2-qa svc/hatchet-stack-engine 7070:7070
```

## Production Environment Configuration

### Production Values Configuration

Key differences for production:

```yaml
# Use external PostgreSQL
postgresql:
  enabled: false

externalDatabase:
  enabled: true
  host: # From Doppler - external PostgreSQL host
  port: 5432
  database: hatchet
  username: hatchet
  # Password from Doppler
  sslMode: require

# RabbitMQ - consider external or clustered setup
rabbitmq:
  enabled: true # Or use external
  replicaCount: 3
  clustering:
    enabled: true
  persistence:
    enabled: true
    size: 20Gi
    storageClass: fast-ssd

# High Availability Configuration
api:
  replicaCount: 3
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 2Gi
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - topologyKey: kubernetes.io/hostname

engine:
  replicaCount: 4
  resources:
    requests:
      cpu: 2000m
      memory: 4Gi
    limits:
      cpu: 8000m
      memory: 8Gi
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - topologyKey: kubernetes.io/hostname

# Additional production components
controllers:
  replicaCount: 2
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi

scheduler:
  replicaCount: 2
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi
```

## Application Integration

### Service Discovery

KlickerUZH services will connect to Hatchet using internal Kubernetes DNS:

- API endpoint: `http://hatchet-stack-api.<namespace>.svc.cluster.local:8080`
- Engine endpoint: `hatchet-stack-engine.<namespace>.svc.cluster.local:7070`

### Environment Variables for KlickerUZH Services

Add to application configurations:

```yaml
HATCHET_API_URL: 'http://hatchet-stack-api:8080'
HATCHET_GRPC_URL: 'hatchet-stack-engine:7070'
HATCHET_API_TOKEN: # From Doppler - generated after deployment
```

### Worker Implementation

Create Hatchet workers within KlickerUZH services:

- Integrate Hatchet SDK into backend services
- Define workflows for background tasks
- Implement worker processes for job execution
- Add circuit breakers for Hatchet communication
- Implement dual-path processing (direct + Hatchet) for gradual migration

### Phased Migration Strategy

**Phase 0 - Proof of Concept (1-2 weeks)**

- Deploy Hatchet in QA with minimal configuration
- Implement ONE simple workflow (daily timeline updates)
- Validate operational procedures and monitoring

**Phase 1 - Scheduled Tasks (2-3 weeks)**

- Migrate all CronJobs to Hatchet scheduled workflows:
  - Daily group scores calculation
  - Push notifications check
  - Activity publications
  - Activity endings
  - Timeline updates
  - Group creation workflows
- Low risk, high observability gain
- Keeps critical real-time paths unchanged

**Phase 2 - Async Operations (3-4 weeks)**

- Email sending and notification delivery
- Report generation and data export
- Background analytics processing
- Medium risk, significant reliability improvements
- Still preserves live quiz direct processing

**Phase 3 - Response Processing (Only after 2-3 months of stability)**

- Integrate live quiz response handling as workflows
- Implement dual-path processing initially (direct + workflow)
- Each response triggers workflow: validate → score → update leaderboard → award XP
- Extensive load testing required
- Circuit breaker to fall back to direct processing

## Security Configuration

### Internal Security

- Use NetworkPolicies to restrict traffic between services
- Implement service-to-service authentication using API tokens
- Store all sensitive configuration in Doppler

### RBAC Configuration

Create appropriate Kubernetes RBAC for Hatchet:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: hatchet-role
  namespace: klicker-v2-qa
rules:
  - apiGroups: ['']
    resources: ['pods', 'services', 'configmaps', 'secrets']
    verbs: ['get', 'list', 'watch', 'create', 'update', 'patch']
```

### Network Policies

Implement network policies to control traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hatchet-network-policy
spec:
  podSelector:
    matchLabels:
      app: hatchet
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: klicker
      ports:
        - protocol: TCP
          port: 8080
        - protocol: TCP
          port: 7070
```

## Monitoring & Observability

### Metrics Collection

- Enable Prometheus metrics export from Hatchet
- Configure ServiceMonitor resources for Prometheus Operator
- Create Grafana dashboards for workflow monitoring
- **Critical Metrics to Monitor:**
  - Workflow queue depth and processing latency
  - Engine resource utilization (CPU/memory)
  - Failed workflow rates by type
  - Response time for critical workflows (live quiz processing)
  - Database connection pool utilization
  - RabbitMQ queue depths and message rates

### Logging

- Configure structured logging to existing log aggregation system
- Set appropriate log levels for different environments
- Implement log retention policies

### Health Checks

Configure liveness and readiness probes for all Hatchet components:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Doppler Secret Management

### Required Secrets

Configure in Doppler for each environment:

```
HATCHET_ADMIN_EMAIL
HATCHET_ADMIN_PASSWORD
HATCHET_DATABASE_URL (production only)
HATCHET_DATABASE_PASSWORD
HATCHET_RABBITMQ_PASSWORD
HATCHET_ENCRYPTION_KEY
HATCHET_API_TOKENS (for service authentication)
```

### Secret Generation Script

Update deployment script to generate Hatchet secrets:

```bash
doppler secrets get --json | jq '
  .HATCHET_ADMIN_EMAIL.value as $email |
  .HATCHET_ADMIN_PASSWORD.value as $password |
  # ... other secrets
  {
    sharedConfig: {
      adminEmail: $email,
      adminPassword: $password
    }
    # ... rest of configuration
  }
' > .values-hatchet-SECRET.yaml
```

## Deployment Process

### Phase 0: Proof of Concept Deployment

1. **Prepare Doppler Secrets**

   - Add Hatchet-specific secrets to Doppler
   - Configure database credentials
   - Generate secure admin passwords

2. **Update Helmfile**

   - Add Hatchet repository
   - Configure Hatchet release with minimal resources
   - Set appropriate values files

3. **Deploy to QA**

   ```bash
   cd deploy/env-qa-v3
   ./_deploy.sh apply
   ```

4. **Verify Deployment**

   ```bash
   kubectl get pods -n klicker-v2-qa | grep hatchet
   kubectl logs -n klicker-v2-qa -l app=hatchet
   ```

5. **Access Dashboard and Test**

   ```bash
   kubectl port-forward -n klicker-v2-qa svc/hatchet-stack-frontend 8080:8080
   ```

6. **Generate API Tokens**

   - Access dashboard via port-forward
   - Navigate to Settings > API Tokens
   - Generate tokens for service authentication
   - Store tokens in Doppler

7. **Deploy Test Workflow**
   - Implement simple daily timeline update workflow
   - Test workflow execution, monitoring, and error handling
   - Validate operational procedures

### Phase 1: CronJob Migration

1. **Implement Scheduled Workflows**

   - Convert existing CronJob logic to Hatchet workflows
   - Start with least critical jobs (timeline updates)
   - Progress to more important jobs (group scores, notifications)

2. **Parallel Operation**

   - Run both CronJobs and Hatchet workflows in parallel initially
   - Compare results for consistency
   - Monitor performance and reliability

3. **Gradual Cutover**
   - Disable CronJobs one by one after validation
   - Monitor system behavior after each cutover
   - Maintain rollback capability

### Migration to Production

1. **Configure External Database**

   - Set up database in external PostgreSQL
   - Configure connection parameters in Doppler
   - Test connectivity from cluster

2. **Update Production Values**

   - Switch to external database configuration
   - Increase replica counts for HA
   - Configure production resource limits

3. **Deploy to Production**

   ```bash
   cd deploy/env-prod-v3
   ./_deploy.sh apply
   ```

4. **Verify High Availability**
   - Check pod distribution across nodes
   - Test failover scenarios
   - Monitor resource utilization

## Backup & Recovery

### Database Backup (Production)

- Rely on external PostgreSQL backup strategy
- Document restoration procedures
- Test backup restoration regularly

### Configuration Backup

- All configuration stored in Git
- Secrets backed up in Doppler
- Document recovery procedures

## Rollback Strategy

### QA Environment

- Use Helm rollback: `helm rollback hatchet-qa -n klicker-v2-qa`
- Restore database from backup if needed
- Revert configuration changes in Git

### Production Environment

- Perform staged rollback (one component at a time)
- Monitor impact on running workflows
- Have database rollback plan ready
- Document communication procedures

## Testing Strategy

### Smoke Tests

- Verify all pods are running
- Check service connectivity
- Test dashboard access via port-forward
- Verify API token generation

### Integration Tests

- Test workflow creation and execution
- Verify job processing
- Test error handling and retries
- Validate monitoring metrics

### Load Testing (Production)

- Simulate expected workflow volume
- **Critical Performance Benchmarks:**
  - Live quiz response workflows must complete in <1 second
  - System must handle 500+ concurrent workflow executions
  - Database must handle 10,000+ workflow state changes per minute
- Test resource scaling and auto-scaling behavior
- Verify performance under sustained load
- Monitor database performance and connection pooling
- Test failover scenarios and recovery times

## Documentation Requirements

### Operational Documentation

- Port-forwarding commands for dashboard access
- Troubleshooting guide
- Common administrative tasks
- API token management procedures

### Developer Documentation

- Integration guide for KlickerUZH services
- Workflow definition examples for common KlickerUZH patterns:
  - Quiz response processing workflow
  - Activity lifecycle management workflow
  - Notification delivery workflow
  - Group activity orchestration workflow
- Worker implementation patterns
- SDK usage examples
- Circuit breaker implementation guide
- Performance optimization best practices

### Update Existing Documentation

- Update CLAUDE.md with Hatchet information
- Document service endpoints and integration points
- Add Hatchet to architecture diagrams
- Create runbooks for common issues

## Risk Assessment & Mitigation

### High Risks

1. **Performance Degradation**: Adding Hatchet to live quiz response path could introduce latency

   - **Mitigation**: Phase 3 delayed until after proven stability; dual-path processing with circuit breakers

2. **Single Point of Failure**: Hatchet becomes critical infrastructure

   - **Mitigation**: High availability configuration from production day one; comprehensive monitoring

3. **Operational Complexity**: Additional system to monitor and maintain
   - **Mitigation**: Extensive documentation; gradual rollout with operational validation at each phase

### Medium Risks

1. **Database Performance**: Hatchet adds significant database load

   - **Mitigation**: External PostgreSQL for production; proper connection pooling; monitoring

2. **Resource Contention**: Hatchet competes for cluster resources
   - **Mitigation**: Dedicated resource allocations; proper priority classes; resource monitoring

### Low Risks

1. **Learning Curve**: Team needs to learn workflow orchestration concepts
   - **Mitigation**: Start with simple workflows; comprehensive documentation; training materials

## Success Criteria

### Phase 0 (Proof of Concept)

- ✅ Hatchet deployed and accessible
- ✅ Single workflow successfully executed
- ✅ Monitoring and alerting functional
- ✅ Operational procedures validated

### Phase 1 (CronJob Migration)

- ✅ All 7 CronJobs successfully migrated to workflows
- ✅ No functional regressions
- ✅ Improved observability into scheduled tasks
- ✅ Reduced operational overhead

### Phase 2 (Async Operations)

- ✅ Email/notification workflows operational
- ✅ Improved reliability and retry handling
- ✅ Better error tracking and resolution

### Phase 3 (Critical Path Integration)

- ✅ Live quiz response workflows meet <1s latency requirement
- ✅ System handles peak loads without degradation
- ✅ Circuit breakers prevent cascading failures
- ✅ Comprehensive monitoring of critical workflows
