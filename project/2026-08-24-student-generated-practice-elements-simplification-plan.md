# Student-generated practice elements: simplification and Chat extraction plan

## Decision and status

Approved for autonomous execution on 2026-08-24 after a full-stack review with
Sol. This plan reduces the implementation topology of the existing student
generation package. It does not change the approved student-facing promises:

- a student can retrieve course material and approve a card plan before
  generation;
- generated cards are grounded per card and expose citations;
- each candidate card has an individual Save or Discard action;
- Discard survives reload and is scoped to the participant and course;
- saved cards remain participant-owned personal elements and use the existing
  practice-session interaction contract;
- no ingestion or `mcp-doc-query` deployment change is part of this package.

The earlier implementation plan remains the product-contract record. This
document is the execution plan for simplifying its storage and business logic,
extracting the card-generation workflow from the Chat route, and reducing
terminology and test duplication. It supersedes the earlier plan only where
that plan assigns card-generation orchestration to the route or describes
approval/disposition state as domain content.

## Evidence and problem statement

The plan was drafted at local head `52f0c165f810da38a5e2edf96d4136adf929246b`
and was reconciled non-destructively onto `origin/v3` at
`d75d5aef6e4689c779a819f0c96c530ae3969424`. The remote readback and local
tracking ref both identify the current `origin/v3` target as
`ae9bc7ea526b32cdc964057c00f1b1e8e7d045ee`; the freshness gate is green with
zero commits behind that target. The plan’s later documentation commit is a
descendant of the reconciliation commit, so the durable plan does not freeze
an ahead count that would invalidate itself on every local commit. The
post-rebase scans still report 2,552 route lines versus 1,744 lines at the
base, with 823 additions and 15 deletions, and no application consumer of the
public GraphQL create/update operations beyond their service, resolver, and
tests. The earlier plan set a review threshold of roughly 400 added route
lines, so the current boundary has failed its own maintainability check.

The current schema adds `PersonalElement`, `ChatGenerationApproval`, and
`ChatGenerationCandidateDisposition`, plus lifecycle enums. Only three durable
facts are needed:

1. the saved personal element;
2. a persistent negative decision that a candidate was discarded; and
3. a short-lived lease that prevents concurrent generation of one approved
   plan and records successful completion.

The current code calls the stable server-issued `candidateId` the identity in
retry logic, but database uniqueness still includes source message and tool
call IDs. That mismatch creates cross-attempt lookup and supersession logic.
The single-value Discard status enum and the `actor` service wrapper add
terminology without adding behavior. Public GraphQL create/update mutations
duplicate the Chat save boundary and have no application consumer.

The current Chat route also owns history projection, plan parsing, tool
assembly, retrieval policy, duplicate checks, lease handling, and stream
settlement. The separate personal-elements route repeats candidate validation
and decision checks. The result is difficult to reason about and difficult to
extend to another element type.

## Target architecture

### Durable storage

Keep `PersonalElement` as the participant-owned content table. It continues to
hold the Flashcard content shape, bounded source metadata, scheduling state,
versioning, origin, and verification because the PWA and response mutation
currently use those fields. Remove the unused `options` column in this
refactor; do not remove scheduling or visible provenance fields without a
separate product decision.

Make the server-issued candidate ID the retry identity:

- `PersonalElement` uniqueness becomes participant + course + candidate ID;
- message and tool-call IDs remain saved-card provenance, not identity;
- the discard record is unique by participant + course + candidate ID;
- the save and discard service checks the candidate ID before any write and
  keeps the serializable save/discard race protection.

Replace `ChatGenerationCandidateDisposition` with a plainly named
`PersonalElementDiscard` model. It has no status enum because every row means
one thing: the participant discarded that candidate. It stores `participantId`,
`courseId`, and `candidateId`; it does not store chatbot, message, or tool-call
identity and does not persist candidate content or retrieved text. The HTTP and
Chat boundaries still authenticate the chatbot and resolve its course before
calling the service. Course-local identity matches the existing save lookup and
prevents a chatbot-specific read from disagreeing with the durable discard.

