# Local Development Setup

## Development Architecture

KlickerUZH uses a sophisticated local development environment that closely mirrors production with custom domains, HTTPS certificates, and microservice architecture.

## Core Principles

### Production Parity

- **Custom Domains**: All services use branded local domains instead of localhost
- **HTTPS by Default**: Local SSL certificates for secure development
- **Service Discovery**: Reverse proxy routing between services
- **Container Services**: Database and cache services in containers
- **Host Applications**: Frontend and backend applications on host system

### Service Architecture

- **Reverse Proxy**: Central routing for all local services
- **Multi-Service**: Separate services for different concerns
- **Database Layer**: PostgreSQL for persistent data
- **Cache Layer**: Multiple Redis instances for different purposes
- **Authentication**: Integrated authentication services

## Environment Components

### Domain Strategy

Local development uses custom domain configuration:

- All services accessible via \*.klicker.com domains
- Requires host file configuration for domain resolution
- SSL certificates generated for trusted local development
- Service-specific subdomains for different applications

### Infrastructure Services

Core infrastructure runs in containers:

- **Database**: PostgreSQL with persistent storage
- **Cache**: Redis instances for different use cases
- **Reverse Proxy**: Traefik for dynamic service routing
- **Workflow Orchestration**: Hatchet-lite for local workflow development
  - **Web UI**: http://localhost:8888 for workflow monitoring
  - **gRPC Server**: localhost:7077 for worker communication
  - **Configuration**: Persistent config volume for Hatchet settings
- **Development Tools**: Email testing and monitoring services

### Application Services

Applications run on host system for development:

- **Frontend Applications**: Next.js development servers
- **Backend Services**: Node.js applications with hot reload
- **Function Apps**: Local Azure Functions runtime
- **Authentication**: Dedicated authentication service

## Platform Support

### Cross-Platform Development

Development environment adapts to different platforms:

- **macOS**: Native Docker Desktop integration with host networking
- **WSL**: Windows Subsystem for Linux with Docker configuration
- **Linux**: Direct Docker setup with network configuration

### Certificate Management

HTTPS certificate setup varies by platform:

- **mkcert Integration**: Trusted certificate generation
- **Platform-Specific**: OS-specific certificate trust
- **Automatic Renewal**: Development certificate management

## Configuration Management

### Environment Variables

Development configuration through multiple sources:

- **Doppler Integration**: Centralized secret management (recommended)
- **Local Environment Files**: Package-specific configuration
- **Docker Environment**: Container-specific variables
- **Runtime Configuration**: Dynamic configuration loading

### Service Configuration

Each service maintains its own configuration:

- **Database Connection**: Automatic service discovery
- **API Endpoints**: Internal service communication
- **Authentication**: Development authentication providers
- **Feature Flags**: Development-specific feature toggles

## Development Modes

### Full Development Mode

Complete development environment with external integrations:

- All services running with external dependencies
- Real authentication providers
- External service integrations
- Production-like data flow

### Offline Development Mode

Self-contained development without external dependencies:

- Mock external services
- Local authentication
- Simplified data flows
- Faster startup and iteration

### Infrastructure-Only Mode

Minimal setup for specific development needs:

- Database and cache services only
- Manual application startup
- Selective service activation
- Resource optimization

### Production Data Mode

Development with production-like data:

- Production data dumps
- Realistic data volumes
- Complex relationships
- Performance testing capabilities

## Development Workflow

### Environment Preparation

Initial setup process:

1. Domain configuration in system hosts file
2. SSL certificate generation and trust
3. Docker service initialization
4. Database schema setup and seeding
5. Application dependency installation

### Daily Development

Standard development cycle:

1. Infrastructure service startup
2. Application service activation
3. Development server initialization
4. Real-time development with hot reload
5. Automated quality checks

### Testing Integration

Development environment supports testing:

- Test database with seeded data
- Isolated test execution
- E2E testing with real services
- Performance testing capabilities

## Service Discovery

### Automatic Routing

Reverse proxy handles service routing:

- Dynamic service registration
- Load balancing between instances
- Health checking and failover
- SSL termination and certificate management

### Development Access

Services accessible through consistent patterns:

- Web applications via branded domains
- API services through consistent endpoints
- Development tools via standard ports
- Monitoring and debugging interfaces

## Data Management

### Database Setup

Local database configuration:

- Automated schema deployment
- Test data seeding
- Migration management
- Development user accounts

### Cache Management

Redis configuration for development:

- Separate instances for different purposes
- Development-appropriate persistence
- Cache invalidation patterns
- Performance optimization

## Troubleshooting Patterns

### Common Issues

Development environment troubleshooting:

- **Domain Resolution**: Host file configuration and DNS caching
- **Certificate Issues**: SSL certificate trust and renewal
- **Port Conflicts**: Service port allocation and conflicts
- **Container Issues**: Docker service management and networking

### Diagnostic Tools

Built-in diagnostic capabilities:

- Service health checking
- Connection testing utilities
- Log aggregation and analysis
- Performance monitoring

For specific configuration files and current setup scripts, refer to:

- `docker-compose.yml` for service definitions
- `util/traefik/` for reverse proxy configuration
- Package-specific configuration files
- Platform-specific setup scripts in `util/` directory
