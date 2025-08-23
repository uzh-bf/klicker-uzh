# KlickerUZH Helm to Kustomize Migration - Task List

## Project Timeline: 10 Weeks (Implementation Focus)
**Start Date**: 2025-01-03  
**Target Completion**: TBD  
**Implementation**: Claude + Human Developer  

---

## Phase 1: Foundation Setup (Week 1)

### Directory Structure and Base Configuration
- [ ] **Task 1.1**: Create Kustomize directory structure
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: None
  - **Implementation**: 
    - Create `/deploy/kustomize/` directory tree
    - Create base and overlay subdirectories
    - Add .gitignore for secrets.env files
  - **Files to create**:
    ```
    deploy/kustomize/
    ├── base/
    │   ├── apps/
    │   ├── redis/
    │   └── cron-jobs/
    └── overlays/
        ├── qa/
        └── production/
    ```

- [ ] **Task 1.2**: Create namespace and priority class definitions
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 1.1
  - **Implementation**:
    - Create `base/namespace.yaml`
    - Create `base/priority-classes/production-workload.yaml`
    - Create `base/priority-classes/staging-workload.yaml`
  - **Validation**: `kubectl apply --dry-run=client -f <file>`

- [ ] **Task 1.3**: Create base kustomization.yaml
  - **Priority**: High
  - **Estimated Time**: 30 minutes
  - **Dependencies**: Task 1.2
  - **Implementation**:
    - Create `base/kustomization.yaml` with commonLabels
    - Reference namespace and priority classes
    - Define common metadata
  - **Validation**: `kubectl kustomize base/`

- [ ] **Task 1.4**: Create helper scripts for migration
  - **Priority**: Medium
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 1.3
  - **Scripts to create**:
    - `scripts/validate-kustomize.sh` - Validate kustomize output
    - `scripts/compare-helm-kustomize.sh` - Compare Helm vs Kustomize manifests
    - `scripts/extract-helm-values.sh` - Extract current values from Helm

---

## Phase 2: Base Manifest Conversion (Week 2)

### Auth Service Conversion
- [ ] **Task 2.1**: Convert auth service manifests from Helm
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 1.4
  - **Source**: `deploy/charts/klicker-uzh-v2/templates/deployment-app.yaml`
  - **Files to create**:
    - `base/apps/auth/deployment.yaml`
    - `base/apps/auth/service.yaml`
    - `base/apps/auth/ingress.yaml`
    - `base/apps/auth/configmap.yaml`
    - `base/apps/auth/kustomization.yaml`
  - **Key conversions**:
    - Remove all `{{ .Values.* }}` templating
    - Use environment variable references for configs
    - Set default resource limits

- [ ] **Task 2.2**: Create auth HPA configuration
  - **Priority**: Medium
  - **Estimated Time**: 30 minutes
  - **Dependencies**: Task 2.1
  - **File to create**: `base/apps/auth/hpa.yaml`
  - **Configuration**:
    - Target: Deployment/auth
    - Min replicas: 1
    - Max replicas: 4
    - CPU target: 70%

### Frontend Services Conversion
- [ ] **Task 2.3**: Convert frontend-pwa service
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 2.2
  - **Files to create**:
    - `base/apps/frontend-pwa/deployment.yaml`
    - `base/apps/frontend-pwa/service.yaml`
    - `base/apps/frontend-pwa/ingress.yaml`
    - `base/apps/frontend-pwa/configmap.yaml`
    - `base/apps/frontend-pwa/kustomization.yaml`
  - **Special considerations**:
    - Port 3000
    - Image: `ghcr.io/uzh-bf/klicker-uzh/frontend-pwa`

- [ ] **Task 2.4**: Convert frontend-manage service
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 2.3
  - **Implementation**: Same structure as frontend-pwa
  - **Image**: `ghcr.io/uzh-bf/klicker-uzh/frontend-manage`

- [ ] **Task 2.5**: Convert frontend-control service
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 2.4
  - **Implementation**: Same structure as frontend-pwa
  - **Image**: `ghcr.io/uzh-bf/klicker-uzh/frontend-control`

### Backend Services Conversion
- [ ] **Task 2.6**: Convert backend-graphql service
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 2.5
  - **Files to create**: Same structure as frontend services
  - **Special environment variables**:
    - DATABASE_URL
    - REDIS connection configs
    - API_DOMAIN, COOKIE_DOMAIN
  - **Image**: `ghcr.io/uzh-bf/klicker-uzh/backend-docker`

