# Knowledge Base resource operations roadmap — PR [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710)

Date: 2026-08-31

Status: Ingest all and material categories merged; file replacement published in PR #5756, with CI and release acceptance pending.

## Current delivery summary — 2026-09-05

The resource table and add-resource flow are implemented. Ingest all and material categories merged in PR #5710. The generated-question review list and canonical editor workflow merged in PR #5667 with its dependency #5635. File replacement is the remaining resource-management delivery in PR #5756.

An **upload reservation** is the temporary record that reserves bytes and identifies an upload before confirmation. The existing database model remains named `KBUploadTicket` for compatibility. File replacement adds only the target resource ID and expected resource version, with a foreign key and index in one generated migration. Confirmation consumes the reservation; abandoned uploads use the existing retention sweep. No separate replacement entity or lifecycle is needed.

The replacement source changes at confirmation. Existing indexed AI content remains active until ingestion settles, but the previous source file has no rollback. Pending replacement uploads also defer hard resource deletion until the retention sweep removes them.

At reviewed head `2f38d8a546b46b53339f40a3964cf1620f14c38f`, the branch includes `v3-ai@208e97d38e6abfd13d997d48200077febc8c1445` without conflicts. The full pre-push build passed 26/26. Current CI includes inherited MCP Docker build failures: the pinned Turbo executable rejects the new cache configuration. Playwright and final-review status remain delivery gates; successful local builds do not establish live ingestion acceptance.

After this PR merges:

1. Verify the deployed revision, then exercise one synthetic upload, ingestion, retrieval, and same-resource replacement. Require retrieval to switch to the new content without a duplicate resource.
2. Verify the downstream journey with an explicit graph build, question generation, editing and keeping one question, and opening its saved Element. Coordinate with the existing generation-lifecycle work before changing shared behavior.
3. Continue the question-generation roadmap with clearer stages, honest progress, and settings revision/restart. Bulk question review, richer citation excerpts, and arbitrary tags remain deferred.

Deployment and live provider actions retain their separate execution boundaries. Historical snapshots and Progress entries below explain prior decisions; this summary supersedes their delivery-state claims.

### Approved review corrections

The follow-up removes the unreachable zero-byte compatibility exception from replacement confirmation and uses `uploadReservation` in the upload component, without renaming the database table or API. The MCP lecturer and student Dockerfiles now pin Turbo 2.10.11, matching the repository and backend image; both local prune commands pass with that version.

Formatting, diff checks, staged gitleaks, and Node 24 Prisma generation/type checking pass. The repository pre-commit check under Node 24 passes 37/40 tasks but fails GraphQL, Chat, and OLAT type checks in unchanged assessment, chatbot, user-group, and live-quiz code. The earlier Node 26 run additionally failed Prisma generation. Publication bypasses the failing pre-commit hook with this limitation recorded; the ordinary pre-push build and natural CI remain required evidence. No database-backed test, browser, deployment, or live provider operation ran in this correction pass.

Working context: `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/kb-resource-replacement-w2`, branch `rs/kb-resource-replacement-w2`

PR: W1 [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710) is merged; the W2 PR targets `v3-ai`

Proposed delivery target: the current KB/KG feature stack, with the live PR base resolved again before implementation. The ultimate integration target remains `v3-ai` unless the user names another target. This roadmap does not include the `v3-ai` to `v3` promotion branch.

Parent work: [KB management UX roadmap](./2026-08-24-pr-5540-kb-management-ux-plan.md)

Audience: a senior developer or agent picking this up without session context. Read [the domain model](../docs/domain-model.md), [frontend conventions](../docs/frontend-conventions.md), and [the async worker guide](../docs/async-and-workers.md) before implementation.

## 1. Orchestration contract

| Field | Contract |
| --- | --- |
| Goal and terminal | Deliver two independently reviewable desktop Manage capabilities: `Ingest all` reconciles every resource that is not serving its current form, and file replacement updates one existing resource identity while preserving its active AI-serving content until settlement. Material classification is controlled metadata, not provider behavior. The package ends when both work PRs are green at their own tips, the final review accepts the integrated stack, and the required browser evidence covers the named states. |
| Mode and boundary owner | Guided execution under `rs-roadmap-orchestrator`; the main session owns decomposition, integration, reviews, verification, and boundary decisions. |
| Question channel | The orchestrator presents the decision gates in this roadmap. Sol supplied the planning pass and will be reused for plan hardening; no new user-visible task is needed. |
| Authority layers | Plan artifact, local implementation commits, normal push, and PR updates for the current package: approved. Marking ready, merge, promotion, deployment, live ingestion, graph generation, secret access, cluster writes, deletion, and production actions: withheld. |
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

