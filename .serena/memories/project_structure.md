# Project Structure

## Root Directory Organization

```
klicker-uzh/
├── apps/                    # Application packages
│   ├── frontend-pwa/       # Student-facing web app
│   ├── frontend-manage/    # Lecturer administration interface
│   ├── frontend-control/   # Mobile controller for live quizzes
│   ├── auth/              # Authentication service
│   ├── backend-docker/    # Main GraphQL backend
│   ├── func-incoming-responses/  # Azure function for responses
│   ├── func-response-processor/  # Response processing service
│   ├── olat-api/          # LMS integration API
│   ├── analytics/         # Analytics service
│   ├── lti/              # LTI integration
│   ├── docs/             # Documentation website
│   └── office-addin/     # PowerPoint integration
├── packages/              # Shared packages
│   ├── prisma/           # Database schema & migrations
│   ├── graphql/          # GraphQL schema & business logic
│   ├── grading/          # Scoring logic
│   ├── types/            # TypeScript type definitions
│   ├── util/             # Utility functions
│   ├── i18n/             # Internationalization
│   ├── shared-components/ # Shared React components
│   ├── markdown/         # Markdown renderer
│   ├── transactional/    # Email templates
│   └── next-config/      # Shared Next.js config
├── cypress/              # E2E tests
├── deploy/               # Kubernetes/Helm deployment
├── util/                 # Utility scripts
├── bruno/                # API testing collections
└── email/                # Email templates
```

## Key Configuration Files

- package.json # Root package with scripts
- pnpm-workspace.yaml # Workspace configuration
- turbo.json # Turbo build configuration
- doppler.yaml # Environment management
- docker-compose.yml # Local development services
- .prettierrc.mjs # Code formatting
- .lintstagedrc.mjs # Pre-commit hooks
- CLAUDE.md # AI assistance guidelines

## Frontend App Structure (e.g., frontend-manage)

```
apps/frontend-manage/
├── src/
│ ├── components/ # React components by feature
│ │ ├── activities/ # Activity management
│ │ ├── analytics/ # Analytics components
│ │ ├── courses/ # Course management
│ │ ├── evaluation/ # Evaluation components
│ │ ├── questions/ # Question management
│ │ └── sharing/ # Permissions & activity logs
│ ├── pages/ # Next.js pages (routes)
│ ├── lib/ # Utilities and hooks
│ │ ├── hooks/ # Custom React hooks
│ │ └── utils/ # Helper functions
│ └── types/ # TypeScript definitions
├── public/ # Static assets
└── package.json # Package dependencies
```

## Package Structure (e.g., graphql)

```
packages/graphql/
├── src/
│   ├── schema/         # GraphQL type definitions
│   ├── services/       # Business logic services
│   │   ├── accounts.ts
│   │   ├── activities.ts
│   │   ├── courses.ts
│   │   └── ...
│   ├── graphql/
│   │   └── ops/       # GraphQL operations
│   └── lib/           # Utilities
└── package.json
```

## Database Schema Organization

```
packages/prisma/src/prisma/schema/
├── datasource.prisma # DB connection config
├── js.prisma # Prisma client config
├── user.prisma # User & auth models
├── participant.prisma # Student models
├── element.prisma # Question/content models
├── quiz.prisma # Activity models
├── course.prisma # Course models
├── sharing.prisma # Permissions & access
├── response.prisma # Response tracking
├── resources.prisma # Resource models
├── gamification.prisma # Leaderboards & achievements
├── other.prisma # Other models
└── analytics.prisma # Analytics models
```

## Testing Structure

- Unit tests: Co-located in **tests** folders
- E2E tests: cypress/cypress/e2e/
- Test data: packages/prisma/src/data/

## Build Outputs

- Next.js apps: .next/ directories
- Backend: dist/ directories
- Turbo cache: .turbo/
