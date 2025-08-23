# KlickerUZH Helm to Kustomize Migration - Planning Document

## Project Overview

This document outlines the comprehensive migration strategy for transitioning KlickerUZH's Kubernetes deployment from Helm/Helmfile to Kustomize. The migration aims to simplify the deployment process, improve maintainability, and prepare for modern Kubernetes versions (1.25+).

## Current Architecture Analysis

### Existing Deployment Stack
- **Helm Chart**: `klicker-uzh-v2` with complex templating
- **Helmfile**: Environment-specific value management
- **Kubernetes Version**: 1.22 (target: 1.25+)
- **Environments**: QA (`klicker-v2-qa`) and Production (`klicker-v2-prod`)
- **Namespace Strategy**: Environment-specific namespaces

### Current Services Architecture
```
KlickerUZH Application Stack:
├── Frontend Services
│   ├── auth (Authentication frontend)
│   ├── frontend-pwa (Student interface)
│   ├── frontend-manage (Lecturer interface)
│   └── frontend-control (Mobile controller)
├── Backend Services
│   ├── backend-graphql (Main API)
│   └── lti (LTI integration)
├── Infrastructure
│   └── redis (Bitnami chart dependency)
└── Cron Jobs
    ├── daily-group-scores
    ├── push-notifications-check
    ├── activity-publications
    ├── activity-endings
    ├── random-groups-creation
    └── timeline-updates
```

### Current Configuration Management
- **Secrets**: Managed through Helm values with Doppler integration
- **Environment Variables**: Template-based injection via Helmfile
- **Resource Allocation**: Environment-specific overrides
- **Ingress**: Multiple hosts per environment (UZH domains + bf-app.ch)

## Target Kustomize Architecture

### Directory Structure
```
deploy/kustomize/
├── base/                           # Common base configurations
│   ├── kustomization.yaml         # Base kustomization
│   ├── namespace.yaml             # Namespace definition
│   ├── priority-classes/          # Pod priority classes
│   │   ├── production-workload.yaml
│   │   └── staging-workload.yaml
│   ├── apps/                      # Application definitions
│   │   ├── auth/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── hpa.yaml
│   │   ├── frontend-pwa/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── hpa.yaml
│   │   ├── frontend-manage/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── hpa.yaml
│   │   ├── frontend-control/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── hpa.yaml
│   │   ├── backend-graphql/
│   │   │   ├── kustomization.yaml
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── hpa.yaml
│   │   └── lti/
│   │       ├── kustomization.yaml
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── ingress.yaml
│   │       └── hpa.yaml
│   ├── redis/                     # Redis StatefulSet
│   │   ├── kustomization.yaml
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   └── cron-jobs/                 # Cron job definitions
│       ├── kustomization.yaml
│       ├── daily-group-scores.yaml
│       ├── push-notifications.yaml
│       ├── activity-publications.yaml
│       ├── activity-endings.yaml
│       ├── random-groups-creation.yaml
│       └── timeline-updates.yaml
└── overlays/                      # Environment-specific overlays
    ├── qa/
    │   ├── kustomization.yaml     # QA overlay configuration
    │   ├── .env                   # QA environment variables
    │   ├── secrets.env            # QA secrets (git-ignored)
    │   └── patches/               # QA-specific patches
    │       ├── replica-counts.yaml
    │       ├── resources.yaml
    │       ├── ingress-hosts.yaml
    │       ├── priority-classes.yaml
    │       └── redis-config.yaml
    └── production/
        ├── kustomization.yaml     # Production overlay configuration
        ├── .env                   # Production environment variables
        ├── secrets.env            # Production secrets (git-ignored)
        └── patches/               # Production-specific patches
            ├── replica-counts.yaml
            ├── resources.yaml
            ├── ingress-hosts.yaml
            ├── priority-classes.yaml
            ├── redis-config.yaml
            └── autoscaling.yaml
```

### Kustomize Pattern Design