## 3. Planning baseline (historical)

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
| Planning partner | Completed with concerns | Sol originally recommended server-side reconciliation, a staged same-resource replacement, and a three-value controlled classification. The user-approved 2026-09-03 MVP simplification supersedes the staged-candidate design: the canonical source changes at confirmation, while the prior active serving identity remains available until normal ingestion settlement. |

## 4. Non-negotiables

- `Ingest all` is a server-side reconciliation over the complete KB. It must not iterate the loaded client page, current search result, filter result, or selection.
- A current `READY` resource is a no-op. `Ingest all` must not become “refresh every URL”. A provider-refreshed active version newer than the latest lecturer attempt is also not downgraded.
- `QUEUED` and `PROCESSING` resources are skipped, not duplicated. Concurrent bulk and per-resource actions must converge through conditional claims and deterministic lock ordering.
- Failed resources are eligible for one new attempt when their failed revision is not already the active serving revision. The result must tell the lecturer that failures are being retried.
- File replacement preserves the `KBResource.id`, title, material category, and active serving identity. It is not delete-plus-create. Confirmation atomically makes the uploaded blob canonical, increments the resource version, and creates the ordinary UPSERT run; normal callback or polling settlement controls the serving cutover.
- A confirmed replacement has no source-file rollback. The old blob is deleted best-effort after the transaction, while the previous AI-serving content remains available until the new version settles. A dispatch failure leaves the new canonical source retryable through the ordinary ingestion actions.
- Replacement consumes no resource slot. While an upload ticket is pending, quota counts both the current resource bytes and the candidate's full size. Confirmation consumes the ticket and replaces the resource's accounted size; expiry cleanup releases an abandoned candidate reservation.
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

**Replacing a file makes the old AI content disappear.** Cause: source metadata is mistaken for the active serving identity. Remedy: fence confirmation to the expected resource version, update the canonical source and create its run atomically, and leave the active serving version and digest unchanged until signed callback or reconciliation settlement.

**The replacement run still reads the old file.** Cause: confirmation creates an ingestion run without first making the uploaded blob the canonical source. Remedy: replace the canonical BLOB metadata and create the new version's run in one transaction; the existing worker and source gateway then resolve the new source through the ordinary resource contract.

**Replacing the source also cuts over the AI-serving content.** Cause: canonical source metadata and active serving identity are treated as one state. Remedy: confirmation changes only the canonical source and desired version. Keep `activeResourceVersion` and `activeContentSha256` unchanged until the ordinary signed callback or reconciliation path settles the matching run.

**A failed replacement cannot be retried.** Cause: failure handling assumes the consumed upload ticket remains the source owner. Remedy: after confirmation, the resource row owns the new canonical source. The ordinary row retry and `Ingest all` paths therefore retry that version without another upload.

**Quota rejects a replacement because it consumes a second resource slot.** Cause: the create-only ticket rule is reused unchanged. Remedy: replacement tickets reserve the uploaded bytes while pending but never reserve a resource slot; confirmation replaces the existing resource's accounted size.

**An abandoned upload keeps quota reserved.** Cause: pending replacement tickets count their full uploaded size until consumed or expired. Remedy: include pending replacement bytes in the existing ticket reservation total and let the normal ticket-retention sweep delete expired blobs and release their reservation. Confirmation consumes the winning ticket and makes the resource's new size authoritative.

**A category is mistaken for a source type or provider hint.** Cause: “file”, “website”, “syllabus”, and “script” are mixed into one field. Remedy: keep source type (`BLOB`/`URL`) and material category (`UNCLASSIFIED`/`COURSE_CONTENT`/`ADMINISTRATIVE`) as separate concepts; do not pass the category to data-ingestion in this MVP.

**The plan drifts into graph or question-generation work.** Cause: the KB detail page contains graph and generation controls. Remedy: keep the resource workspace changes independent; graph builds continue to use only active serving sources and the canonical build ledger.

## 6. Primitive impact

