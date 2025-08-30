# Technology Stack

## Frontend Technologies

- **Framework**: Next.js 15 with React 19
- **Language**: TypeScript with strict mode
- **Styling**: TailwindCSS with tailwind-merge
- **State Management**: Apollo Client for GraphQL
- **Forms**: Formik with Yup validation
- **Data Visualization**: Recharts
- **Internationalization**: next-intl
- **Rich Text Editing**: Slate.js
- **Component Library**: @uzh-bf/design-system

## Backend Technologies

- **Runtime**: Node.js 20
- **API**: GraphQL with Pothos GraphQL schema builder
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Queue**: Azure Service Bus for message queuing
- **Authentication**: JWT with Edu-ID integration

## Development Tools

- **Package Manager**: pnpm with workspaces
- **Build Tool**: Turbo for monorepo builds
- **Testing**:
  - Cypress for E2E testing
  - Jest for unit testing
  - Vitest for some packages
- **Code Quality**:
  - ESLint (Next.js config)
  - Prettier with organize-imports plugin
  - Husky for git hooks
  - lint-staged for pre-commit checks
- **Environment Management**: Doppler for secrets
- **Version Control**: Git with standard-version for releases

## Deployment

- Docker containers
- Kubernetes with Helm charts
- Azure cloud services
