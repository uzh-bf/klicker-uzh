## 2026-08-16

- **Correction**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [testing](../testing.md) now document the durable graph-dispatch claim, the `NEEDS_HUMAN_REVIEW` hold for accepted-but-uncorrelated provider runs, atomic matching/stale/superseded late-success reconciliation, and the separation between current quota currency and historical settled build cost. Matching `klicker-*` skills carry the same lifecycle and verification rules.

## 2026-08-15

- **Update**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [testing](../testing.md) document the M1 knowledge-graph lifecycle: per-KB opt-in, the graph kill switch, integer minor-unit reservation and settlement, W1 terminal-result validation, fail-closed provider reconciliation, human-review holds, and lecturer cost/quota states. Matching `klicker-*` skills carry the schema, GraphQL, UI, and verification rules.

- **Correction**: [domain-model](../domain-model.md), [graphql-api-layer](../graphql-api-layer.md), and [async-and-workers](../async-and-workers.md) now distinguish an ordinary `RESERVED` release from a `NEEDS_HUMAN_REVIEW` hold. Only a later valid W1 success callback can reconcile the held reservation; malformed or late failure results remain held. The cost-accounting migration marks pre-accounting in-flight builds for review and clears their active slots.

- **Correction**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [testing](../testing.md) now record worker-side gate revalidation, pre-accounting reservation fencing, cleanup-safe late settlement, localized maximum/reservation status, and real-PostgreSQL release coverage.

- **Correction**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [testing](../testing.md) now record metered non-success settlement without publication, PostgreSQL integer bounds, complete quota-identity fencing, and quota currency/limit drift handling. Matching skills carry the same contract and verification rules.

## 2026-08-01

- **Update**: [domain-model](../domain-model.md) and `klicker-data-model` document KB-owned graph builds: a reader trusts only a successful build belonging to the requested KB, each completed build has its own graph name, and retired graphs plus GraphML share bounded retention while the active and published graphs remain protected. `turbo.json` now passes the matching `KB_FALKORDB_*` configuration through task runs.

- **Update**: [domain-model](../domain-model.md), [async-and-workers](../async-and-workers.md), and [graphql-api-layer](../graphql-api-layer.md) document the signed, platform-initiated `resource.content_refreshed` event: a terminal ledger entry correlated to the platform operation, serving-identity-only advancement, repeat-delivery deduplication, stale-refresh preservation, and current-attempt resource-list projection. The `klicker-data-model` and `klicker-testing-verification` skills now require the same two-axis, idempotency, and projection checks.

## 2026-07-30

- **Update**: [getting-started](../getting-started.md) documents the managed DevPod's routed Azurite Blob service, exact local CORS setup, and separate browser-facing and internal account URLs. Matching environment-doctor and testing-verification procedures cover local Blob diagnosis and real KB upload proof without exposing SAS queries.

- **Update**: [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [data-and-migrations](../data-and-migrations.md) document interim `privatePreview` access, the ingestion kill switch, stranded-UPSERT recovery, conservative URL quota claims, bounded loaded-window polling, mutation/refresh isolation, the tenant-wide source-gateway trust boundary, and the `KB.owner` cascade constraint. Matching `klicker-*` task skills carry the implementation and verification rules.

## 2026-07-28

- **Update**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [testing](../testing.md) document cursor-bound KB/resource connections, grouped exact metrics, deterministic bulk deletion, current-page polling, the resource inspector, and lecturer scale verification.

- **Update**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [testing](../testing.md) document concurrency-safe KB count/byte reservations, persisted ingestion scope checks, URL replacement accounting, the PDF/TXT/MD production MIME contract, and quota verification.

## 2026-07-27

- **Update**: [domain-model](../domain-model.md), [graphql-api-layer](../graphql-api-layer.md), [async-and-workers](../async-and-workers.md), and [frontend-conventions](../frontend-conventions.md) document owner-hidden KB tombstones, canonical external deletion, persisted upload tickets, bounded retention cleanup, and the lecturer-visible background-cleanup contract.

- **Update**: [domain-model](../domain-model.md), [data-and-migrations](../data-and-migrations.md), [graphql-api-layer](../graphql-api-layer.md), [frontend-conventions](../frontend-conventions.md), [chat-platform](../chat-platform.md), and [ci-and-deployment](../ci-and-deployment.md) document one-enabled-KB chatbot binding, atomic MCP configuration, ES256 retrieval scope tokens, citation rendering, browser states, and external secret ownership.

- **Update**: [frontend-conventions](../frontend-conventions.md), [graphql-api-layer](../graphql-api-layer.md), and [testing](../testing.md) document the request-time KB detail route, separate latest-operation/active-serving presentation, contextual ingestion actions, lazy bounded attempt history, and browser plus PostgreSQL verification.

- **Update**: [domain-model](../domain-model.md), [async-and-workers](../async-and-workers.md), [graphql-api-layer](../graphql-api-layer.md), and [testing](../testing.md) document the resource-scoped ingestion ledger, separate operation/serving state, atomic transitions, bounded owner-facing history, and token-independent focused KB integration suites.

## 2026-07-26

- **Update**: [domain-model](../domain-model.md), [async-and-workers](../async-and-workers.md), [frontend-conventions](../frontend-conventions.md), and [ci-and-deployment](../ci-and-deployment.md) document the KB resource model, synchronous ingestion API dispatch, polling plus strict signed-event reconciliation, source-gateway boundary, lecturer routes, reusable UI package, and deployment configuration split.