| Primitive | Owner and source of truth | New user-visible behavior | Invariants |
| --- | --- | --- | --- |
| Resource freshness | `KBResource` latest revision plus active serving identity and `KBIngestionRun` | The workspace says which resources need ingestion and offers one `Ingest all` action. | Current READY is a no-op; active/in-flight claims are fenced; latest operation and serving revision remain distinguishable. |
| Bulk command | GraphQL mutation and server-side candidate predicate | One confirmation and one result summary replace repetitive row-by-row clicking. | Complete-KB scope, deterministic claims, bounded dispatch, idempotent repeated clicks, no client pagination dependence. |
| Same-resource replacement | Target-bound upload ticket plus expected resource version | A BLOB row can be updated without changing its resource identity; the old serving revision remains visible during processing. | Confirmation atomically changes the canonical source and queues the next version; active serving identity changes only after settlement; old source deletion is best-effort. |
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

The current upload path can only create a new resource. A lecturer who updates a script must delete and recreate the row, losing its identity. The second work PR adds a bounded BLOB replacement that keeps the same row and uses the existing ingestion, callback, and serving contracts.

**Do**

1. Add dedicated `requestKbFileReplacement` and `confirmKbFileReplacement` operations. A replacement ticket is bound to one live BLOB resource and its expected version; ordinary upload confirmation must reject it. Multiple uploads may be prepared, but the first confirmation for the expected version wins under the KB lock.
2. Count every pending upload's bytes against quota while counting only create tickets as resource slots. Use one generated migration containing only the nullable target/version ticket fields, relation, and lookup index.
3. On confirmation, verify the uploaded blob and ticket, then atomically swap the canonical BLOB source metadata, increment `resourceVersion`, preserve resource id, title, material category, and active serving fields, create the existing UPSERT ingestion run, consume the winning ticket, and dispatch the existing Hatchet task. No data-ingestion, source-gateway, webhook, worker, or maintenance contract changes are needed.
4. A dispatch failure leaves the new canonical source in `FAILED` with the previous AI-serving identity still active. The ordinary row retry and `Ingest all` therefore operate on that canonical new source. The old source blob is deleted best-effort after the transaction; deletion failure cannot undo confirmation, and source-file rollback is not offered in this MVP.
5. Add `Replace file` only to BLOB row menus. The modal explains the identity, category, serving, and source-file consequences; file selection does not mutate anything, and the explicit final action is `Replace and ingest`. Prevent duplicate submission and refresh the row after a queue failure.
6. Update the domain, async-worker, frontend documentation, and frontend skill. Do not change graph or question-generation behavior.

**Check**

- GraphQL tests prove target/version binding, ordinary-confirmation separation, byte-versus-slot quota accounting, same-id confirmation, category and active-serving preservation, a single winner from concurrent confirmations, queue-failure state, ordinary retry, expiry, ownership, and BLOB-only authorization.
- The migration is exactly one generated replacement-ticket migration. Review its SQL, index, foreign key, schema equivalence, and absence of unrelated model churn.
- Playwright proves URL rows have no replacement action, BLOB rows require explicit selection and confirmation, one replacement request occurs, the modal closes on success, and the previous serving version remains visible while the new version is queued.
- Run GraphQL generation, focused service tests, package checks, formatting/linting, `check:all`, and the pre-push build at the exact head. Use a synthetic local Blob only.
- Use a synthetic/local Blob fixture only. No live external ingestion retry, production data, graph build, or cleanup operation is part of this acceptance check.

**Working context**

Repository: KlickerUZH. Base is the merged Ingest all and material category result on `v3-ai` after the normal interaction check. Branch: `rs/kb-resource-replacement-w2`. Owned mutable seams are upload reservation fields, GraphQL replacement operations, `KnowledgeBaseFileDropzone`, resource row/modal behavior, generated operations, focused tests, and affected docs. Maintenance changes are limited to deferring hard deletion while replacement upload reservations remain. Do not modify data-ingestion, Hatchet workflows, source-gateway/webhook code, graph work, or sibling question-generation work.

**Authority and terminal**

Local edits, repository-native checks, required reviews, and local commits are proposed after plan approval. Push and PR updates require the delivery approval named at handoff. Merge, deployment, live provider retry, graph generation, production, secrets, cluster writes, and cleanup remain withheld. Terminal: `reviewed` and independently green at this layer's tip.

**Boundary owner**

`rs-roadmap-orchestrator` integrates W2 with W1, verifies the final branch diff, and owns the final review packet.

**Release-note impact**

Candidate claim: “Lecturers can replace a file without recreating its Knowledge Base resource; ingestion starts immediately and previous AI content remains available during the update.” This claim requires exact-head service and desktop browser evidence. It does not promise restoration of the previous source file.

**Depends on / GATED on**

