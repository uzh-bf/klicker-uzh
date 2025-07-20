# CLAUDE.md - OLAT API

This file provides guidance to Claude Code for working specifically with the OLAT API in the KlickerUZH project.

## Application Overview

The OLAT API is a REST API service that provides integration between KlickerUZH and the OLAT Learning Management System (LMS). It enables OLAT users to access KlickerUZH activities directly from their LMS interface through LTI (Learning Tools Interoperability) integration.

The API provides machine-readable documentation via OpenAPI specification at `/openapi.yaml` and interactive documentation at `/api-docs`.

### Key Responsibilities

- Provide RESTful endpoints for OLAT to query KlickerUZH data
- Authenticate OLAT requests via API key
- Map OLAT user identities to KlickerUZH accounts
- Expose course structures and activity configurations
- Enable activity type discovery and selection
- Support LTI-based user authentication flow

## Architecture

This is an Express.js application built with TypeScript that interfaces with the KlickerUZH database.

### Directory Structure

- `/src/`: Application source code
  - `index.ts`: Main API server implementation with all endpoints
- `/static/`: Static configuration files
  - `activityTypes.json`: Configuration for available course contents (activity types, activity lists, docs, leaderboard, etc.)
- `/test/`: Unit tests and test utilities
  - `index.test.ts`: API endpoint tests
  - `helpers.ts`: Test utility functions
  - `userData.ts`: Test data fixtures
- Build and deployment files
  - `Dockerfile`: Container image definition
  - `package.json`: Dependencies and scripts
  - `rollup.config.mjs`: Build configuration

## API Endpoints

### Root Endpoint

```http
GET /
```

Returns a simple message indicating the API server is running. No authentication required.

**Response:**

```json
{
  "message": "OLAT API server"
}
```

### Health Check

```http
GET /health
```

Returns the service health status. No authentication required.

**Response:**

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### OpenAPI Specification

```http
GET /openapi.yaml
```

Returns the OpenAPI v3.1 specification for the API in YAML format. No authentication required.

**Response:**

- Content-Type: `application/yaml`
- Body: OpenAPI specification in YAML format

### API Documentation

```http
GET /api-docs
```

Serves an interactive API documentation interface using Scalar. No authentication required.

**Response:**

- Content-Type: `text/html`
- Body: Interactive API documentation HTML page

### Get User Courses

```http
GET /api/configuration/courses?identityMappingIdentifier={providerAccountId}
```

Retrieves all courses associated with a user based on their provider account.

**Headers:**

- `X-API-Key`: Required API authentication key
- `Content-Type`: Must be `application/json`

**Parameters:**

- `identityMappingIdentifier`: The provider account ID (e.g., `user@olat.uzh.ch`)

**Response:**

```json
{
  "courses": [
    {
      "id": "uuid",
      "title": "Course Name"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "api": "olat-api"
}
```

### Get All Activity Types

```http
GET /api/configuration/activityTypes
```

Returns all available activity types that can be integrated into OLAT.

**Headers:**

- `X-API-Key`: Required API authentication key
- `Content-Type`: Must be `application/json`

**Response:**

```json
{
  "activityTypes": [
    {
      "id": "LIVE_QUIZZES",
      "path": "/liveQuizzes",
      "olatConfigurationKey": "live-quizzes",
      "isEmailTransferRequired": false
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "api": "olat-api"
}
```

### Get Course Activity Types

```http
GET /api/configuration/course/{courseID}/activityTypes
```

Returns activity types available for a specific course, including counts and availability based on course settings.

**Headers:**

- `X-API-Key`: Required API authentication key
- `Content-Type`: Must be `application/json`

**Parameters:**

- `courseID`: UUID of the course

**Response:**

```json
{
  "activityTypes": [
    {
      "id": "LIVE_QUIZZES",
      "title": "Live Quiz Overview (5)",
      "olatConfigurationKey": "live-quizzes",
      "isSubselectionRequired": false
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "api": "olat-api"
}
```

### Get Activities of Type

```http
GET /api/configuration/course/{courseID}/{activityTypeKey}
```

Returns specific activities of a given type within a course. For activity types that require subselection (individual activities), it returns a list of available activities. For general activity types (overview pages, documentation, etc.), it returns an empty array.

**Headers:**

- `X-API-Key`: Required API authentication key
- `Content-Type`: Must be `application/json`

**Parameters:**

- `courseID`: UUID of the course
- `activityTypeKey`: Activity type key from activityTypes.json (e.g., `live-quiz`, `practice-quiz`, `micro-learning`, `docs`, `manage-account`, etc.)

**Response:**

```json
{
  "activityTypes": [
    {
      "id": "uuid",
      "title": "Activity Name"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "api": "olat-api"
}
```

**Note:** For general activity types that don't require subselection (e.g., `docs`, `manage-account`, `course-leaderboard`), the response will contain an empty `activityTypes` array.

## Activity Types

The API supports the following activity types, configured in `/static/activityTypes.json`:

### Overview Pages (No subselection required)

