# Deployment Infrastructure

## Overview

KlickerUZH uses a sophisticated deployment infrastructure with multiple environments and technologies:

- **Kubernetes** with Helm charts for orchestration
- **Docker** containers for all services
- **Azure Functions** for serverless components
- **Environment-specific configurations** for dev, qa, and production
- **Doppler** for secrets management

## Kubernetes Deployment

### Helm Charts

- **Location**: `deploy/charts/klicker-uzh-v2/`
- **Chart Structure**:
  - `Chart.yaml`: Chart metadata and dependencies
  - `templates/`: Kubernetes resource templates
  - `values.yaml`: Default configuration values

### Key Templates

- **Deployments**: `deployment-app.yaml` for main application
- **Services**: `service-app.yaml` for service discovery
- **Ingresses**: Multiple ingress files for different frontend apps
  - `ingress-backend-graphql.yaml`
  - `ingress-frontend-pwa.yaml`
  - `ingress-frontend-manage.yaml`
  - `ingress-frontend-control.yaml`
  - `ingress-auth.yaml`
  - `ingress-lti.yaml`
  - `ingress-olat-api.yaml`
- **ConfigMaps**: Environment-specific configurations
- **Secrets**: Secure credential management
- **HPA**: `hpa-app.yaml` for horizontal pod autoscaling
- **CronJobs**: Automated tasks
  - `cron-async-activity-publications.yaml`
  - `cron-final-random-groups-creation.yaml`
  - `cron-daily-timeline-updates.yaml`
  - `cron-daily-push-notifications-check.yaml`
  - `cron-running-random-groups-creation.yaml`
  - `cron-daily-group-scores.yaml`

### Environment Management

- **Production**: `deploy/env-prod-v3/`
- **QA**: `deploy/env-qa-v3/`

Each environment has:

- `values.yaml`: Environment-specific values
- `values-envsubst.yaml`: Template values with environment variable substitution
- `helmfile.yaml`: Helmfile configuration for deployment orchestration
- `doppler.yaml`: Doppler secrets configuration

## Docker Configuration

### Local Development

- **File**: `docker-compose.yml` at repository root
- **Services**:
  - `reverse_proxy_docker`: Traefik reverse proxy for containerized setup
  - `reverse_proxy_macos`: Traefik for macOS host networking
  - `reverse_proxy_wsl`: Traefik for WSL environments
  - `postgres`: PostgreSQL 15 database
  - `redis_exec`: Redis for live quiz execution
  - `redis_cache`: Redis for caching and rate limiting
  - `mailhog`: SMTP server for development

### Production Services

All applications have containerized versions:

- `auth`: Authentication service (ghcr.io/uzh-bf/klicker-uzh/auth:v3)
- `frontend_pwa`: Student frontend
- `frontend_manage`: Lecturer frontend
- `frontend_control`: Controller frontend
- `backend`: Main GraphQL backend

### Container Registry

- **Registry**: GitHub Container Registry (ghcr.io)
- **Organization**: uzh-bf/klicker-uzh
- **Tagging**: Version-based (v3, qa, prod variants)

## Environment Configuration

### Environment Files Structure

Only Next.js applications use environment files during Docker build:

```
apps/frontend-*/
├── .env.development
├── .env.test
├── .env.qa
└── .env.production
```

Other services (backend, functions) receive their configuration through:

- Kubernetes ConfigMaps
- Kubernetes Secrets
- Doppler secret injection
- Runtime environment variables

### Template Files

- `packages/graphql/.env.template`
- `apps/backend-docker/.env.template`
- `apps/backend-docker/.env.cypress` (for testing)

## Azure Functions

### Response Processing Services

- **func-responses**: Handles incoming student responses
- **func-response-processor**: Processes queued responses for scoring

### Configuration

- Separate Azure Function deployments
- Integration with main backend through message queues
- Scalable processing for high-volume quiz responses

## Secrets Management

### Doppler Integration

- **Configuration**: `deploy/doppler.yaml`
- **Per-environment**: Separate Doppler configs for qa/prod
- **Local Development**: `doppler run --config dev -- pnpm dev`

### Secret Types

- Database connection strings
- Redis authentication
- API keys and tokens
- Azure blob storage credentials
- VAPID keys for push notifications
- Webhook URLs

## Network Architecture

### Ingress Controllers

- **Traffic Routing**: Kubernetes ingress controllers route external traffic to services
- **Load Balancing**: Handled by Kubernetes services
- **Service Discovery**: Kubernetes native service discovery

### External Dependencies

- **PostgreSQL**: Managed database service
- **Redis**: Managed Redis instances (cache + exec)
- **Blob Storage**: Azure Blob Storage for file uploads
- **Email Services**: External SMTP for notifications

## Monitoring and Scaling

### Horizontal Pod Autoscaling

- **HPA Configuration**: `hpa-app.yaml`
- **Metrics**: CPU and memory-based scaling
- **Target**: Maintain performance under load

### Priority Classes

- **Production**: `priority-production.yaml`
- **Staging**: `priority-staging.yaml`
- **Resource Management**: Ensures critical workloads get priority

## Local Development Infrastructure

```
util/
├── traefik/           # Local reverse proxy
│   ├── Dockerfile     # Traefik container
│   ├── Dockerfile.wsl # WSL-specific build
│   ├── rules_docker.yaml # Docker routing rules
│   ├── rules_wsl.yaml    # WSL routing rules
│   └── ssl/          # mkcert certificates
├── _prepare_local_prod.sh # Local environment setup
├── _restore-db-dev.sh    # Database restore script
├── _restore-redis-dev.sh # Redis restore script
└── sync-schema.sh    # Schema synchronization
```

### Platform Detection

- **macOS**: Uses host networking with `host.docker.internal`
- **WSL**: Uses separate Docker configuration
- **Docker**: Full containerized setup

### Reverse Proxy Configuration

- **Traefik**: Used for local development routing
- **Rules**: `util/traefik/rules_docker.yaml` and `util/traefik/rules_wsl.yaml`
- **SSL**: Local HTTPS with mkcert certificates
- **Domains**: Custom local domains (\*.klicker.com)
