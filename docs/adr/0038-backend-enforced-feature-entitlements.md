# 38. Permit backend-enforced GrowthBook feature entitlements

- **Status:** Accepted — 2026-08-25

## Context

ADR 0008 introduced GrowthBook as a rollout and presentation mechanism and
prohibited using flags for authorization. Learning analytics needs a stronger
contract: hiding controls is insufficient because a lecturer can navigate to a
route or call GraphQL directly, while moving rollout membership back into the
database would recreate the coupling GrowthBook was introduced to remove.

## Decision

A GrowthBook flag may be a feature entitlement only when the backend evaluates
it independently as an additional fail-closed condition. Authentication,
role/scope checks, and resource permissions remain mandatory; a true flag only
allows those existing checks to proceed and never grants access by itself. The
browser evaluation is presentation state and is never trusted as the data
boundary.

Backend evaluation uses the read-only SDK connection and a minimal authenticated
actor projection. Missing configuration, invalid environments, unavailable
definitions, false results, and evaluation failures deny the feature with a
generic error. Flags may not carry sensitive targeting attributes or replace
durable domain state. A flag whose rules or attributes are sensitive must use a
reviewed server-only or remote-evaluation design instead of browser-visible
targeting.

This decision supersedes only ADR 0008's blanket prohibition on authorization.
Ordinary rollout-only flags remain presentation concerns, and GrowthBook never
replaces Klicker's authentication or resource-authorization model.

## Consequences

Every backend-enforced flag needs equivalent browser and backend definitions,
explicit allow and deny coverage, and an operational check in each deployment
environment. Backend consumers must own an abortable refresh lifecycle and a
bounded stale window so both grants and revocations propagate without restarts;
an expired payload denies access. The backend result is authoritative: a
backend `false` always denies, while a backend `true` still cannot bypass the
existing authentication and resource-permission checks. A browser `false` may
hide the feature even when the backend result is true. GrowthBook availability
therefore joins the feature's access path, but not application startup or
unrelated Klicker functionality.