#### Base Layer
- **Pure Kubernetes YAML**: No templating, clean manifests
- **Sensible Defaults**: Conservative resource requests/limits
- **Common Labels**: Consistent labeling across all resources
- **Standard Ports**: 3000 for frontends, 4000 for LTI

#### Overlay Strategy
- **Environment-Specific**: QA and Production overlays
- **Strategic Merge Patches**: For environment differences
- **ConfigMap/Secret Generators**: From .env files
- **Image Tag Management**: Per-environment version control

#### Secret Management Strategy
- **Environment Files**: `.env` for non-sensitive config
- **Secret Files**: `secrets.env` for sensitive data (git-ignored)
- **Doppler Integration**: Runtime secret injection
- **Hash Suffixes**: Automatic rolling updates on secret changes

## Migration Phases

### Phase 1: Foundation Setup (Week 1)
**Goal**: Establish new directory structure and tooling

**Key Activities**:
- Create base directory structure
- Install/verify Kustomize tooling
- Set up development environment
- Create initial namespace and priority class definitions

**Deliverables**:
- Complete directory structure
- Kustomize CLI setup
- Base namespace.yaml and priority classes

### Phase 2: Base Manifest Conversion (Week 2)
**Goal**: Convert Helm templates to plain Kubernetes YAML

**Key Activities**:
- Extract and convert each Helm template
- Remove all Helm templating syntax
- Create base kustomization files for each service
- Establish common labeling strategy

**Deliverables**:
- Complete base/ directory with all services
- Working base kustomization.yaml
- Clean Kubernetes manifests without templating

### Phase 3: Environment Overlay Development (Week 3)
**Goal**: Create environment-specific configurations

**Key Activities**:
- Build QA and Production overlays
- Create strategic merge patches for differences
- Set up environment variable management
- Configure image tag replacement strategies

**Deliverables**:
- Working QA and Production overlays
- Environment-specific .env files
- Strategic merge patches for all differences

### Phase 4: Secret Management Implementation (Week 4)
**Goal**: Establish secure secret handling

**Key Activities**:
- Implement secretGenerator configuration
- Set up Doppler integration scripts
- Create secret rotation procedures
- Test secret injection mechanisms

**Deliverables**:
- Working secret management system
- Doppler integration scripts
- Secret rotation documentation

### Phase 5: Advanced Patching and Tuning (Week 5)
**Goal**: Fine-tune environment-specific configurations

**Key Activities**:
- Create detailed resource patches
- Implement autoscaling configurations
- Set up monitoring and alerting patches
- Optimize for production workloads

**Deliverables**:
- Production-ready resource configurations
- HPA configurations for scalable services
- Monitoring integration patches

### Phase 6: Redis and Dependencies Migration (Week 6)
**Goal**: Replace external chart dependencies

**Key Activities**:
- Convert Redis Bitnami chart to StatefulSet
- Create Redis configuration management
- Set up data persistence strategies
- Test Redis connectivity

**Deliverables**:
- Self-contained Redis deployment
- Redis configuration management
- Data persistence verification

### Phase 7: Testing and Validation (Week 7)
**Goal**: Comprehensive testing of new deployment system

**Key Activities**:
- Parallel deployment testing
- Configuration drift detection
- Performance comparison testing
- Security validation

**Deliverables**:
- Test results comparison
- Performance benchmarks
- Security compliance verification

### Phase 8: Production Migration (Week 8)
**Goal**: Execute production migration

**Key Activities**:
- Blue-green deployment execution
- Traffic switching procedures
- Rollback plan implementation
- Post-migration validation

**Deliverables**:
- Successful production migration
- Validated rollback procedures
- Post-migration health checks

### Phase 9: Modern Kubernetes Upgrade (Week 9)
**Goal**: Implement modern Kubernetes features

**Key Activities**:
- Update to modern API versions
- Implement advanced security contexts
- Add modern autoscaling features
- Optimize for newer Kubernetes versions

