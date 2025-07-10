# CLAUDE.md - Bruno API Client

This file provides guidance to Claude Code for working with the Bruno API client in the KlickerUZH project.

## Package Overview

Bruno is an open-source API client used in KlickerUZH for interacting with the GraphQL API in two primary ways:

1. Authenticating with cron tokens to trigger scheduled operations via GraphQL
2. Making user-specific GraphQL queries and mutations using JWT/cookie authentication

### Key Responsibilities

- Executing scheduled GraphQL operations with cron token authentication
- Testing user-specific GraphQL queries and mutations
- Organizing reusable API requests for development and testing
- Managing environment-specific variables for different deployment contexts

## Directory Structure

The Bruno configuration is organized as follows:

- `bruno.json`: Main configuration file for the collection
- `environments/`: Directory containing environment-specific configurations
  - `PROD.bru`: Production environment variables
- `*.bru`: Individual API request files representing specific GraphQL operations

## Request Types

### Cron Job GraphQL Operations

Bruno files for scheduled cron operations use the cron token authentication:

```
meta {
  name: finalRandomGroups
  type: http
}

post {
  url: {{API_URL}}
  body: json
  auth: none
}

headers {
  x-graphql-yoga-csrf: abcd
  x-token: {{CRON_TOKEN}}
}

body:json {
  {
    "operationName": "FinalRandomGroupAssignments",
    "variables": {},
    "extensions": {
      "persistedQuery": {
        "version": 1,
        "sha256Hash": "hashValue"
      }
    }
  }
}
```

### User-Specific GraphQL Operations

Operations that require user authentication use JWT/cookie authentication:

```
meta {
  name: userSpecificOperation
  type: http
}

post {
  url: {{API_URL}}
  body: json
  auth: none
}

headers {
  Content-Type: application/json
  Cookie: {{AUTH_COOKIE}}
}

body:json {
  {
    "query": "query GetUserSpecificData { ... }",
    "variables": { ... }
  }
}
```

## Environment Variables

Bruno uses environment-specific variables to support different deployment targets:

- Variables are defined in `.bru` files within the `environments/` directory
- Regular variables use the format `{{VARIABLE_NAME}}`
- Secret variables are stored separately with enhanced security

Example environment file:

```
vars {
  API_URL: https://backend-sls.klicker.uzh.ch/api/graphql
}
vars:secret [
  CRON_TOKEN,
  AUTH_COOKIE
]
```

## Current GraphQL Operations

The collection includes the following GraphQL operations:

1. **finalRandomGroups**: Creates final random groups for courses (cron operation)
2. **runningRandomGroupAssignments**: Manages running random group assignments (cron operation)
3. **updateGroupAverageScores**: Updates average scores for participant groups (cron operation)

Each operation is authenticated appropriately based on its purpose.

## Development Workflow

### Adding New Cron Job Operations

1. Create a new `.bru` file with a descriptive name matching the operation
2. Define the meta section with a unique name and http type
3. Configure the POST method with the GraphQL API URL
4. Set headers including the cron token authentication
5. Define the body with the operation name, GraphQL query, and any required variables
6. Test the request against development before using in production

### Creating User-Specific GraphQL Operations

1. Create a new `.bru` file with a name reflecting the GraphQL operation
2. Configure the POST method to the GraphQL endpoint
3. Include the appropriate authentication headers (JWT/cookie)
4. Define the GraphQL query/mutation in the body section
5. Include any required variables in the variables object
6. Test against the development GraphQL API endpoint

### Environment Management

1. Create separate environment files for different deployment targets (dev, staging, production)
2. Store sensitive values like CRON_TOKEN and AUTH_COOKIE as secret variables
3. Reference environment variables using the `{{VARIABLE_NAME}}` syntax

## Authentication Methods

### Cron Token Authentication

Used for scheduled operations that don't require a specific user context:

- Include `x-token: {{CRON_TOKEN}}` in the headers
- Typically used with persisted queries for efficiency

### User Authentication (JWT/Cookie)

Used for operations that require a user context:

- Include `Cookie: {{AUTH_COOKIE}}` in the headers
- JWT contains the user identity and permissions
- Required for accessing user-specific data and operations

## Best Practices

1. **Organization**: Use clear, descriptive filenames that match the purpose of the GraphQL operation
2. **Security**: Always use environment variables for authentication tokens
3. **Documentation**: Include comments in complex GraphQL queries explaining their purpose
4. **GraphQL Operations**: Structure queries to request only the necessary data
5. **Variables**: Use GraphQL variables rather than string interpolation
6. **Persisted Queries**: Consider using persisted queries for frequently used operations

## Troubleshooting Common Issues

### Authentication Problems

If GraphQL operations fail with authentication errors:

1. For cron operations, verify the x-token header contains the correct CRON_TOKEN value
2. For user operations, check that the AUTH_COOKIE is valid and not expired
3. Verify you're using the appropriate authentication method for the operation type

### GraphQL Execution Issues

If operations fail to execute:

1. Check for GraphQL syntax errors in the query
2. Verify that all required variables are provided with the correct types
3. For persisted queries, ensure the hash value matches the query content
4. Confirm the API_URL environment variable points to the correct endpoint

## Expanding Bruno Usage

As the project evolves, Bruno usage can be expanded in several ways:

1. **Complete API Documentation**: Create a comprehensive collection of all GraphQL operations
2. **Testing Suite**: Develop a complete set of API tests covering all major operations
3. **Mock Responses**: Use Bruno's response examples to document expected behavior

## Related Resources

- Bruno documentation: https://docs.usebruno.com/
- KlickerUZH GraphQL schema: See `packages/graphql/src/schema/`
- GraphQL operations: See `packages/graphql/src/graphql/ops/`
