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
- **Backend Responses** (`apps/func-incoming-responses`): Handles live quiz responses
- **Backend Response Processor** (`apps/func-response-processor`): Processes queued responses
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

## Database Structure

PostgreSQL database managed with Prisma ORM, organized around:

- User management (lecturers and participants)
- Content elements (questions, flashcards, case studies)
- Activities (LiveQuiz, PracticeQuiz, MicroLearning, GroupActivity)
- Permissions and sharing
- Analytics and feedback
- Activity logging for tracking changes
