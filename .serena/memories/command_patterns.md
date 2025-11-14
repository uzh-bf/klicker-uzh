# Development Command Patterns

## Command Philosophy

KlickerUZH uses pnpm workspaces with Turbo for monorepo management. Commands follow consistent patterns that can be executed globally or targeted to specific packages. Understanding command patterns enables efficient development workflows.

## Command Discovery Strategy

### Finding Available Commands

**Package-level scripts:**
- Root package.json defines global orchestration commands
- Each package defines domain-specific scripts
- Turbo configuration defines build and development tasks
- Docker Compose manages infrastructure services

**Standard naming patterns:**
- `dev`: Start development mode with hot reload
- `build`: Create production-ready builds
- `test`: Execute test suites
- `check`: Run quality validation (types, format, lint)
- `clean`: Remove build artifacts and caches

### Command Structure

**Monorepo command patterns:**
- Root-level commands orchestrate across packages
- Package-specific commands use filter flags for targeting
- Infrastructure commands use Docker Compose patterns
- Platform-specific variations for cross-platform support

## Environment Setup

### Initial Configuration

**One-time setup requirements:**
- Local domain configuration for development
- SSL certificate generation for HTTPS
- Dependency installation across workspace
- Database schema initialization
- Infrastructure service setup

**Setup principles:**
- Automated where possible
- Platform-adaptive for different operating systems
- Reproducible across development environments
- Well-documented for new contributors

## Development Workflows

### Starting Development

**Multiple development modes:**
- **Full environment**: Complete stack with external integrations
- **Offline mode**: Self-contained without external dependencies
- **Infrastructure-only**: Database and services without applications
- **Service-selective**: Run specific applications as needed

**Mode selection criteria:**
- Feature requirements determine necessary services
- Development focus guides service selection
- Resource constraints influence mode choice
- Testing needs affect infrastructure requirements

### Code Quality Operations

**Quality assurance patterns:**
- **Formatting**: Automated code formatting validation and application
- **Linting**: Code quality and style rule enforcement
- **Type Checking**: TypeScript validation across package boundaries
- **Comprehensive**: Combined validation for pre-commit checks

**Execution levels:**
- Individual file or directory targeting
- Package-level quality checks
- Workspace-wide validation
- Pre-commit automated validation

### Build and Test Operations

**Build patterns:**
- Development builds with source maps and fast refresh
- Production builds with optimization and minification
- Test builds with instrumentation for coverage
- Package-specific builds for targeted development

**Test execution:**
- Unit tests for package-specific logic
- Integration tests for service interactions
- End-to-end tests for complete user workflows
- Test watch mode for iterative development

## Database Management

### Schema Operations

**Database workflow patterns:**
- **Migrations**: Version-controlled schema evolution
- **Seeding**: Test and development data setup
- **Studio**: Visual database exploration
- **Synchronization**: Cross-package schema consistency

**Migration principles:**
- Named migrations for clarity
- Tested migrations before deployment
- Reversible migrations when possible
- Coordinated across dependent services

## Package Operations

### Workspace Targeting

**Filter patterns:**
- Target specific packages by name
- Execute commands in package subsets
- Coordinate changes across related packages
- Manage inter-package dependencies

**Package naming:**
- Scoped packages under organizational namespace
- Descriptive names indicating purpose
- Consistent naming across frontend and backend
- Clear separation of application and library packages

### Service-Specific Patterns

**Application types:**
- **Frontend applications**: Next.js development with hot reload
- **Backend services**: GraphQL development with type generation
- **Worker services**: Background job development and testing
- **Function applications**: Serverless function local development

## Release Management

### Versioning

**Release patterns:**
- Standard semantic versioning for production releases
- Pre-release channels for testing (alpha, beta, RC)
- Dry run options for validation before execution
- Automated changelog generation from commits

**Release workflow:**
- Version bump following semantic conventions
- Changelog update with release notes
- Tag creation for version tracking
- Deployment triggered by release completion

## Platform Considerations

### Cross-Platform Development

**Platform adaptation:**
- macOS with native Docker Desktop integration
- Windows Subsystem for Linux configuration
- Linux with direct Docker setup
- Platform-specific service configurations

**Configuration differences:**
- Network configuration varies by platform
- Path resolution platform-dependent
- Service access patterns platform-specific
- Docker integration platform-adapted

## Environment Variables

### Configuration Management

**Configuration sources:**
- Secret management for sensitive configuration
- Local environment files for development overrides
- Docker environment for container-specific settings
- Build-time versus runtime variable distinction

**Access patterns:**
- Frontend uses build-time environment variables
- Backend accesses runtime configuration
- Workers inherit environment from orchestration
- Containers receive environment from orchestration

## Default Development Data

### Test Account Strategy

**Seeded accounts:**
- Role-specific accounts for different user types
- Consistent credentials across environments
- Pre-configured course and activity data
- Element library for content testing

**Data consistency:**
- Predictable identifiers for testing
- Realistic data volumes for performance testing
- Clean state reset capabilities
- Privacy-safe test data patterns

## Troubleshooting Patterns

### Diagnostic Operations

**Common diagnostic needs:**
- Port conflict identification and resolution
- Service status verification
- Log access for debugging
- Database connectivity testing

### Reset Operations

**Environment cleanup:**
- Container state reset
- Database recreation with fresh schema
- Cache clearing for build and runtime
- Dependency reinstallation when needed

## Command Reference Discovery

For current command implementations:
- Review root package.json for global scripts
- Check individual package.json files for package-specific commands
- Examine turbo.json for build orchestration configuration
- Reference docker-compose.yml for service management
- Consult platform-specific scripts in util directory

This pattern-based approach enables discovery of current commands while understanding the principles that guide command structure and usage.
