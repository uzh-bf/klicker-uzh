# Development Command Patterns

## Command Structure

KlickerUZH uses pnpm workspaces with Turbo for monorepo management. Commands can be run at the root level for global operations or within specific packages for targeted actions.

## Common Command Categories

### Environment Setup (One-time)

Essential setup for new developers:

- Local domain configuration (\*.klicker.com)
- HTTPS certificate generation (mkcert)
- Dependency installation
- Database initialization
- Docker service setup

### Development Workflow

#### Starting Development

Multiple development modes available:

- **Full environment**: With external services and secret management
- **Offline mode**: Self-contained without external dependencies
- **Infrastructure-only**: Database, cache, and proxy services
- **Production data**: Using production data dumps for testing

#### Code Quality

Quality assurance commands run at root or package level:

- **Formatting**: Check and apply code formatting
- **Linting**: Code quality and style validation
- **Type Checking**: TypeScript validation across packages

#### Building & Testing

Build and test commands support both development and production:

- **Build**: Compile all packages with optimization
- **Test**: Unit tests, E2E tests, and comprehensive test suites
- **Validation**: Pre-deployment checks and validation

### Database Management

Database operations follow Prisma patterns:

- **Migrations**: Schema change management
- **Seeding**: Test data and development data setup
- **Studio**: Visual database exploration
- **Schema Sync**: Synchronization across packages

### Release Management

Structured release process with versioning:

- **Standard releases**: Production-ready versions
- **Pre-releases**: Alpha, beta, and release candidate versions
- **Dry runs**: Preview release changes without execution

## Package-Specific Operations

### Workspace Commands

Commands can target specific packages:

- Use `--filter` flag for package-specific operations
- Package names follow `@klicker-uzh/{package-name}` pattern
- Common packages: frontend-manage, graphql, prisma, shared-components

### Service Operations

Different applications have specific development patterns:

- **Frontend apps**: Next.js development with hot reload
- **Backend services**: GraphQL development with type generation
- **Functions**: Azure Functions local development

## Local Development Environment

### Service Architecture

Local development uses custom domain setup:

- **Reverse Proxy**: Traefik handles routing between services
- **Custom Domains**: \*.klicker.com for all services
- **HTTPS**: Local certificates for production-like setup
- **Docker Services**: Database, cache, and infrastructure services

### Platform Considerations

Development setup varies by platform:

- **macOS**: Native Docker Desktop integration
- **WSL**: Windows Subsystem for Linux configuration
- **Linux**: Direct Docker configuration

## Command Discovery

### Finding Available Commands

- **Root package.json**: Global scripts and orchestration commands
- **Package-specific**: Each package defines its own scripts
- **Turbo configuration**: Build and development task definitions
- **Docker Compose**: Service management commands

### Common Script Names

Standard script naming patterns across packages:

- `dev`: Development mode
- `build`: Production build
- `test`: Run tests
- `check`: Quality checks (types, format, lint)
- `clean`: Clean build artifacts

## Environment Variables

### Configuration Management

- **Doppler**: Centralized secret management (preferred)
- **Environment Files**: Package-specific configuration
- **Docker Environment**: Container-specific variables
- **Development Overrides**: Local development customization

### Access Patterns

Different services access configuration differently:

- **Frontend**: Build-time environment variables
- **Backend**: Runtime configuration injection
- **Functions**: Azure Functions configuration
- **Docker**: Container environment variables

## Default Development Data

Standard test accounts are available for development:

- **Lecturer accounts**: For management interface testing
- **Student accounts**: For student interface testing
- **Course data**: Pre-seeded courses and activities
- **Element library**: Test questions and content

## Troubleshooting Commands

### System Diagnostics

Common diagnostic operations:

- **Port checking**: Identify port conflicts
- **Service status**: Check running services
- **Log access**: Service and application logs
- **Database connectivity**: Connection testing

### Reset Operations

When development environment needs cleanup:

- **Docker reset**: Clean container state
- **Database reset**: Fresh database with migrations
- **Cache clearing**: Clear build and runtime caches
- **Dependency refresh**: Clean install of dependencies

For specific command syntax and current script definitions, refer to:

- Root `package.json` for global scripts
- Individual package `package.json` files for package-specific commands
- `docker-compose.yml` for service management
- `turbo.json` for build orchestration