Replace `ChatGenerationApproval` with a minimal `CardGenerationLease` model.
The row stores `participantId`, the plan message and tool-call identity, the
current assistant attempt token, a lease expiry, and a completion timestamp.
The plan message relation proves the thread and chatbot, so those duplicate
foreign keys are not copied into the lease. An unexpired lease blocks
concurrent generation; an expired lease can be reclaimed; a completed lease
blocks replay. Aborted attempts release the lease. This is operational
coordination, not a user-facing approval domain object.

The lease contract is explicit and must be implemented with compare-and-swap
updates, not read-then-write logic:

- Claim inserts the unique `(participantId, planMessageId, planToolCallId)` row.
  If it already exists, a completed row rejects replay, an unexpired row
  rejects the claim, and an expired row is reclaimed only by an update whose
  predicate still says `completedAt IS NULL` and `leaseExpiresAt <= now`.
  A competing insert or update maps to the existing-generation conflict.
- Complete updates the row only when `completedAt IS NULL` and the attempt
  token matches. A zero-row update means that ownership was lost; the caller
  must not report a successful generated message.
- Abort, stream failure, partial terminal failure, and client disconnect may
  expire or release the lease only when the attempt token still matches. A
  stale owner must never clear a newer claimant.
- A completed row remains terminal. An expired, incomplete row is retryable.

Add database-backed concurrent claim/reclaim tests and retain the existing
save/discard race test. Mock-only approval tests are not sufficient evidence
for this contract.

Do not replace these rows with in-memory state: two approval requests can race
before either assistant message is persisted. The lease is the smallest
durable boundary that preserves the current replay and concurrency contract.

### Service and API boundary

Keep one server-safe personal-element service as the owner of authorization,
course participation, caps, candidate validation, save/discard idempotency,
spacing updates, and version conflicts. Replace the `PersonalElementActor`
wrapper with a participant-scoped context containing `participantId` and the
Prisma client. GraphQL and Chat remain responsible for their own authentication
boundary; the service remains defensive about participant ownership.

Remove public GraphQL create/update mutations and the public candidate input.
The Chat API is the only creation transport. Keep the server service functions
needed by Chat, and keep the PWA query, response, and delete operations. This
removes a second write boundary without removing the server-side saved-card
edit path.

### Chat module boundary

Create a server-only card-generation module under
`apps/chat/src/lib/server/personalElements/`:

- `cardGeneration.ts` owns eligibility, retrieval gating, plan validation,
  tool assembly, system-prompt additions, step policy, and stream settlement;
- `history.ts` owns active-branch projection, persisted tool-result parsing,
  and unsaved candidate extraction;
- `lease.ts` owns claim, completion, expiry, and abort behavior;
- `cardDecisions.ts` owns the shared Save/Discard validation used by the
  personal-elements API route.

The existing `tools.ts` becomes a focused implementation of the plan and
per-card generation tools. The Chat route keeps generic authentication,
model selection, image handling, credit accounting, stream construction, and
message persistence. It receives card tools and stream policy from the module;
it does not inspect card candidates, plan lineage, or lease rows.

The route-specific feature diff should fall below the existing 400-line
threshold after extraction. The personal-elements API route should become an
HTTP adapter that authenticates, parses the request, calls `cardDecisions`,
and serializes the result.

The generic retrieval policy in
`apps/chat/src/lib/server/retrievalPolicy.ts` remains shared Chat infrastructure.
Only card-specific retrieval eligibility and source qualification move into the
personal-elements module. The extraction may also update
`apps/chat/src/lib/personalElements/failure.ts` for removed card tools and
`apps/chat/src/lib/sources/normalizeSources.ts` for generated-card source
qualification; neither file becomes a second orchestration layer.

### Terminology and future types

Use the repository vocabulary in `CONTEXT.md`:

- `PersonalElement` means saved participant-owned content;
- `Candidate element` remains the internal domain name for an unsaved result;
- `Card plan` means the approved list of proposed cards;
- UI copy may say “card” or “proposed card”;
- `CardGenerationLease` and `PersonalElementDiscard` replace the opaque
  “approval” and “disposition” infrastructure terms;
- remove “actor” and “supersession” from the public service and UI vocabulary;
- do not call candidates “drafts”; the repository glossary reserves that word
  for publication and editing states.

