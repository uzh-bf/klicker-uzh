# Project Structure

## Root Directory Organization

```
klicker-uzh/
├── .github/               # CI/CD workflows and automation
├── apps/                  # Application packages
│   ├── frontend-pwa/     # Student-facing web app
│   ├── frontend-manage/  # Lecturer administration interface
│   ├── frontend-control/ # Mobile controller for live quizzes
│   ├── auth/             # Authentication service
│   ├── backend-docker/   # Main GraphQL backend
│   ├── func-*/           # Azure Functions
│   ├── olat-api/         # LMS integration API
│   ├── analytics/        # Analytics service
│   └── lti/              # LTI integration
├── packages/             # Shared packages
│   ├── prisma/          # Database schema & migrations
│   ├── graphql/         # GraphQL schema & business logic
│   ├── grading/         # Scoring logic
│   ├── types/           # TypeScript type definitions
│   ├── util/            # Utility functions
│   ├── i18n/            # Internationalization
│   ├── shared-components/ # Shared React components
│   └── markdown/        # Markdown renderer
├── cypress/             # E2E tests
├── deploy/              # Kubernetes/Helm deployment configs
├── util/                # Development utility scripts
└── bruno/               # API testing collections
```

## Key Configuration Files

- **package.json**: Root package with monorepo scripts
- **pnpm-workspace.yaml**: Workspace configuration
- **turbo.json**: Turbo build configuration
- **doppler.yaml**: Environment management
- **docker-compose.yml**: Local development services
- **.prettierrc.mjs**: Code formatting rules
- **CLAUDE.md**: AI assistance guidelines

## Frontend Application Structure

```
apps/frontend-*/
├── src/
│   ├── pages/       # Next.js pages (routes)
│   ├── components/  # React components organized by feature
│   ├── lib/         # Utilities and custom hooks
│   └── types/       # TypeScript definitions
├── public/          # Static assets
└── package.json     # Dependencies
```

## Shared Package Structure

```
packages/{package}/
├── src/             # Source code
├── __tests__/       # Unit tests (if applicable)
└── package.json     # Package dependencies
```

## Database Schema Organization

```
packages/prisma/src/prisma/schema/
├── datasource.prisma    # Database connection
├── user.prisma         # User & authentication
├── participant.prisma  # Student accounts
├── element.prisma      # Questions & content
├── quiz.prisma         # Activities
├── course.prisma       # Course management
├── sharing.prisma      # Permissions & access
└── *.prisma           # Other domain models
```

## GraphQL Structure

```
packages/graphql/src/
├── schema/          # GraphQL type definitions
├── services/        # Business logic implementation
├── graphql/ops/     # GraphQL operations (200+ files)
│   ├── Q*.graphql  # Queries
│   ├── M*.graphql  # Mutations
│   ├── S*.graphql  # Subscriptions
│   └── F*.graphql  # Fragments
└── lib/             # Utilities
```

## Deployment Structure

```
deploy/
├── charts/          # Helm charts for Kubernetes
├── env-prod-v3/     # Production environment config
├── env-qa-v3/       # QA environment config
└── doppler.yaml     # Secret management
```

## Testing Structure

- **Unit tests**: Co-located `__tests__/` folders
- **E2E tests**: `cypress/` directory
- **Test data**: Prisma seed files

## Local Development

```
util/
├── traefik/         # Local reverse proxy configuration
├── _prepare_local_prod.sh # Environment setup script
└── sync-schema.sh   # Schema synchronization
```

## Build Outputs

- **Next.js apps**: `.next/` directories
- **Backend services**: `dist/` directories
- **Turbo cache**: `.turbo/` (build cache)
- **Docker images**: Built to GitHub Container Registry
