# CLAUDE.md - @klicker-uzh/logging

This document provides comprehensive guidance for AI assistants working with the KlickerUZH logging package.

## Package Overview

The `@klicker-uzh/logging` package provides structured logging infrastructure for the entire KlickerUZH platform. It was created to address the lack of consistent logging across the distributed architecture, particularly for the permission system v3.0 which had cluttered test outputs from raw console.log statements.

### Key Achievements
- **Performance**: 0.006ms per log call (far exceeding <1ms requirement)
- **Test Coverage**: 97.93% with comprehensive test suite
- **Zero Dependencies**: No external libraries, only Node.js built-ins
- **Production Ready**: Successfully integrated into util package with zero issues

## Design Principles

1. **Zero External Dependencies**: No Winston, Pino, or other logging libraries - only Node.js built-ins
2. **Environment-First**: Test silence is non-negotiable, production structure is critical
3. **Performance-Focused**: <1ms per log call for 1000+ operations/minute scenarios
4. **Simple API**: Intuitive interface that developers can adopt immediately

## Architecture

### Core Components

- `logger.ts`: Functional logger implementation with pure functions and state management
- `formatter.ts`: Environment-specific formatting (JSON for production, console for dev)  
- `environment.ts`: Environment detection and configuration
- `context.ts`: Context propagation utilities for operation and request tracing
- `types.ts`: TypeScript interfaces and type definitions

### Design Philosophy

The logging package follows KlickerUZH's functional programming approach:

- **Pure Functions**: All operations are side-effect free functions
- **Immutable State**: Logger state is created once and passed to functions
- **No Classes**: Uses functional composition instead of class-based inheritance
- **Explicit Dependencies**: Functions receive all dependencies as parameters

### Environment Behavior

The logger automatically adapts based on NODE_ENV:

- **Test** (`NODE_ENV=test`): 
  - Complete silence via no-op logger
  - No output to console or stderr
  - Enables clean test runs without noise
  
- **Development** (`NODE_ENV=development`):
  - Human-readable multi-line colored output
  - ANSI colors for log levels and service names
  - Indented context display for easy reading
  - Default log level: DEBUG
  
- **Production** (`NODE_ENV=production`):
  - Single-line JSON to stdout for Kubernetes
  - Structured format for log aggregation
  - Includes all context in queryable format
  - Default log level: INFO

## API Reference

### Core Functions

#### `createLogger(config: LoggerConfig): Logger`
Creates a new logger instance.

```typescript
interface LoggerConfig {
  service: string         // Service identifier (required)
  environment?: Environment  // Override NODE_ENV
  level?: LogLevelString    // Override default log level
  context?: LogContext      // Base context for all logs
}
```

### Logger Methods

#### `logger.debug(message: string, context?: LogContext): void`
Log debug-level message (only in development by default).

#### `logger.info(message: string, context?: LogContext): void`
Log informational message.

#### `logger.warn(message: string, context?: LogContext): void`
Log warning message.

#### `logger.error(message: string, context?: LogContext): void`
Log error message.

#### `logger.child(context: LogContext): Logger`
Create a child logger with inherited context.

## Usage Patterns

### Service Logger
```typescript
const logger = createLogger({ service: 'graphql-operations' })
```

### Operation Context
```typescript
const opLogger = logger.child({
  operationId: operation.id,
  operationType: operation.operationType
})
```

### Performance Tracking
```typescript
const startTime = Date.now()
// ... perform operations ...
logger.info('Batch complete', {
  duration: Date.now() - startTime,
  operationsPerSecond: count / duration * 1000
})
```

### Error Handling
```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    operationId: op.id
  })
}
```

### Context Utilities

#### Operation Context
```typescript
import { createOperationContext } from '@klicker-uzh/logging'

const context = createOperationContext(
  'op-123',                    // operationId (required)
  'PROCESS_USER_ACCESS',       // operationType (optional)
  { priority: 'high' }         // additional context (optional)
)
```