Keep one stable generalization seam: a `type` discriminator on plan entries,
generated candidates, and saved elements. Implement `FLASHCARD` only. A later
question type may add its own validated payload and renderer without requiring
a generic registry, strategy hierarchy, or new persistence framework now.

Defer unsaved `revise_cards`, `candidateSupersession`, and their lineage UI
from this package. Saved-card editing may remain as a deterministic,
version-checked service operation because it does not require candidate
lineage.

## Delegation Map

| Slice | Execution owner | Route | Depends on | Commit boundary | Acceptance |
| --- | --- | --- | --- | --- | --- |
| S1 — simplify persistence and service | native `executor` | Prisma, GraphQL service/schema/mutations, analytics mirror | Freshness gate and this approved plan | `refactor(practice): simplify personal card persistence` | Reduced schema, migration, analytics mirror, service context, stable candidate identity, course-local persistent discard, and server-only write boundary compile and pass focused GraphQL tests. |
| S2 — extract Chat generation | native `executor` | `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`, server personal-elements module, card-specific retrieval/source helpers | S1 | `refactor(chat): extract personal card generation` | Card-generation module owns all feature workflow; route contains only generic Chat wiring; plan approval, retrieval gating, per-card citations, lease settlement, partial retry, and credit accounting retain behavior. |
| S3 — simplify candidate UI and decisions | native `executor` | `apps/chat/src/components/personal-elements/`, `apps/chat/src/app/api/chatbots/[chatbotId]/personal-elements/route.ts`, and tests | S1 and S2 | `refactor(chat): simplify personal card decisions` | Save/Discard API uses the shared decision service; no candidate-revision lineage or unsaved-revision UI remains; cards, sources, progress, and accepted-plan state remain intact. |
| S4 — integrate contracts and verification | `main` | Generated GraphQL artifacts, ADR/wiki, cross-slice tests, browser proof | S1–S3 | Integration/docs commit after generated artifacts and final verification | GraphQL, Prisma, analytics, generated operations, docs, tests, and browser proof agree on the reduced vocabulary and behavior. |

File ownership is exclusive. S1 owns
`packages/prisma/src/prisma/schema/personalElement.prisma`, its related Prisma
relations and migrations, the analytics mirror, and
`packages/graphql/src/services/personalElements.ts` plus
`packages/graphql/src/schema/personalElement.ts`, the
personal-element mutation definitions, GraphQL tests, and removal of the
obsolete source operations
`packages/graphql/src/graphql/ops/MCreatePersonalElements.graphql` and
`MUpdatePersonalElement.graphql`. S1 must not delete the PWA query, response,
delete, or saved-card revision operations.

S2 owns
`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` and
`apps/chat/src/lib/server/personalElements/`, plus card-specific edits in
`apps/chat/src/lib/personalElements/failure.ts`,
`apps/chat/src/lib/server/retrievalPolicy.ts`, and
`apps/chat/src/lib/sources/normalizeSources.ts`. Generic retrieval behavior
stays outside the module. S2 must preserve newer-plan replacement detection;
only candidate-revision lineage is removed.

S3 owns `apps/chat/src/components/personal-elements/`,
`apps/chat/src/app/api/chatbots/[chatbotId]/personal-elements/route.ts`, and
their tests. S4/Main owns generated GraphQL artifacts after
the final schema (`packages/graphql/src/ops.schema.json`, `ops.ts`, and
`public/*`), ADR/wiki updates, cross-slice tests, browser proof, final checks,
and review. Executors must not revert another slice; they must report a
conflict if the shared branch changes underneath them.

The removed public GraphQL create/update mutations and their generated
operations are an intentional compatibility change on this unreleased branch.
Keep the server exports used by Chat and the personal-elements route, and keep
the newer-card-plan replacement regression test while removing only unsaved
candidate revision lineage.

## Acceptance and verification

### Data integrity

- A participant can save a candidate once; repeated Save is idempotent.
- A discarded candidate remains discarded after reload and across a new
  generation attempt with the same stable candidate ID.
- Save and Discard for the same candidate cannot both succeed.
- Participant and course ownership, the 500-card cap, source bounds, and
  substantive explanation validation remain enforced by the service.
