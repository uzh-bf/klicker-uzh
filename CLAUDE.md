# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. This file together with @project/PLANNING.md and specific TODO files should provide a complete snapshot of the project and the tasks to be performed with Claude.

## Repository Overview

KlickerUZH is an open-source audience interaction platform developed by the Teaching Center of the Department of Finance at the University of Zurich. The platform consists of multiple applications and services that communicate with each other:

### Core Components

- **Frontend PWA**: Student frontend for live quizzes, microlearnings, practice quizzes, and leaderboards
- **Frontend Manage**: Lecturer frontend for question management, activity management, course management, and analytics (@apps/frontend-manage/CLAUDE.md)
- **Frontend Control**: Controller frontend for managing live quizzes from mobile devices (@apps/frontend-control/CLAUDE.md)
- **Frontend Authentication**: Authentication frontend for Edu-ID accounts and delegated logins (@apps/auth/CLAUDE.md)
- **Backend Docker**: Main backend service (@apps/backend-docker/CLAUDE.md)
- **Backend Responses**: Service that handles incoming student responses during live quizzes (@apps/func-incoming-responses/CLAUDE.md)
- **Backend Response Processor**: Processes queued elements with scoring and experience points calculations (@apps/func-response-processor/CLAUDE.md)

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

### Additional Components

- **Analytics Service**: Python-based analytics computation service (@apps/analytics)
- **Office Add-in**: PowerPoint integration for catalyst users (@apps/office-addin)
- **LTI Service**: Standalone LTI service for course system integration (@apps/lti)
- **Documentation**: Project documentation and landing page (@apps/docs)

### Testing

- **Cypress**: End-to-end tests for all applications (@cypress/CLAUDE.md)

## Monorepo Structure

This project uses a monorepo structure managed with:

- **pnpm**: Package manager with workspace support
- **Turbo**: Build orchestration and caching
- **Syncpack**: Dependency version synchronization
- **Husky**: Git hooks for code quality
- **Standard Version**: Automated versioning and changelog

## Development Workflow

### Setting Up the Development Environment