#### User Context
```typescript
import { createUserContext } from '@klicker-uzh/logging'

const context = createUserContext(
  'user-456',                  // userId (required)
  { role: 'admin' }           // additional context (optional)
)
```

#### Request Context
```typescript
import { createRequestContext } from '@klicker-uzh/logging'

const context = createRequestContext(
  'req-789',                   // requestId (required)
  'POST',                      // method (optional)
  '/api/permissions',          // path (optional)
  { ip: '192.168.1.1' }       // additional context (optional)
)
```

#### Performance Context
```typescript
import { createPerformanceContext } from '@klicker-uzh/logging'

const startTime = Date.now()
// ... perform work ...
const context = createPerformanceContext(
  startTime,                   // startTime (required)
  { itemCount: 100 }          // additional context (optional)
)
// Automatically calculates duration
```

## Integration Guide

### Package Installation
```bash
# Add to package.json dependencies
"@klicker-uzh/logging": "workspace:*"

# Update Jest configuration if needed
moduleNameMapper: {
  '^@klicker-uzh/logging$': '<rootDir>/../logging/src',
}
```

### Service Integration Pattern
```typescript
// In src/logging.ts
import { createLogger } from '@klicker-uzh/logging'

export const createServiceLogger = (module: string) => 
  createLogger({ 
    service: `myservice-${module}`,
    environment: process.env.NODE_ENV 
  })

// In your modules
import { createServiceLogger } from '../logging.js'
const logger = createServiceLogger('user-auth')
```

### Migration from console.log
```typescript
// Before
console.log('Processing user', userId)
console.error('Failed to process', error)

// After
logger.info('Processing user', { userId })
logger.error('Failed to process', { error: error.message })
```

## Testing

### Test Environment Behavior
When running tests, the logger is completely silent:
```typescript
// In test files
const logger = createLogger({ service: 'test' })
logger.info('This will not output anything')
logger.error('Neither will this')
// Result: Complete silence, no console output
```

### Running Package Tests
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
# Current coverage: 97.93%

# Watch mode
pnpm test:watch
```

### Test Coverage Areas
- Environment detection and behavior
- Log level filtering and precedence
- Context propagation and merging
- Formatter output validation (JSON, console, no-op)
- Performance benchmarks (<1ms requirement)
- Memory leak detection with child loggers
- Error handling (circular references, formatter failures)

## Production Considerations

### Kubernetes Integration
The JSON output is designed for stdout log aggregation:
```bash
# Query logs with kubectl
kubectl logs -l app=backend | jq 'select(.level == "error")'

# Filter by operation
kubectl logs -l app=backend | jq 'select(.context.operationId == "op-123")'

