# Audit Service

A high-performance audit logging service built with Hono, TypeScript, and Azure Table Storage. Designed for the klicker-uzh platform to handle 1000+ events per second with idempotent writes and comprehensive observability.

## Features

- ✅ **Fast & Lightweight**: Built with Hono framework for minimal overhead
- ✅ **Type-Safe**: Full TypeScript with strict validation using Zod
- ✅ **Idempotent**: Deterministic event IDs prevent duplicate events
- ✅ **Scalable Storage**: Azure Table Storage with optimized partitioning
- ✅ **Observable**: Prometheus metrics, structured logging, health checks
- ✅ **Production Ready**: Error handling, authentication, proper shutdown

## Quick Start

### Prerequisites

- Node.js 20 (exact version required)
- pnpm package manager
- Docker (for local Azure Storage emulation)

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# For local testing, the defaults work with Azurite
```

### 2. Start Local Dependencies

```bash
# Start Azurite (local Azure Storage emulator)
pnpm docker:up

# Verify Azurite is running
# Table service: http://localhost:10002
```

### 3. Install & Build

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build
```

### 4. Run the Service

```bash
# Development mode (auto-rebuild)
pnpm dev

# Production mode
pnpm start
```

The service will be available at:
- **API**: http://localhost:7080
- **Health**: http://localhost:7080/healthz
- **Metrics**: http://localhost:7080/metrics

## API Usage

### Submit Audit Event

```bash
curl -X POST http://localhost:7080/audit \\
  -H "Content-Type: application/json" \\
  -H "X-Internal-Token: your-secret-token" \\
  -d '{
    "tenantId": "klicker-tenant-123",
    "subject": "user:john.doe@uzh.ch", 
    "action": "session.started",
    "resourceId": "live-session-abc",
    "userId": "user-456",
    "attributes": {
      "sessionType": "quiz",
      "questionCount": 10
    }
  }'
```

### Event Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | ✅ | Tenant identifier (1-100 chars) |
| `subject` | string | ✅ | Who performed the action (1-500 chars) |
| `action` | string | ✅ | What action was performed (1-200 chars) |
| `timestamp` | number | - | Unix timestamp (defaults to server time) |
| `eventId` | string | - | Custom ID for idempotency (1-100 chars) |
| `resourceId` | string | - | Resource that was acted upon (≤500 chars) |
| `sessionId` | string | - | Session identifier (≤100 chars) |
| `userId` | string | - | User identifier (≤100 chars) |
| `attributes` | object | - | Additional event metadata |

### Response

```json
{
  "status": "accepted",
  "eventId": "01HN2K8X9QGJ1K8H3P4M7R2N8T"
}
```

## Testing

### Automated Tests

```bash
# Run API tests against local service
pnpm test

# Start Azurite + run tests  
pnpm test:local
```

### Manual Testing

```bash
# Start service in development mode
pnpm test:manual

# Use test/manual-test.http with VS Code REST Client
# Or use curl commands from the examples above
```

### Test Scenarios

The test suite covers:
- ✅ Health endpoints (`/healthz`, `/ready`, `/metrics`)
- ✅ Authentication (valid/invalid tokens)
- ✅ Event validation (required fields, field lengths)
- ✅ Idempotency (same `eventId` handling)
- ✅ Error handling (400, 401, 500 responses)
- ✅ Full event submission workflow

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | `7080` | - |
| `NODE_ENV` | Environment mode | `development` | - |
| `AZURE_TABLES_CONNECTION_STRING` | Azure/Azurite connection | - | ✅ |
| `AZURE_TABLES_TABLE_NAME` | Table name for events | `auditevents` | - |
| `INTERNAL_TOKEN` | Authentication token | - | ✅ |
| `LOG_LEVEL` | Logging level | `info` | - |
| `SERVICE_NAME` | Service identifier | `audit-service` | - |
| `SERVICE_VERSION` | Service version | `1.0.0` | - |

### Local Development (Azurite)

```bash
AZURE_TABLES_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;
INTERNAL_TOKEN=test-secret-token-123
```

### Production (Azure Storage)

```bash
AZURE_TABLES_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=your-key;EndpointSuffix=core.windows.net
INTERNAL_TOKEN=your-production-secret-token
LOG_LEVEL=warn
```

## Architecture

### Data Model

Events are stored in Azure Table Storage with optimized partitioning:

```
PartitionKey: <tenantHash>-<YYYYMMDDHHmm>-<shard>
RowKey: <eventId> or <ULID>
```

**Example**: `42-202501031425-a`
- `42`: Hash of tenant ID (for distribution)
- `202501031425`: Time bucket (January 3, 2025, 14:25)
- `a`: Shard (first char of eventId, or '0')

This partitioning strategy:
- ✅ **Distributes load** across Azure's physical partitions
- ✅ **Enables efficient queries** by tenant and time range
- ✅ **Supports high throughput** with minimal hotspotting

### Performance Optimizations

1. **Simple hash functions** (no MD5/crypto overhead)
2. **Direct writes** (no batching complexity in MVP)
3. **Minimal JSON serialization** (removed validation overhead)
4. **Low-cardinality metrics** (efficient Prometheus scraping)
5. **Structured logging** with sensitive data redaction

## Observability

### Metrics (Prometheus)

- `audit_requests_total` - Total requests received
- `audit_writes_total` - Successfully written events
- `audit_write_errors_total` - Write failures
- `audit_write_latency_seconds` - Write latency histogram
- Standard process metrics (CPU, memory, etc.)

Access at: http://localhost:7080/metrics

### Logging (Structured JSON)

```json
{
  "level": "INFO",
  "time": "2025-01-03T14:25:30.123Z",
  "service": "audit-service",
  "tenantId": "tenant-123",
  "partitionKey": "42-202501031425-a",
  "rowKey": "01HN2K8X9QGJ1K8H3P4M7R2N8T",
  "duration": 45,
  "msg": "Audit event written successfully"
}
```

### Health Checks

- **Liveness**: `GET /healthz` - Basic service health
- **Readiness**: `GET /ready` - Ready to accept traffic

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start in development mode (auto-rebuild) |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm test` | Run API tests |
| `pnpm test:local` | Start Azurite + run tests |
| `pnpm test:manual` | Start for manual testing |
| `pnpm docker:up` | Start Azurite container |
| `pnpm docker:down` | Stop containers |
| `pnpm docker:clean` | Clean containers + volumes |
| `pnpm check` | TypeScript type checking |

## Troubleshooting

### Service won't start

1. **Check environment variables**: Ensure `.env` file exists with required values
2. **Verify Azurite**: Run `pnpm docker:up` and check http://localhost:10002
3. **Check ports**: Ensure port 7080 is not in use
4. **Review logs**: Service logs configuration issues on startup

### Tests failing

1. **Service running**: Ensure service is running on localhost:7080
2. **Azurite running**: Run `pnpm docker:up` before tests
3. **Clean state**: Run `pnpm docker:clean` to reset Azurite data

### Azure connection issues

1. **Connection string format**: Verify format matches Azure documentation
2. **Network access**: Ensure firewall allows Azure Storage access
3. **Credentials**: Verify account key is valid and has table permissions

## Contributing

1. Follow existing TypeScript patterns and conventions
2. Add tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting changes

## License

AGPL-3.0 - see LICENSE file for details.