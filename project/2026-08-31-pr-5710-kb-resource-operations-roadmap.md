# Knowledge Base resource operations roadmap — PR [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710)

Date: 2026-08-31

Status: execution in progress — W1 acceptance and publication

Working context: `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/kb-resource-operations-w1`, branch `rs/kb-resource-operations-w1`

PR: [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710), targeting `feat/kb-element-generation-followups`

Proposed delivery target: the current KB/KG feature stack, with the live PR base resolved again before implementation. The ultimate integration target remains `v3-ai` unless the user names another target. This roadmap does not include the `v3-ai` to `v3` promotion branch.

Parent work: [KB management UX roadmap](./2026-08-24-pr-5540-kb-management-ux-plan.md)

Audience: a senior developer or agent picking this up without session context. Read [the domain model](../docs/domain-model.md), [frontend conventions](../docs/frontend-conventions.md), and [the async worker guide](../docs/async-and-workers.md) before implementation.

## 1. Orchestration contract

| Field | Contract |
| --- | --- |
| Goal and terminal | Deliver two independently reviewable desktop Manage capabilities: `Ingest all` reconciles every resource that is not serving its current form, and file replacement updates one existing resource identity through a safe staged revision. Material classification is controlled metadata, not provider behavior. The package ends when both work PRs are green at their own tips, the final review accepts the integrated stack, and the required browser evidence covers the named states. |
| Mode and boundary owner | Guided execution under `rs-roadmap-orchestrator`; the main session owns decomposition, integration, reviews, verification, and boundary decisions. |
| Question channel | The orchestrator presents the decision gates in this roadmap. Sol supplied the planning pass and will be reused for plan hardening; no new user-visible task is needed. |
| Authority layers | Plan artifact and local implementation commits: proposed. Normal push and PR updates: ask at execution handoff unless the user approves the exact branch and remote. Merge, promotion, deployment, live ingestion, graph generation, secret access, cluster writes, deletion, and production actions: withheld. |
| Writer budget | One implementation writer per work PR. Do not split the two work packages into concurrent writers because both touch the resource list, generated GraphQL operations, and the same lifecycle seams. Sol is read-only for planning/review. |

## 2. How to work on this

Do not implement from the primary checkout. It contains unrelated user-owned tracked and untracked changes. Reuse the current lower worktree only after the remote-state gate and target resolution are repeated.

Before implementation:

1. On the host, run `git fetch --prune`, then record the branch, upstream, ahead/behind counts, and `git worktree list --porcelain`.
2. Resolve the live PR base. The current lower worktree is a feature-stack checkout; do not merge or rebase `origin/v3`, `origin/v3-ai`, or `origin/dev` until the user approves that exact one-time integration. The primary roadmap checkout is stale and is not an implementation base.
3. Inspect the current branch diff and preserve unrelated `.devcontainer`, `.devrouter`, and other user-owned changes. Stage explicit paths only.
4. For container checks, use the repository's Node 24/pnpm environment. Run host `gh`/`git` commands on the host and repository tests/builds in the managed container. Do not start a runtime merely for schema or service checks.
5. Because the work changes Manage interactions, use the repository `agent-browser` procedure for authenticated desktop verification. Use the existing seeded delegated lecturer fixture or synthetic data only. Capture English and German evidence at 1440×900; a narrow smoke check must not introduce horizontal scrolling, but mobile is not a delivery target.

The two actual work PRs are stacked by capability, not by directory or commit:

```text
current resolved KB feature base
  └─ PR 1: Ingest all + material category, complete and usable
       └─ PR 2: Same-resource file replacement, complete and usable
```

There is no separate docs-only PR and no promotion PR in this stack. Each PR may contain multiple commits. The exact branch names and PR bases are resolved at execution time after Gate A1.

## 3. Current state

| Item | State | Evidence |
| --- | --- | --- |
| Existing KB management UX | Complete prior work | [Prior UX roadmap](./2026-08-24-pr-5540-kb-management-ux-plan.md) records the resource-first page, semantic table, one add-resource chooser, polling, selection, inspector, and explicit per-resource ingestion. Do not redo those changes. |
| Current resource lifecycle | Existing | `KBResource` uses `ADDED`, `QUEUED`, `PROCESSING`, `READY`, and `FAILED`; latest operation identity is separate from `activeResourceVersion` and `activeContentSha256`. `KBIngestionRun` is append-only. |
| Current ingestion ownership | Existing contract | Klicker queues the external ingestion operation and reconciles signed callbacks. Data-ingestion owns fetching, parsing, embedding, and indexing. This roadmap does not add scraping or another Hatchet ingestion implementation. |
| Current file upload | Create-only | `requestKbFileUpload` and `confirmKbFileUpload` create a new `KBResource` and a 15-minute `KBUploadTicket`; the ticket has no target resource. |
| Current batch ingestion | Missing | `ingestKbResource` handles one resource. The Manage table only has per-resource Ingest/Retry/Re-ingest actions and sees a cursor-paginated window. |
| Current material metadata | Missing | `KBResource` has source type `BLOB` or `URL`, but no separate material category or tag. Source type must remain independent of the proposed category. |
| Current graph and question-generation lifecycle | Out of scope and preserved | The graph build ledger remains the canonical graph identity. No graph-version lifecycle, graph source taxonomy, or question-generation change is part of this roadmap. |
| Local implementation checkout | Clean at planning start | Lower worktree head is `b1646839e8737da18fb016860be971aaeb05a205` (`chore(devrouter): align managed runtime with azurite`), branch is 9 commits ahead and 6 behind its tracking branch. This is a planning snapshot, not a permission to integrate its remote or another base. |
| Remote freshness risk | Open execution gate | The primary checkout `docs/chatbot-hitl-config-roadmap` is 144 commits behind `origin/v3` and 1 ahead; `origin/dev` is 62 commits beyond its merge-base and overlaps 37 files. Recheck and obtain approval before any upstream integration. |
| Planning partner | Completed with concerns | Sol recommended server-side reconciliation, a staged same-resource replacement, and a three-value controlled classification. The material replacement concern is recorded in the design below: never overwrite or delete the only source of the still-serving revision before the candidate is proven. |

