# KlickerUZH - Start Here

## What This Is

Open-source audience interaction platform for universities. Real-time polling, quizzes, microlearning, and practice activities for educational purposes.

## Stack at a Glance

**Core:**
- Next.js 15.3.4 + React 19.1.0 + TypeScript 5.6.3 (strict mode)
- Prisma 6.16.1 + PostgreSQL 15
- GraphQL (Pothos 4.3.0 for schema, Yoga 3.9.1 for server)
- Node 20.19.4 (managed via Volta)
- pnpm 10.15.0 workspaces

**Infrastructure:**
- Turborepo 2.5.6 monorepo
- Docker + Kubernetes with Helm
- Redis 7 (3 instances: exec, cache, assessment)
- Hatchet 1.9.4 for distributed workflows

**Frontend:**
- Next.js App Router (all frontends)
- Apollo Client 3.13.8 (GraphQL state)
- Tailwind CSS 4.1.11 + UZH Design System 4.1.6
- Cypress 15.2.0 (E2E) + Vitest 3.2.4 (unit)

## Architecture

**Monorepo structure:**
```
apps/          → 14 applications
  frontend-pwa       (student interface)
  frontend-manage    (lecturer interface)
  frontend-control   (mobile controller)
  auth              (authentication)
  backend-docker    (main GraphQL API)
  response-api      (high-throughput responses)
  chat              (AI chat)
  hatchet-worker-*  (background workers)
  lti, olat-api, analytics, docs

packages/      → 13 shared packages
  prisma        (database schema + ORM)
  graphql       (schema + resolvers + business logic)
  grading       (scoring algorithms)
  shared-components (React components)
  i18n, markdown, types, util, etc.
```

**Key architectural facts:**
- GraphQL-first API (single endpoint, type-safe)
- Hatchet replaced Azure Service Bus for workflows
- 3 Redis instances for different purposes
- All frontends: Next.js with functional components only
- All code: TypeScript strict mode, no class components
- Styling: Tailwind CSS exclusively

## Main Branch

- **Production branch:** v3
- **Feature branches:** Branch from v3
- **Commits:** Conventional commits (enforced by husky)

## Quick Facts for AI Agents

**Required conventions:**
- Functional components only (no class components)
- TypeScript strict mode (no `any` without justification)
- Tailwind for styling (no inline styles)
- GraphQL operations: Q (query), M (mutation), S (subscription), F (fragment)
- Apollo Client for all data fetching
- Formik + Yup for forms
- Testing: E2E (Cypress) + Unit (Vitest)

**Workflow requirements:**
- Database changes: Prisma migration → schema sync → GraphQL schema update
- Pre-commit: Format + lint (automatic via husky)
- Quality gates: format, lint, types, tests

## For More Details

- **CONVENTIONS.md** - Code style, naming, quality standards
- **PATTERNS.md** - GraphQL, database, testing, state management patterns
- **ARCHITECTURE.md** - Detailed system design and technology decisions
- **DEVELOPMENT.md** - Setup, workflow, troubleshooting
- **REFERENCE.md** - Authentication, permissions, deployment, CI/CD

## First Steps

1. Read this file (you're done!)
2. Check CONVENTIONS.md for code style
3. Review PATTERNS.md for common patterns
4. Reference DEVELOPMENT.md when setting up or making changes

**Start coding.** The documentation is here to support you, not block you.