- [ ] **Task 2.7**: Convert LTI service
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 2.6
  - **Port**: 4000 (different from other services)
  - **Special configs**: LTI database connection
  - **Image**: `ghcr.io/uzh-bf/klicker-uzh/lti`

### Base Integration and Redis
- [ ] **Task 2.8**: Create Redis StatefulSet configuration
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 2.7
  - **Files to create**:
    - `base/redis/statefulset.yaml`
    - `base/redis/service.yaml`
    - `base/redis/configmap.yaml`
    - `base/redis/kustomization.yaml`
  - **Replace**: Bitnami Redis chart
  - **Service name**: Must match current names for compatibility

- [ ] **Task 2.9**: Create cron job configurations
  - **Priority**: Medium
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 2.8
  - **Cron jobs to convert**:
    - daily-group-scores
    - push-notifications-check
    - activity-publications
    - activity-endings
    - random-groups-creation
    - timeline-updates

- [ ] **Task 2.10**: Integrate all components in base kustomization
  - **Priority**: High
  - **Estimated Time**: 30 minutes
  - **Dependencies**: Tasks 2.1-2.9
  - **Update**: `base/kustomization.yaml` to reference all services
  - **Validation**: `kubectl kustomize base/` generates valid YAML

---

## Phase 3: Environment Overlay Development (Week 3)

### QA Environment Setup
- [ ] **Task 3.1**: Create QA overlay structure and kustomization
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 2.10
  - **Files to create**:
    - `overlays/qa/kustomization.yaml`
    - `overlays/qa/.env.example`
    - `overlays/qa/patches/` directory
  - **Kustomization content**:
    - namespace: klicker-v2-qa
    - namePrefix: qa-
    - configMapGenerator from .env
    - secretGenerator from secrets.env

- [ ] **Task 3.2**: Extract QA environment variables from Helmfile
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 3.1
  - **Source**: `deploy/env-qa-v3/helmfile.yaml`
  - **Create**: `overlays/qa/.env` with:
    - APP_VERSION
    - Domains (*.klicker-qa.bf-app.ch)
    - Resource limits (50m CPU, 50Mi memory)
    - Replica counts (1 for all services)

- [ ] **Task 3.3**: Create QA-specific patches
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 3.2
  - **Patches to create**:
    - `patches/replica-counts.yaml` - Set all to 1
    - `patches/resources.yaml` - QA resource limits
    - `patches/ingress-hosts.yaml` - QA domains
    - `patches/priority-class.yaml` - staging-workload
    - `patches/redis-config.yaml` - Redis connection

### Production Environment Setup
- [ ] **Task 3.4**: Create Production overlay structure
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 3.3
  - **Implementation**: Similar to QA but namespace: klicker-v2-prod

- [ ] **Task 3.5**: Extract Production environment variables
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 3.4
  - **Source**: `deploy/env-prod-v3/helmfile.yaml`
  - **Key differences from QA**:
    - Dual domains (*.klicker.uzh.ch + *.klicker-prod.bf-app.ch)
    - Higher resources (150m-1000m CPU, 150Mi-1000Mi memory)
    - Different replica counts (3 for PWA, 2 for manage, etc.)

- [ ] **Task 3.6**: Create Production-specific patches
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 3.5
  - **Additional patches**:
    - Multiple TLS certificates for dual domains
    - Production resource limits
    - Production replica counts
    - Priority class: production-workload

### Image Management and Validation
- [ ] **Task 3.7**: Configure image transformations
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 3.6
  - **Implementation**:
    - Add images section to overlay kustomizations
    - Reference APP_VERSION from environment
    - Example: `newTag: ${APP_VERSION}`

- [ ] **Task 3.8**: Validate overlay configurations
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 3.7
  - **Validation steps**:
    ```bash
    kubectl kustomize overlays/qa/ > /tmp/qa.yaml
    kubectl kustomize overlays/production/ > /tmp/prod.yaml
    kubectl apply --dry-run=client -f /tmp/qa.yaml
    kubectl apply --dry-run=client -f /tmp/prod.yaml
    ```

---

## Phase 4: Secret Management Implementation (Week 4)

