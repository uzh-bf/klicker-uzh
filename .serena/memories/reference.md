# Reference Documentation

## Authentication Methods

**Five authentication types:**

1. **Edu-ID** (Swiss academic SSO)
   - OAuth 2.0 flow with Swiss universities federation
   - Production-only (requires institutional credentials)
   - Primary method for academic users

2. **Magic Link** (passwordless email)
   - Email-based one-time login links
   - Time-limited tokens (15 minutes)
   - Stateless implementation via JWT

3. **LTI** (Learning Tool Interoperability)
   - LMS integration (Moodle, Canvas, etc.)
   - OAuth 1.0a signature validation
   - Automatic account provisioning
   - Session tied to LMS context

4. **Traditional** (email + password)
   - Bcrypt password hashing
   - Available in development/testing
   - Fallback for non-academic users

5. **Temporary** (anonymous participation)
   - No registration required
   - Limited feature access
   - Session-only persistence

## Permission System

### User Roles
- **PARTICIPANT**: Student accounts, limited to learning activities
- **USER**: Lecturer accounts, course management capabilities
- **ADMIN**: System administrators, full platform access

### Permission Levels
Hierarchical from least to most privileged:
- **READ** < **WRITE** < **EXECUTE** < **ADMIN** < **OWNER**

**Permission inheritance:**
- Higher levels include all lower level permissions
- Checks enforce minimum required level
- Per-resource permission assignment

### Account Scopes
- **ACCOUNT_OWNER**: Owns the account (self)
- **FULL_ACCESS**: Complete resource access
- **SESSION_EXEC**: Can execute live sessions
- **READ_ONLY**: View-only access

**GraphQL resolver pattern:**
1. Verify user authentication
2. Check permission level for resource
3. Execute business logic if authorized

## Database Architecture

### Prisma Schema Organization

**Modular schema files:**
- `packages/prisma/src/prisma/*.prisma`
- Organized by domain: `user.prisma`, `course.prisma`, `element.prisma`, etc.
- Synchronized across packages via `./util/sync-schema.sh`

**Schema patterns:**
- UUID primary keys (`@db.Uuid`)
- Soft deletes (`isDeleted Boolean @default(false)`)
- Audit timestamps (`createdAt`, `updatedAt`)
- Cascading deletes for referential integrity
- Indexes on frequently queried fields

**Multiple database instances:**
- Primary PostgreSQL for transactional data
- Read replicas for analytics queries (production)
- Test database for E2E tests
- Shadow database for migration validation

## Redis Architecture

### Three Redis Instances

**1. redis-exec** (port 6379)
- Live session state
- Real-time quiz data
- WebSocket connection tracking
- High throughput, short TTL

**2. redis-cache** (port 6380)
- GraphQL query results
- Computed aggregations
- Session metadata
- Longer TTL, reduces database load

**3. redis-assessment** (port 6381)
- Assessment workflow state
- Student progress tracking
- Grading queue management
- Persistent until assessment completion

**Pub/Sub channels:**
- Live quiz events
- Feedback notifications
- Activity completion signals
- Multi-instance coordination

## Workflow Orchestration (Hatchet)

### Why Hatchet

**Replaced Azure Service Bus because:**
- Self-hosted (no vendor lock-in)
- Built-in retries and error handling
- Visual workflow debugging UI
- TypeScript SDK with type safety

### Worker Types

**1. hatchet-worker-general**
- Course operations (clone, archive)
- Bulk data processing
- Scheduled tasks
- Email dispatch

**2. hatchet-worker-response-processor**
- Quiz response scoring
- Real-time leaderboard updates
- Experience point calculations
- High-throughput parallel processing

**Workflow patterns:**
- Durable execution (survives restarts)
- Automatic retries with exponential backoff
- Dead letter queue for failed jobs
- Workflow history for debugging

**Local development:**
- Hatchet server + engine via Docker Compose
- UI at http://localhost:8888
- Token from logs: `docker-compose logs hatchet-server | grep HATCHET_CLIENT_TOKEN`

## Deployment Architecture

### Containerization

**Docker images:**
- Multi-stage builds for size optimization
- Separate images per application
- Base image: Node 20 Alpine
- Build cache layers for dependencies