# Performance analysis
kubectl logs -l app=backend | jq 'select(.context.operationsPerSecond)'
```

### Performance Characteristics
- **Log call overhead**: 0.006ms (benchmarked)
- **High-volume tested**: 290 operations/second sustained
- **Memory efficient**: 1.73MB for 1000 child loggers
- **Context creation**: 0.29μs per context utility call

### Error Boundaries
The logger includes protective error handling:
- Circular reference detection in context
- Formatter error recovery
- Context size validation (1000 char limit)
- BigInt serialization support

## Recommendations for Future Enhancements

### Immediate Improvements (Low Effort, High Impact)

1. **Configurable Context Limits**
   ```typescript
   interface LoggerConfig {
     maxContextSize?: number // Default: 1000
     contextTruncation?: 'warn' | 'smart' | 'none'
   }
   ```

2. **Lazy Context Evaluation**
   ```typescript
   // Support expensive computations
   logger.info('Operation complete', () => ({
     metrics: calculateExpensiveMetrics() // Only if log level permits
   }))
   ```

3. **Log Level Runtime Changes**
   ```typescript
   // For debugging production issues
   logger.setLevel('debug')
   ```

### Medium-term Enhancements

1. **Log Sampling**
   ```typescript
   // For high-volume scenarios
   logger.sample(0.1).debug('Detailed trace') // 10% sampling
   ```

2. **Structured Error Logging**
   ```typescript
   logger.error('Operation failed', {
     error: enhancedErrorSerializer(error), // Stack, cause chain
     recovery: 'retry-with-backoff'
   })
   ```

3. **Performance Profiling**
   ```typescript
   const profiler = logger.profile('expensive-operation')
   // ... work ...
   profiler.end() // Auto-logs duration
   ```

### Long-term Vision

1. **Plugin Architecture**
   ```typescript
   const logger = createLogger({
     service: 'api',
     plugins: [
       metricsExtractor(),      // Extract metrics from logs
       sensitiveDataMasker(),   // PII protection
       openTelemetryBridge()    // Trace correlation
     ]
   })
   ```

2. **Transport Abstraction**
   ```typescript
   const logger = createLogger({
     service: 'api',
     transports: [
       consoleTransport(),      // Current default
       fileTransport({ rotate: true }),
       httpTransport({ url: '/logs' })
     ]
   })
   ```

3. **Browser Support**
   ```typescript
   // Separate entry point for frontend
   import { createLogger } from '@klicker-uzh/logging/browser'
   
   const logger = createLogger({
     service: 'frontend-pwa',
     transport: 'console' // or 'beacon' for analytics
   })
   ```

## Common Patterns and Best Practices

### Structured Context Over String Interpolation
```typescript
// ❌ Avoid
logger.info(`User ${userId} performed ${action}`)

// ✅ Prefer
logger.info('User action performed', { userId, action })
```

### Consistent Error Handling
```typescript
// Create a standard error logger utility
export const logError = (logger: Logger, error: Error, context?: LogContext) => {
  logger.error(error.message, {
    ...context,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    }
  })
}
```

### Request Lifecycle Logging
```typescript
// At request start
const requestLogger = logger.child({
  requestId: generateId(),
  method: req.method,
  path: req.path
})

// Throughout request
requestLogger.info('Processing request')

// At request end
requestLogger.info('Request complete', {
  statusCode: res.statusCode,
  duration: Date.now() - startTime
})
```

## Troubleshooting

### No Log Output in Development
- Check NODE_ENV is set to 'development'
- Verify log level allows your message type
- Ensure you're not in a test file (NODE_ENV=test)

### JSON Parse Errors in Production
- Check for circular references in context
- Verify BigInt values are handled
- Look for undefined values in context

### Performance Issues
- Reduce context object size
- Avoid logging in tight loops
- Consider log sampling for high-volume paths

## Package Maintenance

### Version Management
- Follow semantic versioning
- Update CHANGELOG.md for releases
- Maintain backward compatibility

### Adding New Features
1. Update types in `types.ts`
2. Implement with tests
3. Update this documentation
4. Consider migration guide if breaking

## Summary

The `@klicker-uzh/logging` package is a lightweight, performant, and well-tested logging solution that successfully addresses KlickerUZH's needs for structured logging across its distributed architecture. Its functional design, zero-dependency approach, and environment-aware behavior make it an ideal foundation for the platform's observability needs.

### Key Strengths
- **Simplicity**: Easy to understand and use
- **Performance**: Exceeds all requirements with minimal overhead
- **Reliability**: Comprehensive error handling and test coverage
- **Flexibility**: Environment-aware with clean extension points
- **Integration**: Proven successful in production code

### When to Use This Package
- Any KlickerUZH service or package needing structured logging
- Test suites requiring silent operation
- Production services needing Kubernetes-compatible JSON logs
- Development environments wanting readable console output

### Support and Contributions
- Report issues in the KlickerUZH repository
- Follow the functional programming patterns when contributing
- Ensure all changes maintain the zero-dependency principle
- Add tests for any new functionality