### Secret Generator Configuration
- [ ] **Task 4.1**: Map secrets from Helm to Kustomize format
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 3.8
  - **Secrets to map**:
    - APP_SECRET
    - DATABASE_URL
    - Redis passwords
    - Email credentials
    - VAPID keys
    - Blob storage keys
    - LTI database credentials
  - **Create**: `overlays/qa/secrets.env.example`

- [ ] **Task 4.2**: Configure secretGenerator in overlays
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 4.1
  - **Update both**:
    - `overlays/qa/kustomization.yaml`
    - `overlays/production/kustomization.yaml`
  - **Configuration**:
    ```yaml
    secretGenerator:
    - name: app-secrets
      envs:
      - secrets.env
    ```

### Doppler Integration
- [ ] **Task 4.3**: Create Doppler download script
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 4.2
  - **Script**: `scripts/doppler-to-env.sh`
  - **Functions**:
    ```bash
    # Download QA secrets
    doppler secrets download --no-file --format env --project klicker-qa > overlays/qa/secrets.env
    # Download Production secrets
    doppler secrets download --no-file --format env --project klicker-prod > overlays/production/secrets.env
    ```

- [ ] **Task 4.4**: Create deployment wrapper script
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 4.3
  - **Script**: `scripts/deploy-with-doppler.sh`
  - **Usage**: `./deploy-with-doppler.sh qa`
  - **Steps**:
    1. Download secrets from Doppler
    2. Apply Kustomize with secrets
    3. Clean up local secrets file

### Secret Validation
- [ ] **Task 4.5**: Create secret validation script
  - **Priority**: Medium
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 4.4
  - **Script**: `scripts/validate-secrets.sh`
  - **Checks**:
    - All required secrets present
    - No empty values
    - Format validation (URLs, keys, etc.)

- [ ] **Task 4.6**: Test secret mounting in pods
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 4.5
  - **Test deployment**:
    - Deploy to test namespace
    - Verify secrets mounted correctly
    - Check environment variables in pods
    - Validate hash suffix for auto-restart

---

## Phase 5: Advanced Patching and Tuning (Week 5)

### Resource Optimization
- [ ] **Task 5.1**: Analyze current resource usage and create patches
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 4.6
  - **Analysis**: Extract from current Helm values
  - **Create patches**:
    - QA: 50m/200m CPU, 50Mi/200Mi memory
    - Prod: 150m/1000m CPU, 150Mi/1000Mi memory
    - Different per service type

- [ ] **Task 5.2**: Create HPA v2 configurations
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 5.1
  - **Services to scale**:
    - frontend-pwa: 3-10 replicas
    - backend-graphql: 3-10 replicas
    - frontend-manage: 2-4 replicas
  - **Metrics**: CPU 70%, Memory 80%

### Health Checks and Monitoring
- [ ] **Task 5.3**: Add health check probes to all services
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 5.2
  - **Probes to add**:
    - Liveness: `/api/health` or `/`
    - Readiness: `/api/ready` or `/`
    - Startup probe for backend services
  - **Timeouts**: initialDelaySeconds: 30, periodSeconds: 10

- [ ] **Task 5.4**: Add monitoring annotations
  - **Priority**: Medium
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 5.3
  - **Annotations**:
    ```yaml
    prometheus.io/scrape: "true"
    prometheus.io/port: "3000"
    prometheus.io/path: "/metrics"
    ```

### Production Optimizations
- [ ] **Task 5.5**: Create Pod Disruption Budgets
  - **Priority**: Medium
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 5.4
  - **PDBs to create**:
    - Critical services: minAvailable: 1
    - Non-critical: maxUnavailable: 1
  - **Files**: `base/apps/*/pdb.yaml`

- [ ] **Task 5.6**: Add security contexts
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 5.5
  - **Security settings**:
    ```yaml
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      fsGroup: 1000
    ```

---

## Phase 6: Redis Migration (Week 6)

### Redis StatefulSet Implementation
- [ ] **Task 6.1**: Replace Bitnami Redis with custom StatefulSet
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 5.6
  - **Implementation details**:
    - Use Redis 7.x image
    - PVC for data persistence
    - Service names: `<env>-redis-master`
    - No authentication (matching current)
  - **Note**: Task 2.8 already created base files

