# CLAUDE.md - Auth Application

This file provides guidance to Claude Code for working specifically with the Authentication Application in the KlickerUZH project.

## Application Overview

The Auth application serves as the centralized authentication service for the KlickerUZH platform, providing secure user authentication via EduID integration and delegated access mechanisms. It handles session management, JWT token issuance, and user identity verification across all KlickerUZH applications.

> **IMPORTANT:** Currently, the auth application primarily serves the manage frontend (for lecturers), but is planned to be expanded to handle authentication for the student frontend (PWA) as well. This future expansion will require significant restructuring as the application will need to cover different audience types (lecturers managing content vs. students consuming content).

### Key Responsibilities

- User authentication through EduID (Swiss academic identity provider)
- Delegated access authentication with credentials
- Session management with JWT tokens
- Cross-domain cookie handling
- User profile data collection and update
- Integration with the central user database

### Current vs. Future Scope

#### Current Implementation

- Primarily serves lecturer authentication for the manage frontend
- Focused on EduID integration for academic staff
- Delegated access for teaching assistants and collaborators
- Institutional validation for UZH affiliates

#### Planned Expansion

- Authentication for student frontend (PWA)
- Handling of different authentication flows based on user type
- Support for student-specific identity providers
- Differentiated permissions and scopes for students vs. lecturers
- Potential integration with institution-specific authentication services

## Architecture Overview

### Technology Stack

- **Framework**: Next.js with API routes
- **Authentication**: NextAuth.js with custom adapters
- **Database Access**: Prisma client
- **Token Handling**: JWT with custom encode/decode functions
- **Password Hashing**: bcrypt for secure credential storage
- **Styling**: TailwindCSS

### Key Files and Components

- **Authentication Configuration**:
  - `src/pages/api/auth/[...nextauth].ts`: NextAuth configuration with providers and callbacks
- **Authentication Providers**:
  - EduID Provider: OAuth 2.0 implementation for Swiss academic identities
  - Credentials Provider: Username/password authentication for delegated access
- **Frontend Pages**:

  - `src/pages/index.tsx`: Main authentication page with login forms
  - `src/pages/logout.tsx`: Session termination handling
  - `src/pages/discourse.tsx` and `discourse_handoff.tsx`: Integration with Discourse forum

- **Utility Functions**:
  - `src/lib/prisma.ts`: Database client initialization
  - `src/lib/util.ts`: Helper functions for authentication flows

## Authentication Flows

### EduID Authentication

1. User initiates login via EduID button
2. Redirected to EduID authentication service
3. After successful authentication, EduID returns user data including:
   - Email address
   - Swiss academic unique identifier
   - Linked affiliations (for institutional status)
4. User profile is created or updated based on returned data
5. JWT session token is generated and stored in cross-domain cookie

### Delegated Access Authentication

1. User provides shortname and password for a main account
2. Credentials are verified against UserLogin records
3. If valid, a session is created with appropriate scope limitations
4. Scope determines available permissions throughout the application

### Session Management

- JWT tokens include user role, shortname, catalyst status, and access scope
- Tokens are stored in HTTP-only cookies with appropriate domain settings
- Session validation occurs on each protected API request
- Custom encode/decode functions manage JWT token security

## Integration Points

### Database Integration

The auth application interacts with the database to:

- Verify user credentials
- Create and update user records
- Track login history
- Manage session data

### Frontend Applications Integration

- Common session cookie across all subdomains
- Consistent authentication state through shared JWT format
- Redirects to appropriate application after successful authentication

## Planned Restructuring for Student Authentication

To support both lecturer and student authentication, the following changes will be needed:

### Architecture Changes

1. **User Type Detection**:

   - Implement early user-type detection to serve different login flows
   - Create separate authentication flows for lecturers vs. students
   - Develop conditional UI rendering based on user type

2. **JWT Token Structure**:

   - Expand token payload to include user type marker (LECTURER vs. STUDENT)
   - Include appropriate scope limitations for each user type
   - Maintain backward compatibility with existing frontends

3. **Database Schema Adjustments**:

   - Ensure proper relationship between User and Participant models
   - Update user session tracking for both user types
   - Add fields to support new authentication methods for students

4. **Frontend Changes**:
   - Develop audience-specific login interfaces
   - Create conditional redirection logic based on user type
   - Support different authentication providers for different audiences

### Implementation Considerations

- Maintain backward compatibility with existing authentication flows
- Consider phased approach to minimize disruption
- Implement feature flags to control rollout of new authentication methods
- Create appropriate error handling for mixed-audience authentication attempts

## Common Development Tasks

### Adding a New Authentication Provider

1. Create a new provider configuration in `[...nextauth].ts` following the existing patterns
2. Implement profile mapping function to standardize user data
3. Add UI components for the new login method in `index.tsx`
4. Update JWT token creation to include any provider-specific data

### Modifying Session Token Content

1. Update the `jwt` callback in `[...nextauth].ts`
2. Add new properties to the token object
3. Ensure consistent token structure across all authentication flows
4. Update any type definitions in `app.d.ts`

### Implementing New Login Restrictions

1. Add validation logic to the appropriate provider's `authorize` function
2. Update the `signIn` callback for additional checks
3. Add appropriate error messages in the UI components

## Testing Authentication

- Test EduID integration using the staging environment
- Use isolated test credentials for delegated access testing
- Verify cross-domain cookie functionality in local environment
- Test token expiration and refresh mechanisms

## Troubleshooting Common Issues

### Session Cookie Problems

- Verify `COOKIE_DOMAIN` environment variable configuration
- Check cookie security settings match between applications
- Confirm cookie SameSite and HTTP-only settings

### EduID Integration Issues

- Validate client credentials and redirect URIs
- Check required scopes and claims in authorization request
- Verify proper handling of profile data mapping

### JWT Token Verification Failures

- Ensure consistent APP_SECRET across all services
- Verify token signature algorithms match
- Check encode/decode implementation consistency

## Best Practices

1. Always use HTTP-only cookies for session tokens
2. Implement appropriate CSRF protection
3. Validate all user inputs rigorously
4. Never store sensitive user data in client-accessible storage
5. Use appropriate scopes for delegated access
6. Keep authentication code isolated and well-tested
7. Maintain clear separation between authentication and authorization logic

## Environment Setup

The auth application requires several environment variables:

```
# NextAuth Configuration
APP_SECRET=your-secret-here
NEXTAUTH_URL=https://auth.your-domain.com

# EduID Configuration
EDUID_CLIENT_ID=your-client-id
EDUID_CLIENT_SECRET=your-client-secret
EDUID_WELL_KNOWN=https://login.eduid.ch/.well-known/openid-configuration
NEXT_PUBLIC_EDUID_ID=eduid

# Cookie Configuration
COOKIE_DOMAIN=.your-domain.com

# Application URLs
NEXT_PUBLIC_MANAGE_URL=https://manage.your-domain.com
NEXT_PUBLIC_DEFAULT_REDIRECT=https://manage.your-domain.com
```

## Learning Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [JWT.io](https://jwt.io/)
- [EduID Documentation](https://www.switch.ch/edu-id/docs/)
- [Prisma Authentication Recipes](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