- A concurrent approval cannot generate the same plan twice; an expired lease
  can be retried; a completed lease rejects replay.
- No retrieved chunk text or participant-controlled IDs become model prompt
  context outside the existing bounded title-list behavior.

### Chat behavior

- Retrieval is required before a card plan.
- Approval forces exactly the approved plan and does not emit duplicate prose.
- Each generated card performs its own retrieval and retains only cited source
  metadata.
- Partial generation reports progress and retries only unresolved cards.
- Save/Discard and source state survive thread reload.
- Generated card sources enter the same message-level source normalizer used by
  source cards and inline citations.

### Verification commands and proof

Run repository-native checks in the DevPod/container after each slice. The
minimum named checks and test portfolio are:

- S1: `pnpm --filter @klicker-uzh/prisma generate`, `pnpm run prisma:sync`,
  `pnpm --filter @klicker-uzh/graphql generate`, `pnpm --filter
  @klicker-uzh/graphql check`, `pnpm --filter @klicker-uzh/graphql test`, and
  `pnpm --filter @klicker-uzh/graphql test:local` for DB-backed concurrency;
- S2/S3: `pnpm --filter @klicker-uzh/chat test:run`, `pnpm --filter
  @klicker-uzh/chat check`, and `pnpm --filter @klicker-uzh/chat build`, plus
  route/module tests covering plan replacement, retrieval gating, citations,
  lease compare-and-swap, partial retry, and credit settlement;
- S3 browser proof: accepted-plan state, Markdown rendering, per-card
  citations, Save, Discard, reload, and personal practice navigation;
- S4: `pnpm run format:check`, `pnpm run lint`, `pnpm run check:all`, the
  GraphQL and Chat builds, and final browser proof in English desktop and
  German mobile states.

| Obligation | Stable test seam | Distinct failure to expose | Owning slice |
| --- | --- | --- | --- |
| Save/Discard serialization and cross-attempt identity | DB-backed personal-element service tests | Save and Discard both succeed, or a discarded candidate reappears | S1 |
| Lease claim, reclaim, completion, and stale-owner protection | DB-backed lease transaction tests | Duplicate generation, stale completion, or stale abort clears a newer owner | S1/S2 |
| Newer card-plan replacement | Chat history projection and route regression test | An accepted older plan is treated as current after a newer plan exists | S2 |
| Retrieval and citation grounding | Card tool/source-normalizer tests | A generated card has no bounded source metadata or inline references resolve to the wrong source | S2/S3 |
| Partial retry and credit settlement | Extracted generation module tests | A retry regenerates saved/discarded cards or charges the wrong terminal path | S2 |
| Reload and UI state | HTTP adapter and browser state tests | Save/Discard, accepted-plan state, Markdown, or sources disappear after reload | S3 |
| Future type discriminator | Plan/candidate schema validation tests | A non-`FLASHCARD` type is accepted without a validated payload/renderer | S1/S2 |

Update ADR 0027 and the affected `docs/graphql-api-layer.md` page so the
course-local discard identity, removed public write mutations, and preserved
plan-replacement behavior agree with the code and generated public schema.

The final review must cover correctness, data integrity, security boundary,
maintainability, future-type seam, and plan compliance. A green build alone is
not live or deployment proof.

## Delivery and authority boundaries

This approved plan authorizes local worktree edits, bounded executor dispatch,
repository-native checks, documentation updates, and local commits. It does
not authorize merge, deployment, Argo sync, cluster changes, paid model runs,
or force-pushing.

The local branch was clean and zero commits behind the remote-verified
`origin/v3` target at the execution freshness gate (`7b638c6c`). During local
verification, the remote `v3` head advanced to `de604985`; this branch has not
been rebased or published against that newer head. The remote feature ref
currently resolves to `bf728c3a`, a divergent line containing unrelated
changes. Before publishing new commits, main must reconcile the exact intended
remote branch without force-pushing or overwriting unrelated work. No executor
starts before the freshness gate is green; that gate was satisfied for the
local implementation branch.

