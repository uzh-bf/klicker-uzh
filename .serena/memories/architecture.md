# Architecture

## System Overview

KlickerUZH is a microservices-based educational platform built as a Turborepo monorepo.

**Core principle:** GraphQL-first API with type-safe end-to-end data flow (database → GraphQL → frontend).

## Monorepo Structure

### Applications (14 apps in `/apps`)

**Student-facing:**
- `frontend-pwa` - Progressive Web App for students (installable, push notifications)
- Runs on port 3001

**Lecturer-facing:**
- `frontend-manage` - Course and content management interface
- Runs on port 3002
- `frontend-control` - Mobile controller for live quizzes
- Runs on port 3003

**Authentication:**
- `auth` - Centralized auth service (NextAuth + Edu-ID OAuth)
- Runs on port 3010

**Backend services:**
- `backend-docker` - Main GraphQL API (Express + GraphQL Yoga)
- Runs on port 3000
- `response-api` - High-throughput response handler
- Queues responses to Hatchet workers
- `chat` - AI-powered chat (Azure AI + MCP)
- Runs on port 3004

**Workers:**
- `hatchet-worker-response-processor` - Processes quiz responses
- `hatchet-worker-general` - General background tasks

**Integration:**
- `lti` - LTI 1.3 for LMS integration (Moodle, OpenOLAT)
- `olat-api` - REST API for OpenOLAT
- `analytics` - Analytics processing (Python)
- `docs` - Docusaurus documentation site + main landing page (www.klicker.uzh.ch)

### Packages (13 packages in `/packages`)

**Data & Business Logic:**
- `prisma` - Database schema + migrations + ORM client
- `graphql` - GraphQL schema + resolvers + all business logic
- `grading` - Scoring algorithms and XP calculations

**UI & Utilities:**
- `shared-components` - React components shared across frontends
- `i18n` - Internationalization messages (English, German)
- `markdown` - Markdown rendering component
- `types` - Shared TypeScript type definitions
- `util` - Common utility functions
- `transactional` - Transactional email logic

**Infrastructure:**
- `hatchet` - Workflow orchestration configuration
- `next-config` - Shared Next.js configuration
- `prisma-data` - Database seeding utilities

## Key Architectural Decisions

### Why GraphQL?

**Decision:** Single GraphQL API instead of REST
**Rationale:**
- Type-safe schema with Pothos generates TypeScript types
- Single endpoint simplifies client-server communication
- Real-time subscriptions for live quizzes
- Efficient data fetching (no over/under-fetching)

### Why Pothos (Code-First GraphQL)?

**Decision:** Pothos over schema-first or GraphQL SDL
**Rationale:**
- TypeScript-first approach with full type inference
- Prisma integration for automatic model-to-GraphQL mapping
- Plugins for auth, validation, directives
- No code generation lag (types are source of truth)

### Why Hatchet?

**Decision:** Replaced Azure Service Bus with Hatchet
**Rationale:**
- Better workflow orchestration for complex tasks
- Built-in retry and failure handling
- Easy local development (hatchet-lite)
- Visual workflow monitoring
- Open-source, self-hostable

### Why Monorepo?

**Decision:** Turborepo monorepo vs separate repos
**Rationale:**
- Shared code reuse across 14 apps
- Coordinated releases and versioning
- Single source of truth for dependencies
- Faster builds with Turbo caching
- Consistent quality standards

### Why Next.js?

**Decision:** Next.js for all frontends
**Rationale:**
- Full-stack framework (API routes + frontend)
- Server-side rendering for better SEO and performance
- Pages Router (primary), App Router (chat app only)
- Built-in optimizations (images, fonts, code splitting)
- Excellent TypeScript support

### Why Three Redis Instances?

**Decision:** Separate Redis for exec, cache, assessment
**Rationale:**
- Isolation prevents one use case from affecting others
- Different persistence and eviction policies
- redis-exec (6379): Live quiz state (ephemeral)
- redis-cache (6380): Response caching (LRU eviction)
- redis-assessment (6381): Assessment mode (persistent)

## Service Communication

### Frontend ↔ Backend

**Protocol:** GraphQL over HTTP/HTTPS
- Queries/Mutations: HTTP POST with JSON
- Subscriptions: WebSocket (graphql-ws protocol)
- Authentication: Cookie-based sessions + JWT
- Client: Apollo Client with normalized cache

### Backend ↔ Database

**Protocol:** PostgreSQL wire protocol via Prisma
- Connection pooling with `@prisma/adapter-pg`
- Type-safe queries generated from schema
- Transactions for complex operations

### Backend ↔ Redis

**Client:** ioredis
**Use cases:**
- Session state for live quizzes
- Response caching
- Rate limiting
- Pub/sub for real-time events

### Response Processing Flow (High Load)

1. Student submits response → `response-api` receives POST
2. `response-api` → Queues task to Hatchet
3. Hatchet dispatches → `hatchet-worker-response-processor`
4. Worker processes:
   - Calculates score using `@klicker-uzh/grading`
   - Updates database via Prisma
   - Updates Redis cache
   - Publishes event to Redis pub/sub