## 4. Non-negotiables

- `Ingest all` is a server-side reconciliation over the complete KB. It must not iterate the loaded client page, current search result, filter result, or selection.
- A current `READY` resource is a no-op. `Ingest all` must not become “refresh every URL”. A provider-refreshed active version newer than the latest lecturer attempt is also not downgraded.
- `QUEUED` and `PROCESSING` resources are skipped, not duplicated. Concurrent bulk and per-resource actions must converge through conditional claims and deterministic lock ordering.
- Failed resources are eligible for one new attempt when their failed revision is not already the active serving revision. The result must tell the lecturer that failures are being retried.
- File replacement preserves the `KBResource.id` and the material category. It is not delete-plus-create and it is not an in-place overwrite that can destroy the only recoverable source.
- File replacement stages a candidate blob and keeps the old serving identity available until the signed callback or the existing reconciliation path proves the new revision. The worker, source preparation, callback comparison, and source gateway must resolve the candidate from the immutable resource-version/run correlation, not from mutable `KBResource` source or digest fields. On failure, the old resource metadata and AI-serving content remain available.
- Old and candidate blobs are retained until a bounded asynchronous cleanup proves that the new serving revision is settled. Do not delete them synchronously from the browser confirmation path.
- Replacement consumes no resource slot, but the transition temporarily stores both old and candidate bytes. Reserve the candidate's full size while it is staged or pending, keep the old bytes in the resource or retention ledger until cleanup, and release only after conditional cleanup succeeds. The UI must explain temporary headroom rather than silently evicting content.
- Material category is controlled single-select metadata, separate from `BLOB`/`URL`, and has no effect on ingestion, retrieval, graph generation, or question generation in this MVP.
- Use one generated Prisma migration per work PR at most. Review generated provenance, schema equivalence, defaults, indexes, and retained custom SQL. Do not hand-create a migration when Prisma can generate it.
- Preserve the existing external data-ingestion contract. Do not send web-scraping instructions from Klicker, add a second scraper, change provider payload semantics without necessity, or move provider ownership into Klicker.
- Do not add a second graph lifecycle or make category changes a graph/question-generation trigger. Graph generation remains a later, explicit action.
- Keep English and German strings paired. Preserve the existing table, modal, polling, focus, and selection contracts from the prior UX roadmap.
- No secrets, real course data, production data, cluster writes, deployment, live provider retry, graph build, or cleanup action is part of this roadmap execution.

## 5. Known traps

**A bulk button only sees the loaded rows.** Cause: the resource query is cursor-paginated and filters are client-visible controls. Remedy: make the mutation and its candidate predicate server-side; expose a bounded summary count separately from the loaded table.

**Every `READY` row gets fetched again.** Cause: status is mistaken for freshness. Remedy: compare the latest desired resource version/digest with the active serving version/digest; treat current READY and newer provider-served revisions as no-ops.

**Two clicks create two ingestion attempts.** Cause: a preflight count is treated as a lock. Remedy: claim rows transactionally, in sorted resource-ID order, with a conditional status/version predicate; the mutation result is authoritative and the preflight count is informational.

**A queue failure leaves a permanent QUEUED row.** Cause: the DB claim commits before the task dispatch. Remedy: settle a failed dispatch as `FAILED` for that attempt, and preserve the existing maintenance backstop that can safely re-dispatch a stale attempt with the same idempotency key.

**Replacing a file makes the old AI content disappear.** Cause: the canonical blob pointer or active version is overwritten before the new operation settles. Remedy: stage a candidate upload, correlate it to the resource revision, retain the prior serving identity, and promote only after the signed callback/reconciliation proof.

**The candidate upload is recorded but the worker still reads the old file.** Cause: the current source gateway resolves only `KBResource.blobName`, while a safe replacement must leave that field unchanged until promotion. Remedy: persist immutable candidate BLOB metadata on the matching ingestion run, and make the worker, retry path, and source gateway resolve it by resource ID, resource version, and attempt; keep a legacy fallback only for pre-change runs.

**Source preparation writes the candidate digest into the canonical resource.** Cause: the current `persistPreparedSource` and callback comparison use `KBResource.contentSha256`; that would expose or compare the replacement before it is promoted. Remedy: for replacement runs, write candidate digest/size to the immutable run record, compare callbacks against that run, and promote the resource source metadata and active identity together only after a matching serving result.

**A failed replacement cannot be retried.** Cause: the candidate upload ticket is deleted at confirmation or the worker reads only the old resource metadata. Remedy: retain a target-bound replacement ticket/source record through success or explicit supersession, and make retry resolve the same candidate without re-uploading it.

