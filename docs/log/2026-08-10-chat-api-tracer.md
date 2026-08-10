## 2026-08-10

**Update**

- Updated [Chat Platform](../chat-platform.md) to record the Slice 2 `apps/chat-api`
  tracer, its versioned engine/readiness boundary, and the fact that the current
  Next route remains the production path until the later cutover slices.
- Added the local verification scope: authenticated existing-thread requests,
  degraded engine readiness, strict stream validation, partial persistence, and
  exactly-once credit finalization.