**Production images:**
- frontend-pwa (student app)
- frontend-manage (lecturer app)
- frontend-control (session control)
- backend-docker (GraphQL API)
- response-api (quiz submission handler)
- hatchet workers (background jobs)

### Kubernetes Orchestration

**Helm charts:**
- Environment-specific values (dev, staging, prod)
- Secrets management via external secrets operator
- Horizontal Pod Autoscaling for API and workers
- Resource limits and requests defined

**Deployment environments:**
- **Development**: Single namespace, minimal replicas
- **Staging**: Production-like, isolated database
- **Production**: Multi-region, high availability

**Service mesh:**
- Ingress controller for HTTPS termination
- Internal service-to-service communication
- Health checks and readiness probes
- Circuit breakers for external dependencies

## CI/CD Pipelines

### Quality Gates (GitHub Actions)

**On pull request:**
1. Format check (`pnpm format:check`)
2. Lint (`pnpm lint`)
3. Type check (`pnpm check`)
4. Unit tests (`pnpm test:run`)
5. Build validation (`pnpm build`)
6. E2E tests (Cypress headless)

**Security scanning:**
- Dependency vulnerability checks (npm audit)
- Container image scanning (Trivy)
- Secret detection (GitGuardian)

### Deployment Pipeline

**Automated deployments:**
- **v3 branch** → Staging environment (auto-deploy)
- **main branch** → Production (manual approval)
- **Release tags** → Production (semantic versioning)

**Deployment steps:**
1. Build Docker images
2. Push to container registry
3. Update Helm values
4. Apply Kubernetes manifests
5. Run database migrations
6. Verify health checks
7. Smoke tests post-deployment

## Chat Application (AI Integration)

### Architecture

**AI Backend:**
- Azure OpenAI Service integration
- Streaming responses via Server-Sent Events
- Context management with conversation history
- Rate limiting per user

**MCP (Model Context Protocol):**
- Standardized AI tool integration
- File system access tools
- Code analysis capabilities
- Extensible tool registry

**Data flow:**
1. User message → GraphQL mutation
2. Backend → Azure OpenAI API
3. Streaming response → Redis pub/sub
4. GraphQL subscription → Client updates

**Features:**
- Course-specific knowledge bases
- Document upload and indexing
- Citation tracking for answers
- Conversation persistence

## Test Data

### Default Accounts

**Lecturer:**
- Email: `lecturer@test.com`
- Password: `abcd1234`
- Pre-configured courses and elements

**Students:**
- Emails: `participant1@test.com` through `participant50@test.com`
- Password: `abcd1234` (all)
- Enrolled in test courses

**Seeding:**
- `pnpm prisma:setup` creates all test data
- Predictable UUIDs for E2E test assertions
- Realistic data volumes (50 students, 10 courses, 100+ questions)

## Environment Variables

### Critical Variables

**Database:**
- `DATABASE_URL`: PostgreSQL connection string
- `SHADOW_DATABASE_URL`: Migration validation database

**Redis:**
- `REDIS_HOST`, `REDIS_PORT`: Main instance
- `REDIS_CACHE_HOST`, `REDIS_CACHE_PORT`: Cache instance
- `REDIS_ASSESSMENT_HOST`, `REDIS_ASSESSMENT_PORT`: Assessment instance

**Application:**
- `APP_SECRET`: Session encryption (32+ char random string)
- `API_DOMAIN`: For CORS configuration
- `COOKIE_DOMAIN`: Cookie scope
- `APP_ORIGIN_*`: Allowed origins for frontend apps

**Hatchet:**
- `HATCHET_CLIENT_TOKEN`: From server logs
- `HATCHET_CLIENT_HOST_PORT`: localhost:7077 (local)
- `HATCHET_CLIENT_TLS_STRATEGY`: none (local), tls (production)

**Optional (disable features if not set):**
- `BLOB_STORAGE_*`: File uploads (Azure)
- `AZURE_API_KEY`: AI chat
- `EDUID_CLIENT_SECRET`: Edu-ID OAuth
- `EMAIL_*`: SMTP configuration
- `VAPID_*`: Web push notifications

### Configuration Sources

**Local development:**
- `.env` files per application
- Example files: `.env.example`

**Production:**
- Doppler CLI (core team)
- Kubernetes secrets (deployment)
- Environment-specific configurations