**Quota rejects a replacement because old and new bytes are counted as two permanent resources.** Cause: the existing create-only ticket path is reused unchanged. Remedy: reserve the full candidate size while the old source remains retained, and use the physical-byte formula below under the KB lock.

**The quota formula is internally inconsistent during replacement.** Cause: a positive delta is reserved while both the old resource and full candidate blob remain physically present. Remedy: use one explicit physical-byte formula: other retained bytes plus the old resource bytes plus the full candidate bytes before promotion; other retained bytes plus new resource bytes plus the retained old bytes after promotion; new resource bytes after cleanup. Keep the full candidate reservation through the candidate's non-terminal lifetime.

**A category is mistaken for a source type or provider hint.** Cause: “file”, “website”, “syllabus”, and “script” are mixed into one field. Remedy: keep source type (`BLOB`/`URL`) and material category (`UNCLASSIFIED`/`COURSE_CONTENT`/`ADMINISTRATIVE`) as separate concepts; do not pass the category to data-ingestion in this MVP.

**The plan drifts into graph or question-generation work.** Cause: the KB detail page contains graph and generation controls. Remedy: keep the resource workspace changes independent; graph builds continue to use only active serving sources and the canonical build ledger.

## 6. Primitive impact

| Primitive | Owner and source of truth | New user-visible behavior | Invariants |
| --- | --- | --- | --- |
| Resource freshness | `KBResource` latest revision plus active serving identity and `KBIngestionRun` | The workspace says which resources need ingestion and offers one `Ingest all` action. | Current READY is a no-op; active/in-flight claims are fenced; latest operation and serving revision remain distinguishable. |
| Bulk command | GraphQL mutation and server-side candidate predicate | One confirmation and one result summary replace repetitive row-by-row clicking. | Complete-KB scope, deterministic claims, bounded dispatch, idempotent repeated clicks, no client pagination dependence. |
| Same-resource replacement | Target-bound upload ticket plus resource/run revision correlation | A BLOB row can be updated without changing its resource identity; the old serving revision remains visible during processing. | Candidate is staged, old serving content is retained on failure, promotion is atomic after callback, cleanup is asynchronous. |
| Material category | Controlled enum on `KBResource` | Lecturers can classify and filter materials as Course content, Administrative, or Unclassified. | Independent of source type and provider behavior; replacement preserves it; existing rows backfill safely. |
| Lecturer control | Manage resource table, inspector, and focused dialogs | The common workflow is scan, classify, ingest all, or replace one file. | Status wording is actionable, result summaries are honest, focus and keyboard behavior follow the existing modal contract. |

### Execution delegation map

| Work item | Single execution owner | Reviewers and evidence |
| --- | --- | --- |
| W1 — Ingest all and material category | Main session as `rs-roadmap-orchestrator`; no parallel writer | Simplifier for the completed slice, applicable slice reviewer for the public GraphQL/concurrency boundary, then browser and exact-head evidence. |
| W2 — Same-resource file replacement | Main session as `rs-roadmap-orchestrator`; no parallel writer | Simplifier plus slice reviewer for source identity, quota, callback, and cleanup; then integrated final review and browser evidence. |

Sol is the planning/review partner only. Reviewer roles do not own implementation files and do not count as additional work-package owners.

## 7. Work items

### W1 / PR 1 — Ingest all and material category, end to end

**Problem**

Lecturers currently have to open or inspect resources one by one, and the table cannot distinguish a syllabus from course content. The first work PR adds one server-authoritative reconciliation command and a small controlled metadata field while preserving the existing source and ingestion contracts.

**Do**

1. Add `KBResourceMaterialType` with `UNCLASSIFIED`, `COURSE_CONTENT`, and `ADMINISTRATIVE`. Use one generated migration to backfill existing resources to `UNCLASSIFIED`; new resources visibly default to `COURSE_CONTENT` but submit an explicit enum value.
2. Expose the category as a non-null `materialType: KBResourceMaterialType!`, defaulting legacy and omitted create callers to `UNCLASSIFIED`. The current UI sends `COURSE_CONTENT` explicitly. Add an exact connection summary with non-null `needsIngestionCount`, `failedIngestionCount`, and `inProgressCount`; these counts cover the complete KB, not the loaded cursor window. Add a focused category update mutation so existing resources can be classified from the inspector without changing their source or triggering ingestion.
3. Add a server-side `ingestAllKbResources(kbId)` mutation. Its candidate predicate is:
   - `ADDED` resources;
   - `FAILED` resources whose failed revision/digest is not already active;
   - `READY` resources whose latest desired version or digest does not match the active serving identity;
   - never `QUEUED` or `PROCESSING` resources;
   - never a resource whose active serving version is newer than its latest lecturer attempt.
4. Lock the KB and eligible resource rows in deterministic ID order, recheck each candidate under the lock, create one `KBIngestionRun` and one attempt per claim, commit the short transaction, then dispatch through the existing `ingestKBResource` task with bounded concurrency. Return an exact `KBIngestAllResult` containing non-null `queuedCount`, `retriedFailedCount`, `alreadyCurrentCount`, `alreadyInProgressCount`, and `queueFailureCount`. Queue-failure compensation may mark only the still-current attempt as failed; stale or concurrently changed rows are untouched. Repeated calls must not create duplicate attempts for rows already claimed.
5. Keep `Ingest all` in the resource toolbar. Confirm the server-reported scope, including how many failed resources will receive a fresh attempt; after the mutation, show its mixed-result summary and let the existing polling surface terminal outcomes. Do not invent percentage progress.
6. Add the category select to website/document creation, show a category badge or short label in the table/inspector, add a server-backed category filter, and preserve the value across all existing ingestion and deletion actions.
7. Update [the domain model](../docs/domain-model.md), [frontend conventions](../docs/frontend-conventions.md), [async worker guidance](../docs/async-and-workers.md), and the affected `.agents/skills/klicker-frontend-ui/SKILL.md` in this PR. Document that category is lecturer metadata only and that `Ingest all` does not refresh already-current URLs.