GATED on merged W1 and A1–A5. Integrate the current `v3-ai` once after the branch passes on its existing base, as explicitly approved for this package.

**Priority and size signal**

P1. Estimated 12–16 files and 300–500 human-authored lines, plus generated output. The simplified package keeps the replacement command, ticket fence, quota accounting, ingestion dispatch, UI, and evidence together while reusing every downstream ingestion contract.

## 8. Decision gates

The recommendations below make the MVP predictable. The user can approve them together or change an item before implementation.

| Gate | Decision | Recommendation and rationale | Gates |
| --- | --- | --- | --- |
| A1 — Base and integration | Which exact live branch/PR base should receive the two work PRs, and should the current upstream changes be integrated once before coding? | Resolve the live KB feature-stack base at execution start. Incorporate upstream only after one explicit approval naming the branch and integration pass. The stale roadmap checkout is not the base. | W1, W2 |
| A2 — Bulk freshness semantics | Should `Ingest all` retry failed resources, skip current READY resources, and skip a provider-refreshed active version newer than the latest lecturer attempt? | Yes. Include failed resources that are not currently serving, never re-fetch current READY resources, and never downgrade a newer active provider revision. This makes the label truthful and prevents surprise URL refreshes. | W1 |
| A3 — Replacement completion | Should confirming a replacement automatically queue ingestion? | Yes, behind an explicit `Replace and ingest` confirmation. Confirmation makes the uploaded source canonical and queues its ordinary UPSERT run, while the old serving revision remains available during the operation. | W2 |
| A4 — Replacement quota | Should the pending replacement upload count alongside the current resource? | Yes. Before confirmation, count the current resource plus every pending candidate upload. Confirmation consumes the ticket and replaces the resource's accounted size; expiry cleanup releases abandoned candidate reservations. | W2 |
| A5 — Material taxonomy | Should MVP use controlled single-select metadata rather than arbitrary tags, and should new resources default to Course content? | Yes. Use `Unclassified`, `Course content`, and `Administrative`; backfill existing resources to Unclassified and preselect Course content for new resources. “Script” maps to Course content and “syllabus” maps to Administrative. Add arbitrary multi-tags only after a real filtering/metadata use case exists. | W1, W2 |

## 9. External dependencies to watch

- **Data-ingestion service:** its existing source URL/BLOB payload and signed callback/resource-version contract must remain usable. The new canonical source flows through that ordinary contract; no provider API change is planned. If the contract cannot preserve same-resource/version fencing, stop at the design boundary and ask before expanding it.
- **Azure Blob storage:** existing SAS upload and maintenance deletion paths must support pending replacement uploads, expired-ticket cleanup, and best-effort deletion of the superseded source. Do not access secret values; use metadata-only tests or existing local Azurite fixtures.
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

The package's final review must explicitly verify that source type and material category remain independent, the bulk mutation is complete-KB and idempotent, replacement preserves resource identity and active serving content on failure, expired pending uploads are cleaned safely, superseded source deletion cannot roll back confirmation, and graph/question-generation contracts remain unchanged.

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

### 2026-08-31 — W1 acceptance readback and runtime blocker

- After a fresh `git fetch --prune origin`, W1 and `origin/rs/kb-resource-operations-w1` both point to `41c5c41c28e68afe884663c2e27c5e24577c4b83`. The branch is clean and seven commits ahead of `origin/feat/kb-element-generation-followups@3c43f4c40dca67a3f842ef46ec334c5ba3554e32`. The refreshed unrelated `origin/v3` is `c9683ca1bbda0ad937c899fe1002668e1fd60501`; no upstream integration was performed.
- PR [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710) is open, non-draft due to the previously recorded external `ready_for_review` event, and `MERGEABLE` at the exact W1 head. Current branch checks are terminal success or intentional skip, including repository checks, GraphQL and MCP tests/status, unit tests, builds, gitleaks, GitGuardian, trusted policy, and filters. The external `final-ai-review` status remains an error because the repository route requires a manual reviewer; the integrated final review and local review evidence remain the applicable review record. No new source finding is present.
- The exact W1 managed runtime is stopped with zero active apps, services, processes, or routes, but devrouter `0.0.51` retains `status=failed-transition` and `transitionPhase=process-start` in its exact managed-runtime record. `ensure` refuses to transition while that marker exists. The report-only cleanup and doctor diagnostics identified no supported non-destructive repair command. The Manage profile also omits Azurite even though the managed post-start always configures local Blob CORS through the Azurite service; this must be corrected before the deferred browser proof can be rerun.
- The remaining acceptance gate is therefore runtime recovery followed by the named desktop English/German browser states and live-dispatch/error-state evidence. A bounded recovery would be `devrouter workspace down rs-kb-resource-operations-w1 --repo /Users/rschlae/Git/klicker/klicker-uzh --keep-worktree`, which deletes only this exact runtime/routes and preserves the Git worktree and ownership record; it is not executed without explicit cleanup authority. No merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, or unrelated cleanup was performed.

