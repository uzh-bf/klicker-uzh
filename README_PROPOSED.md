<img src="https://manage.klicker.uzh.ch/KlickerLogo.png" width="350">

# KlickerUZH - Open Source Audience Interaction Platform

[![Test Status](https://img.shields.io/endpoint?url=https://cloud.cypress.io/badge/simple/y436dx/v3&style=for-the-badge&logo=cypress)](https://cloud.cypress.io/projects/y436dx/runs)
[![Coverage](https://coveralls.io/repos/github/uzh-bf/klicker-uzh/badge.svg?branch=v3)](https://coveralls.io/github/uzh-bf/klicker-uzh?branch=v3)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**KlickerUZH** is a modern, open-source platform for interactive learning that enables real-time audience engagement through live quizzes, microlearning, practice quizzes, and collaborative group activities. Built with TypeScript, Next.js, and GraphQL for scalability and developer experience.

> **Note**: This is the repository for KlickerUZH v3.0, released in August 2023. For more information on the v3.0 concept, see our [public discussion](https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79).

## Features

- **Live Quizzes**: Real-time audience interaction during lectures
- **Microlearning**: Spaced repetition for knowledge retention
- **Practice Quizzes**: Self-paced learning with immediate feedback
- **Group Activities**: Collaborative problem-solving
- **Gamification**: Points, leaderboards, and achievements
- **Question Types**: Single/Multiple Choice, Kprim, Numerical, Free Text, Content elements
- **Analytics**: Detailed performance insights for instructors
- **LTI Integration**: Seamless integration with Moodle and OpenOLAT
- **PWA Support**: Installable mobile app experience
- **Multi-language**: English and German (extensible)

## Quick Links

- [User Documentation](https://www.klicker.uzh.ch/getting_started/welcome)
- [Contributing Guide](CONTRIBUTING.md)
- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Community Forum](https://community.klicker.uzh.ch/)
- [Feature Roadmap](https://klicker-uzh.feedbear.com)
- [Bug Reports](https://klicker-uzh.feedbear.com/boards/bug-reports)

## Quick Start for Developers

### Prerequisites

- Node.js 20.19.4 (managed via Volta)
- pnpm 10.15.0
- Docker Desktop

### Get Up and Running in 5 Minutes

```bash
# Clone the repository
git clone https://github.com/uzh-bf/klicker-uzh.git
cd klicker-uzh

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, etc.)
docker-compose up -d postgres redis-exec redis-cache redis-assessment hatchet-server hatchet-engine

# Copy environment configuration
cp apps/backend-docker/.env.example apps/backend-docker/.env
cp packages/graphql/.env.example packages/graphql/.env

# Setup and seed database
pnpm run prisma:setup

# Start all services (without Doppler)
pnpm run dev:offline
```

**Access the applications:**
- Student Frontend: http://127.0.0.1:3001
- Lecturer Frontend: http://127.0.0.1:3002
- Control App: http://127.0.0.1:3003
- GraphQL API: http://127.0.0.1:3000/graphql

**Test credentials:** `lecturer@test.com` / `abcd1234`

For detailed setup instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture

KlickerUZH v3 is built as a modern **TypeScript monorepo** using Turborepo, featuring microservices architecture with multiple specialized applications and shared packages.

### Applications

| Application | Purpose | Technology |
|-------------|---------|------------|
| [frontend-pwa](apps/frontend-pwa) | Student interface (installable PWA) | Next.js 15, React 19 |
| [frontend-manage](apps/frontend-manage) | Lecturer management interface | Next.js 15, React 19 |
| [frontend-control](apps/frontend-control) | Mobile controller for live quizzes | Next.js 15, React 19 |
| [auth](apps/auth) | Authentication service | NextAuth, Edu-ID OAuth |
| [backend-docker](apps/backend-docker) | Main GraphQL API | Express, GraphQL Yoga |
| [response-api](apps/response-api) | High-throughput response handler | TypeScript, Redis |
| [hatchet-worker-*](apps/hatchet-worker-response-processor) | Background job processors | Hatchet workflows |
| [chat](apps/chat) | AI-powered chat assistant | Azure AI SDK |
| [lti](apps/lti) | LTI 1.3 integration | ltijs |
| [analytics](apps/analytics) | Analytics processing | Python |
| [docs](apps/docs) | Documentation site | Docusaurus |

### Shared Packages

| Package | Purpose |
|---------|---------|
| [graphql](packages/graphql) | GraphQL schema, resolvers, and business logic |
| [prisma](packages/prisma) | Database schema and ORM |
| [grading](packages/grading) | Scoring and experience point calculation |
| [shared-components](packages/shared-components) | Reusable React components |
| [i18n](packages/i18n) | Internationalization |
| [markdown](packages/markdown) | Markdown rendering |
| ... | [See all packages](packages/) |

### Technology Stack

**Core:**
- TypeScript 5.6 (strict mode)
- Node.js 20
- pnpm 10 (workspace monorepo)
- Turborepo 2.5 (build orchestration)

**Frontend:**
- Next.js 15.3 (App Router)
- React 19.1
- Apollo Client 3.13 (GraphQL)
- Tailwind CSS 4.1
- UZH Design System 4.1

**Backend:**
- GraphQL Yoga 3.9 (GraphQL server)
- Pothos 4.3 (code-first schema)
- Prisma 6.16 (ORM)
- PostgreSQL 15 (database)
- Redis 7 (caching & state)
- Hatchet 1.9 (workflow orchestration)

**Testing:**
- Cypress 15 (E2E tests)
- Vitest 3 (unit tests)
- 100+ test files, 466+ test cases

**DevOps:**
- Docker (containerization)
- Kubernetes + Helm (orchestration)
- GitHub Actions (CI/CD)
- Traefik (reverse proxy)

For a detailed architecture overview, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project Structure

```
klicker-uzh/
├── apps/               # Applications (14 apps)
│   ├── frontend-pwa/   # Student frontend
│   ├── frontend-manage/# Lecturer frontend
│   ├── backend-docker/ # Main GraphQL API
│   └── ...
├── packages/           # Shared packages (13 packages)
│   ├── graphql/        # GraphQL schema & logic
│   ├── prisma/         # Database schema
│   ├── grading/        # Scoring logic
│   └── ...
├── cypress/            # E2E tests
├── deploy/             # Kubernetes deployment configs
└── docs/               # Documentation
```

## Contributing

We welcome contributions from the community! Whether you're fixing a bug, adding a feature, or improving documentation, your help is appreciated.

### How to Contribute

1. Read our [Contributing Guide](CONTRIBUTING.md)
2. Check out [good first issues](https://github.com/uzh-bf/klicker-uzh/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
3. Join our [Community Forum](https://community.klicker.uzh.ch/) for discussions
4. Submit a pull request

**Before contributing:**
- Review our [coding standards](CONTRIBUTING.md#coding-standards)
- Ensure your changes pass tests and linting
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages

### Areas We Need Help

- **Documentation**: Improve setup guides, add tutorials, create diagrams
- **Testing**: Increase test coverage, add E2E tests
- **Features**: Check our [roadmap](https://klicker-uzh.feedbear.com) for planned features
- **Bug Fixes**: See [bug reports](https://github.com/uzh-bf/klicker-uzh/issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- **Translations**: Add support for new languages
- **Accessibility**: Improve WCAG compliance

## Using KlickerUZH

### Official Hosted Instance

The official instance of KlickerUZH is available at **[www.klicker.uzh.ch](https://www.klicker.uzh.ch)**, hosted by the University of Zurich:

- **Free Tier**: Core functionalities (questions, live quizzes, courses, gamification) available to anyone
- **Catalyst Program**: Advanced features for institutional partners
- **UZH/USZ Users**: Automatically enrolled in Catalyst program

See our [Privacy Policy](https://www.klicker.uzh.ch/privacy_policy) for data processing information.

### Self-Hosting

You can deploy your own instance of KlickerUZH on private infrastructure. This is useful for:

- Sensitive question content or confidential voting
- Institutional compliance requirements
- Custom integrations and modifications

**Deployment options:**
- Docker Compose (quickest for small deployments)
- Kubernetes with Helm (recommended for production)

See our [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

**Important:** Per the AGPL-3.0 license, any modifications to self-hosted instances must be made available as open source.

## Community & Support

### Get Help

- [Community Forum](https://community.klicker.uzh.ch) - Ask questions and discuss
- [GitHub Discussions](https://github.com/uzh-bf/klicker-uzh/discussions) - Technical discussions
- [FAQ](https://www.klicker.uzh.ch/faq) - Common questions

### Report Issues & Request Features

- [Bug Reports](https://klicker-uzh.feedbear.com/boards/bug-reports)
- [Feature Requests](https://klicker-uzh.feedbear.com)
- [GitHub Issues](https://github.com/uzh-bf/klicker-uzh/issues)

### Development Resources

- [Roadmap](https://www.klicker.uzh.ch/development) - Upcoming features
- [Changelog](CHANGELOG.md) - Release history
- [API Documentation](docs/API.md) - GraphQL schema reference

**Support Expectations:** We provide best-effort support but don't have a dedicated support team. Response times may vary based on team availability and project funding.

## Team

KlickerUZH is developed by the **Teaching Center** at the **Department of Finance**, University of Zurich, Switzerland.

**Maintainers:**
- Roland Schlaefli ([@rschlaefli](https://github.com/rschlaefli))
- Julius Schlapbach ([@juliusbschlapbach](https://github.com/uzh-bf))

**Contributors:** See [package.json](package.json#L14-L26) and [GitHub contributors](https://github.com/uzh-bf/klicker-uzh/graphs/contributors)

## License

KlickerUZH is licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE.md)**.

**What this means:**
- ✅ Use KlickerUZH freely for any purpose
- ✅ Modify the software as needed
- ✅ Distribute your modifications
- ⚠️ Any modifications must be open-sourced under AGPL-3.0
- ⚠️ Network use constitutes distribution (must share modifications)

This ensures that KlickerUZH and all derivatives remain open source and benefit the entire community.

## Sponsors & Funding

KlickerUZH development is funded through:
- University of Zurich Teaching Center
- Project-based grants
- Catalyst program participants

Interested in sponsoring KlickerUZH development? [Contact us](mailto:klicker@bf.uzh.ch).

## Citation

If you use KlickerUZH in your research or teaching, please cite:

```bibtex
@software{klickeruzh2025,
  title = {KlickerUZH: Open Source Audience Interaction Platform},
  author = {Schlaefli, Roland and Schlapbach, Julius},
  year = {2025},
  url = {https://www.klicker.uzh.ch},
  version = {3.4.0}
}
```

## Acknowledgments

KlickerUZH uses the excellent [UZH Design System](https://github.com/uzh-bf/design-system) for consistent UI components and theming.

Special thanks to all our [contributors](https://github.com/uzh-bf/klicker-uzh/graphs/contributors) who have helped make KlickerUZH better!

---

**Ready to contribute?** Start with our [Contributing Guide](CONTRIBUTING.md) or join the [Community Forum](https://community.klicker.uzh.ch/)!

**Need help?** Check the [FAQ](https://www.klicker.uzh.ch/faq) or [create a discussion](https://github.com/uzh-bf/klicker-uzh/discussions).