```bash
# Install dependencies
pnpm install

# Start development environment with Doppler environment variables
pnpm dev

# Start database, Redis, and reverse proxy only
pnpm run dev:prepare-prod
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

- **Frontend**:
  - Next.js 15 with Pages Router
  - React 18 with functional components
  - TailwindCSS with @uzh-bf/design-system
  - Apollo Client for GraphQL
  - Formik & Yup for forms
  - next-intl for i18n (en/de)
  - PWA capabilities with @ducanh2912/next-pwa
- **Backend**:
  - Node.js with TypeScript
  - GraphQL with Pothos schema builder
  - Redis for caching and pub/sub
  - Azure Functions for response handling
  - Bull for job queuing
- **Database**:
  - PostgreSQL 15+ with Prisma ORM
  - Shadow database for migrations
  - JSON fields for flexible data
- **Infrastructure**:
  - Docker containers
  - Kubernetes (Helm charts)
  - Doppler for secrets management
  - Traefik for reverse proxy

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

### Current Branch Development

The current branch (`v3`) is the main development branch for KlickerUZH v3.0. Recent development includes:

- Answer collection enhancements (duplication, direct import from catalog)
- Object activity logging system via `ActivityLogEntry` model
- Improved permission management for shared resources
- Enhanced catalog functionality for public answer collections
- Permission System v3.0: Asynchronous operation-based permission processing via `PendingPermissionOperation` model to eliminate transaction timeouts

### Development Environment Ports

- **3000**: Backend GraphQL API
- **3001**: Frontend PWA (Student)
- **3002**: Frontend Manage (Lecturer)
- **3003**: Frontend Control (Mobile Controller)
- **3010**: Authentication Service
- **5432**: PostgreSQL Database
- **6379**: Redis Cache
- **7245**: Backend Response Processor
- **7246**: Backend Incoming Responses

### GraphQL Architecture

The GraphQL API uses:

- **Pothos**: Code-first schema builder with TypeScript
- **Plugins**: ScopeAuth, Prisma, Zod validation, Directives
- **Authentication**: JWT tokens with role-based access (USER, PARTICIPANT, ADMIN)
- **Permissions**: Multi-level system (READ, WRITE, EXECUTE, ADMIN, OWNER)
- **Subscriptions**: Real-time updates via WebSockets
- **Operations**: Organized in `packages/graphql/src/graphql/ops/` with naming conventions:
  - `Q` prefix for queries
  - `M` prefix for mutations
  - `F` prefix for fragments
  - `S` prefix for subscriptions

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

### CODING PROTOCOL

- If anything is unclear, ask for clarification
- Write the absolute minimum code required (no unnecessary or extra props)
- No sweeping changes
- No unrelated edits - focus on just the task you're on
- Make code precise, modular, testable
- Don’t break existing functionality
- If I need to do anything (e.g. config or manual testing), tell me clearly

### AI-Based Development Workflow

This project uses a structured epic-based development approach:

**Planning Files**:

- `@project/PLANNING.md`: Contains a high-level overview and details on future epics with descriptions, goals, and dependencies
- `@project/TODO-EPIC-x.md`: Detailed tasks for specific epics and features (created as needed). Each task should:
  - Be small + testable
  - Have a clear start + end
  - Focus on one concern
- Any further planning, TODO, and concept files should be placed in the `@project` directory

**Workflow**:

1. Work epic by epic, potentially overlapping when dependencies allow
2. Track progress through TODO files, updated regularly by both humans and AI agents
3. `@project/PLANNING.md` updated periodically when high-level changes occur or epics complete
4. Tasks marked complete in TODO files as work progresses

**Epic Structure**:

- Each epic has clear description, goals, and dependencies to other epics
- Detailed implementation tasks broken down in separate TODO files
- Continuous progress tracking ensures nothing is lost between sessions

### 🔄 Project Awareness & Context

- Always read @project/PLANNING.md at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- Check the specific @project/TODO-EPIC-x.md file before starting a new epic/task. If the task isn’t listed, add it with a brief description and today's date.
- Use consistent naming conventions, file structure, and architecture patterns as described in @project/PLANNING.md.
- After you finish working on a task, always review and, if necessary, update the specific @project/TODO-EPIC-x.md file regarding the task you have worked on and, if applicable, regarding new tasks that might have come up during your work on the current task.
- Regularly update the "Implementation Status" in @project/PLANNING.md to reflect the current overall summarized state of the project.
- When asked to prepare a prompt for the next conversation, always focus on the next task and provide a draft of the instructions that should be given to this agent (including the goal, instructions to review @project/PLANNING.md and the specific @project/TODO-EPIC-x.md file, and the task description of the subsequent specific task).
- When you complete a task, always provide a summary of your work as well as an outlook on the next task according to @project/PLANNING.md and the specific @project/TODO-EPIC-x.md file. Assume that the next task will be worked on in a new conversation.
- ALWAYS continue working until you finish your task. Do not stop prematurely and wait for the user to tell you to continue.
- Ask me questions to further clarify the task if necessary.
- URGENT: When using the view_file tool to analyze a file, ALWAYS read the maximum lines per call whenever possible to minimize the number of tool calls and reduce costs. Only make additional calls when necessary to understand the complete context and if the file is longer than the maximum number of lines. NEVER do incremental look ups of the same file if not necessary.
- When you want to view a complete file, always use a `cat` command in the terminal. If you want to find specific code in a file, use `cat` combined with `grep`.

### ✅ Task Completion

- URGENT: Mark completed tasks in the specific @project/TODO-EPIC-x.md file immediately after finishing them. Do not wait until the end of the conversation or until the user tells you to, otherwise it might be forgotten.
- URGENT: Add new sub-tasks or TODOs discovered during development to the specific @project/TODO-EPIC-x.md file under a “Discovered During Work” section. If not absolutely necessary, do not deviate from your task to quickly do another task, just add it to the specific @project/TODO-EPIC-x.md file for later implementation and let the user know.

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
