# CLAUDE.md - Backend Docker Application

This file provides guidance to Claude Code for working specifically with the backend-docker application in the KlickerUZH project.

## Application Overview

The backend-docker application is the core API server of KlickerUZH, providing GraphQL API endpoints for all frontend applications. It serves as the central connection point between client applications and the database, implementing business logic and enforcing security.

### Key Responsibilities

- Hosting the GraphQL API with GraphQL Yoga
- Processing GraphQL operations (queries, mutations, subscriptions)
- Authentication and authorization enforcement
- Real-time data with WebSocket subscriptions
- Database interactions via Prisma
- Redis-based caching and event systems
- Migration runner for database schema changes

## Architecture

The backend-docker application is a Node.js service using Express and GraphQL Yoga, containerized for deployment in Docker/Kubernetes environments.

### Core Components

- **GraphQL Server**: GraphQL Yoga-based API server with schema from @klicker-uzh/graphql
- **Authentication**: JWT-based authentication with Passport.js
- **Subscriptions**: WebSocket server for real-time data with Redis-backed PubSub
- **Caching**: Redis-based response caching for performance optimization
- **Database Access**: Prisma Client for type-safe database operations
- **Migration System**: Runtime migration support for database changes

### File Structure

- `src/app.ts`: Express application setup with middleware and GraphQL configuration
- `src/index.ts`: Main entry point that initializes server, database, and subscriptions
- `src/migration.ts`: Runtime migration system for database schema evolution

## Configuration and Environment

The application is configured through environment variables, with different sources based on the environment:

### Environment Variables

- In production: Provided by Kubernetes/deployment environment
- In development: Managed through Doppler (recommended)

Key environment variables include:

- `APP_SECRET`: Secret key for JWT signing and verification
- `APP_*_SUBDOMAIN`: Domain configuration for different applications
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`: Redis connection settings
- `REDIS_CACHE_*`: Redis cache instance configuration
- `PRISMA_OPTIMIZE`: Enable Prisma query optimization (development)
- `NODE_ENV`: Environment setting (development, test, production)
- `DEBUG`: Enable detailed debug logging

## GraphQL Implementation

The GraphQL server is implemented using GraphQL Yoga with several plugins:

### Plugins and Enhancements

- **GraphQL Armor**: Security protection against malicious queries
- **CSRF Prevention**: Protection against cross-site request forgery
- **Persisted Operations**: Support for operation persisting in production
- **Response Cache**: Optional caching of query responses

### Schema and Context

- Schema is imported from the @klicker-uzh/graphql package
- Context is enhanced with:
  - Prisma client for database access
  - User authentication details from JWT
  - Redis for caching and pub/sub
  - Event emitter for application events

## Authentication System

Authentication is implemented using Passport.js with JWT strategy:

### JWT Authentication

- JWT tokens are extracted from:
  - Cookie: `next-auth.session-token` for lecturer frontends
  - Cookie: `participant_token` for student frontend
  - Authorization header: Bearer token for API access
- Token verification with APP_SECRET environment variable
- User information attached to request context for resolvers

## WebSocket Subscriptions

The application supports real-time data through GraphQL subscriptions:

### Subscription Implementation

- WebSocketServer integration with GraphQL Yoga
- Redis-backed PubSub system for cross-instance scaling
- Custom event target for subscription events
- Shared schema and context with HTTP operations

## Redis Integration

Redis is used for several critical functions:

### Redis Instances

- **Redis Exec**: For general operations, caching, and pub/sub
- **Redis Cache**: Dedicated instance for GraphQL response caching

### Redis Use Cases

- PubSub for GraphQL subscriptions
- Response caching for performance
- Cross-instance message passing
- Cache invalidation via event emitter

## Migration System

The application includes a runtime migration system:

### Migration Framework

- Tracks migrations in the database
- Supports idempotent and transactional migrations
- Executes migrations on application startup
- Used for data transformations beyond Prisma's capabilities

## Performance Optimization

Several strategies are employed for performance:

### Optimization Techniques

- Response caching for frequent queries
- Prisma query optimization (in development environment)
- Redis-based subscription broadcasting
- Efficient GraphQL schema with proper field resolvers

## Security Features

Security is a key concern addressed through multiple layers:

### Security Mechanisms

- GraphQL Armor for query protection
- CSRF prevention plugin
- Strict CORS configuration
- JWT authentication and verification
- Permission checks in resolvers

## Docker Configuration

The application is containerized using a multi-stage Dockerfile:

### Docker Stages

1. **Base**: Node.js Alpine base image
2. **Dependencies**: Package installation and dependency pruning
3. **Builder**: Application building with TypeScript compilation
4. **Runtime**: Minimal production image with only required files

### Docker Best Practices

- Multi-stage builds for size optimization
- Non-root user (nodejs) for container execution
- Proper dependency management with pnpm
- Intelligent layer caching

## Development Workflow

### Common Commands

```bash
# Build the application
pnpm build