Execution contract: `main` is the execution orchestrator and boundary owner.
The approved local actions are worktree edits, native checks, documentation,
bounded executor dispatch, and local commits through S4’s verified terminal
condition. External actions withheld are push, merge, PR/MR publication,
deployment, Argo sync, cluster changes, secret access or writes, and paid model
runs. Pause if freshness becomes stale, a shared migration is found to have
been applied, a lease or Save/Discard invariant loses deterministic coverage,
or a cross-slice conflict changes an approved contract. If a migration has
reached a shared environment, S1 must stop and use a forward migration; only
an unreleased local migration may be rewritten. The package is complete when
S1–S3 commits are integrated, S4 generated artifacts and docs are current,
repository checks pass, and the required browser proof plus final review are
recorded.

## Risks and rollback

- Stable candidate identity changes database uniqueness. The feature is not
  released, so the feature workspace may be rebuilt from the rewritten schema;
  if any shared environment has applied the existing migrations, stop and
  create a forward migration instead of rewriting history.
- Removing public create/update mutations changes the unreleased GraphQL
  surface. Regenerate the schema and operations and confirm no application
  consumer remains before deleting them.
- Deferring unsaved revision removes an unrequested capability, but keeps the
  future type seam and saved-card editing path. Restore it only as a separate
  product decision, not by reintroducing supersession state incidentally.
- If replay prevention or Save/Discard serialization loses a deterministic
  test, stop integration and retain the current lease/discard boundary until
  the failing invariant is understood.

## Progress

- 2026-08-24: Sol-backed simplification review completed. The review found
  excessive route coupling, redundant durable workflow state, duplicated write
  boundaries, and terminology that obscures the three durable facts. This
  plan records the approved reduced design and executor topology.
- 2026-08-24: Sol planner review completed. Dispositions added for the
  freshness gate, lease compare-and-swap contract, course-local discard
  identity, generic retrieval ownership, public-operation removal, preserved
  plan replacement, exact slice ownership, and ADR/wiki verification.
- 2026-08-24: Rebased non-destructively onto `origin/v3`; freshness is green
  at the reconciled head, and the route-size and public-operation consumer
  scans were rerun with the results recorded above. Executor dispatch is now
  authorized; implementation and final integration are pending.
- 2026-08-25: S1–S3 implementation and review are integrated in local commits.
  Chat generation and candidate decisions are extracted into server modules,
  Save/Discard is participant- and course-scoped with durable Discard, public
  GraphQL write mutations are removed, and generated artifacts plus ADR/wiki
  pages are current.
- 2026-08-25: Runtime proof passed in the exact linked worktree. The PWA
  Practice Pool showed both Lecturer elements and Own elements; Own opened the
  normal empty-state shell, and Lecturer elements opened the standard practice
  quiz navigation. Chat retrieval returned `KLICKER_LOCAL_MCP_OK` with a
  source card before and after reload. Card generation showed retrieval,
  accepted-plan wording, a tool-only generation turn, per-card references,
  individual Save/Discard controls, and a discarded candidate remained absent
  after reload.
- 2026-08-25: Focused GraphQL personal-element tests passed (15/15), the Chat
  production build passed, and `pnpm run check:all` completed successfully.
  The local runtime was stopped afterward and its exact route count is zero.
- 2026-08-25: Final review identified a lease-settlement integrity gap. The
  fixed route now deletes a persisted assistant response and emits an error
  outcome when completion loses ownership or throws; completion keeps its lease
  handle until completion or durable abort settles. Focused lease and route
  tests pass (18/18), including false-return and rejected-promise completion.
- 2026-08-25: Final fixed-head Chat verification passed with
  `pnpm --filter @klicker-uzh/chat test:run` (51 files, 474 tests), Chat
  `check`, and the Chat production build. A fresh root `check:all` rerun reached
  the analytics lint task but could not build its pinned pandas dependency
  because the container has no C compiler; the earlier full `check:all` run
  passed before this Chat-only fix, and all changed-package gates pass.
- 2026-08-25: Required responsive browser proof is captured in the exact linked
  runtime: English desktop Practice Pool at
  `/private/tmp/student-generated-practice-en-desktop.png` showed both
  Lecturer elements and Own elements; German mobile at
  `/private/tmp/student-generated-practice-de-mobile.png` opened the normal
  practice overview with Start, progress, navigation, and course metadata.
  The deterministic Chat proof also showed `KLICKER_LOCAL_MCP_OK`, its source
  card after reload, accepted-plan wording, tool-only generation, per-card
  references, and durable Discard. These browser artifacts are local evidence,
  not committed product data.
