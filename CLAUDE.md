# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. This file together with @PLANNING.md and @TODO.md should provide a complete snapshot of the project and the tasks to be performed with Claude.

## Repository Overview

KlickerUZH is an open-source audience interaction platform developed by the Teaching Center of the Department of Finance at the University of Zurich. The platform consists of multiple applications and services that communicate with each other:

### Core Components

- **Frontend PWA**: Student frontend for live quizzes, microlearnings, practice quizzes, and leaderboards
- **Frontend Manage**: Lecturer frontend for question management, activity management, course management, and analytics (@apps/frontend-manage/CLAUDE.md)
- **Frontend Control**: Controller frontend for managing live quizzes from mobile devices
- **Frontend Authentication**: Authentication frontend for Edu-ID accounts and delegated logins
- **Backend Docker**: Main backend service
- **Backend Responses**: Service that handles incoming student responses during live quizzes
- **Backend Response Processor**: Processes queued elements with scoring and experience points calculations

### Hatchet Integration & Token Management

KlickerUZH integrates with **Hatchet** for workflow orchestration and background job processing. The system includes an automated token generation and management setup:

#### Hatchet Services

- **Hatchet Engine**: Core workflow orchestration engine
- **Hatchet Dashboard**: Web interface for monitoring workflows (http://localhost:8090)
- **Hatchet Admin**: Administrative tools and CLI for token generation
- **Hatchet PostgreSQL**: Dedicated database for Hatchet data
- **Hatchet RabbitMQ**: Message queue for task distribution

#### Automated Token Generation System

The project includes a comprehensive automated system for generating and managing Hatchet client tokens:

**Location**: `util/hatchet/`
**Main Scripts**:

- `_generate_hatchet_token.sh` - Main token generation orchestrator
- `token-generator.sh` - Container script that generates JWT tokens using Hatchet CLI
- `env-updater.sh` - Updates .env files in both backend-docker and hatchet apps
- `docker-compose.hatchet-token.yml` - Docker services for token generation

**Usage**:

```bash
# 1. Start services (must be done first)
./_run_app_dependencies_macos.sh

# 2. Generate and configure tokens automatically
./_generate_hatchet_token.sh
```

**Key Features**:

- **Automatic JWT token generation** using official `hatchet-admin` CLI
- **Service verification** ensures Hatchet services are running before generation
- **Environment file automation** safely updates both `apps/backend-docker/.env` and `apps/hatchet/.env`
- **External network connectivity** for separate Docker Compose command execution
- **Modular bash scripts** mounted into containers for maintainability
- **Robust error handling** with proper token extraction and validation

**Environment Variables Added**:

- `HATCHET_CLIENT_TOKEN` - JWT token for Hatchet authentication
- `HATCHET_CLIENT_TLS_STRATEGY=none` - Disables TLS for local development
- `HATCHET_LOG_LEVEL` - Controls Hatchet logging verbosity

**Network Configuration**:
All Hatchet services are connected to the `klicker` Docker network, allowing communication between the main KlickerUZH services and Hatchet workflows.

**Development Workflow Integration**:

- Both `apps/backend-docker` and `apps/hatchet` now use `node -r dotenv/config` for automatic environment variable loading in development mode:
- `.env` files are properly gitignored to prevent token exposure
- `.env.example` templates document required environment variables

For detailed setup instructions and troubleshooting, see `util/hatchet/README.md`.

### Shared Packages

- **Prisma**: Database schema, migrations, and client (@packages/prisma/CLAUDE.md)
- **GraphQL**: GraphQL schema and resolvers with business logic (@packages/graphql/CLAUDE.md)
- **Grading**: Grading logic for scoring and awarding experience points (@packages/grading/CLAUDE.md)
- **Types**: Type definitions shared across packages (@packages/types/CLAUDE.md)
- **Utilities**: Common utility functions (@packages/util/CLAUDE.md)
- **LTI**: Learning Tools Interoperability logic for course system integration
- **i18n**: Internationalization messages (@packages/i18n/CLAUDE.md)
- **shared-components**: Common React components shared between frontends (@packages/shared-components/CLAUDE.md)
- **markdown**: React component for rendering markdown strings (@packages/markdown/CLAUDE.md)

### Testing

- **Cypress**: End-to-end tests for all applications (@cypress/CLAUDE.md)

## Development Workflow

### Setting Up the Development Environment

```bash
# Install dependencies
pnpm install

# Start development environment with Doppler environment variables
pnpm dev

# Start database, Redis, reverse proxy, and Hatchet services only
pnpm run dev:prepare-prod
```

**For Hatchet Integration**:

```bash
# 1. Start all services including Hatchet
./_run_app_dependencies_macos.sh

# 2. Generate Hatchet client tokens (run this once or when tokens expire)
./_generate_hatchet_token.sh
```

### Database Management

```bash
# Sync Prisma schema between packages/prisma and apps/analytics
./util/sync-schema.sh

# Deploy Prisma schema changes to the database
pnpm run prisma:deploy

# Run Prisma Studio to browse data
pnpm run prisma:studio

# Create a new Prisma migration
pnpm run prisma:migrate
```

### Running Tests

```bash
# Run all tests
pnpm test:run

# Run tests with watch mode
pnpm test:watch

# Run Cypress E2E tests
cd cypress && pnpm cypress open
```

### Building for Production

```bash
# Build all packages and applications
pnpm build

# Build packages and applications for testing
pnpm build:test
```

### Code Quality

```bash
# Run linting
pnpm lint

# Format code
pnpm format

# Check formatting
pnpm format:check

# Run type checks and formatting validation
pnpm run check
```

### Release Management

```bash
# Create a new release
pnpm release

# Create an alpha release
pnpm release:alpha

# Create a beta release
pnpm release:beta

# Create a release candidate
pnpm release:rc
```

## Architecture

KlickerUZH follows a distributed architecture with separate frontend and backend services. The database schema is defined using Prisma, and GraphQL is used for API communication between the services.

### Key Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Node.js, GraphQL, Redis
- **Database**: PostgreSQL with Prisma ORM
- **Infrastructure**: Docker, Kubernetes for deployment

### Database Structure

The database is organized around these main entities:

#### User Management

- **User**: Lecturers who create and manage questions and activities
  - Has properties like shortname, email, catalystIndividual/Institutional (subscription status)
  - Connected to UserLogins for authentication
  - Has locale preferences (en/de)
- **Participant**: Students who interact with activities
  - Has properties like username, email, password, avatar, xp (experience points)
  - Can join courses via Participation model
  - Can belong to ParticipantGroups for group activities

#### Content and Activities

- **Element**: Questions and content elements
  - Types include SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, and CASE_STUDY
  - Contains content, explanation, options (type-specific JSON)
  - ElementInstances are instantiations of elements in activities
  - ElementStacks group elements for different activities
- **Course**: Container for organizing activities and participants
  - Has properties like name, description, color, startDate/endDate
  - Contains settings for gamification, groups, etc.
  - Connected to activities like LiveQuiz, PracticeQuiz, MicroLearning, GroupActivity
- **Activities**:
  - **LiveQuiz**: Real-time quizzes with blocks of questions
  - **PracticeQuiz**: Self-paced quizzes for practice with spaced repetition
  - **MicroLearning**: Scheduled learning activities with notifications
  - **GroupActivity**: Collaborative activities for participant groups with parameters and clues

#### Permissions and Sharing

- **Permission**: Direct permissions granted to users or user groups
  - Levels: READ, WRITE, EXECUTE, ADMIN, OWNER
  - Connected to different object types (elements, courses, activities)
- **DerivedPermission**: Computed permissions based on direct permissions
  - Efficient access control with propagation of permissions
- **AccessRequest**: Requests from users to access objects
  - Pending requests awaiting approval/rejection
- **CatalogCollection**: Collections of shared objects
  - Public or restricted access settings
  - Contains assignments of objects to collections

#### Analytics and Feedback

- **QuestionResponse**: Stores participant responses to questions
- **LeaderboardEntry**: Tracks scores for gamification
- **Feedback**: Questions and comments in LiveQuiz Q&A
- **ActivityLogEntry**: Tracks changes to objects (current branch development)
  - Types: MESSAGE, MODIFICATION
  - Connected to different object types
  - Records user who made the change

### Object Activity (Current Branch)

The current branch (`object-changelog`) is implementing a change tracking system for elements and other objects in the application. This allows tracking changes made to objects and providing comments/messages about these changes.

Key features:

- `ActivityLogEntry` model with types MESSAGE and MODIFICATION
- Support for elements, courses, quizzes, and other object types through polymorphic relations
- Recording of message content, user, and timestamps
- GraphQL operations for retrieving and adding activity log entries

## Common Development Tasks

### Creating a New Element/Component

When creating a new React component, follow the existing patterns in the corresponding application. Most components are functional components using TypeScript with proper type definitions.

### Modifying the Database Schema

1. Update the schema files in `packages/prisma/src/prisma/schema/`
2. Run `pnpm run prisma:migrate` to create a migration
3. Run `./util/sync-schema.sh` to sync the schema with other packages
4. Implement any necessary changes to the GraphQL schema in `packages/graphql/src/schema/`

### Adding a New Feature

1. Create or modify components in the relevant frontend application
2. Update or add GraphQL operations in `packages/graphql/src/graphql/ops/`
3. Implement business logic in the appropriate service in `packages/graphql/src/services/`
4. Add tests for the new functionality
5. Update i18n translations if needed

### Debugging

- Frontend applications provide development error messages
- GraphQL operations can be debugged through the browser's network tab
- Database queries can be inspected using Prisma Studio

## Key Files and Directories

- `/packages/prisma/src/prisma/schema/`: Database schema definitions
  - `analytics.prisma`: Analytics models for tracking user and course performance, activity levels, and participation metrics
  - `course.prisma`: Course and related models
  - `datasource.prisma`: Database connection and provider configuration
  - `element.prisma`: Core element models (question/content elements, element stacks)
  - `gamification.prisma`: Gamification features (achievements, leaderboards, rewards)
  - `js.prisma`: Prisma Client and TypeScript integration settings
  - `other.prisma`: Miscellaneous models (email templates, migrations)
  - `participant.prisma`: Participant, ParticipantGroup, and leaderboard models
  - `quiz.prisma`: LiveQuiz, PracticeQuiz, MicroLearning, GroupActivity models
  - `resources.prisma`: Answer collections and related resources
  - `response.prisma`: User response models (correctness, timing, tracking)
  - `sharing.prisma`: Permissions, access control, audit logging
  - `user.prisma`: User, UserLogin, roles, and authentication models
- `/packages/graphql/src/schema/`: GraphQL schema definitions
- `/packages/graphql/src/services/`: Business logic implementation
  - `accounts.ts`: User and participant authentication, login, registration, and account management
  - `activities.ts`: Activity lifecycle management (creation, editing, publishing, deletion)
  - `analytics.ts`: Aggregation and reporting of analytics for courses, activities, and elements
  - `courses.ts`: Course creation, management, enrollment, and settings
  - `email.ts`: Email sending, template hydration, and notification delivery
  - `feedbacks.ts`: Live quiz feedback management, including moderation, voting, and publishing
  - `groups.ts`: Participant group management, group activities, assignments, and messaging
  - `liveQuizzes.ts`: Live quiz creation, editing, execution, evaluation, and leaderboard logic
  - `microLearning.ts`: MicroLearning activity management (CRUD, evaluation, publishing)
  - `notifications.ts`: Push notification subscription and delivery for courses and microlearnings
  - `participants.ts`: Participant profile, avatar, timeline, and feedback management
  - `practiceQuizzes.ts`: Practice quiz management (CRUD, evaluation, publishing)
  - `questions.ts`: Element/question manipulation, queries, and evaluation logic
  - `resources.ts`: Answer collection/resource management (CRUD, modification, linking)
  - `sharing.ts`: Permission, sharing, and access control for resources and activities
  - `stacks.ts`: Element stack response, evaluation, and statistics computation
  - `templates.ts`: Activity and element template management, including creation and conversion
- `/apps/frontend-*/src/pages/`: Page definitions for frontend applications
- `/apps/frontend-*/src/components/`: React components for frontend applications
- `/packages/shared-components/src/`: Shared React components
- `/cypress/`: End-to-end tests
- `/util/hatchet/`: Hatchet integration and token management
  - `README.md`: Developer-focused setup and usage guide
  - `_generate_hatchet_token.sh`: Main token generation script
  - `docker-compose.hatchet-token.yml`: Docker services for automated token generation
  - `token-generator.sh`: Container script for JWT token generation using Hatchet CLI
  - `env-updater.sh`: Container script for automatically updating .env files
  - `HATCHET-TOKEN-SETUP.md`: Complete documentation for Hatchet token setup and troubleshooting
- `/apps/hatchet/`: Hatchet workflow application
  - `src/index.ts`: Main Hatchet workflows and client configuration
  - `.env.example`: Environment variable template for Hatchet configuration
- `/_generate_hatchet_token.sh`: Convenience wrapper for Hatchet token generation
- `/_run_app_dependencies_macos.sh`: Starts all services including Hatchet for development

## Tips and Best Practices

1. Follow the existing code style and patterns
2. Use TypeScript for type safety
3. Keep business logic in the GraphQL services
4. Use the shared packages for code reuse between applications
5. Create comprehensive tests for new features
6. Keep internationalization in mind when adding user-facing text
7. Consider permissions and access control when implementing new features
8. When working with the Prisma schema:
   - Add models to the appropriate schema file based on domain
   - Use relations and constraints appropriately
   - Document JSON fields with comments (e.g., `/// [PrismaElementOptions]`)
   - Follow the migration workflow when making changes
9. **Hatchet Integration**:
   - Always start services with `_run_app_dependencies_macos.sh` before working with Hatchet
   - Generate tokens using `_generate_hatchet_token.sh` when setting up or when tokens expire
   - Use environment variables for Hatchet configuration (never hardcode tokens)
   - Test Hatchet workflows through the dashboard at http://localhost:8090
   - Keep Hatchet services running during development for background job processing
   - Check `util/hatchet/HATCHET-TOKEN-SETUP.md` for troubleshooting token issues

### 🔄 Project Awareness & Context

- Always read PLANNING.md at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- Check TASK.md before starting a new task. If the task isn't listed, add it with a brief description and today's date.
- Use consistent naming conventions, file structure, and architecture patterns as described in PLANNING.md.
- After you finish working on a task, always review and, if necessary, update TASK.md regarding the task you have worked on and, if applicable, regarding new tasks that might have come up during your work on the current task.
- Regularly update the "Implementation Status" in PLANNING.md to reflect the current overall summarized state of the project.
- When asked to prepare a prompt for the next conversation, always focus on the next task and provide a draft of the instructions that should be given to this agent (including the goal, instructions to review PLANNING.md and TASK.md, and the task description of the subsequent specific task).
- When you complete a task, always provide a summary of your work as well as an outlook on the next task according to PLANNING.md and TASK.md. Assume that the next task will be worked on in a new conversation.
- ALWAYS continue working until you finish your task. Do not stop prematurely and wait for the user to tell you to continue.
- Ask me questions to further clarify the task if necessary.
- URGENT: When using the view_file tool to analyze a file, ALWAYS read the maximum lines per call whenever possible to minimize the number of tool calls and reduce costs. Only make additional calls when necessary to understand the complete context and if the file is longer than the maximum number of lines. NEVER do incremental look ups of the same file if not necessary.
- When you want to view a complete file, always use a `cat` command in the terminal. If you want to find specific code in a file, use `cat` combined with `grep`.

### 🧱 Code Structure & Modularity

- Never create a file longer than 500 lines of code. If a file approaches this limit, refactor by splitting it into modules or helper files.
- Organize code into clearly separated modules, grouped by feature or responsibility.
- Use clear, consistent imports (prefer relative imports within packages).

### 🧪 Testing & Reliability

- After updating any logic, check whether existing unit tests need to be updated. If so, do it.
- Whenever you create or change tests, run them with the matching command to make sure they still pass.

#### TypeScript

When using TypeScript:

- Always create Jest unit tests for new features (functions, classes, routes, etc).
- Tests should live in a /**tests** folder mirroring the main app structure.
- Include at least:
- 1 test for expected use
- 1 edge case
- 1 failure case
- If Cypress is installed, write end-to-end tests for critical user flows.
- Add data-cy attributes to complex frontend components to ensure compatibility with e2e tests.
- Structure e2e tests to cover complete user journeys.

#### Python

When using Python:

- Always create Pytest unit tests for new features (functions, classes, routes, etc).
- Tests should live in a /tests folder mirroring the main app structure.
- Include at least:
- 1 test for expected use
- 1 edge case
- 1 failure case

### ✅ Task Completion

- URGENT: Mark completed tasks in TASK.md immediately after finishing them. Do not wait until the end of the conversation or until the user tells you to, otherwise it might be forgotten.
- URGENT: Add new sub-tasks or TODOs discovered during development to TASK.md under a "Discovered During Work" section. If not absolutely necessary, do not deviate from your task to quickly do another task, just add it to the TASK.md for later implementation and let the user know.

### 📎 Style & Conventions

- Prefer functional programming - avoid classes and use pure functions when possible.
- Ignore lint errors in Markdown files when it comes to newlines and file structuring.

#### TypeScript

When using TypeScript:

- Follow ESLint rules and format with Prettier.
- Use strong typing with interfaces and type definitions.
- Use React with functional components and hooks for frontend.
- Write JSDoc comments for every function:

```typescript
/**
 * Brief summary.
 *
 * @param param1 - Description.
 * @returns Description.
 */

function example(param1: string): number {
  // implementation
}
```

#### React

When using React:

- Always use function and not const for functional components.
- Extract complex logic and computations into one or multiple custom hooks and, if sensible, create unit tests for the hooks.
- Create one file per component unless the components are very simple and only used inside the main component.
- Use PascalCase for React component file names (e.g., UserCard.tsx, not user-card.tsx).
- Use Tailwind CSS for styling. Use tailwind-merge for dynamic and conditional className (e.g., twMerge('flex', isOpen ? 'flex' : 'hidden')).
- Do NOT add inline comments in JSX in React components.

#### Python

When using Python:

- Follow PEP8, use type hints, and format with ruff.
- Use pydantic for data validation.
- Use FastAPI for APIs.
- Never use argument parsing or similar when building command line scripts unless explicitly asked to do so
- Write docstrings for every function using the Google style:

```python
def example():
"""
Brief summary.

Args:
param1 (type): Description.

Returns:
type: Description.
"""
```

### 📚 Documentation & Explainability

- Update README.md and relevant CLAUDE.md files (the root CLAUDE.md and the CLAUDE.md of the packages you are working on) when new features are added, dependencies or architecture change, or setup steps are modified.
- Comment non-obvious code and ensure everything is understandable to a mid-level developer.
- When writing complex logic, add an inline # Reason: comment explaining the why, not just the what.

### 🧠 AI Behavior Rules

- Never assume missing context. Ask questions if uncertain.
- Never hallucinate libraries or functions – only use known, verified packages (e.g., from NPM or PyPI).
- Always confirm file paths and module names exist before referencing them in code or tests or trying to update them.
- Never delete or overwrite existing code unless explicitly instructed to or if part of a task from TODO.md.

## Where to Find More Information

- Project homepage: https://www.klicker.uzh.ch/
- User documentation: https://www.klicker.uzh.ch/getting_started/welcome
- Frequently asked questions: https://www.klicker.uzh.ch/faq
- Community discussions: https://community.klicker.uzh.ch/
- Package-specific documentation: See the CLAUDE.md files in each package directory referenced above
