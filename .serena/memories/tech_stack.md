# Technology Stack

## Frontend Technologies

- **Framework**: Next.js with React
- **Language**: TypeScript with strict mode
- **Styling**: TailwindCSS with design system integration
- **State Management**: Apollo Client for GraphQL state
- **Forms**: Formik with Yup validation
- **Data Visualization**: Recharts for analytics
- **Internationalization**: next-intl for multi-language support
- **Rich Text**: Slate.js for content editing
- **Component Library**: @uzh-bf/design-system (custom)
- **Testing**: Cypress for E2E, Jest for unit tests

## Backend Technologies

- **Runtime**: Node.js LTS
- **API**: GraphQL with Pothos GraphQL schema builder
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (dual instances for execution and general caching)
- **Message Queue**: Azure Service Bus
- **Authentication**: JWT with educational identity integration
- **Real-time**: GraphQL subscriptions with WebSockets
- **File Storage**: Azure Blob Storage
- **Email**: Transactional email service integration

## Serverless & Cloud Functions

- **Platform**: Azure Functions for response processing
- **Triggers**: HTTP triggers and Service Bus message triggers
- **Scaling**: Event-driven autoscaling
- **Services**:
  - Real-time response handling
  - Asynchronous response processing and scoring

## Database & Data Management

- **Primary Database**: PostgreSQL (latest stable)
- **ORM**: Prisma with type-safe database access
- **Migrations**: Version-controlled schema migrations
- **Schema Design**: Multi-file organization by business domain
- **Test Data**: Comprehensive seeding system
- **Analytics**: Dedicated analytics models and aggregations

## Development Tools & Workflow

### Package Management & Build

- **Package Manager**: pnpm with workspace support
- **Monorepo**: Multi-package workspace architecture
- **Build System**: Turbo for monorepo builds and caching
- **Bundling**: Next.js built-in bundling and optimization

### Code Quality & Testing

- **Linting**: ESLint with framework-specific configurations
- **Formatting**: Prettier with import organization
- **Type Checking**: TypeScript strict mode across all packages
- **Git Hooks**: Husky with lint-staged for pre-commit validation
- **Testing Stack**:
  - Cypress: End-to-end testing with real browser automation
  - Jest: Unit testing for business logic and utilities
  - Testing Library: React component testing utilities

### Environment & Configuration

- **Secret Management**: Doppler for centralized configuration
- **Environment Configuration**: Multiple environment support
- **Local Development**: Custom domain setup with HTTPS
- **Container Support**: Docker Compose for service orchestration

## Local Development Infrastructure

### Reverse Proxy & Networking

- **Reverse Proxy**: Traefik with dynamic service discovery
- **Local Domains**: Custom domain setup (\*.klicker.com)
- **SSL/TLS**: mkcert for trusted local certificates
- **Platform Support**: macOS, WSL, and containerized environments

### Development Services

- **Database**: Containerized PostgreSQL with persistent storage
- **Cache**: Redis instances for different use cases
- **Email Testing**: Local SMTP service for development
- **Monitoring**: Service discovery and health checking

## CI/CD & Deployment

### Continuous Integration

- **Platform**: GitHub Actions
- **Quality Gates**: Automated linting, formatting, and type checking
- **Testing**: Comprehensive E2E testing with service dependencies
- **Security**: Static analysis and vulnerability scanning
- **Code Review**: AI-assisted code review integration

### Container & Deployment

- **Registry**: GitHub Container Registry
- **Orchestration**: Kubernetes with Helm charts
- **Environments**: Separate QA and production deployments
- **Scaling**: Horizontal Pod Autoscaling based on metrics
- **Configuration**: Environment-specific value management

## Integration & External Services

### Authentication Systems

- **Educational Identity**: Swiss Edu-ID federation integration
- **LTI**: Learning Tools Interoperability for LMS integration
- **Magic Links**: Email-based passwordless authentication

### Third-party Integrations

- **Learning Management Systems**: OLAT, Moodle, Canvas support
- **Communication**: Microsoft Teams webhook integration
- **Push Notifications**: Web push with VAPID keys
- **Email Services**: SMTP integration for notifications

## Architecture Patterns

### API Design

- **GraphQL-First**: All client-server communication via GraphQL
- **Type Safety**: End-to-end type safety from database to frontend
- **Real-time**: WebSocket subscriptions for live features
- **Caching**: Multi-layer caching strategy

### Data Architecture

- **Database-First**: Prisma schema as single source of truth
- **Event-Driven**: Message queues for async processing
- **Microservices**: Function-based services for specific concerns
- **Monorepo**: Shared code via internal packages

### Security & Performance

- **Authentication**: Multi-method authentication support
- **Authorization**: Role-based access control with permissions
- **Performance**: Build optimization and runtime performance tuning
- **Scalability**: Horizontal scaling and load distribution

For specific versions and detailed configuration, refer to package.json files and configuration files in the respective packages.