**Check**

- Prisma migration generation, client generation, and schema sync produce no unreviewed model drift. Confirm exactly one new migration in this work PR.
- GraphQL tests cover mixed statuses, stale version/digest comparisons, failed retry eligibility, newer provider-served versions, authorization, kill switch, quota-independent dispatch, queue failures, repeated calls, and concurrent bulk/per-resource claims.
- GraphQL contract tests assert the exact non-null summary/result fields, omitted legacy category arguments default to `UNCLASSIFIED`, and the current UI submits `COURSE_CONTENT` explicitly.
- Focused GraphQL code generation and package type checks pass. The complete repository check, format, lint, and build checks pass at the PR tip.
- Playwright covers an English and German desktop resource table with paginated data where a stale resource is outside the first loaded page; one click queues it, current rows remain untouched, failed rows are reported, and a second click is a no-op while work is active.
- Browser evidence covers category selection on add, category edit on an existing row, category filtering, empty/current/all-current states, confirmation, mixed-result summary, and keyboard/focus behavior.
- Browser evidence also covers disabled/loading double-submit prevention, a stale preview becoming a no-op safely, zero eligible resources, kill-switch and mutation-error announcements, and reload persistence of category and terminal ingestion state.
- Reverting only the candidate predicate test or conditional claim must make the corresponding regression fail; do not accept a green test that never exercises the race or freshness distinction.

**Working context**

Repository: KlickerUZH. Start from the exact base resolved in Gate A1. Proposed branch role: first actual work PR in the current KB feature stack. Owned mutable seams: Prisma knowledge schema and one migration, GraphQL knowledge schema/services/ops/tests, `packages/kb-management`, generated GraphQL output, and the three named docs. One writer owns the work PR; preserve unrelated worktree changes.

**Authority and terminal**

Local edits, repository-native checks, required read-only reviews, and a local commit are proposed for execution after plan approval. Push, PR creation/update, and marking ready require the delivery approval named at handoff. Merge, deployment, live ingestion, graph generation, production, secrets, cluster writes, and cleanup remain withheld. Terminal: `reviewed` and independently green at this layer's tip.

**Boundary owner**

`rs-roadmap-orchestrator` integrates the layer and returns the exact head, diff scope, test evidence, browser evidence, and review disposition.

**Release-note impact**

Candidate claim: “Lecturers can classify resources and ingest all resources that need a current ingestion in one action.” This is true only after the layer's exact-head CI and desktop browser evidence pass. It does not claim that graph generation or question generation is changed.

**Depends on / GATED on**

GATED on A1, A2, and A5. W1 is the base for W2.

**Priority and size signal**

P1. Estimated 12–18 files and 350–500 human-authored lines, plus generated GraphQL/Prisma output. This is one work package because the command, category semantics, table state, and creation/edit flows must be judged together; splitting them into schema/API/UI fragments would leave each layer incomplete or misleading. Reassess the estimate after the first diff; split only with a new user ruling if the package becomes two independently functional capabilities.

### W2 / PR 2 — Safe same-resource file replacement, end to end

**Problem**

The current upload path can only create a new resource. A lecturer who updates a script must delete and recreate the row, losing its identity and making active serving behavior hard to understand. The second work PR adds a staged BLOB replacement that keeps the same row and keeps the old AI content available until the new revision is proven.

**Do**

