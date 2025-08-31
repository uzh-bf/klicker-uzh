# Project Structure

## Monorepo Architecture

KlickerUZH is organized as a monorepo using pnpm workspaces with Turbo for build orchestration. The structure follows domain-driven design principles with clear separation between applications, shared packages, and infrastructure.

## Top-Level Organization

### Application Layer (`apps/`)

User-facing applications organized by function:

- **Frontend Applications**: Student, lecturer, and controller interfaces
- **Backend Services**: API and processing services
- **Function Applications**: Serverless processing functions
- **Integration Services**: LMS and external service integration
- **Authentication Services**: Identity and access management
- **Workflow Services**: Hatchet-based distributed processing
  - **hatchet-worker-general**: General purpose workflow worker
  - **hatchet-worker-response-processor**: Response processing worker
  - **response-api**: Dedicated response handling API service

### Shared Package Layer (`packages/`)

Reusable packages shared across applications:

- **Data Layer**: Database schema, migrations, and ORM
- **API Layer**: GraphQL schema, resolvers, and business logic
- **Business Logic**: Domain-specific logic and calculations
- **Type Definitions**: Shared TypeScript types
- **Utilities**: Common functions and helpers
- **UI Components**: Shared React components
- **Internationalization**: Multi-language support
- **Workflow Tasks**: Hatchet task definitions and workflow orchestration (`packages/hatchet-tasks`)

### Infrastructure Layer

Supporting infrastructure and tooling:

- **Testing Infrastructure**: E2E tests and test utilities
- **Deployment Configuration**: Kubernetes and containerization
- **Development Tools**: Local development utilities
- **CI/CD Workflows**: Automation and quality assurance

## Architectural Boundaries

### Domain Separation

Clear boundaries between business domains:

- **User Management**: Authentication, profiles, and access control
- **Content Management**: Questions, activities, and curriculum
- **Learning Delivery**: Live sessions, practice, and assessment
- **Analytics**: Performance tracking and reporting
- **Collaboration**: Group work and communication

### Technology Layers

Separation by technical concerns:

- **Presentation Layer**: User interfaces and interaction
- **API Layer**: GraphQL operations and data access
- **Business Logic Layer**: Domain rules and calculations
- **Data Layer**: Persistence and data modeling
- **Integration Layer**: External service communication

## Package Organization Patterns

### Frontend Applications

Standard Next.js application structure:

- **Pages**: Route definitions and page components
- **Components**: Feature-organized React components
- **Utilities**: Application-specific utilities and hooks
- **Types**: TypeScript definitions
- **Styles**: Styling and theme configuration

### Backend Services

Node.js service structure:

- **Source**: Main application logic
- **Configuration**: Environment and service configuration
- **Types**: Service-specific type definitions
- **Testing**: Unit and integration tests

### Shared Packages

Consistent internal package structure:

- **Source**: Package implementation
- **Types**: Exported type definitions
- **Testing**: Package-specific tests
- **Documentation**: Package usage documentation

## Configuration Management

### Build Configuration

- **Monorepo Config**: Workspace and dependency management
- **Build Orchestration**: Turbo configuration for builds and tasks
- **Code Quality**: Linting, formatting, and type checking
- **Environment**: Development and production configurations

### Development Tools

- **Local Development**: Docker Compose and reverse proxy setup
- **Database Tools**: Migration and seeding utilities
- **Testing Tools**: E2E and unit testing configuration
- **Deployment Tools**: Container and Kubernetes configurations

## File Organization Principles

### Modular Structure

- **Feature-Based**: Components organized by business feature
- **Layer-Based**: Clear separation of technical concerns
- **Domain-Based**: Business domain boundaries respected
- **Reusability**: Shared code extracted to packages

### Naming Conventions

- **Descriptive Names**: Clear indication of purpose and scope
- **Consistent Patterns**: Similar naming across similar components
- **TypeScript Conventions**: PascalCase for components, camelCase for functions
- **File Extensions**: Appropriate extensions for file types

## Dependency Management

### Package Dependencies

- **Internal Dependencies**: References between internal packages
- **External Dependencies**: Third-party package management
- **Version Coordination**: Consistent versions across packages
- **Dependency Isolation**: Minimal cross-package coupling

### Build Dependencies

- **Development Dependencies**: Tools and utilities for development
- **Runtime Dependencies**: Required for application execution
- **Build Dependencies**: Compilation and build process requirements
- **Test Dependencies**: Testing framework and utilities

## Code Organization Patterns

### Business Logic Separation

- **Services**: Business logic implementation
- **Utilities**: Pure functions and helpers
- **Types**: Data structure definitions
- **Constants**: Shared constants and configurations

### Component Organization

- **Feature Components**: Domain-specific UI components
- **Shared Components**: Reusable UI elements
- **Layout Components**: Page structure and navigation
- **Utility Components**: Low-level UI utilities

## Development Workflow Integration

### Build System Integration

- **Workspace Awareness**: Build system understands package relationships
- **Incremental Builds**: Only rebuild changed packages
- **Parallel Execution**: Concurrent package operations
- **Cache Management**: Shared build cache across packages

### Quality Assurance Integration

- **Code Quality**: Consistent quality checks across packages
- **Testing Strategy**: Coordinated testing across package boundaries
- **Documentation**: Integrated documentation generation
- **Release Management**: Coordinated versioning and releases

For specific directory structures and current organization, explore the repository structure directly or refer to individual package README files for detailed organization within each package.
