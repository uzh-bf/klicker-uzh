# KlickerUZH Project Overview

## Project Purpose

KlickerUZH is an open-source audience interaction platform developed by the Teaching Center of the Department of Finance at the University of Zurich. It provides real-time polling, quizzes, microlearning, and practice activities for educational purposes.

## Architecture

The project follows a monorepo structure using pnpm workspaces and Turbo for build orchestration. It consists of multiple applications and services that communicate via GraphQL:

### Core Applications

- **Frontend PWA** (`apps/frontend-pwa`): Student frontend for activities
- **Frontend Manage** (`apps/frontend-manage`): Lecturer administration interface
- **Frontend Control** (`apps/frontend-control`): Mobile controller for live quizzes
- **Frontend Authentication** (`apps/auth`): Authentication frontend
- **Backend Docker** (`apps/backend-docker`): Main backend service
- **OLAT API** (`apps/olat-api`): REST API for LMS integration

### Shared Packages

- **Prisma** (`packages/prisma`): Database schema and migrations
- **GraphQL** (`packages/graphql`): GraphQL schema, resolvers, and business logic
- **Grading** (`packages/grading`): Scoring and experience points logic
- **Types** (`packages/types`): Shared TypeScript definitions
- **Utilities** (`packages/util`): Common utility functions
- **i18n** (`packages/i18n`): Internationalization messages
- **Shared Components** (`packages/shared-components`): Shared React components
- **Markdown** (`packages/markdown`): Markdown rendering component

## Local Development Environment

The project uses a sophisticated local development setup that closely mirrors production:

- **Custom Domains**: All services use \*.klicker.com local domains (not localhost)
- **HTTPS by Default**: Local HTTPS certificates generated with mkcert
- **Traefik Reverse Proxy**: Routes requests to appropriate services
- **Docker Services**: PostgreSQL, Redis, and reverse proxy run in containers
- **Host Applications**: Frontend and backend apps run directly on the host system

### Local Service URLs

- Student Interface: https://pwa.klicker.com
- Lecturer Interface: https://manage.klicker.com
- Mobile Controller: https://control.klicker.com
- GraphQL API: https://api.klicker.com
- Authentication: https://auth.klicker.com

## Database Structure

PostgreSQL database managed with Prisma ORM, organized around:

- User management (lecturers and participants)
- Content elements (questions, flashcards, case studies)
- Activities (LiveQuiz, PracticeQuiz, MicroLearning, GroupActivity)
- Permissions and sharing
- Analytics and feedback
- Activity logging for tracking changes

## Technology Foundation

- **Runtime**: Node.js LTS versions
- **Package Manager**: pnpm with workspace support
- **Main Branch**: v3 (production branch)
- **Development Platform**: Cross-platform support (macOS, Linux, WSL)

For current versions and specific environment details, refer to package.json files and development documentation in the repository.