1. Freeze a replacement state machine before coding. An unconfirmed ticket is `PENDING_UPLOAD` and may expire with its candidate cleaned up. Confirmation consumes it into one replacement ingestion run; ticket-expiry maintenance must never delete a confirmed or in-flight candidate. A failed candidate remains retryable, a superseded candidate can never promote, and a successfully promoted candidate becomes cleanup-eligible only after the exact promotion proof. Enforce one non-terminal replacement per resource with the locked resource slot plus a database-enforced uniqueness rule (use the smallest documented SQL partial index if Prisma cannot express the active-status predicate). Extend the upload-ticket lifecycle with a target resource, expected resource version, replacement purpose, and candidate metadata. Extend the append-only ingestion run with immutable candidate BLOB source metadata, candidate digest/size, candidate identity, and the previous source pointer needed for cleanup. Use one generated migration for these replacement fields and any cleanup index. Do not weaken the create-only ticket checks.
2. Add dedicated `requestKbFileReplacement` and `confirmKbFileReplacement` operations rather than making the existing create mutations ambiguously destructive. The request validates a live BLOB resource and creates a random candidate blob. It reserves the candidate's full bytes because the old source remains retained. The confirmation locks the KB and target resource, verifies the expected version and upload metadata, carries the candidate reservation into the run, creates a new versioned ingestion run, and rejects replacement while another ingestion/replacement is active.
3. Keep the candidate source addressable through the run until settlement. Update the existing task payload builder, source preparation/digest persistence, stale-attempt maintenance retry, callback comparison, and `handleKBSourceGateway` to resolve BLOB source metadata from the matching resource ID, resource version, and attempt/run. They must not read the old mutable `KBResource.blobName`, `mimeType`, `sizeBytes`, or `contentSha256` for a replacement. Candidate identity, digest, and size are stored on the run; the canonical resource source metadata stays at the last promoted revision until success. A legacy fallback to current resource metadata is allowed only for runs created before this change. The data-ingestion service still receives the existing URL/BLOB source contract; no scraper or new provider path is added.
4. Give retry a precise identity rule: a retry creates a fresh monotonic resource version and ingestion attempt, retains the same candidate blob identity, supersedes the failed run, and requires resource ID, candidate identity, version, and attempt to match at promotion. `Ingest all` and row retry must resolve the latest failed replacement candidate rather than silently re-ingesting the old canonical blob.
5. On a signed success callback or valid reconciliation result, atomically promote candidate file metadata, `activeResourceVersion`, and `activeContentSha256`; retain the prior blob long enough for asynchronous cleanup. On failure or queue failure, leave the prior resource metadata, active serving identity, and prior serving content intact, surface the failed replacement, and keep the candidate available for one explicit retry or safe supersession. The resource query may expose the pending candidate from the latest run for UX, but must not pretend it is serving.
6. Extend maintenance and deletion fencing to account for candidate and retained blobs and for superseded failed candidates. Cleanup must be retryable and conditional on the settled resource revision; no browser action deletes the old blob synchronously. Until cleanup completes, quota is calculated as other retained bytes plus both the new and retained old physical blobs. After cleanup, only the promoted blob remains in the resource total.
7. Add the row action `Replace file` for BLOB resources. The modal shows the current file, category, serving state, and the consequence of replacement. The final action is explicit: `Replace and ingest`. Keep the same title/category unless the lecturer edits category intentionally. After confirmation, keep one row, show the candidate file and “previous version still serving” state, and offer `Retry replacement` or `Choose another file` after failure without forcing delete-plus-create.
8. Update the same domain, async-worker, frontend documentation, and affected frontend skill with the replacement state machine and retention rule. Do not add graph source-category snapshots or question-generation behavior in this PR.

**Check**

- GraphQL tests prove the exact ticket/run state machine, one active replacement constraint, same-ID replacement, BLOB-only authorization, expected-version fencing, upload-ticket mismatch/expiry, full candidate-byte quota reservation, concurrent replacement rejection, candidate retry with a fresh version/attempt, supersession, and category preservation.
- Ingestion/webhook/source-preparation/source-gateway tests prove the candidate source and digest are read from the matching immutable run/version/attempt while the resource still points at the old file, the callback promotes only that matching candidate, a failure leaves old resource metadata and active fields unchanged, and a stale callback cannot delete or promote a candidate. Maintenance tests prove retained and superseded candidate blob cleanup is conditional and retryable.
- The failed-replacement path is tested through both the row retry action and `Ingest all`; both reuse the latest candidate run and never fall back to the old canonical blob.
- Quota tests cover equal, larger, and smaller candidates before promotion, after promotion but before cleanup, after cleanup, failed replacement, and a second replacement attempt. The assertions use the physical-byte formula rather than a positive-delta shortcut.
- The migration is exactly one generated replacement migration for this PR. Review generated SQL, indexes, defaults, foreign keys, custom cleanup operations, and the absence of unrelated model churn.
- Playwright covers replacing a file without changing its row, processing with the old serving badge, successful promotion, failed replacement with old serving content retained, retry with the same candidate, safe supersession with another file, upload expiry, quota feedback, concurrent replacement rejection, reload persistence, disabled/loading double-submit prevention, and keyboard/focus behavior in English and German at the primary desktop viewport.
- Run GraphQL generation, targeted service/Hatchet tests, package type checks, formatting/linting, the full `check:all`, and the pre-push build at this layer's exact head.
- Use a synthetic/local Blob fixture only. No live external ingestion retry, production data, graph build, or cleanup operation is part of this acceptance check.

**Working context**

Repository: KlickerUZH. Base is the green exact head of W1 after the normal stack interaction check. Proposed branch role: second actual work PR in the current KB feature stack. Owned mutable seams: replacement ticket/schema fields, GraphQL replacement operations and callbacks, existing Hatchet bridge/maintenance paths, `KnowledgeBaseFileDropzone`, resource inspector/table, generated operations, and affected docs. Do not modify data-ingestion or sibling question-generation work.

**Authority and terminal**

Local edits, repository-native checks, required reviews, and local commits are proposed after plan approval. Push and PR updates require the delivery approval named at handoff. Merge, deployment, live provider retry, graph generation, production, secrets, cluster writes, and cleanup remain withheld. Terminal: `reviewed` and independently green at this layer's tip.

**Boundary owner**

`rs-roadmap-orchestrator` integrates W2 with W1, verifies the final branch diff, and owns the final review packet.

**Release-note impact**

Candidate claim: “Lecturers can replace a file without recreating its Knowledge Base resource, while the previous AI-serving revision remains available if the update fails.” This claim requires exact-head service, maintenance, and desktop browser evidence.

**Depends on / GATED on**

GATED on W1 and A1–A5. Do not start W2 on a stale or rebased W1 head without refreshing the interaction check.

**Priority and size signal**