- [ ] **Task 6.2**: Create Redis patches for environments
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 6.1
  - **Patches**:
    - QA: 1Gi storage, basic resources
    - Prod: 10Gi storage, higher resources
    - Different persistence settings

### Redis Testing and Validation
- [ ] **Task 6.3**: Test Redis connectivity
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 6.2
  - **Test steps**:
    1. Deploy Redis to test namespace
    2. Create test pod with redis-cli
    3. Verify connectivity and operations
    4. Test persistence across restarts

- [ ] **Task 6.4**: Update application Redis configurations
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 6.3
  - **Updates needed**:
    - Backend GraphQL Redis configs
    - Service names in ConfigMaps
    - Connection strings in secrets

### Redis Monitoring
- [ ] **Task 6.5**: Add Redis monitoring configuration
  - **Priority**: Medium
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 6.4
  - **Monitoring setup**:
    - Redis exporter sidecar
    - Prometheus annotations
    - Basic alerts (memory, connections)

---

## Phase 7: Testing and Validation (Week 7)

### Parallel Testing
- [ ] **Task 7.1**: Create test namespace and deploy
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 6.5
  - **Test deployment**:
    ```bash
    kubectl create namespace klicker-v2-test
    kubectl apply -k overlays/qa/ -n klicker-v2-test
    ```
  - **Verify**: All pods running, services accessible

- [ ] **Task 7.2**: Run functional tests
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 7.1
  - **Tests**:
    - Frontend accessibility
    - GraphQL API responses
    - Database connectivity
    - Redis operations
    - LTI functionality

### Configuration Validation
- [ ] **Task 7.3**: Compare Helm and Kustomize manifests
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 7.2
  - **Script**: `scripts/compare-manifests.sh`
  - **Compare**:
    - Resource definitions
    - Environment variables
    - Volume mounts
    - Service names
    - Ingress rules

- [ ] **Task 7.4**: Run load tests
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 7.3
  - **Load test scenarios**:
    - Concurrent user logins
    - Quiz participation
    - GraphQL query load
  - **Success criteria**: Performance parity with Helm

### Migration Readiness
- [ ] **Task 7.5**: Create migration checklist
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 7.4
  - **Checklist items**:
    - [ ] All services tested
    - [ ] Secrets validated
    - [ ] Performance verified
    - [ ] Rollback tested
    - [ ] Documentation updated

- [ ] **Task 7.6**: Test rollback procedures
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 7.5
  - **Rollback test**:
    - Deploy with Kustomize
    - Switch back to Helm
    - Verify no data loss

---

## Phase 8: Production Migration (Week 8)

### QA Environment Migration
- [ ] **Task 8.1**: Backup current QA deployment
  - **Priority**: High
  - **Estimated Time**: 30 minutes
  - **Dependencies**: Task 7.6
  - **Commands**:
    ```bash
    helm get values klicker-v2-qa > qa-helm-backup.yaml
    kubectl get all -n klicker-v2-qa -o yaml > qa-resources-backup.yaml
    ```

- [ ] **Task 8.2**: Deploy Kustomize to QA
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 8.1
  - **Migration steps**:
    1. Scale down Helm deployment
    2. Apply Kustomize configuration
    3. Verify all pods running
    4. Update DNS if needed

- [ ] **Task 8.3**: QA smoke tests
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 8.2
  - **Test all critical paths**:
    - User login
    - Quiz creation
    - Student participation
    - LTI integration

### Production Migration
- [ ] **Task 8.4**: Production pre-flight checks
  - **Priority**: Critical
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 8.3
  - **Checklist**:
    - [ ] QA running stable for 24h
    - [ ] Production backups completed
    - [ ] Rollback plan ready
    - [ ] Team availability confirmed

- [ ] **Task 8.5**: Execute production migration
  - **Priority**: Critical
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 8.4
  - **Blue-green deployment**:
    1. Deploy Kustomize alongside Helm
    2. Test new deployment
    3. Switch traffic progressively
    4. Monitor for issues

- [ ] **Task 8.6**: Post-migration monitoring
  - **Priority**: Critical
  - **Estimated Time**: Ongoing
  - **Dependencies**: Task 8.5
  - **Monitor**:
    - Error rates
    - Response times
    - Resource usage
    - User reports

---

## Phase 9: Modern Kubernetes Features (Week 9)