- 2026-08-25: The final-review follow-up fix gates the client-visible finish
  event on durable stream finalization. Lost or failed card-generation lease
  settlement now emits an SSE error without a completed run; successful turns
  emit the finish only after settlement. Route tests consume the SSE response
  for false-return and rejected settlement, and also cover the successful
  finish path. The fix is committed locally as `ff2748284`; fixed-head Chat
  verification now passes 51 files and 475 tests, plus Chat check, lint, and
  production build. Final package review is pending on this fixed head.
- 2026-08-25: Final review findings are fixed in local commit `8e1374cb5`.
  Candidate Save/Discard and reload now require a participant-scoped completed
  generation lease for the retained assistant attempt. An aborted settlement
  caused by failed assistant persistence is client-visible as an error, and a
  UI stream that closes without terminal finalization fails closed instead of
  waiting indefinitely. Focused route and decision tests pass (29/29); the
  full Chat suite passes 51 files and 478 tests, with Chat check, lint, and
  production build passing. Final package review is pending on this fixed
  head.
- 2026-08-25: Follow-up review found that intentional terminal-partial runs
  must remain usable even though their lease is intentionally aborted. The
  settlement result now distinguishes partial completion, generation failure,
  and assistant-persistence failure. Partial candidates remain persisted and
  Save/Discard authorizes the matching participant-owned incomplete lease,
  while failed persistence still emits an SSE error. Stream finalization waits
  briefly for an in-flight terminal callback, then fails closed on a true
  zero-step close. Focused tests pass 37/37; the full Chat suite passes 51
  files and 479 tests, with Chat check, lint, and production build passing.
- 2026-08-25: A further lifecycle review found that retrying could reclaim the
  mutable lease row before decisions on a successful terminal-partial run were
  made. The settled partial run now writes a server-only `settlement: partial`
  marker into its persisted generation result after the abort compare-and-swap
  succeeds. Save and Discard use that immutable message proof, so they remain
  available after a later retry reclaims the lease; stale or failed aborts do
  not write the marker. Focused decision and settlement tests pass (25/25),
  and the full Chat suite passes 51 files and 482 tests with Chat check, lint,
  and production build passing. The fix is committed locally as `2f51be86c`;
  final package review is pending on this fixed head.
- 2026-08-25: Final package review passed the integrated range through
  `2f51be86c` with no remaining correctness, data-integrity,
  participant-isolation, architecture, documentation, test-portfolio, or
  readiness findings. The review confirmed that the partial settlement marker
  is written only after a successful participant-scoped abort and that the
  Save/Discard linkage remains fail-closed after lease reclamation. Delivery is
  complete in local commits; push, merge, and deployment remain outside this
  approved plan.
- 2026-08-25: Post-reconciliation CI exposed two integration gaps. The Chat
  test job did not build its newly imported Markdown workspace package, and
  legacy Playwright journeys skipped the approved Lecturer elements course
  step. The workflow now builds Markdown, and all affected Q, R, and MA
  journeys use the course-scoped navigation helper. The Markdown build, full
  Chat suite (51 files, 482 tests), Playwright typecheck, and collection of all
  three repaired journeys pass in the exact linked worktree. Fresh GitHub
  Actions validation is pending.
- 2026-08-26: The stack was reconciled onto current `origin/v3` at
  `339d8a0da`, including the merged account-usage lifecycle. The card-generation
  route now reuses that lifecycle's assistant claim, includes nested generation
  cost in finalization, and settles the generation lease before emitting a
  client-visible finish. The full Chat suite passes 59 files and 575 tests;
  Chat, GraphQL, and PWA typechecks pass; the focused GraphQL suite passes 18
  tests; and affected lint checks pass with existing warnings. Repository-wide
  formatting and schema-sync checks pass, and the production build passes all
  23 applicable tasks. The aggregate lint run remains
  environment-blocked because the devcontainer selected Python 3.14 and tried
  to build `pandas==2.2.2` without a C compiler; no analytics files changed in
  this integration.
