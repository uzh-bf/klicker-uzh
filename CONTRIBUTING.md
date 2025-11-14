# Contributing to KlickerUZH

First off, thank you for considering contributing to KlickerUZH! It's people like you that make KlickerUZH such a great tool for interactive learning. We welcome contributions from everyone, whether you're fixing a typo, reporting a bug, or implementing a major feature.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Don't Want to Contribute Code](#i-dont-want-to-contribute-code)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Getting Help](#getting-help)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## I Don't Want to Contribute Code

That's perfectly fine! There are many ways to contribute:

- **Report Bugs**: Found a bug? [Create an issue](https://github.com/uzh-bf/klicker-uzh/issues/new?template=bug_report.md)
- **Suggest Features**: Have an idea? [Submit a feature request](https://klicker-uzh.feedbear.com)
- **Improve Documentation**: Help make our docs better
- **Answer Questions**: Help others in our [Community Forum](https://community.klicker.uzh.ch)
- **Spread the Word**: Blog, tweet, or present about KlickerUZH

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20.19.4** (we use Volta for version management)
- **pnpm 10.15.0** (package manager)
- **Docker Desktop** (for running PostgreSQL, Redis, etc.)
- **Git** (version control)

Optional but recommended:
- **mkcert** (for local HTTPS)
- **Doppler CLI** (for environment management - core team only)

### First-Time Setup

#### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/klicker-uzh.git
cd klicker-uzh

# Add upstream remote
git remote add upstream https://github.com/uzh-bf/klicker-uzh.git
```

#### 2. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install
```

This will install all dependencies for all packages in the monorepo.

#### 3. Setup Infrastructure

Start the required services (PostgreSQL, Redis, Hatchet):

```bash
# Start all infrastructure services
docker-compose up -d postgres redis-exec redis-cache redis-assessment hatchet-server hatchet-engine
```

Verify services are running:
```bash
docker-compose ps
```

#### 4. Configure Environment Variables

**Option A: Using .env files (Recommended for Contributors)**

Each app and package that needs configuration has an `.env.example` file. Copy these to create your local `.env` files:

```bash
# Backend
cp apps/backend-docker/.env.example apps/backend-docker/.env

# GraphQL package (for testing)
cp packages/graphql/.env.example packages/graphql/.env

# Hatchet workers
cp apps/hatchet-worker-general/.env.example apps/hatchet-worker-general/.env
cp apps/hatchet-worker-response-processor/.env.example apps/hatchet-worker-response-processor/.env

# Response API
cp apps/response-api/.env.example apps/response-api/.env
```

The `.env.example` files contain sensible defaults for local development. You typically only need to modify:
- Database connection strings (if you changed Docker setup)
- Redis connection details (if you changed Docker setup)

**Option B: Using Doppler (Core Team Only)**

If you're a core team member with Doppler access:

```bash
# Login to Doppler
doppler login

# Select the dev configuration
doppler setup
```

For detailed environment configuration, see [docs/SETUP.md](docs/SETUP.md).

#### 5. Setup Database

Initialize the database and seed with test data:

```bash
pnpm run prisma:setup
```

This will:
- Push the Prisma schema to PostgreSQL
- Run migrations
- Seed the database with test users, courses, and questions

#### 6. Verify Setup

Start the development servers:

```bash
pnpm run dev:offline
```

Wait for all services to start (this takes 1-2 minutes), then verify:

- Frontend PWA: http://127.0.0.1:3001
- Frontend Manage: http://127.0.0.1:3002
- Frontend Control: http://127.0.0.1:3003
- Backend API: http://127.0.0.1:3000/graphql
- Auth: http://127.0.0.1:3010

**Test User Credentials** (from seed data):
- Email: `lecturer@test.com`
- Password: `abcd1234`

If you see the login page and can log in, congratulations! Your setup is complete.

### Troubleshooting Setup

**"Doppler not found"**
- Use `dev:offline` instead of `dev`: `pnpm run dev:offline`
- Or install Doppler: `brew install dopplerhq/cli/doppler` (macOS)

**"Port already in use"**
- Check if another process is using the port: `lsof -i :3000`
- Kill the process or use a different port

**"Cannot connect to database"**
- Ensure Docker is running: `docker ps`
- Check database logs: `docker-compose logs postgres`
- Verify connection string in `.env`

**"Module not found" errors**
- Rebuild packages: `pnpm run build --filter=@klicker-uzh/prisma --filter=@klicker-uzh/graphql`
- Clear turbo cache: `rm -rf .turbo`

For more help, see [docs/SETUP.md](docs/SETUP.md) or ask in our [Discussions](https://github.com/uzh-bf/klicker-uzh/discussions).

## Development Workflow

### Creating a Feature Branch

Always create a new branch for your changes:

```bash
# Update your local main branch
git checkout v3
git pull upstream v3

# Create a feature branch
git checkout -b feature/my-awesome-feature

# Or for a bug fix
git checkout -b fix/issue-123
```

### Making Changes

1. **Make your changes** in the appropriate files
2. **Write or update tests** to cover your changes
3. **Test your changes locally**:
   ```bash
   # Run linting
   pnpm run lint

   # Run type checking
   pnpm run check

   # Run tests
   pnpm run test:run

   # Or run all checks at once
   pnpm run check:all
   ```

### Testing Your Changes

**Unit Tests:**
```bash
# Run all unit tests
pnpm run test:run

# Run tests for a specific package
pnpm run --filter=@klicker-uzh/graphql test

# Run tests in watch mode
pnpm run test:watch
```

**End-to-End Tests:**
```bash
# Build and start test environment
pnpm run build:test
pnpm run start:test

# In another terminal, run Cypress
cd cypress
pnpm run cypress:open
```

**Manual Testing:**
- Test your changes in the browser
- Try different scenarios and edge cases
- Test on different screen sizes (responsive design)

### Running Individual Apps

You don't always need to run the full stack. Here's how to run individual applications:

```bash
# Run only the backend
turbo run dev --filter=@klicker-uzh/backend-docker

# Run only the student frontend
turbo run dev --filter=@klicker-uzh/frontend-pwa

# Run backend + student frontend
turbo run dev --filter=@klicker-uzh/backend-docker --filter=@klicker-uzh/frontend-pwa
```

## Coding Standards

### TypeScript

- **Strict mode enabled**: Fix all TypeScript errors
- **Use types over any**: Avoid `any` unless absolutely necessary
- **Prefer interfaces over types** for object shapes
- **Use meaningful variable names**: `userData` not `data`, `userId` not `id`

### Code Style

We use automated tools to enforce code style:

- **Prettier**: Code formatting (runs automatically on commit)
- **ESLint**: Code linting (runs automatically on commit)
- **Husky + lint-staged**: Pre-commit hooks

Your code will be automatically formatted when you commit, but you can also run:

```bash
# Format all files
pnpm run format

# Check formatting without changing files
pnpm run format:check
```

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(frontend-pwa): add dark mode toggle"
git commit -m "fix(graphql): correct scoring calculation for KPRIM questions"
git commit -m "docs: update setup instructions in README"
git commit -m "test(grading): add tests for experience point calculation"
```

**Why?** Conventional commits allow us to:
- Automatically generate changelogs
- Determine semantic version bumps
- Make the git history more readable

### GraphQL Conventions

**Naming:**
- **Queries**: Start with verb (get, list, find)
  - `getUserCourses`, `getCourse`, `listQuestions`
- **Mutations**: Start with verb (create, update, delete, add, remove)
  - `createCourse`, `updateQuestion`, `deleteLiveQuiz`
- **GraphQL Operations**: Use prefixes
  - `Q` for queries: `QGetUserCourses.graphql`
  - `M` for mutations: `MCreateCourse.graphql`
  - `F` for fragments: `FElementData.graphql`
  - `S` for subscriptions: `SFeedbackAdded.graphql`

**File Organization:**
- Schema definitions: `packages/graphql/src/schema/<domain>.ts`
- Business logic: `packages/graphql/src/services/<domain>.ts`
- Operations: `packages/graphql/src/graphql/ops/<operation>.graphql`

### React/Next.js Conventions

- **Use functional components** with hooks
- **Use TypeScript** for all new components
- **Prefer server components** unless client interactivity is needed
- **Co-locate styles** with components when using Tailwind
- **Use the design system**: Import from `@uzh-bf/design-system`

### Testing Conventions

- **Write tests for new features**: Aim for good coverage of business logic
- **Test edge cases**: Null values, empty arrays, boundary conditions
- **Use descriptive test names**: `it('should calculate correct score for KPRIM question with partial correctness')`
- **Arrange-Act-Assert pattern**:
  ```typescript
  it('should create a new course', async () => {
    // Arrange
    const courseData = { name: 'Test Course' }

    // Act
    const result = await createCourse(courseData)

    // Assert
    expect(result.name).toBe('Test Course')
  })
  ```

## Submitting Changes

### Before Submitting

Checklist:
- [ ] Code follows project style guidelines (Prettier + ESLint pass)
- [ ] All tests pass locally (`pnpm run test:run`)
- [ ] Type checking passes (`pnpm run check`)
- [ ] You've tested your changes manually
- [ ] You've added/updated tests for your changes
- [ ] You've updated documentation (if needed)
- [ ] Commit messages follow Conventional Commits format

### Creating a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/my-awesome-feature
   ```

2. **Create a Pull Request** on GitHub:
   - Navigate to your fork on GitHub
   - Click "Compare & pull request"
   - Fill out the PR template:
     - Describe what you changed and why
     - Link to related issues (`Closes #123`)
     - Add screenshots for UI changes
     - Mention any breaking changes

3. **Wait for review**:
   - Maintainers will review your PR
   - Address any feedback or requested changes
   - Once approved, your PR will be merged!

### PR Review Process

**What to expect:**
- **Initial response**: Within 1-3 business days
- **Review**: Maintainers may request changes
- **Multiple rounds**: It's normal to have several rounds of feedback
- **CI checks**: All GitHub Actions must pass

**After merge:**
- Your changes will be included in the next release
- You'll be added to the contributors list!

## Getting Help

Stuck? Have questions? We're here to help!

### Where to Ask

**For setup/contribution questions:**
- [GitHub Discussions](https://github.com/uzh-bf/klicker-uzh/discussions)
- [Community Forum](https://community.klicker.uzh.ch)

**For bugs:**
- [Create an issue](https://github.com/uzh-bf/klicker-uzh/issues/new?template=bug_report.md)

**For feature requests:**
- [Feedback Platform](https://klicker-uzh.feedbear.com)

### Response Times

We're a small team working on this project alongside our other responsibilities:
- **Best effort support**: We'll respond as quickly as we can
- **No guaranteed SLA**: We don't have dedicated support staff
- **Be patient**: Complex questions may take longer to answer

## Good First Issues

Looking for something to work on? Check out our [good first issues](https://github.com/uzh-bf/klicker-uzh/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)!

These are smaller, well-defined tasks that are perfect for getting familiar with the codebase.

## Recognition

All contributors will be:
- Added to the `contributors` list in `package.json`
- Mentioned in release notes (for significant contributions)
- Credited in the GitHub contributors graph

## License

By contributing to KlickerUZH, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE.md).

This means:
- Your code will be open source
- Derivative works must also be open source
- You retain copyright to your contributions

---

## Thank You!

Your contributions make KlickerUZH better for everyone. We appreciate you taking the time to contribute!

**Happy coding! 🚀**

---

**Questions about this guide?** Open a [discussion](https://github.com/uzh-bf/klicker-uzh/discussions) or suggest improvements via a PR.