### API Modernization
- [ ] **Task 9.1**: Update API versions
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 8.6
  - **Updates needed**:
    - Ingress: `networking.k8s.io/v1`
    - HPA: `autoscaling/v2`
    - Already using `apps/v1` for Deployments ✓

- [ ] **Task 9.2**: Add Ingress pathType and ingressClassName
  - **Priority**: High
  - **Estimated Time**: 30 minutes
  - **Dependencies**: Task 9.1
  - **Updates**:
    ```yaml
    spec:
      ingressClassName: nginx
      rules:
      - host: example.com
        http:
          paths:
          - pathType: Prefix
            path: /
    ```

### Security Enhancements
- [ ] **Task 9.3**: Implement Pod Security Standards
  - **Priority**: Medium
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 9.2
  - **Add to deployments**:
    ```yaml
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
    ```

- [ ] **Task 9.4**: Add NetworkPolicies
  - **Priority**: Low
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 9.3
  - **Policies to create**:
    - Allow ingress to frontends from nginx
    - Allow backend to database
    - Allow frontends to backend
    - Deny all other traffic

---

## Phase 10: Documentation and CI/CD (Week 10)

### Documentation Updates
- [ ] **Task 10.1**: Create Kustomize deployment guide
  - **Priority**: High
  - **Estimated Time**: 2 hours
  - **Dependencies**: Task 9.4
  - **Document**: `deploy/kustomize/README.md`
  - **Contents**:
    - Quick start guide
    - Environment management
    - Secret handling
    - Common operations
    - Troubleshooting

- [ ] **Task 10.2**: Update repository documentation
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 10.1
  - **Files to update**:
    - Remove Helm instructions from CLAUDE.md
    - Update deployment section in main README
    - Archive Helm documentation

### CI/CD Updates
- [ ] **Task 10.3**: Update GitHub Actions workflows
  - **Priority**: High
  - **Estimated Time**: 1.5 hours
  - **Dependencies**: Task 10.2
  - **Changes**:
    ```yaml
    - name: Deploy to QA
      run: |
        ./scripts/deploy-with-doppler.sh qa
    ```

- [ ] **Task 10.4**: Create deployment scripts
  - **Priority**: High
  - **Estimated Time**: 1 hour
  - **Dependencies**: Task 10.3
  - **Scripts**:
    - `scripts/deploy.sh` - Main deployment script
    - `scripts/rollback.sh` - Quick rollback
    - Update `_deploy.sh` in env directories

### Cleanup
- [ ] **Task 10.5**: Archive Helm configurations
  - **Priority**: Low
  - **Estimated Time**: 30 minutes
  - **Dependencies**: Task 10.4
  - **Actions**:
    - Move `deploy/charts/` to `deploy/archive/helm/`
    - Update .gitignore
    - Create migration notes

---

## Discovered During Work
_This section will be populated with additional tasks discovered during implementation_

---

## Quick Reference

### Key Scripts to Create
1. `scripts/validate-kustomize.sh` - Validate manifest syntax
2. `scripts/compare-helm-kustomize.sh` - Compare outputs
3. `scripts/doppler-to-env.sh` - Download secrets
4. `scripts/deploy-with-doppler.sh` - Deploy with secrets
5. `scripts/validate-secrets.sh` - Check secret completeness
6. `scripts/deploy.sh` - Main deployment script
7. `scripts/rollback.sh` - Emergency rollback

### Critical Files
- `base/kustomization.yaml` - Main base configuration
- `overlays/qa/kustomization.yaml` - QA overlay
- `overlays/production/kustomization.yaml` - Production overlay
- `overlays/*/secrets.env` - Environment secrets (git-ignored)

### Key Commands
```bash
# Validate configuration
kubectl kustomize overlays/qa/

# Deploy to environment
kubectl apply -k overlays/qa/

# Deploy with Doppler
doppler run -- kubectl apply -k overlays/qa/

# Check differences
kubectl diff -k overlays/qa/
```

### Migration Checklist
- [ ] All Helm templates converted
- [ ] Environment variables mapped
- [ ] Secrets configured
- [ ] Redis migrated
- [ ] Tests passing
- [ ] Documentation updated
- [ ] CI/CD updated
- [ ] Team trained

---

**Last Updated**: 2025-01-03  
**Implementation Start**: Phase 1, Task 1.1  
**Next Review**: After Phase 1 completion