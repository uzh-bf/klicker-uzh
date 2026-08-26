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
it still cannot replace authentication or resource authorization.

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
attributes and browser-only authorization decisions are prohibited.

Each adopting app or service owns its connectivity configuration and must be
tested with missing configuration. Browser definitions load on provider mount;
this first adapter requires a reload or remount to observe a changed flag.

The package creates a new review boundary: adding a flag requires a typed
fallback and tests, while rollout rules remain an operational GrowthBook change
rather than a Klicker code or database change.