- **Live Quiz Overview** (`live-quizzes`): Lists all live quizzes in a course
- **Practice Quiz Overview** (`practice-quizzes`): Lists all practice quizzes
- **Micro Learning Overview** (`micro-learnings`): Lists all micro learnings
- **Course Leaderboard** (`course-leaderboard`): Shows gamification leaderboard (only if enabled)
- **Manage Account** (`manage-account`): Account creation and management page
- **Documentation** (`docs`): Links to KlickerUZH documentation

### Individual Activities (Subselection required)

- **Live Quiz** (`live-quiz`): Individual live quiz sessions
- **Practice Quiz** (`practice-quiz`): Individual practice quizzes
- **Micro Learning** (`micro-learning`): Individual micro learning activities

### Special Configurations

- `isSubselectionRequired`: Whether users need to select a specific activity
- `isEmailTransferRequired`: Whether email must be transmitted via LTI (required for account management)

## Authentication

The API uses API key authentication:

1. Set the `OLAT_API_KEY` environment variable
2. Include the API key in the `X-API-Key` header for all `/api` endpoints
3. The health check endpoint does not require authentication

## Rate Limiting

The API implements rate limiting:

- 100 requests per minute per IP address
- Standard rate limit headers are included in responses
- Exceeded limits return HTTP 429 with error message

## Error Handling

The API uses standard HTTP status codes:

- `200 SUCCESS`: Request succeeded
- `400 BAD_REQUEST`: Malformed request (missing/invalid parameters, missing API key)
- `401 UNAUTHORIZED`: Invalid API key
- `404 NOT_FOUND`: Resource not found (e.g., course or user)
- `415 UNSUPPORTED_MEDIA_TYPE`: Invalid Content-Type header
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded
- `500 INTERNAL_SERVER_ERROR`: Server error

Error responses follow this format:

```json
{
  "error": "Error description"
}
```

**Note:** Missing API key returns status code 400 (BAD_REQUEST), while an invalid API key returns 401 (UNAUTHORIZED).

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Environment Variables

- `PORT`: Server port (default: 3000)
- `OLAT_API_KEY`: API authentication key (required)
- `DATABASE_URL`: PostgreSQL connection string (required)
- `NODE_ENV`: Runtime environment (development/production)

### Testing

The API includes comprehensive unit tests:

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage
```

Test files:

- `test/index.test.ts`: API endpoint tests
- `test/helpers.ts`: Test utilities for mocking Prisma
- `test/userData.ts`: Test data fixtures

## Deployment

The API is deployed as a containerized application on Kubernetes:

### Docker Build

```bash
# Build the Docker image
docker build -t klicker-uzh/olat-api .
```

The Dockerfile:

- Uses Node.js 20 Alpine Linux base image
- Includes only production dependencies
- Copies built artifacts and static files
- Runs as non-root user

### Kubernetes Resources

The deployment includes:

- **Deployment**: Manages the API pods with configurable replicas
- **Service**: Exposes the API internally
- **Ingress**: Provides external access with TLS
- **Secret**: Stores the API key securely
- **HorizontalPodAutoscaler**: Auto-scales based on CPU usage (optional)

Configuration is managed through Helm values:

```yaml
olatApi:
  enabled: true
  replicaCount: 1
  image:
    repository: klicker-uzh/olat-api
    tag: latest
  service:
    port: 3000
  ingress:
    enabled: true
    hosts:
      - host: olat-api.klicker.uzh.ch
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
```

## Integration Flow

1. **OLAT Configuration**: OLAT administrators configure the LTI tool with KlickerUZH endpoints
2. **User Authentication**: Students authenticate via OLAT, which passes identity to KlickerUZH
3. **Course Discovery**: OLAT queries this API to get available courses for the user
4. **Activity Selection**: OLAT retrieves available activity types and specific activities
5. **Launch**: OLAT launches the selected KlickerUZH activity via LTI

## Security Considerations

1. **API Key Protection**: Store API keys securely in environment variables or Kubernetes secrets
2. **HTTPS Only**: Always use HTTPS in production for API communication
3. **Input Validation**: All inputs are validated (UUIDs, provider accounts)
4. **Rate Limiting**: Prevents abuse and ensures service availability
5. **Database Access**: Uses Prisma ORM with parameterized queries

## Monitoring and Debugging

### Health Monitoring

- Use the `/health` endpoint for liveness and readiness probes
- Monitor response times and error rates
- Check rate limit headers for usage patterns

### Logging

The API logs:

- Startup messages with port information
- Error details for failed requests
- Database connection issues

### Common Issues

1. **Authentication Failures**: Verify API key configuration
2. **Course Not Found**: Check user's provider account mapping
3. **Empty Activity Lists**: Ensure activities are created in the course
4. **Rate Limiting**: Monitor request patterns and adjust limits if needed

## Future Enhancements

Potential improvements to consider:

- Add caching for frequently accessed data
- Support for additional activity types
- Webhook notifications for activity changes
- Metrics endpoint for Prometheus monitoring
- Support for batch operations
- Performance optimization for OpenAPI file serving (caching)

## Related Documentation

- LTI Integration Tutorial: `/apps/docs/docs/tutorials/lti_integration.mdx`
- Main KlickerUZH documentation: `/CLAUDE.md`
- GraphQL API: `/packages/graphql/CLAUDE.md`
- Database Schema: `/packages/prisma/CLAUDE.md`
