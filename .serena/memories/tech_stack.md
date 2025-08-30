# Technology Stack

## Frontend Technologies

- **Framework**: Next.js 15 with React 18
- **Language**: TypeScript with strict mode
- **Styling**: TailwindCSS with tailwind-merge
- **State Management**: Apollo Client for GraphQL
- **Forms**: Formik with Yup validation
- **Data Visualization**: Recharts
- **Internationalization**: next-intl
- **Rich Text Editing**: Slate.js
- **Component Library**: @uzh-bf/design-system
- **Testing**: Cypress for E2E, Jest for unit tests
- **Development**: Hot reload with Next.js dev server

## Backend Technologies

- **Runtime**: Node.js 20
- **API**: GraphQL with Pothos GraphQL schema builder
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (dual instances - execution & cache)
- **Queue**: Azure Service Bus for message queuing
- **Authentication**: JWT with Edu-ID integration
- **Real-time**: GraphQL subscriptions with WebSockets
- **File Storage**: Azure Blob Storage
- **Email**: Transactional email templates

## Serverless & Cloud Functions

- **Azure Functions**: Response processing services
  - func-incoming-responses: Real-time response handling
  - func-response-processor: Asynchronous response processing
- **Triggers**: HTTP triggers, Service Bus triggers
- **Runtime**: Node.js runtime in Azure Functions
- **Scaling**: Event-driven autoscaling

## Database & Data Management

- **Primary Database**: PostgreSQL 15
- **ORM**: Prisma with type-safe database access
- **Migrations**: Prisma migrate with version control
- **Schema Organization**: Multi-file schema organization by domain
- **Seeding**: Comprehensive test data seeding
- **Analytics**: Separate analytics models and queries

## Caching & Performance

- **Application Cache**: Redis for query caching and rate limiting
- **Execution Cache**: Dedicated Redis for live quiz execution
- **CDN**: Azure CDN for static assets
- **Build Caching**: Turbo build cache
- **Container Caching**: Docker layer caching in CI/CD

## Development Tools

### Package Management

- **Package Manager**: pnpm with workspaces
- **Monorepo**: Organized as monorepo with shared packages
- **Build Tool**: Turbo for monorepo builds and caching
- **Dependency Management**: Shared dependencies via workspace

### Code Quality & Testing

- **Linting**: ESLint with Next.js configuration
- **Formatting**: Prettier with organize-imports plugin
- **Type Checking**: TypeScript in strict mode across all packages
- **Git Hooks**: Husky with lint-staged for pre-commit checks
- **Testing Frameworks**:
  - Cypress: E2E testing with real browser automation
  - Jest: Unit testing for business logic
  - Vitest: Fast unit testing for some packages
  - Testing Library: React component testing utilities

### Environment & Configuration

- **Environment Management**: Doppler for centralized secret management
- **Configuration**: Environment-specific .env files
- **Secrets**: Doppler integration with automatic secret injection
- **Local Setup**: Automated development environment preparation

## Local Development Infrastructure

### Reverse Proxy & Routing

- **Reverse Proxy**: Traefik with dynamic service discovery
- **Custom Domains**: \*.klicker.com (api, pwa, manage, control, auth)
- **SSL/TLS**: mkcert for trusted local HTTPS certificates
- **Platform Support**: Separate configurations for macOS, WSL, Docker

### Development Services

- **Container Orchestration**: Docker Compose with service definitions
- **Database**: PostgreSQL 15 container with persistent volumes
- **Cache Layer**: Dual Redis instances (execution + caching)
- **Email Testing**: MailHog for SMTP testing
- **Service Discovery**: Automatic Traefik service registration

### Local Development Tools

- **Setup Scripts**: Platform-aware setup automation
- **Database Management**: Automated backup/restore functionality
- **Schema Synchronization**: Cross-package schema sync utilities
- **Live Reload**: Hot reload for all frontend applications

## CI/CD & Deployment

### GitHub Actions

- **Quality Checks**: Automated linting, formatting, type checking
- **Testing**: Cypress E2E tests with PostgreSQL + Redis services
- **Security**: CodeQL analysis and SonarCloud integration
- **Code Review**: AI-assisted code review with Claude
- **Release Management**: Automated versioning and releases