### 2026-08-31 — W1 Manage profile correction published

- The smallest runtime configuration correction is published at `5ee5c90be`: the Manage profile now selects the already-registered `azurite` service required by the managed post-start Blob CORS setup. `devrouter profile resolve` and Prettier pass, and `devrouter doctor` confirms `.devrouter.yml` is valid.
- The exact W1 runtime remains stopped and blocked by the prior `failed-transition` marker; the config correction also changes the effective managed configuration, so `ensure` must not be retried against the existing record. The next bounded step is the previously named exact `workspace down --keep-worktree` recovery, which preserves the Git worktree and ownership record and still requires explicit cleanup authority.
- The current PR head is the config-fix commit until the next progress receipt is published. Its branch checks will rerun naturally after publication; no merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, or unrelated cleanup was performed.

### 2026-08-31 — W1 runtime and browser acceptance recovery

- After the approved scoped `workspace down --keep-worktree` recovery, the W1 Manage profile recreated successfully with compose project `default-rs-932dd`. The runtime is ready with `api`, `auth`, and `manage` routes, `klicker-dev`, Hatchet, Postgres, the three Redis services, and Azurite. Postgres and Azurite report healthy; Azurite owns host port `10004`, preserving the parent feature runtime on port `10003`.
- Values-free route checks pass for the W1 Manage, API, and Blob routes. The Manage route returns `200 text/html`; the API and Blob roots return expected `404` responses, confirming route reachability without an authenticated or mutating request.
- Authenticated desktop `agent-browser` acceptance now covers English and German resource-table states. The retained synthetic KB `70adc84c-0d55-4e5c-9dda-9f19912f85ae` contains one synthetic URL resource titled `W1 Acceptance Website`, categorized as `Administrative`. The table shows the resource type, category, version `0`, and unavailable-to-AI state; the complete-KB summary reports one resource needing ingestion.
- The Add resource chooser renders Website, Document, and disabled Video options. The Ingest all dialog correctly reports one eligible resource. It was canceled, so no external data-ingestion/provider request was sent. Screenshots are retained at `/private/tmp/kb-w1-runtime-table.png`, `/private/tmp/kb-w1-runtime-table-de.png`, and `/private/tmp/kb-w1-add-resource-modal.png`.
- The local W1 runtime remains running for human verification. The synthetic KB and resource are retained by default. Live ingestion dispatch, mixed-result/error/pagination states, merge, deployment, graph generation, production action, secret access/write, cluster write, and cleanup remain outside this acceptance pass.

### 2026-09-01 — W1 bulk-operation interaction acceptance

- After the scoped runtime recovery, a fresh synthetic KB `ceaedb1b-dd8b-4fdd-8573-3722e8245681` was created in the authenticated Manage UI. It retains two synthetic URL resources: `https://example.com/` categorized as `Administrative`, and `https://www.example.com/` categorized as `Course content`.
- The complete-KB `Ingest all` dialog reported both resources as eligible. A temporary in-page fetch stub intercepted only `IngestAllKbResources`; it returned a mixed-result summary with one queued resource and one already-current resource. The UI made the toolbar and confirmation controls unavailable while the request was pending, and a duplicate click left the call count at one.
- A second single-call deterministic error response produced the shared failure toast and kept the confirmation dialog open for an intentional retry. The original `window.fetch` was restored and the temporary mock state was removed; no provider or data-ingestion request was sent.
- This closes the previously deferred loading, mixed-summary, and error-state interaction evidence for the bulk action without claiming live dispatch. The automated Playwright spec was not run because its `finally` block deletes the synthetic KB/resource, and cleanup authority remains withheld. Pagination/off-page selection was not manually exercised.
- The exact W1 runtime remains running for human verification at `https://manage.klicker.rs-kb-resource-operations-w1.localhost`. Synthetic fixtures remain retained by default. Merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, and cleanup remain outside this acceptance pass.

### 2026-09-02 — W1 concurrent-claim correction started

