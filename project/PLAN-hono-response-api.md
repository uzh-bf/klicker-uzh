# Hono Response-API Refactoring Plan

## Overview
Refactor the response-api from Node.js built-in HTTP server to Hono framework, implementing security best practices, type-safe validation, and structured logging while maintaining all existing functionality.

## Phase 1: Setup and Dependencies
1. **Update package.json**
   - Add Hono and middleware dependencies:
     - `hono` - Core framework
     - `@hono/node-server` - Node.js adapter
     - `@hono/zod-validator` - Validation middleware
     - `zod` - Schema validation
     - `hono-pino` - Structured logging
     - `pino` - Logger

2. **Create TypeScript types**
   - Define request/response schemas with Zod
   - Create type definitions for all endpoints
   - Ensure compatibility with existing JWTPayload type

## Phase 2: Core Application Structure
1. **Create new app structure** (`src/app.ts`)
   - Initialize Hono application
   - Configure global middleware stack:
     - CORS with dynamic origin validation
     - Body limit (1MB as currently configured)
     - Secure headers
     - CSRF protection for POST endpoints
     - Request logging with hono-pino
   
2. **Implement validation schemas**
   - AddResponse schema for standard mode
   - AddAssessmentResponse schema for assessment mode
   - Shared response validation logic

## Phase 3: Route Implementation
1. **Health check routes**
   - GET `/healthz` - Health status endpoint
   - GET `/` - Root health check

2. **Response handling routes**
   - POST `/AddResponse` - Main response endpoint
     - Standard mode handler with cookie forwarding
     - Assessment mode handler with JWT verification
     - Proper error responses with structured logging

3. **Error handling**
   - Global error handler for uncaught errors
   - Validation error formatting
   - Consistent error response structure

## Phase 4: Middleware Configuration
1. **CORS Middleware**
   - Dynamic origin validation from environment
   - Credentials support for cookies
   - Proper preflight handling

2. **Security Middleware**
   - CSRF protection with origin validation
   - Secure headers configuration
   - Body size limit enforcement

3. **Logging Middleware**
   - Request/response logging with pino
   - Correlation ID tracking
   - Performance metrics

## Phase 5: Service Integration
1. **Redis connection**
   - Maintain existing Redis client setup
   - Error handling for connection issues

2. **Hatchet integration**
   - Preserve event publishing logic
   - Maintain audit logging patterns

3. **JWT verification**
   - Keep existing JWT utility usage
   - Type-safe payload handling

## Phase 6: Server Configuration
1. **Update index.ts**
   - Import Hono app from app.ts
   - Use @hono/node-server for Node.js runtime
   - Maintain PORT configuration
   - Proper shutdown handling

2. **Environment configuration**
   - Preserve all existing environment variables
   - Add any new Hono-specific configurations

## Phase 7: Testing & Validation
1. **Type checking**
   - Ensure all TypeScript types are correct
   - Validate request/response interfaces

2. **Functionality testing**
   - Test both standard and assessment modes
   - Verify CORS behavior
   - Validate error handling
   - Check audit logging

3. **Performance validation**
   - Ensure no performance regression
   - Validate memory usage

## Phase 8: Documentation & Cleanup
1. **Update documentation**
   - Document new middleware configuration
   - Add validation schema documentation
   - Update deployment notes if needed

2. **Code cleanup**
   - Remove unused dependencies
   - Clean up old HTTP server code
   - Ensure consistent code style

## Key Benefits
- **Type Safety**: End-to-end type safety with Zod validation
- **Security**: Built-in CSRF, CORS, and security headers
- **Maintainability**: Cleaner, more modular code structure
- **Observability**: Structured logging with hono-pino
- **Performance**: Optimized middleware pipeline
- **Developer Experience**: Better error messages and validation

## Migration Notes
- All existing API contracts remain unchanged
- Cookie handling logic preserved
- Hatchet event publishing unchanged
- Redis operations maintain same patterns
- Environment variables remain compatible
- Docker deployment unchanged

## Implementation Checklist

### Dependencies to Add
```json
{
  "hono": "^4.x",
  "@hono/node-server": "^1.x",
  "@hono/zod-validator": "^0.x",
  "zod": "^3.x",
  "hono-pino": "^0.x",
  "pino": "^9.x"
}
```

### Files to Create
- [ ] `src/app.ts` - Main Hono application
- [ ] `src/schemas/index.ts` - Zod validation schemas
- [ ] `src/routes/health.ts` - Health check routes
- [ ] `src/routes/response.ts` - Response handling routes
- [ ] `src/middleware/index.ts` - Custom middleware
- [ ] `src/lib/redis.ts` - Redis client setup
- [ ] `src/lib/logger.ts` - Logger configuration

### Files to Modify
- [ ] `src/index.ts` - Server startup
- [ ] `package.json` - Dependencies
- [ ] `tsconfig.json` - If needed for Hono

### Testing Requirements
- [ ] Standard response mode works
- [ ] Assessment response mode works
- [ ] CORS headers are correct
- [ ] CSRF protection is active
- [ ] Body size limits work
- [ ] Error responses are structured
- [ ] Logging captures all requests
- [ ] Performance is acceptable
- [ ] Docker container builds
- [ ] Deployment works in K8s

### Rollback Plan
If issues arise during deployment:
1. Keep old implementation alongside new
2. Use feature flag to switch between implementations
3. Monitor error rates and performance
4. Quick rollback via container image swap