# Periodic assessment audit sealing

## Goal

Every five minutes, a dedicated sealer inventories verified Azure evidence for
assessment LiveQuiz lifecycles, publishes hash-chained immutable manifest batches,
and marks matching delivered outbox events SEALED only after storage readback.
Exports discover blob versions independently of Table indexes and verify every
manifest member, including events deleted from all Table inventories.

## Boundaries

One cohesive backend feature: audit contract/storage/sealing/export, Hatchet handler
and identity selection, opt-in Helm deployment. No schema, GraphQL API, UI, i18n,
gamification, image verification, production changes, or outbox cleanup. Native
implementation/review only; no repository opt-in for external model execution.

The manifest chain itself is the retry checkpoint, using conditional creation at
a deterministic quiz/epoch/sequence name. Concurrent workers accept the winning
manifest, then validate its membership. This avoids a second mutable checkpoint or
schema migration. Blob version enumeration is authoritative; no mutable latest
pointer or redundant AuditControl manifest index is introduced. AuditControl has
no current producers; future control/hold commands need their own sealing contract.
This implements five-minute event sealing instead of the historical daily design.

Manifests commit canonical event bytes and IDs, not Azure transport metadata.
Existing reader verification checks the required root/chunks/locator/retention
relationships. Table roots are also enumerated to expose orphaned writes.
Late events are set differences, never skipped by a recordedAt watermark.

Sealer identity: Table read, manifest read/create/version-policy extension, and
outbox state update. Ordinary and dispatcher workers cannot register its task.
Helm enablement defaults off pending staging WORM/RBAC conformance.

## Verification

Synthetic storage tests: exact-version readback, interrupted upload, conflicting
concurrent create, chain gaps, hidden old versions, tampering, policy failures.
Sealer/export tests: missing evidence, late arrival, replay after database failure,
no false SEALED status, participant filtering after whole-scope verification.
Disposable PostgreSQL checks for conditional state transition; worker role tests;
package checks/builds and Helm rendering. Azure managed identity/WORM proof remains
a staging gate because local fakes cannot establish provider conformance.

## Progress

- Inspected existing Table reader, immutable blob adapter, outbox, worker identity.
- Created isolated worktree from v3-audit; disposable PostgreSQL migrations passed.
- Reduced task dependencies after local disk exhaustion; full frontend build may
  be unavailable due to capacity. No other worktrees or runtimes modified.

- Implemented conditional immutable version checkpoints, independent export
  verification, retryable matching outbox transitions, and isolated sealer role.
- Native storage worker and independent reviewer ran. External executor/simplifier
  were ineligible without repository opt-in; main inspected and simplified locally.
- Review backlog finding resolved with explicit deferred count and failed scheduled
  runs until drained; lifecycle batching priority clarified. Added delivery timestamp
  guard and fresh marking clock to avoid racing dispatcher transitions.
- Audit tests passed with disposable PostgreSQL and Azurite; worker role tests,
  affected dependency build/typecheck, and Helm enabled/disabled rendering passed.
- Root check:all attempted, blocked by missing frontend dependencies after the
  disk-limited filtered install, unavailable host Devrouter in this disposable
  container, and existing server-console violations in unchanged files. Full
  monorepo checks/build remain CI gates. No browser surface changed.
- Azure WORM/managed-identity conformance and backlog/RSS measurements remain
  staging gates. Sealer enablement defaults off, with no cloud changes applied.