**Deliverables**:
- Modern API version compliance
- Enhanced security configurations
- Advanced autoscaling capabilities

### Phase 10: Documentation and Cleanup (Week 10)
**Goal**: Complete migration and document new processes

**Key Activities**:
- Create comprehensive documentation
- Update CI/CD pipelines
- Clean up legacy Helm configurations
- Train team on new deployment processes

**Deliverables**:
- Complete documentation set
- Updated CI/CD pipelines
- Team training materials

## Risk Assessment and Mitigation

### High-Risk Areas
1. **Service Downtime During Migration**
   - *Mitigation*: Blue-green deployment strategy
   - *Contingency*: Immediate rollback procedures

2. **Secret Management Transition**
   - *Mitigation*: Parallel secret systems during transition
   - *Contingency*: Manual secret injection capabilities

3. **Configuration Drift**
   - *Mitigation*: Comprehensive testing in parallel environments
   - *Contingency*: Configuration comparison tools

### Medium-Risk Areas
1. **Redis Data Migration**
   - *Mitigation*: Redis cluster setup with replication
   - *Contingency*: External Redis service fallback

2. **Ingress Configuration Changes**
   - *Mitigation*: DNS failover preparation
   - *Contingency*: Legacy ingress controller availability

### Low-Risk Areas
1. **Development Workflow Changes**
   - *Mitigation*: Comprehensive documentation and training
   - *Contingency*: Legacy development environment availability

## Success Metrics

### Technical Metrics
- **Deployment Time**: Reduce deployment time by 30%
- **Configuration Errors**: Reduce by 50% through declarative configs
- **Secret Rotation Time**: Improve by 40% with native env var support
- **Resource Efficiency**: Maintain current resource utilization

### Operational Metrics
- **MTTR (Mean Time to Recovery)**: Improve by 25%
- **Deployment Frequency**: Enable faster release cycles
- **Configuration Drift**: Eliminate through declarative management
- **Team Velocity**: Reduce configuration management overhead

### Compliance Metrics
- **Kubernetes Version Support**: Enable rapid K8s version upgrades
- **Security Posture**: Improve through modern security contexts
- **Audit Trail**: Enhance through Git-based configuration management

## Implementation Status

### Current Phase: Planning Complete ✅
- [x] Architecture analysis
- [x] Migration strategy design
- [x] Risk assessment
- [x] Timeline establishment

### Next Phase: Foundation Setup
- [ ] Directory structure creation
- [ ] Tooling setup
- [ ] Initial base configurations

## Dependencies and Prerequisites

### Technical Dependencies
- Kubernetes cluster access (1.22+)
- kubectl with Kustomize support (1.14+)
- Doppler CLI for secret management
- Git repository access for configuration storage

### Team Dependencies
- DevOps engineer availability (primary)
- Backend developer for application configuration review
- Infrastructure engineer for cluster preparation

### External Dependencies
- Kubernetes cluster upgrade timeline
- DNS management for ingress changes
- Certificate management for TLS

## Communication Plan

### Stakeholders
- **Primary**: DevOps team, Backend developers
- **Secondary**: Frontend team, QA team
- **Tertiary**: Product team, End users

### Communication Schedule
- **Weekly**: Progress updates to development team
- **Bi-weekly**: Status reports to management
- **Pre-migration**: Detailed communication to all teams
- **Post-migration**: Success metrics and lessons learned

## Rollback Strategy

### Immediate Rollback (< 15 minutes)
- DNS switch back to Helm-managed ingresses
- Service mesh traffic routing to old deployments
- Manual secret restoration if needed

### Full Rollback (< 1 hour)
- Complete Helm deployment restoration
- Database connection string updates
- Application restart with original configurations

### Partial Rollback (Service-specific)
- Individual service rollback capability
- Mixed Helm/Kustomize deployment support
- Gradual migration approach if needed

This planning document serves as the foundation for the KlickerUZH Helm to Kustomize migration project and will be updated throughout the implementation phases.