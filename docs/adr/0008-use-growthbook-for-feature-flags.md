# 8. Use GrowthBook for shared feature flags

- **Status:** Accepted — 2026-08-06; authorization constraint partially
  superseded by [ADR 0038](./0038-backend-enforced-feature-entitlements.md)
- **Deciders:** KlickerUZH maintainers

## Context

Klicker has used `User.publicPreview` and `User.privatePreview` as coarse
database-backed gates. They require a database mutation for every rollout,
cannot express environment or percentage rules cleanly, and couple preview
membership to the user profile queried by each frontend. GrowthBook is already
self-hosted in the same Kubernetes cluster and can target a stable actor id.

The same flag vocabulary must work in browser applications and concurrent
backend requests. The browser cannot reach a cluster-internal DNS name, while
exposing a management key or forwarding all flag decisions through the main API
would add either a security problem or an avoidable request boundary.

## Decision

Use one typed `@klicker-uzh/feature-flags` package and one GrowthBook project as
the feature-flag contract for Klicker.

Browser-only flags use GrowthBook's public HTTPS SDK endpoint and client-side
evaluation. Apps mount the shared React provider only after the actor is known,
and only after that app adopts a flag. Client keys are public SDK identifiers;
management/admin keys are never shipped to a browser.

Node.js services use a process-level `GrowthBookClient` configured with the
cluster-internal SDK endpoint. Every evaluation supplies request-scoped actor
attributes instead of mutating global client state, so concurrent users cannot
leak targeting context into one another.

The shared actor attributes are stable Klicker id, actor type, and role. Each
adapter owns the normalized deployment environment and adds it to evaluations.
Email is excluded. Missing configuration, an invalid non-empty environment,
and unavailable boolean definitions fail closed to false. At the time of this
decision, flags controlled rollout and presentation only. ADR 0038 later
permits a flag to become an additional backend-enforced feature entitlement;
it still cannot replace authentication or resource authorization. A server-side
flag may be a restrictive condition in an authorization gate, but it never
replaces authentication, role, login-scope, ownership, or account-approval
checks.

Amendment, 2026-09-06: the approved beta authoring gate uses the database-owned
`User.betaEnabled` preference, default `true`, as a trusted input to the
server-side, read-only `ai-beta` rollout. The backend reads the authenticated
actor's preference per request with request-local reuse, then evaluates
GrowthBook with the existing stable actor id, user actor type, role, and
Catalyst attributes. The rollout rule must require `betaEnabled: true`,
`catalyst: true`, and the existing actor conditions; browser evaluation is not
authoritative. A false or unreadable preference stays false even when a remote
definition would otherwise force the flag on.

The preference is not stored in GrowthBook. Beta enrollment uses no saved group,
management API, `beta-signup` flag, or Redis membership lock. The separate
backend management API configuration remains available for other flag-control
use cases; beta enrollment does not depend on it.
`FULL_ACCESS` and `ACCOUNT_OWNER` sessions may edit
the preference; the enrollment capability returns unknown membership for weaker
scopes without reading the preference. Catalyst is required to opt in, while full-access opt-out remains
available without Catalyst.

The database-owned `User.aiFeaturesEnabled`, default `false`, remains the sole
account approval gate for Knowledge Base access, question/graph generation,
chatbot publication, and model usage, even when budget enforcement is
disabled. Chatbot authoring is preapproval: the beta preference and `ai-beta`
rollout may allow authoring without that approval, but neither grants it.
Per-chatbot publication review and published participant access remain separate
and unchanged. Token provisioning and validation belong to v3-ai, not this flag
contract. See the
[approved beta authoring plan](../../project/2026-09-05-v3-beta-authoring-gate-plan.md)
and [the publication approval decision](./0020-two-tier-chatbot-approval.md).

Existing preview booleans migrate incrementally. A field remains authoritative
until every consumer for that behavior has moved; deleting the database or
GraphQL field is a separate compatibility decision.

## Considered options

**Keep only database preview booleans.** This is operationally simple but does
not provide per-environment rules, percentage rollout, or targeting without
schema/profile coupling.

**Proxy all browser decisions through the Klicker backend.** This keeps rules
off the client, but adds an API contract, cache policy, and request dependency
for ordinary UI rollout. It remains appropriate for sensitive decisions, not
the default.

**Use separate frontend and backend flag registries.** This avoids a shared
package but permits key and fallback drift precisely where cross-layer flags
need consistency.

**Use GrowthBook remote evaluation for every browser flag.** This hides rules
and attributes from the browser but adds infrastructure and latency before any
flag has that privacy requirement. Remote evaluation remains the explicit
upgrade path for a sensitive flag.

## Consequences

The cluster must expose a browser-accessible, CORS-enabled HTTPS SDK endpoint in
addition to its internal service. GrowthBook feature definitions and ordinary
client-side targeting rules are observable in browser traffic, so sensitive
attributes must not appear there. Client-side decisions cannot authorize backend
operations; the authoring restriction above is independently evaluated by the
backend.

Each adopting app or service owns its connectivity configuration and must be
tested with missing configuration. Browser definitions load on provider mount;
this first adapter requires a reload or remount to observe a changed flag.

The package creates a new review boundary: adding a flag requires a typed
fallback and tests, while rollout rules remain an operational GrowthBook change
rather than a Klicker code or database change.