P1. Estimated 18–24 files and 550–750 human-authored lines, plus generated output. This is deliberately one risk-isolated work package because staged source identity, source-gateway resolution, callback promotion, quota, cleanup, and the user-visible replacement state are one correctness contract. Do not split it into a UI PR and a storage PR that cannot independently preserve the old serving revision.

## 8. Decision gates

The recommendations below make the MVP predictable. The user can approve them together or change an item before implementation.

| Gate | Decision | Recommendation and rationale | Gates |
| --- | --- | --- | --- |
| A1 — Base and integration | Which exact live branch/PR base should receive the two work PRs, and should the current upstream changes be integrated once before coding? | Resolve the live KB feature-stack base at execution start. Incorporate upstream only after one explicit approval naming the branch and integration pass. The stale roadmap checkout is not the base. | W1, W2 |
| A2 — Bulk freshness semantics | Should `Ingest all` retry failed resources, skip current READY resources, and skip a provider-refreshed active version newer than the latest lecturer attempt? | Yes. Include failed resources that are not currently serving, never re-fetch current READY resources, and never downgrade a newer active provider revision. This makes the label truthful and prevents surprise URL refreshes. | W1 |
| A3 — Replacement completion | Should confirming a replacement automatically queue ingestion? | Yes, behind an explicit `Replace and ingest` confirmation. A replacement is not complete until its candidate is ingested, while the old serving revision remains available during the operation. | W2 |
| A4 — Replacement quota | Should candidate and retained bytes count until asynchronous cleanup settles? | Yes. Reserve the candidate's full size while the old source remains retained. Before promotion count old plus candidate; after promotion count new plus retained old; after cleanup count only new. This keeps the physical quota truthful, even for a smaller replacement. | W2 |
| A5 — Material taxonomy | Should MVP use controlled single-select metadata rather than arbitrary tags, and should new resources default to Course content? | Yes. Use `Unclassified`, `Course content`, and `Administrative`; backfill existing resources to Unclassified and preselect Course content for new resources. “Script” maps to Course content and “syllabus” maps to Administrative. Add arbitrary multi-tags only after a real filtering/metadata use case exists. | W1, W2 |

## 9. External dependencies to watch

- **Data-ingestion service:** its existing source URL/BLOB payload and signed callback/resource-version contract must remain usable. Klicker resolves staged candidates through its own ticket/run correlation where needed; no provider API change is planned. If the contract cannot preserve same-resource/version fencing, stop at the design boundary and ask before expanding it.
- **Azure Blob storage:** existing SAS upload and maintenance deletion paths must support candidate blobs and conditional cleanup. Do not access secret values; use metadata-only tests or existing local Azurite fixtures.
- **Current feature stack and upstream branches:** the lower worktree is not a fresh copy of its remote, and the unrelated primary checkout has substantial upstream drift. Re-run the remote-state gate and make the A1 integration decision before creating implementation branches.
- **Devrouter/runtime:** browser proof needs a healthy Manage runtime. Reuse the existing managed runtime only after its exact branch and revision are verified; do not start, stop, or repair it as part of planning.
- **Graph/question-generation work:** remains a consumer of active serving content and the canonical graph-build ledger. No synchronization or source-category contract is needed for W1/W2.

## 10. Out of scope

- New data-ingestion endpoints, scraper logic, HTML parsing policy, provider-side material classification, or a second Hatchet ingestion process.
- Automatic re-ingestion of every current URL or a “refresh all” feature.
- Arbitrary free-form tags, tag joins, nested taxonomies, prompt weighting, retrieval weighting, or citation changes.
- Graph generation, graph source metadata, graph publication, question generation, generated-element persistence, or new graph lifecycle entities.
- Mobile-first redesign, shared Manage shell/header repair, broad modal-library refactoring, or full WCAG audit; retain the prior UX roadmap's separate follow-ups.
- Production deployment, staging live ingestion, live retries, cluster changes, secret access/write, data cleanup, and destructive deletion.

## 11. Review and evidence expectations

Each work PR must return a boundary packet containing:

- exact base and head, branch/PR target, and a complete changed-path accounting;
- generated versus human-authored diff counts, one-migration count, and migration provenance/schema review;
- targeted test commands and results, including the negative race/fencing checks;
- GraphQL codegen and package check results, full repository checks, and exact-head CI after publication if push is authorized;
- desktop browser evidence for the named English/German states, with accessible names, focus entry/containment/restore, status announcements, and no horizontal overflow at the narrow smoke width;
- review findings and verified dispositions from the simplifier, applicable slice reviewer, and final reviewer; invalidated evidence must be named rather than silently reused;
- updated `Progress` entry and the next boundary candidate. Include the affected `.agents/skills/klicker-frontend-ui/SKILL.md` or an explicit reviewed no-change disposition. A green source/CI result is not a deployment or live-ingestion proof.

The package's final review must explicitly verify that source type and material category remain independent, the bulk mutation is complete-KB and idempotent, replacement preserves resource identity and old serving content on failure, retained blobs are not deleted early, and graph/question-generation contracts remain unchanged.

## 12. Progress (append-only)

### 2026-08-31 — planning draft

- Mapped the requested `Ingest all`, same-resource file replacement, and material classification improvements against the current KB resource table, GraphQL service, Prisma schema, Hatchet bridge, maintenance cleanup, and existing UX roadmap.
- Sol planning pass completed with `DONE_WITH_CONCERNS`. Adopted its core recommendations: server-side reconciliation, deterministic claims, controlled three-value classification, and target-bound staged replacement. The concern is addressed by retaining the old serving identity and candidate source until settlement.
- Proposed two actual work PRs: W1 delivers Ingest all plus classification end to end; W2 delivers safe same-resource replacement end to end. No docs-only or promotion PR is included.
- No implementation, upstream integration, push, merge, deployment, live ingestion, graph generation, or cleanup was performed.

