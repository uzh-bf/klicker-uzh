# External MCP OAuth Plan

**Status:** research-backed follow-up plan. Do not implement inside the
embedded-assistant PR.
**Date:** 2026-06-03.
**Scope:** OAuth for external MCP clients that connect directly to KlickerUZH
MCP services, for example Claude Desktop, Cursor, Copilot-style agents, or MCP
Inspector.

## Sources Checked

- [MCP Authorization specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [FastMCP TypeScript README](https://raw.githubusercontent.com/punkpeye/fastmcp/main/README.md)
- Current branch packages:
  - `apps/mcp-student/package.json`: `fastmcp@3.15.2`
  - `apps/mcp-lecturer/package.json`: `fastmcp@3.15.2`
  - `apps/chat/package.json`: `@modelcontextprotocol/sdk@1.17.5`
- Old prior-art branch: `worktree-mcp`, especially `apps/mcp/PLAN.md` and
  `apps/auth/src/pages/api/mcp/*`.

## Goal

Support external MCP clients through a standards-aligned OAuth flow while
keeping the embedded assistant path simple and internal.

External clients should be able to:

1. Discover the MCP resource and its authorization server.
2. Authenticate through KlickerUZH auth.
3. Obtain an MCP-scoped token bound to the intended MCP resource.
4. Call only the MCP tools allowed by the authenticated role and granted
   scopes.
5. Fail with clear OAuth challenges and tool errors when scope or role is
   missing.

## Non-Goals

- Do not replace the current embedded chat to MCP short-lived JWT path.
- Do not pass raw Edu-ID, NextAuth, participant, or internal Klicker session
  tokens through to external clients.
- Do not grant broad GraphQL access through MCP.
- Do not expose lecturer write tools without an explicit confirmation model.
- Do not copy the old Python `apps/mcp` OAuth bridge wholesale.

## Design Principle

Current embedded assistants are trusted Klicker server-to-server flows:

```text
PWA / Manage -> apps/chat -> short-lived internal MCP JWT -> MCP service
```

External MCP clients need a separate delegated authorization flow:

```text
External MCP client -> MCP resource discovery -> apps/auth OAuth flow
                    -> MCP-scoped access token -> MCP service
```

These two flows can share token verification helpers where useful, but they
must remain separate in configuration, token claims, audit logs, and risk
analysis.

## Required OAuth Properties

The target design should satisfy the MCP authorization/security requirements:

- OAuth 2.1 authorization code flow with PKCE `S256`.
- HTTPS for non-localhost redirect URIs.
- Exact redirect URI validation.
- MCP protected resource metadata discovery.
- `WWW-Authenticate` challenges that point clients to resource metadata.
- Resource indicators / audience binding so a token for one MCP service cannot
  be replayed against another resource.
- Bearer token validation on every MCP request.
- Issuer, audience/resource, expiry, subject, role, and scope validation.
- No token passthrough from upstream identity providers to MCP clients.
- Least-privilege scopes and per-client consent.
- Structured audit logs for login, consent, token issuance, refresh, and tool
  calls.

## Proposed Architecture

### Resource Servers

`apps/mcp-student` and `apps/mcp-lecturer` remain separate MCP resource
servers.

Each service gets:

- OAuth-aware bearer token verifier.
- Protected resource metadata for its canonical MCP endpoint.
- `WWW-Authenticate` challenge behavior for missing/invalid tokens.
- Scope checks at tool registration or tool wrapper level.
- Backwards-compatible internal JWT verifier for `apps/chat` embedded calls.

Do not collapse both services into a generic MCP service unless there is a
clear operational reason later.

### Authorization Server

Use `apps/auth` or a small auth-adjacent route group as the authorization
server.

Responsibilities:

- OAuth authorization endpoint.
- OAuth token endpoint.
- Optional authorization server metadata endpoint.
- Client registration policy.
- Consent UI and consent records.
- PKCE validation.
- Token issuance and refresh-token rotation if refresh tokens are enabled.

Initial implementation should prefer explicit client allowlisting over fully
open dynamic client registration. Dynamic registration can be added after we
verify external-client needs and abuse controls.

### Token Shape

Use signed JWT access tokens issued by KlickerUZH auth.

Recommended claims:

```json
{
  "iss": "https://auth.klicker.com",
  "aud": "https://mcp-student.klicker.com/mcp",
  "sub": "<participant-or-user-id>",
  "role": "PARTICIPANT",
  "client_id": "<oauth-client-id>",
  "scope": "student:practice:read student:practice:submit",
  "purpose": "external-mcp",
  "iat": 1760000000,
  "exp": 1760000900
}
```

Lecturer tokens use `role: "USER"` and lecturer scopes.

Access tokens should be short-lived. Refresh tokens are useful for desktop
clients but should be introduced only with rotation, revocation, and storage
tests.

## Initial Scope Model

Student:

- `student:practice:read`
- `student:practice:submit`

Lecturer:

- `lecturer:course:read`
- `lecturer:element:read`
- `lecturer:proposal:create`

Future:

- `student:analytics:read` after privacy/product review.
- `lecturer:write:confirmed` only if write confirmation is implemented outside
  the model loop.

## Open Research Questions

Resolve before implementation:

1. Does `fastmcp@3.15.2` emit protected resource metadata and OAuth challenges
   exactly as current MCP clients expect, or do we need a custom middleware?
2. Which auth spec date do major clients currently implement? We should target
   the latest MCP spec while remaining compatible with lagging clients where
   practical.
3. Does FastMCP's `canAccess` support scope-based tool hiding and tool-level
   challenges well enough, or should we implement a shared wrapper that checks
   scopes and returns stable tool errors?
4. Which external clients need dynamic client registration versus pre-registered
   OAuth clients?
5. Where should consent records live, and how do students/lecturers revoke
   external MCP client access?
6. Should student and lecturer MCP endpoints have distinct OAuth resource URLs,
   distinct issuers/audiences, or both?
7. How should local dev work with HTTP localhost while production enforces
   HTTPS?

## Implementation Slices

### Slice 1: Library and Client Research

Do:

- Inspect installed `fastmcp@3.15.2` source and published docs.
- Verify OAuth metadata/challenge behavior with MCP Inspector.
- Test at least one real external client if available.
- Decide whether to use FastMCP built-ins, custom middleware, or a hybrid.

Check:

- Document exact endpoints, headers, and challenge behavior.
- Capture compatibility findings and limitations.

Commit:

- `docs(mcp): add external oauth research findings`

### Slice 2: Auth Server Skeleton

Do:

- Add OAuth route skeleton in `apps/auth`.
- Implement authorization server metadata if required.
- Add strict redirect URI and client allowlist config.
- Add PKCE `S256` validation tests.

Check:

- Unit tests for invalid client, invalid redirect, missing PKCE, bad code
  verifier, expired code.

Commit:

- `feat(auth): scaffold mcp oauth flow`

### Slice 3: Protected Resource Metadata

Do:

- Add student and lecturer MCP resource metadata.
- Add `WWW-Authenticate` challenges for missing/invalid OAuth tokens.
- Keep internal JWT auth path working for `apps/chat`.

Check:

- Metadata endpoint tests.
- Missing-token challenge tests.
- Existing embedded JWT tests still pass.

Commit:

- `feat(mcp): expose oauth resource metadata`

### Slice 4: Scoped Access Tokens

Do:

- Issue MCP-scoped access tokens from `apps/auth`.
- Validate issuer, audience/resource, expiry, subject, role, and scopes in MCP
  services.
- Add token purpose separation: `external-mcp` versus internal
  `student-mcp` / `lecturer-mcp`.

Check:

- Token issuance tests.
- Audience replay tests across student/lecturer resources.
- Scope denial tests.

Commit:

- `feat(mcp): validate scoped oauth tokens`

### Slice 5: Tool-Level Scope Policy

Do:

- Add declarative scope metadata to each MCP tool.
- Enforce scope checks consistently.
- Return stable tool errors for insufficient scope.

Check:

- Every tool has scope metadata.
- Read-only tools fail closed without read scope.
- Proposal tools fail closed without proposal scope.

Commit:

- `feat(mcp): add tool scope policy`

### Slice 6: External-Client E2E

Do:

- Add a local e2e smoke that exercises authorization, token exchange, tool
  listing, and one read tool per service.
- Add manual validation instructions for MCP Inspector and one external client.

Check:

- Smoke passes against local dev.
- At least one external client can complete the flow.

Commit:

- `test(mcp): add oauth e2e smoke`

## Review Gates

Before merging OAuth work:

- Security review of OAuth endpoints, token claims, redirect handling, and
  client registration.
- Threat model focused on confused deputy, token replay, consent spoofing, and
  cross-role access.
- Browser/client validation of discovery and OAuth challenge behavior.
- CI coverage for auth route tests and MCP verifier tests.

## Deferred Decisions

- Dynamic client registration.
- Refresh tokens and rotation.
- External-client support for lecturer write confirmation flows.
- Student analytics scopes.
- Whether to expose OAuth for staging only before production rollout.
