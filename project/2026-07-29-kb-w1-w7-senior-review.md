# KB Production v1 — W1–W7 Senior Review (2026-07-29)

Read-only senior architect/engineer review of [PR #5174](https://github.com/uzh-bf/klicker-uzh/pull/5174)
(`kb-poc` into `v3-ai`) at head `925eea6a8`, full range
`20a953251..925eea6a8` (40 commits, 171 files). Method: six scoped review
lenses (lifecycle/trust, concurrency/transactions, data/API/pagination,
frontend/a11y/i18n, test false-confidence, security/data-hygiene) per the
review rubric; every finding at confidence 75+ re-verified line-by-line. Two
lenses independently converged on P1-2. Nothing was edited or posted during
the review itself.

## Verified branch defects

No P0 findings.

### P1-1 — Crash between dispatch commit and enqueue strands a resource (conf: code 100, trigger needs process kill; manual)

- Evidence: `packages/graphql/src/services/knowledge.ts:1622-1657` commits
  `status: QUEUED, externalOperationId: null`, then enqueues post-commit
  (`await ctx.tasks.ingestKBResource.runNoWait(payload)`).
- Evidence: monitor requires `externalOperationId: { not: null }`
  (`packages/hatchet/src/kbIngestion.ts:889`); maintenance retries only
  `ingestionOperation: DELETE` (`packages/hatchet/src/kbMaintenance.ts:107-112`,
  no UPSERT branch); re-ingest requires `ADDED/READY/FAILED`
  (`knowledge.ts:1574-1580`); both delete paths refuse `QUEUED/PROCESSING`
  (`knowledge.ts:1048`, `knowledge.ts:1427`).
- Risk: process kill in the window (OOM/deploy/spot reclaim) leaves a
  permanently stuck resource that also blocks parent-KB deletion; only a
  manual DB fix recovers. DELETE side has the safety net by design; UPSERT
  side does not.
- Do: UPSERT recovery branch in `maintainKBResources` mirroring
  `deletionRetryWhere` (recommended) or staleness window in the monitor.

### P1-2 — URL creation under-charges quota; 500 MiB cap overshoots one placeholder (conf 100; gated_auto)

- Evidence: `knowledge.ts:1398`
  `await assertKbQuotaAvailable(prisma, { kbId, resourceCount: 1 })` —
  `sizeBytes` defaults to `0` (line 270) while `getKbQuotaUsage` charges each
  unknown-size resource 25 MiB (line 260). The resource being created is never
  pre-charged; 20 unknown-size rows = exactly 500 MiB, the 21st passes
  (`500 + 0 > 500` false) → 525 MiB retained. Bounded to one step; count cap
  charged correctly.
- Do: pass `sizeBytes: MAX_KB_FILE_SIZE_BYTES` at the call site; add a
  `createKbUrlResource` byte-boundary test (existing boundary test seeds via
  `createMany` and probes file upload instead).

### P1-3 — Refresh failure masks mutation success in 7 of 8 handlers (conf 75, verified; gated_auto)

- Evidence: `packages/kb-management/src/components/DeleteKnowledgeBaseResourceModal.tsx:28-38`
  puts `await onDeleted()` (workspace refresh) inside the mutation `try`; a
  transient refresh failure shows the error toast for an already-successful
  delete and keeps the modal open. Same shape:
  `CreateKnowledgeBaseModal.tsx:30`, `DeleteKnowledgeBaseModal.tsx:32`,
  `KnowledgeBaseChatbotBindings.tsx:67,85`, `KnowledgeBaseFileDropzone.tsx:79`,
  `KnowledgeBaseUrlForm.tsx:43`, `KnowledgeBaseResourceList.tsx:555`
  (`handleIngest`).
- Do: apply the correct two-block pattern already present in
  `DeleteKnowledgeBaseResourcesModal.tsx:30-49` to the seven handlers.

### P2 findings

- P2-1 (75, manual): active polling refetches the entire loaded cursor window
  sequentially every 2 s with no upper bound
  (`KnowledgeBaseResourceList.tsx:353-382,429-433`,
  `targetCount = Math.max(resources.length, PAGE_SIZE)`); at ~300 loaded rows
  this is a continuous multi-round-trip loop. Do: bound the polled window
  (e.g. poll only pages containing active rows).
- P2-2 (75, manual): `knowledgeSourceGateway.test.ts:18,98` mirror-asserts the
  implementation's `findFirst` where-clause against a fully mocked Prisma —
  the authz filter of the blob-streaming endpoint
  (`knowledgeSourceGateway.ts:82-98`) is never proven against a real DB.
- P2-3 (75, manual): real SSRF/DNS-pinning functions (`resolvePublicIPv4`,
  `requestPinnedUrl`, `kbIngestionApi.ts:426-459`) are exercised only through
  injected fakes (`kbIngestionApi.test.ts:317-329`).
- P2-4 (75, gated_auto): hand-rolled native `<select>` filters
  (`KnowledgeBaseResourceList.tsx:639-651`) vs the design system `SelectField`
  used everywhere else, including this PR's `KnowledgeBaseChatbotBindings.tsx:128`.
- P2-5 (50, critical-class carve-out, manual/doc): `KB.owner … onDelete: Cascade`
  (`knowledge.prisma:35`) — a future user hard-delete flow would cascade
  KB→KBResource→KBIngestionRun and bypass tombstone cleanup, orphaning Azure
  blobs + external state. Latent: no app code hard-deletes users today.
  Document before any account-deletion/GDPR flow.

### P3 findings

- P3-1 (75, gated_auto): `KnowledgeBaseFileDropzone.tsx:82`
  `console.error('Failed to upload KB file')` drops the caught error object.
- P3-2 (75, advisory): no rate limiting on the two secret-gated routes
  (`app.ts:202,243`); pre-existing app-wide gap, relevant only on secret leak.
- P3-3 (50, advisory): single shared `KB_SOURCE_GATEWAY_KEY` authorizes any
  owner's blob by resource id — all-tenants blast radius; likely the intended
  system-to-system model (per-KB scoping enforced platform-side); confirm and
  document.
- P3-4 (advisory, tests): no concurrent byte-quota boundary test (count
  boundary has one at `knowledge.test.ts:786`); rotation "cannot starve"
  proven only single-snapshot and `kbMaintenance` lacks `kbIngestion`'s
  wraparound-fill; six-groupBy metrics never tested with multiple KBs per
  page; webhook tests hardcode UUIDs (safe only while `singleFork: true`).

## External platform gates (not branch defects)

- D-8: platform cannot yet validate `scope.kb_id` per project nor enforce
  registry quotas (documented in-repo, no duplicate registry added).
- R4.3/R4.4 gate any real retrieval canary; scope-token verification lives
  outside this repo by design.
- Klicker retry-safety assumes the platform honors `Idempotency-Key` replays;
  worth one staging fault-injection exercise.
- Correlation-persist failure after `acceptResource`
  (`kbIngestion.ts:373-434`) can leave an accepted operation unrecorded
  Klicker-side; platform delete-supersedes-upsert semantics decide if harmless.

## Verified clean (highlights)

Webhook CAS fencing (stale/replayed/foreign events cannot resurrect deleted
state); HMAC over raw bytes with `timingSafeEqual`, no auth oracle, byte-exact
canonical-JSON strict schema; SSRF checks at registration and dispatch with
per-hop DNS resolution + socket pinning (literal-encoding bypasses closed by
URL normalization); globally consistent lock ordering (KB→chatbot/resource,
sorted ids); no blob/HTTP I/O under row locks; deletion pipeline crash-safe
end-to-end; post-commit delete dispatch failures never surface as mutation
errors; one-enabled-KB invariant DB-enforced (partial unique index); cursors
strictly lexicographic, owner+filter-hash bound; generated artifacts
drift-free; analytics schema byte-identical; EN/DE 132/132 key parity;
enumeration-safe not-found behavior. GitGuardian: the branch adds no new
secret or personal-data exposure; the sole red check is pre-existing incident
`1509424` (base-branch local test credential).

## Verdicts

1. Architecture: sound; single blemish is the UPSERT/DELETE outbox asymmetry
   (P1-1), closable within the existing pattern.
2. Engineering/maintainability: good; short fix list (P1-3, P2-1, P2-4).
3. Security: pass; advisories only, no new exposure.
4. Safe to continue into W8/W9 while draft: yes (W8 does not touch these
   models; W9 anticipated via reserved webhook event types; land P1-2 before
   W9 volume; KG may need an additive third `KBIngestionOperation` value).
5. Smallest remediation set: P1-2 one-liner + boundary test; P1-1 UPSERT
   recovery; P1-3 seven-handler pattern fix. Everything else batches into the
   next package.