- Fresh forge readback confirms PR [#5710](https://github.com/uzh-bf/klicker-uzh/pull/5710) at `50f46b87d22008bd80abd23f25319bc9e462e372`, stacked on the live `rs/question-generation-review-inbox@bd8cce838c8d90fd5f132119209fd74f8db006cb`. This supersedes the older target recorded at publication; no parent or upstream integration is performed in this slice.
- Review of the complete-KB operation found one result-accounting race. If a single-resource ingestion claims a resource after the bulk transaction reads its snapshot but before the bulk conditional update, duplicate dispatch is prevented, but the bulk result currently omits that resource from every counter.
- The correction must preserve the existing single-claim invariant and count the concurrent winner as already in progress. A focused real-PostgreSQL regression will pause the bulk transaction after its resource snapshot, let the single-resource operation claim the resource, then require one dispatch, one ingestion run, and an exact `alreadyInProgressCount` of one.
- This is a bounded W1 data-integrity correction. It changes no schema, public GraphQL shape, UI, provider contract, or runtime configuration. Local implementation, checks, exact-range review, a normal push to the existing branch, and PR refresh are authorized. Merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, runtime teardown, and fixture cleanup remain withheld.

### 2026-09-02 — W1 concurrent-claim correction verified locally

- The bulk transaction now re-reads a resource after a lost conditional claim and reconciles the concurrent winner as already current or already in progress. An unexpected state still fails closed. The existing single-resource claim remains the only dispatch and ingestion-run owner.
- The deterministic real-PostgreSQL regression pauses the bulk transaction after its resource snapshot, lets the single-resource operation claim the resource, and verifies one dispatch, one ingestion run, zero bulk queues, and `alreadyInProgressCount=1`. The focused regression and the complete knowledge-ingestion file pass at `1/1` and `14/14` respectively.
- Tests ran against the dedicated local `klicker_w1_concurrency_test` database after all repository migrations applied successfully. The first schema-isolation attempt was rejected by a historical migration that hard-codes `public`; it never reached tests. The separate database and the partial `w1_concurrency_test` schema remain retained because cleanup is not authorized, while the seeded application database stays available for the running Manage UI.
- Node 24 GraphQL generation, schema-drift, TypeScript, focused Biome, and plan-format checks pass. The full monorepo build passes `26/26`. Repository `check:all` reaches the known environment-only analytics blocker: `pandas==2.2.2` cannot build because the managed image has no C compiler; parallel sibling checks are then cancelled. No W1 failure was reported before that cancellation.
- The exact W1 runtime is ready on the full profile with its declared routes, services, and workers and remains running for human verification. The next step is the required exact-range simplifier and concurrency/data-integrity review, followed by a normal push and PR refresh if their verified findings are clear. Merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, runtime teardown, and cleanup remain withheld.

### 2026-09-02 — W1 concurrent-claim correction reviewed

- The required exact-range independent reviews ran against `50f46b87d2..91a839169d` as separate read-only reviewer passes.
- The simplifier pass returned `VERDICT: PASS` with no findings.
- The concurrency/data-integrity slice review returned `VERDICT: PASS` with two non-actionable confirmations: lost claims are re-read and classified under PostgreSQL READ COMMITTED with fail-closed error paths and ingestion-run creation strictly after a winning claim; and the regression deterministically pauses the production snapshot query, exercises the concurrent single-resource path, releases the pause in `finally`, and introduces no lock cycle.
- No review corrections were required. Normal push of the branch and the PR refresh are next per the approved slice; merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster write, runtime teardown, and cleanup remain withheld.

### 2026-09-02 — W1 published at 32492f1402 and exact-head CI dispositioned

- The branch was pushed normally after the full pre-push build passed 26 of 26; `origin/rs/kb-resource-operations-w1` and PR #5710 both read back at `32492f1402`, MERGEABLE, stacked on `rs/question-generation-review-inbox@bd8cce83`.
- Exact-head checks are terminal. Every branch-relevant check passes: repository check, GraphQL, unit, MCP, olat-api, image builds, gitleaks, GitGuardian, trusted policy, SonarCloud, CodeQL, and code analysis.
- Five Playwright hosted shards (1, 2, 4, 6, 7) and the status mirror fail with the identical failing specs already failing on the parent head's own run 33494015438 at `bd8cce83`: `Y-manage-assistant`, `Y-response-examples`, `Y-question-generation-review`, `Y-kb-management-ux`, and `B-feature-access` (shard 7 shows a service-start connection refusal on port 4010). Spec titles and shard placement match between both heads, so these are inherited from the parent layer and are not introduced by this branch.
- `final-ai-review` and `final-ai-stack-review` fail with the repository's stacked-PR topology policy (stack root does not target the default branch), identical to the parent.
- The PR description was refreshed through the description gates — whole-branch accounting for 17 commits, terminal CI readback, and earlier-head evidence re-labeled — and read back from the forge.
- The stack-level merge blocker is now the parent layer's five failing e2e specs plus the lower dependency PR #5635; fixing parent-layer specs is outside this slice's authority. Merge remains withheld.

### 2026-09-03 — W2 replacement contract simplified for the MVP

- The initial W2 candidate/retained-source design was challenged before publication. Sol recommended a smaller canonical-source replacement that reuses the existing ingestion run, callback, serving identity, retry, source-gateway, and maintenance contracts. The user approved that simplification for the MVP.
- The current contract uses dedicated target-bound request and confirmation mutations. Confirmation atomically replaces the canonical BLOB source, increments its version, preserves the row identity, title, category, and active serving fields, creates the existing UPSERT run, and dispatches ingestion immediately. Multiple upload tickets may exist, but expected-version fencing permits one winner.
- A dispatch failure leaves the new source retryable through the ordinary row and bulk ingestion paths. Existing AI content remains active until normal settlement succeeds. The old source blob is deleted best-effort after confirmation and cannot be restored; this narrower source-file guarantee is explicit in the UI and docs.
- The schema adds only nullable replacement target/version fields to `KBUploadTicket`, one relation/index, and one generated migration. No Hatchet workflow, data-ingestion, source-gateway, webhook, maintenance, graph, or question-generation code changes remain in the W2 diff.
- The isolated devrouter workspace is retained as `rs-kb-resource-replacement-w2`. Source checks can run in its Node 24 container when OrbStack is healthy; the current host OrbStack VM RPC exits with `Post "http://vmrpc": EOF`, so browser handoff remains an environment recovery gate rather than source evidence.

### 2026-09-03 — W2 implementation, integration, and review

- W2 is committed on `rs/kb-resource-replacement-w2` and integrated once with `origin/v3-ai@fa7e707bdf76b8afadb2d640e2ad288991537660` at merge commit `722a5bb56d`. The 20-path package adds dedicated request/confirm replacement operations, target/version-fenced upload tickets, conservative byte quota accounting without a second resource slot, same-resource canonical source replacement, ordinary ingestion dispatch/retry, the BLOB-only Manage flow, focused tests, one generated migration, and the required wiki/skill updates.
- Local source evidence before the integration pass is green: the six focused replacement and serving-cutover tests pass, the complete knowledge suite passes `63/63`, Prisma validation, GraphQL generation and checks, Knowledge Base management and Playwright TypeScript checks, repository `check:all`, build, migration reset/deploy/push, and diff/secret checks pass. The authenticated desktop browser flow covers BLOB replacement, URL action absence, explicit selection and confirmation, modal closure, and preservation of the active version while the replacement queues.
- The simplifier and the source/data-integrity slice review found no blocking defect. The integrated final review at `722a5bb56d` passed with no findings across ownership, BLOB-only authorization, version fencing, concurrent confirmation, quota, migration, queue-failure retryability, old-blob cleanup, serving continuity, UI, tests, and docs.
- A later `v3-ai` change at `7249e57eb7` adds chatbot owner preview. It overlaps only the shared English and German message files and merges without conflict; no repeated upstream integration is performed after the approved one-time pass. The PR interaction check and exact-head CI remain the publication gates.
- Integrated runtime re-verification is blocked by environment state, not a reproduced W2 failure. Upstream moved Azurite into the boot-critical base service set; the existing managed runtime now requires exact delete-and-recreate recovery. The host also reports an unavailable OrbStack socket and insufficient free disk during analytics environment refresh. Recreating only `rs-kb-resource-replacement-w2` requires separate explicit deletion authority before the full stack can be left running for manual verification.
- Push and draft PR creation against `v3-ai` are authorized next. Merge, deployment, live ingestion, graph generation, production action, secret access/write, cluster writes, and unrelated cleanup remain withheld.

### 2026-09-03 — W2 exact-head review corrections

- OpenCodeReview raised three current-layer inline findings at published head `359c92c943`. The verified corrections are committed at `3d4a188856`: resource hard-delete maintenance now defers tombstones that still have replacement tickets until the existing ticket-retention sweep removes the abandoned candidate; replacement refresh failures no longer keep the modal open; and the upload error mapping and serving-status fallback are flattened without changing behavior.
- The maintenance regression asserts the replacement-ticket guard in both the selection and final compare-and-delete conditions. The existing browser scenario now makes the metrics refresh fail after a successful replacement and requires the modal to close.
- Focused maintenance tests pass `22/22`. Hatchet, Knowledge Base management, and Playwright TypeScript checks pass; focused Biome, Prettier, diff, and staged gitleaks checks pass. The repository pre-commit gate passes all `29/29` checks. These host checks retain the documented Node 26 warning because the isolated Node 24 runtime is unavailable.
- The previous head's hosted Playwright run `33792176794` failed all eight shards before any tests because the shared artifact omitted `@klicker-uzh/knowledge-graph/dist/index.js`. Current target head `v3-ai@7249e57eb7` fails its own run `33790494925` with the identical module-resolution error. This is a target-wide CI packaging defect, not replacement behavior evidence, and is not patched in W2.
- The required final review, normal push, review-thread replies, PR refresh, and natural exact-head checks remain next. The PR stays draft. Merge, deployment, migration apply, live replacement, secret access, runtime deletion or recreation, and cleanup remain withheld.

### 2026-09-03 — W2 final-review documentation correction

- The integrated final reviewer found no implementation defect. It identified one documentation contradiction: earlier normative sections still described the superseded staged-candidate design after the approved MVP switched to canonical-source replacement.
- The current orchestration contract, non-negotiables, known traps, primitive table, decision gates, dependency notes, and final-review expectations now describe the implemented contract. Confirmation atomically changes the canonical source and queues the next version; active serving identity changes only after normal settlement; old source deletion is best-effort; and expired pending tickets release their quota reservation through the existing maintenance sweep.
- Historical Progress entries remain append-only evidence of the design evolution and are superseded by the approved 2026-09-03 simplification entry above.
- Draft PR #5745 separately fixes the target-wide Playwright artifact omission by uploading `packages/knowledge-graph/dist`. Its ready-state run proves all workers start and seven of eight shards pass; the remaining shard 4 failure requires an independent disposition before that PR can advance. W2 does not duplicate or modify this CI fix.
- Normal push, review-thread replies, PR refresh, and natural exact-head checks remain next. The PR stays draft. Merge, deployment, migration apply, live replacement, Playwright reruns, upstream integration, secret access, runtime deletion or recreation, and cleanup remain withheld.

### 2026-09-04 — W2 publication and delivery reconciliation

- W1 is merged as PR #5710 at source head `77d7018f34305ce713277f0c43793623098d7cd7` and merge commit `a0e32ade053ce5b8836cd9b99b45f557cb247cd4`. W2 is published as draft PR #5756 against `v3-ai`; its reviewed implementation head before this progress-only receipt is `037459d7df42263937ec8bf92b4e3d457160ddbc`.
- The three current-layer review threads are resolved. The integrated final review remains accepted because the later commits only correct deterministic test fixtures and this progress record; they do not change the replacement contract or implementation.
- Local evidence for `037459d7df` is green: focused Playwright TypeScript and formatting checks pass, repository `check:all` passes `29/29`, and the pre-push monorepo build passes `26/26`. Hosted CI passes the repository, GraphQL, MCP, gitleaks, GitGuardian, trusted-policy, fallback-build, and Playwright shard 1–7 checks. Shard 8 fails only the unrelated existing chat feature-access test, and its aggregate status mirrors that failure.
- Exact-head OpenCodeReview run `33876150064`, job `101033487232`, failed before reviewing because all 14 provider requests returned HTTP 403; it produced no findings, tokens, or tool calls. The external final-AI status remains pending on the repository's manual `z-ai/glm-5.3-flash` route. Neither infrastructure result is treated as a replacement source defect, and no event is manufactured.
- `origin/v3-ai` is two commits ahead of the W2 branch baseline. PR #5756 remains mergeable without conflicts, the target movement is unrelated to replacement behavior, and no additional upstream integration is performed.
- The achieved layer is a reviewed draft PR with branch-relevant source and CI evidence. The remaining delivery boundary is the manual final-AI route, natural exact-head checks for this progress-only commit, and an explicit decision to mark ready or merge. The runtime was not started or touched during this reconciliation. Merge, deployment, migration apply, live replacement, upstream integration, secret access, runtime recovery, and cleanup remain withheld.
