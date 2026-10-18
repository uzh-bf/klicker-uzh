---
module: frontend-manage
date: 2026-09-06
problem_type: integration
severity: medium
symptoms:
  - AI navigation appeared after its identity query failed.
root_cause: Shared Apollo profile data could replace a failed cache-and-network query result.
tags: [apollo, growthbook, identity, feature-entitlement]
---

# A failed identity query must not recover from unrelated cached data

## Problem

Manage resolves a user before requesting the backend-owned AI capability.
During integration, a fault-injected profile error still left AI navigation
visible. Other profile queries on the page succeeded and shared the same Apollo
cache. Testing only the initial error result missed the later cache update.
The backend authorization gates remained independent of this presentation bug.

## What did not work

Checking `loading` and `error` on a `cache-and-network` query did not isolate
identity resolution from other cache writers. Reusing the narrower existing
Manage profile operation also omitted `aiFeaturesEnabled`, which the provider
needs before requesting the capability.

## Solution

[ManageFeatureFlagProvider](../../../apps/frontend-manage/src/components/featureFlags/ManageFeatureFlagProvider.tsx)
uses a purpose-scoped
[profile operation](../../../packages/graphql/src/graphql/ops/QManageFeatureFlagProfile.graphql)
with `no-cache`. It selects identity, role, Catalyst, and AI entitlement without
changing the existing persisted operation. Missing, loading, or failed identity
remains fail closed. The separate capability query retains its retry and cache
policy; this correction does not turn cached presentation into authorization.

## Prevention

The [availability browser suite](../../../playwright/tests/Y-ai-beta-availability.spec.ts)
opens a fresh page, fails only the purpose-scoped profile operation, and waits
for that interception and ordinary navigation to render. It then requires AI
navigation to remain absent and the capability-request count to stay zero.
Other profile requests remain real so shared-cache interactions are exercised.
The same suite covers explicit denial, temporary unavailability, and recovery.
