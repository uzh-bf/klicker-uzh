## 2026-08-16

**Creation**

- [ADR 0006](../adr/0006-finalize-correlated-identities-after-settlement.md) records the approved 90-day retention window for finalized correlated response datasets.
- [Domain Model](../domain-model.md) records bounded expiry ownership and the free-text/timestamp minimization boundary.
- [Async & Workers](../async-and-workers.md) records that the existing minute-level general-worker reconciliation task performs expiry in bounded batches.

**Update**

- Correlated admission rejects free-text responses before identity admission and outbox creation.
- Correlated response rows use non-information sentinels for the shared legacy timestamp and time-spent columns; the real event timestamp remains transient grading input.