# Start the development server
pnpm dev

# Run with test coverage
pnpm test

# Run type checking
pnpm check

# Start the application (after building)
pnpm start
```

### Development Best Practices

1. Use environment variables through Doppler for consistency
2. Test GraphQL operations through GraphQL Playground
3. Check Redis connections for subscription testing
4. Verify authentication flow with proper tokens

## Integration with Other Packages

The backend-docker application integrates with:

- **@klicker-uzh/graphql**: GraphQL schema and resolvers
- **@klicker-uzh/prisma**: Database client and models
- **@klicker-uzh/grading**: Grading and scoring logic
- **@klicker-uzh/types**: Shared TypeScript types

## Common Tasks

### Adding New Environment Variables

1. Add to local `.env` file for development
2. Update Doppler configuration
3. Update Kubernetes deployment templates

### Implementing New Functionality

1. Add resolvers and services in graphql package
2. Update schema if needed
3. Test the new operations through GraphQL Playground
4. Ensure proper error handling and permissions

### Debugging Issues

1. Check GraphQL server logs
2. Verify Redis connection status
3. Inspect Prisma query logs (in development mode)
4. Test authentication flow with valid tokens

## Troubleshooting Common Issues

### GraphQL Execution Errors

If queries or mutations fail to execute:

1. Check authentication and permissions
2. Verify resolver implementation in graphql package
3. Check for proper error handling in service functions
4. Inspect GraphQL context for required dependencies

### Subscription Issues

For problems with real-time updates:

1. Verify WebSocket connection is established
2. Check Redis PubSub configuration
3. Ensure subscription resolvers are properly implemented
4. Test with simple subscription operations

### Performance Problems

If experiencing slowdowns:

1. Check for N+1 query patterns in resolvers
2. Verify Redis connection performance
3. Check for long-running operations
4. Review query complexity and depth

## Deployment Considerations

The application is designed for containerized deployment:

### Production Deployment

- Deployed in Kubernetes with Helm charts
- Configured via environment variables
- Scaled horizontally for high availability
- Requires Redis and PostgreSQL services

### Resource Requirements

- Memory: Minimum 512MB, recommended 1GB+
- CPU: Minimum 0.5 cores, recommended 1+ cores
- Storage: Minimal (logs and temporary files only)
- Network: Inbound port 3000, outbound to Redis and PostgreSQL

## Best Practices

1. Follow the error handling patterns established in the codebase
2. Use transactions for multi-step database operations
3. Implement proper authentication and authorization checks
4. Add comprehensive logging for production debugging
5. Keep GraphQL operations focused and efficient
6. Use proper caching strategies for frequently accessed data
7. Implement proper retry mechanisms for external services
8. Follow the established security practices

## Learning Resources

- [GraphQL Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Redis Documentation](https://redis.io/docs)
- [Docker Documentation](https://docs.docker.com/)
