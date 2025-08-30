# CI/CD Pipelines

## Overview

KlickerUZH uses GitHub Actions for comprehensive CI/CD automation with separate workflows for different services, environments, and quality checks. The workflows are organized in `.github/workflows/` and follow clear naming patterns.

## Workflow Naming Convention

### Version-Specific Deployments

- **v3\_[service]-[environment].yml**: Production and QA deployments
- **Examples**:
  - `v3_backend-docker.yml`: Backend production deployment
  - `v3_frontend-manage-docker-qa.yml`: Frontend manage QA deployment
  - `v3_klickeruzhprod-responses.yml`: Response service production

### Quality Checks

- **check-[type].yml**: Code quality validation
- **test-[service].yml**: Service-specific testing

### Special Workflows

- **claude.yml**: AI-assisted code review and automation
- **release.yml**: Automated release management
- **codeql-analysis.yml**: Security analysis

## Core Quality Check Workflows

### Code Quality Pipelines

1. **check-types.yml**: TypeScript type checking

   - Runs on all TypeScript files
   - Validates type safety across packages
   - Prevents type errors in production

2. **check-lint.yml**: ESLint validation

   - Enforces code style consistency
   - Identifies potential bugs and anti-patterns
   - Runs on JavaScript/TypeScript files

3. **check-format.yml**: Prettier formatting
   - Ensures consistent code formatting
   - Validates against .prettierrc.mjs configuration
   - Auto-formatting validation

### Testing Workflows

1. **cypress-testing.yml**: End-to-end testing

   - **Services**: PostgreSQL 15, Redis (cache + exec)
   - **Triggers**: Push to v3 branches, PRs affecting core paths
   - **Platform**: Ubuntu latest (can use self-hosted)
   - **Database Setup**: Automated seeding and migration

2. **test-grading.yml**: Grading package tests

   - Unit tests for scoring algorithms
   - XP calculation validation
   - Critical business logic testing

3. **test-graphql.yml**: GraphQL package tests

   - Resolver testing
   - Schema validation
   - API integration tests

4. **test-olat-api.yml**: OLAT API integration tests
   - LTI integration validation
   - External API communication tests

## Service Deployment Workflows

### Backend Services

- **v3_backend-docker.yml**: Main GraphQL backend
- **v3_klickeruzhprod-responses.yml**: Response handling service
- **v3_klickeruzhprod-response-processor.yml**: Response processing
- **v3_auth-prod.yml** / **v3_auth-qa.yml**: Authentication service

### Frontend Applications

- **v3_frontend-manage-docker-prod.yml** / **v3_frontend-manage-docker-qa.yml**: Lecturer frontend
- **v3_frontend-pwa-docker-prod.yml** / **v3_frontend-pwa-docker-qa.yml**: Student frontend
- **v3_frontend-control-docker-prod.yml** / **v3_frontend-control-docker-qa.yml**: Controller frontend

### Additional Services

- **v3_lti-prod.yml** / **v3_lti-qa.yml**: LTI integration service
- **v3_olat-api-prod.yml** / **v3_olat-api-qa.yml**: OLAT API service
- **v3_analytics-prod.yml** / **v3_analytics-qa.yml**: Analytics service

## Special Workflows

### AI-Assisted Development

1. **claude.yml**: Claude AI integration

   - Automated code review
   - Intelligent suggestions
   - Development assistance

2. **claude-code-review.yml**: AI-powered code review

   - Automated PR analysis
   - Quality suggestions
   - Best practice recommendations

3. **claude-dispatch.yml**: Claude workflow dispatch
   - Manual AI assistance triggers
   - On-demand code analysis

### Release Management

1. **release.yml**: Automated releases
   - Version bumping
   - Changelog generation
   - Tag creation and publishing
   - Multi-package coordination

### Security & Analysis

1. **codeql-analysis.yml**: GitHub CodeQL security scanning

   - Static analysis for vulnerabilities
   - Security pattern detection
   - Automated security reports

2. **v3_sonarcloud.yml**: SonarCloud code quality analysis
   - Code coverage analysis
   - Code smell detection
   - Security vulnerability scanning
   - Technical debt tracking

## Workflow Triggers

### Common Trigger Patterns

```yaml
# Production deployments
on:
  push:
    branches: [v3]
    paths:
      - 'apps/specific-service/**'
      - 'packages/**'

# QA deployments
on:
  push:
    branches: [v3*]
  pull_request:
    branches: [v3]

# Quality checks
on:
  push:
    branches: [v3, v3*]
  pull_request:
    branches: [v3, v3*]
    paths:
      - '**/*.{ts,tsx,js,jsx}'
```

### Environment-Based Triggers

- **Production**: Only on main v3 branch pushes
- **QA**: On v3 feature branches and PRs
- **Testing**: On any v3 branch changes
- **Quality Checks**: On all relevant file changes

## Container Registry Integration

### GitHub Container Registry (ghcr.io)

- **Registry**: `ghcr.io/uzh-bf/klicker-uzh`
- **Authentication**: GitHub token-based
- **Multi-arch**: Support for different architectures
- **Caching**: Layer caching for faster builds

### Image Tagging Strategy

- **Staging/Testing**: Branches with `v3` or `v3-` prefix → built for staging environments
- **Production**: Git tags → built for production deployment
- **No intermediate tagging**: Only branch-based and tag-based builds

## Environment Management

### Secrets Management

- **GitHub Secrets**: Sensitive deployment data
- **Doppler Integration**: Environment variable management
- **Per-Environment**: Separate secret sets for qa/prod

### Environment Variables

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: uzh-bf/klicker-uzh
  ENVIRONMENT: ${{ github.ref == 'refs/heads/v3' && 'prod' || 'qa' }}
```

### Deployment Contexts

- **Production**: Full feature set, performance optimized
- **QA**: Feature testing, debugging enabled
- **Development**: Hot reload, development tools

## Development Workflow

### Pull Request Process

1. **Feature Branch**: Create feature branch from v3
2. **Quality Checks**: Automated linting, formatting, type checking
3. **Testing**: Cypress E2E tests, unit tests
4. **Code Review**: Manual + AI-assisted review
5. **QA Deployment**: Automatic deployment to QA environment
6. **Production**: Manual approval for production deployment

### Hotfix Process

1. **Emergency Branch**: Direct branch from v3
2. **Fast-Track Testing**: Essential tests only
3. **Immediate Deployment**: Skip QA for critical fixes
4. **Post-Deployment**: Retroactive testing and validation