### 2026-08-31 — plan hardening revision

- Sol's hardening pass returned `VERDICT: REVISE`: the draft did not specify how the staged candidate reaches the source gateway while `KBResource.blobName` still names the old serving source.
- Accepted and incorporated the finding in W2. The ingestion run now owns immutable candidate BLOB source metadata; the task builder, maintenance retry, and source gateway must resolve by resource ID, resource version, and attempt, with a legacy-only fallback. The callback promotes candidate metadata only after a matching serving result.
- The opposing-provider plan challenge was armed but no Claude route is available in this environment. Same-provider hardening remains the completion gate.

### 2026-08-31 — source-resolution completeness revision

- After the round-2 approval, the main session checked the current implementation paths and found a related unsafe assumption: `persistPreparedSource` and callback comparison currently use mutable `KBResource.contentSha256` and source metadata.
- W2 was made more precise before final hardening. Replacement candidate source metadata and digest must live on the matching immutable ingestion run; source preparation, retries, callbacks, and the source gateway must use that run, and only a matching success may promote the canonical resource fields.

### 2026-08-31 — late Sol findings incorporated

- Sol's completed planning review identified additional hardening needs: an exact physical-byte quota formula, a frozen replacement-ticket state machine, fresh retry identity with candidate reuse, exact GraphQL summary/result fields, failed-replacement interaction with `Ingest all`, an explicit delegation map, and broader browser/error-state acceptance.
- Accepted all findings. The roadmap now requires full candidate-byte reservation while old and candidate blobs coexist, a database-enforced single active replacement, immutable candidate identity across retries, exact non-null GraphQL contracts, and the named documentation/skill updates. These changes supersede the earlier positive-delta wording and invalidate the prior W2 approval for one final focused review.

### 2026-08-31 — final plan hardening

- Sol returned `VERDICT: APPROVED` after the focused source-resolution re-review. The final draft now covers candidate metadata and digest/size across preparation, dispatch, retry, callback comparison, and source-gateway reads, with callback-gated promotion and failure preservation.
- The plan is ready for the single user approval gate. No implementation, upstream integration, push, merge, deployment, live ingestion, graph generation, or cleanup was performed.

### 2026-08-31 — final plan hardening superseded

- The initial Sol planning child later returned additional `REVISE` findings after its delayed completion. The main session accepted and incorporated them: the replacement quota formula now counts full candidate bytes while old bytes are retained, the replacement state machine and retry identity are explicit, the GraphQL summary/result fields are exact, failed replacement retry flows through `Ingest all`, the execution delegation map is present, and browser/error-state coverage is expanded.
- The prior final-hardening entry is superseded by this revision. A final focused Sol verdict is required before presenting the plan for execution approval.

### 2026-08-31 — final focused hardening

- Sol returned `VERDICT: APPROVED` after reviewing the corrected quota formula, replacement lifecycle, retry identity, exact GraphQL contracts, failed-replacement bulk retry, delegation map, skill documentation, and browser/error-state acceptance.
- The roadmap is ready for the single user approval gate. No implementation, upstream integration, push, merge, deployment, live ingestion, graph generation, or cleanup was performed.

### 2026-08-31 — final re-review after delayed findings

- Sol returned `VERDICT: APPROVED` on the actual current roadmap after the delayed planning findings were incorporated. The review confirmed the physical-byte quota formula, replacement ticket/run state machine, single active replacement constraint, retry identity, exact GraphQL contracts, failed-replacement bulk retry, delegation map, documentation gate, and browser/error acceptance.
- The roadmap is final for user approval. No implementation, upstream integration, push, merge, deployment, live ingestion, graph generation, or cleanup was performed.

### 2026-08-31 — execution base resolved

- The refreshed remote feature base is `origin/feat/kb-element-generation-followups@3c43f4c40dca67a3f842ef46ec334c5ba3554e32`.
- That branch already contains `origin/v3-ai@05ff5e0727dc207df1bbdba6035cd446108e7d90` as an ancestor, so the approved upstream interaction check requires no additional v3-to-v3-ai or v3-ai-to-feature merge for this package.
- The local parent checkout remains ahead 9 and behind 6 of its remote and contains the approved devrouter/Azurite change; it is not used as the W1 implementation base. W1 starts from the refreshed remote feature head, preserving the parent branch's existing work and avoiding unrelated integration into `v3-ai`.
- The unrelated primary `docs/chatbot-hitl-config-roadmap` checkout remains 145 commits behind `origin/v3` with overlapping `origin/dev` drift; no merge or rebase is performed there.
- A1–A5 are approved. W1 implementation and local review are now authorized; push, merge, deployment, live ingestion, graph generation, production, secrets, cluster writes, and cleanup remain withheld.

### 2026-08-31 — W1 started

- W1 implementation branch `rs/kb-resource-operations-w1` starts at the refreshed feature head `3c43f4c40dca67a3f842ef46ec334c5ba3554e32`.
- The requested devrouter/Azurite alignment is carried into this first work PR as the existing `b1646839e8737da18fb016860be971aaeb05a205` change; no unrelated runtime configuration is added.
- The plan is committed first on the W1 branch before behavior changes. No push, merge, deployment, live ingestion, graph generation, production, secrets, cluster write, or cleanup action has occurred.