### Container Registry & Images

- **Registry**: GitHub Container Registry (ghcr.io)
- **Multi-Architecture**: Support for different CPU architectures
- **Optimization**: Multi-stage builds with layer caching
- **Tagging**: Environment-specific image tags (v3, qa, latest)

### Kubernetes Orchestration

- **Container Orchestration**: Kubernetes with custom configurations
- **Package Management**: Helm charts for application deployment
- **Environment Management**: Separate configurations for qa/prod
- **Service Discovery**: Kubernetes native service discovery
- **Load Balancing**: Kubernetes ingress controllers

### Deployment Infrastructure

- **Cluster Management**: Kubernetes cluster with namespace isolation
- **Scaling**: Horizontal Pod Autoscaling (HPA) based on metrics
- **Priority Management**: Pod priority classes for critical workloads
- **Scheduled Tasks**: CronJobs for maintenance and processing
- **Configuration**: ConfigMaps and Secrets for environment management

## Infrastructure & DevOps

### Orchestration Tools

- **Helm**: Kubernetes package manager with templated deployments
- **Helmfile**: Environment-specific Helm deployment orchestration
- **Docker**: Containerization for all services and dependencies
- **Docker Compose**: Local development service orchestration

### Monitoring & Observability

- **Health Checks**: Application health endpoints
- **Resource Monitoring**: Kubernetes resource monitoring
- **Performance Metrics**: Application performance tracking
- **Error Tracking**: Comprehensive error logging and alerting

### Security Infrastructure

- **Secret Management**: Doppler centralized secret storage
- **Access Control**: Kubernetes RBAC and network policies
- **Certificate Management**: Automated SSL/TLS certificate management
- **Security Scanning**: Automated vulnerability scanning in CI/CD

## Integration Technologies

### Authentication Systems

- **Edu-ID**: Swiss educational identity federation
- **LTI**: Learning Tools Interoperability for LMS integration
- **Magic Links**: Passwordless authentication via email
- **SAML/OpenID**: Standards-based authentication protocols

### External Integrations

- **OLAT**: Learning Management System integration
- **Teams**: Microsoft Teams webhook notifications
- **Push Notifications**: Web push notifications with VAPID
- **Email Services**: SMTP integration for notifications

## Platform & Runtime

### Production Runtime

- **Container Runtime**: Docker containers in Kubernetes
- **Node.js**: LTS version with performance optimizations
- **Process Management**: Container-managed process lifecycle
- **Resource Management**: Kubernetes resource quotas and limits

### Development Runtime

- **Local Development**: Node.js with development tools
- **Hot Reload**: Live reloading for rapid development
- **Debug Support**: Source maps and debugging tools
- **Performance Tools**: Profiling and monitoring in development

## Version Control & Release

### Git Workflow

- **Branching**: GitFlow with v3 as main production branch
- **Quality Gates**: Automated checks before merge
- **Release Management**: Automated changelog generation
- **Tagging**: Semantic versioning with git tags

### Deployment Pipeline

- **Continuous Integration**: Automated testing and quality checks
- **Continuous Deployment**: Automated deployment to environments
- **Environment Promotion**: QA → Production deployment workflow
- **Rollback Strategy**: Container-based rollback capabilities

## Performance & Scaling

### Application Performance

- **Build Optimization**: Turbo build caching and parallelization
- **Bundle Optimization**: Next.js automatic code splitting
- **Query Optimization**: GraphQL query batching and caching
- **CDN**: Content delivery network for static assets

### Infrastructure Scaling

- **Auto-Scaling**: Kubernetes HPA for demand-based scaling
- **Load Distribution**: Multi-pod deployment with load balancing
- **Resource Efficiency**: Container resource optimization
- **Cache Strategy**: Multi-layer caching for performance

## Analytics & Reporting

### Data Processing

- **Analytics Models**: Dedicated database models for analytics
- **Reporting**: Business intelligence and usage analytics
- **Performance Tracking**: Application and infrastructure metrics
- **User Analytics**: Learning progress and engagement metrics

This comprehensive technology stack provides a robust, scalable, and maintainable platform for educational technology delivery.