5. GraphQL subscription → Pushes update to connected clients via WebSocket

**Why this flow:**
- Decouples high-throughput writes from database
- Async processing prevents blocking user responses
- Hatchet handles retries and failures
- Redis pub/sub enables real-time updates to all connected clients

## Data Flow

### Read Path (Query)

1. Frontend → Apollo Client → GraphQL query
2. GraphQL API → Check Redis cache
3. If miss → Prisma query → PostgreSQL
4. Transform via GraphQL resolvers
5. Apollo Client cache → Component render

### Write Path (Mutation)

1. Frontend → Apollo Client → GraphQL mutation
2. GraphQL API → Permission check
3. Prisma mutation → PostgreSQL
4. Invalidate Redis cache
5. Publish event to Redis (if real-time update needed)
6. Return result → Apollo Client optimistic update

### Real-Time Path (Subscription)

1. Frontend → Apollo Client → WebSocket connection
2. GraphQL API → Subscribe to Redis pub/sub channel
3. Event published → Redis pub/sub
4. GraphQL API → Push to WebSocket
5. Apollo Client cache update → Component re-render

## Database Design

**Technology:** PostgreSQL + Prisma ORM

**Schema organization:**
- Modular: Split across 12 domain files
- datasource.prisma - Connection config
- user.prisma - Authentication and accounts
- course.prisma - Course management
- quiz.prisma - Quiz types (Live, Practice, Micro)
- element.prisma - Question elements
- response.prisma - Student responses
- gamification.prisma - Points, achievements, leaderboards
- participant.prisma - Student accounts
- analytics.prisma - Analytics data
- chat.prisma - AI chat messages
- Other domain files

**Patterns:**
- UUID primary keys
- Soft deletes with `isDeleted` flag
- Timestamps on all tables (`createdAt`, `updatedAt`)
- Indexes on frequently queried fields
- Cascading deletes for referential integrity

## Workflow Orchestration

**Hatchet workflows handle:**
- Response processing (scoring, XP, cache updates)
- Scheduled publications (microlearning, practice quizzes)
- Group assignments (random distribution)
- Aggregations (quiz results, analytics)
- Push notifications
- Teams webhook notifications

**Local:** hatchet-lite (single container, localhost:8888)
**Production:** Full Hatchet platform on Kubernetes

## Authentication Architecture

**Multi-method auth:**

1. **Edu-ID** (lecturers) - Swiss academic OAuth
2. **Magic Link** (students) - Passwordless email
3. **LTI** (students) - LMS integration
4. **Traditional** (both) - Username/password with bcrypt
5. **Temporary** (guests) - Session-only tokens

**Auth flow:**
- NextAuth handles OAuth flows
- Sessions stored in PostgreSQL
- JWT tokens in HTTP-only cookies
- GraphQL context receives authenticated user

## Deployment Architecture

**Containerization:**
- Docker for all services
- Multi-stage builds for optimization
- GitHub Container Registry (ghcr.io)

**Orchestration:**
- Kubernetes with Helm charts
- Namespaces per environment (dev, qa, prod)
- Horizontal pod autoscaling
- Rolling updates for zero-downtime

**Environments:**
- **Development:** Local with Docker Compose
- **QA:** Kubernetes cluster (staging)
- **Production:** Kubernetes cluster (live)

## Scalability Considerations

**Horizontal scaling:**
- All services are stateless (except databases)
- Load balancer distributes traffic
- Redis handles session persistence
- Database connection pooling

**Performance:**
- Redis caching reduces database load
- GraphQL persisted queries reduce bandwidth
- Next.js image optimization
- CDN for static assets

**Bottlenecks:**
- PostgreSQL (scale with read replicas)
- Redis (scale with Redis Cluster)
- GraphQL API (scale horizontally)

## Security Architecture

**Network security:**
- HTTPS/TLS for all connections
- CORS configured per environment
- Cookie security flags (HttpOnly, Secure, SameSite)

**Authentication:**
- Multi-factor authentication via Edu-ID
- Bcrypt password hashing
- JWT with expiration
- Session rotation

**Authorization:**
- Role-based (PARTICIPANT, USER, ADMIN)
- Scope-based (OWNER, ADMIN, EXECUTE, WRITE, READ)
- Resource-level permissions
- GraphQL resolver-level checks

**Input validation:**
- Zod schemas at GraphQL layer
- SQL injection prevention via Prisma
- XSS prevention via React (automatic escaping)
- CSRF tokens

## Monitoring & Observability

**Application monitoring:**
- Sentry for error tracking
- OpenTelemetry for tracing
- Logs aggregated to central system

**Infrastructure monitoring:**
- Kubernetes metrics
- Database query performance
- Redis memory usage
- API response times

**Business metrics:**
- Active sessions
- Response rates
- Quiz completions
- User engagement

## Future Considerations

**Planned improvements:**
- GraphQL federation for service autonomy
- Event sourcing for audit trails
- CQRS for read/write separation
- Multi-region deployment
- Advanced caching strategies