### 2026-08-31 — W1 implementation and local verification

- W1 implementation is committed at `4de1d1345` with the requested bulk ingestion mutation, complete-KB reconciliation summary, material-category enum and UI controls, one additive Prisma migration, GraphQL operations, tests, and wiki/skill updates.
- The review copy correction is committed at `b30d8df0f`; the English and German bulk-ingestion confirmation now pluralize the single-resource case, and the Playwright assertion matches it. The branch is clean and three commits ahead of `origin/feat/kb-element-generation-followups`.
- The single migration `20260831165143_kb_resource_material_type` was applied with `prisma migrate deploy`. Its isolated create-only generation was blocked by three unrelated pre-existing local drift operations; the committed SQL contains only the requested enum and additive defaulted column, and the Prisma/Analytics schema mirrors remain synchronized.
- Node 24 verification in the existing W1 container passed: focused knowledge tests `71/71`, repository `check` `29/29`, full build `26/26`, and `format:check` across `2160` files. GraphQL generation produced no drift, package checks and the Prisma sync check passed, and the staged gitleaks scan found no leaks. The host pre-commit hook could not complete because host Node 26 triggered a no-TTY pnpm modules purge; the equivalent container checks are recorded here. The broader `check:all` attempt remains environment-blocked in analytics because uv cannot build pandas without a C compiler.
- Manual desktop `agent-browser` proof covered the authenticated Manage flow: create a synthetic URL resource, select and persist a material category, see the complete-KB summary and category filter, open the `Ingest all` confirmation, cancel it without dispatch, and inspect the category. The automated Playwright run was not executable because its host launcher requires Azurite under the full profile, while the full profile previously OOM-killed the backend; no raw runtime workaround was used. The W1 managed runtime was stopped afterward. Its exact container is `exited` and `devrouter ls` has no W1 route; the `devpod` CLI is unavailable for the additional provider-state readback, and `devrouter status` retains the prior `failed-transition` marker.
- The simplifier review at `4de1d1345` returned no findings. The risk review returned no blocking findings and one cosmetic pluralization concern, which was fixed at `b30d8df0f` and rechecked with the focused suite and formatter. The final integrated review remains the last W1 gate.
- W2 remains pending and is not started. No push, merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, or cleanup action has occurred.

### 2026-08-31 — W1 integrated review and evidence disposition

- The integrated final review of the full W1 branch found no source, migration, GraphQL, concurrency, UI, localization, or documentation blocker. The earlier pluralization concern was already fixed at `b30d8df0f`.
- The review identified one medium acceptance-evidence gap rather than a correctness issue. The manual desktop proof covered the authenticated English resource flow, category persistence, complete-KB summary, filter, and `Ingest all` confirmation. It did not confirm a live dispatch, mixed-result summary, duplicate-click behavior while work is active, or the German and error/pagination states.
- This gap is explicitly accepted as deferred browser evidence, not as a source or security waiver. The automated Playwright run could not start because the host launcher requires Azurite under the Manage profile; the full profile previously OOM-killed the backend, and no runtime workaround was used. The deferred states remain required before merge or activation when a healthy routed runtime is available.
- W1 is otherwise locally verified at `b30d8df0f`; the branch remains unpushed and unmerged. W2, deployment, live ingestion, graph generation, production actions, secret access/write, cluster writes, and cleanup remain out of scope.

### 2026-08-31 — W1 published as draft PR

- The W1 branch was pushed to `origin/rs/kb-resource-operations-w1` at `930aa455593d0388e9afeae61b72a6b496006ac9` and opened as draft PR `#5710` against `feat/kb-element-generation-followups`.
- The initial PR readback reports `MERGEABLE` and GitGuardian passing; the repository checks, gitleaks, trusted policy, and OpenCodeReview were pending at publication. Build-only jobs were skipped by the branch filters.
- The PR description carries the complete branch accounting, verification evidence, deferred browser states, and W2 follow-up. The branch remains draft; no merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, or cleanup action has occurred.

### 2026-08-31 — W1 publication and current CI readback

- The published branch now points to `ed676ad85c9a0695186610566b446d6157e13d79`, and PR [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710) targets `feat/kb-element-generation-followups` and reports `MERGEABLE`.
- A `ready_for_review` event at `2026-08-31T20:00:19Z` was recorded for the account `rschlaefli`; this task did not issue that transition. The PR is currently non-draft, while the plan's intended state remains draft until the deferred acceptance evidence is resolved.
- The current W1 check set is still running. The failed `test-mcp-lecturer-status` mirror belongs to run `33433254693`: its log shows the underlying `test-mcp-lecturer` job was cancelled and the mirror failed on `result: cancelled`. A replacement MCP run `33433638633` for the same head is in progress, so the earlier failure is a cancelled-predecessor artifact rather than source evidence.
- Current readback also shows GitGuardian, gitleaks, trusted policy, filters, Docker image builds, and the GraphQL status mirror passing; GraphQL, unit, MCP, repository check, initialization, and the manual final-review route remain pending or in progress. The deferred browser evidence and healthy routed runtime remain required before merge.
- W1 remains incomplete at the acceptance gate. W2, merge, deployment, live ingestion, graph generation, production actions, secret access/write, cluster writes, and cleanup remain out of scope.
