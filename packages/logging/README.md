# @klicker-uzh/logging

Structured logging infrastructure for KlickerUZH platform.

## Features

- **Environment-aware behavior**: Complete silence in tests, human-readable in development, structured JSON in production
- **Zero external dependencies**: Uses only Node.js built-ins for security and performance
- **Context propagation**: Create child loggers with inherited context
- **Type-safe**: Full TypeScript support with strict typing
- **Performance optimized**: <1ms per log call overhead

## Installation

```bash
pnpm add @klicker-uzh/logging
```

## Usage

```typescript
import { createLogger } from '@klicker-uzh/logging'

// Create a logger for your service
const logger = createLogger({
  service: 'my-service',
  // environment is auto-detected but can be overridden
  // level is auto-configured based on environment
})

// Log messages with different levels
logger.debug('Debug information')
logger.info('Processing started', { userId: 123 })
logger.warn('Rate limit approaching', { current: 95, max: 100 })
logger.error('Operation failed', { error: error.message })

// Create child logger with additional context
const opLogger = logger.child({ operationId: 'op-123' })
opLogger.info('Operation started') // Includes operationId in all logs
```

## Environment Behavior

- **Test** (`NODE_ENV=test`): Complete silence, no output
- **Development** (`NODE_ENV=development`): Human-readable colored console output
- **Production** (`NODE_ENV=production`): Structured JSON to stdout for log aggregation

## Performance

Designed for high-throughput scenarios with <1ms per log call overhead. Suitable for processing 1000+ operations per minute without performance impact.

## Production Queries

In production with Kubernetes:

```bash
# Find all errors
kubectl logs -l app=backend | jq 'select(.level == "error")'

# Track specific operation
kubectl logs -l app=backend | jq 'select(.context.operationId == "op-123")'

# Find slow operations
kubectl logs -l app=backend | jq 'select(.context.duration > 100)'
```