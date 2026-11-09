# Request a revision of one generated question

## Approval summary

**Goal.** A lecturer reviewing a generated question can mark it "revision requested", optionally saying what should change. The system then generates a new question for the same slot, linked to the old one, while the rest of the build stays as it is. Today a lecturer can only accept, reject, edit, duplicate or keep a draft; getting a better question for one slot means a new build.

**Origin.** User ruling of 2026-11-09 in the kg-content-generation generation-record work: the draft decision gains a fourth value `revision_requested`, and in KlickerUZH it triggers a regeneration of that slot. The kg pool store already uses the same four values (`open`, `accepted`, `revision_requested`, `rejected`).

**Outcome.**
1. `GeneratedElementDecision` gains `REVISION_REQUESTED`. Setting it on a question draft of a completed build reserves the cost of one slot revision and starts a revision run for that slot. The build stays COMPLETED or INCOMPLETE; other drafts stay reviewable and keepable meanwhile.
2. The revision run produces one new draft for the same slot (`parentDraftId` = the old draft, next `duplicationIndex`), marked as a revision and shown next to the old draft. The old draft keeps `REVISION_REQUESTED` and stays readable; once the run has ended the lecturer can set it back to open, accept or keep it.
3. A failed revision run shows the failure on the old draft and offers a retry. Charging follows decision 3.

**Packages.**
- **P1 — slot revision worker (kg-content-generation).** A Hatchet workflow that regenerates one slot of an existing build from the build's original start input and an optional instruction. Owned by its own execution plan in kg-content-generation; this plan fixes its contract (below).
- **P2 — revision request in KlickerUZH (this repository, target `v3-ai`).** Schema, accounting, dispatch, synchronization, GraphQL and the review UI.

**Off by default.** The action exists only when a runtime flag is on and the slot-revision price is configured. Both are unset in every environment after P2; enabling is a separate, later action (decision 6).

**Approval mode.** Direction-only until the decisions below are answered; then an executable batch for P2, with P1 planned in kg-content-generation first.

**Authority requested after the decisions.** P2: task branches from `v3-ai`, local commits, pushes and a native GitHub stack of draft PRs into `v3-ai` (the repository asks for `$stacked-change` and `$gh-stack` on cross-layer work; layers below), one independent final review, and the repository's standing `/final-review-stack` on the top PR once CI is settled. P1: drafting its kg plan. Withheld: merging, marking ready, deployment, configuration changes in any environment (chart keys are added as optional without values), paid model calls, enabling the feature anywhere. The repository is public: tests and docs use synthetic data only.

**Terminal.** P2 draft PR stack open with passing focused tests (decision, reservation, dispatch, synchronization, UI) against a synthetic worker result. An end-to-end run against the P1 worker needs model calls; it is not part of this batch and comes back as a named, separately approved run once P1 exists. Merging and enabling are the user's decisions.

## Decisions for the user

1. **Instruction text.** Recommend: optional free text (up to 1000 characters) with the request. It is stored on the slot revision row (deleted with the build), sent to the worker and passed to the generation model as the revision brief. Alternative: no text, regenerate blind.
2. **Scope.** Recommend: generated questions only. Flashcard builds have no design or plan slots; their drafts reject `REVISION_REQUESTED`. Alternative: include flashcards with a separate worker path.
3. **Cost and failed runs.** Recommend: a new spend class `QUESTION_SLOT_REVISION` with its own price from the same semester quota, charged like every element-generation dispatch today (ADR 0013): the spend settles once the provider accepts the dispatch, so a run that fails afterwards is charged, and a retry is charged again. The reservation is released only when dispatch fails before provider contact, or when recovery finds no run after the grace period. Alternative: refund failed revisions, which needs a new refund path and an ADR 0013 amendment.
4. **Concurrency.** Recommend: one open revision per draft (requested or running); any number of drafts of a build may be in revision; a revision of the revised draft is allowed (a chain). A failed revision can be retried or replaced by a new request. Alternative: one revision run per build at a time.
5. **The old draft.** Recommend: it keeps `REVISION_REQUESTED`; while its revision is open it cannot be kept, edited or have its decision changed; after the run ends it becomes keepable again (keep is extended to accept `REVISION_REQUESTED`). Alternative: the old draft becomes `REJECTED` automatically once the revision arrives.
6. **Enabling.** Recommend: you enable it later per environment by setting the price and the runtime flag; this batch sets neither. Alternative: enable in staging as part of this batch.
7. **Deleted knowledge base.** Recommend: refuse the request (with a clear reason) when the knowledge base, its source graph or the build's generation artifacts are deleted or purged. Alternative: none; the worker cannot regenerate without them.

## Context (verified on `origin/v3-ai`)

- Decision enum `GeneratedElementDecision` (OPEN, ACCEPTED, REJECTED), `packages/prisma/src/prisma/schema/knowledge.prisma:97-101`; draft model `:507-549` with `parentDraftId` (`onDelete: SetNull`, `:518`), `duplicationIndex`, `@@unique([buildId, sourceElementId, duplicationIndex])`. The analytics copy is mirrored by `pnpm run prisma:sync`.
- GraphQL builds its enum from the Prisma values (`packages/graphql/src/schema/elementGeneration.ts:93-96`); `setGeneratedElementDecision` (`mutation.ts:2394-2412`) routes by element type (`services/elementGeneration.ts:817-826`) to `setGeneratedQuestionDecision` (`services/questionGenerationDrafts.ts:324-364`), which accepts any Prisma value (`:329`) and takes no build lock (`:344-353`). Decisions are allowed only for COMPLETED or INCOMPLETE builds; a saved draft cannot change.
- `keepGeneratedElementDraft` (`services/elementGeneration.ts:494-679`) allows OPEN or ACCEPTED only (`:604-612`) and locks the build (`:520-525`); `duplicateGeneratedElementDraft` (`:759-815`) locks the build (`:783-788`) and copies a row with `parentDraftId` and the next `duplicationIndex`. Bulk save selects ACCEPTED drafts only (`questionGeneration.ts:1463-1466`), locks the build (`:1447-1452`) and requires `targetDifficulty` on every saved draft (`:1495-1500`).
- `supportsIndividualRegeneration: false` is a static capability flag (`packages/types/src/elementGeneration.ts:294`), served at `services/elementGeneration.ts:856`.
- Synchronization: `getQuestionGenerationBuild` returns before taking a lease for every terminal build (`questionGeneration.ts:1099-1101`); `synchronizeLeasedBuild` (`:602-1005`) re-queries the build's run (`:642-657`) and writes the build to FAILED on a non-retryable error (`:963-1003`); `recordBuildFailure` (`:265-316`) resets the build and releases its own spend. Completion checks (coordinates, graph lineage, provenance authority) are at `:836-942`. The lease helper works for any status (`elementGenerationLease.ts:29-36`). The review page stops polling once the build is settled (`ElementGenerationBuild.tsx:59-65`).
- Dispatch: `dispatchCostAccountedElementGeneration` (`services/elementGenerationDispatch.ts:33-136`) claims, pushes, and settles the spend as soon as the provider accepts the dispatch or exact recovery finds the run (`:118-134`). Release requires a RESERVED spend (`elementGenerationAccounting.ts:476-481`). `reserveElementGenerationRetrySpend` (`:232-300`) locks the build then the quota (`:258-282`) and resets the build to PREPARING_INPUT, so it cannot serve a completed build. `ElementGenerationSpend.dispatchAttemptId` is unique (`knowledge.prisma:466`). Recovery matches build id, `dispatch_attempt_id` and `operation_kind` after an anchor time (`questionGenerationRuntime.ts:930-980`). KlickerUZH sends no `execution_policy` (`questionGeneration.ts:335-348`).
- Pricing config: `isElementGenerationCostConfigured` (`elementGenerationAccounting.ts:86-102`) hides all element generation when any listed price is unset; the chart marks every cost key `required` (`deploy/charts/klicker-uzh-v3/templates/cm-backend-graphql.yaml:70-73`), and staging and production values set real prices.
- KB purge deletes `outputArtifactPrefix` recursively and marks generation artifacts purged (`packages/hatchet/src/kbMaintenance.ts:916-961`).
- Worker (kg-content-generation): start, design-reviewed and plan-reviewed events only (`lightrag_research/hatchet_workflows/question_blueprint_schemas.py`, input model `:230-254`). Every stage checks `start_manifest_sha256` against the start input (`question_stage_contracts.py:388`) and the design's pinned evidence (`:264`, `:413`); the worker writes `manifest/start.json` (`question_blueprint_tasks.py:1131`). Internal slot replacement exists for exam composition (`assessment_design.exemplars_for_replacement`, `two_stage` didactical replacement).
- ADRs: 0013 (KlickerUZH reserves and settles graph cost; element-generation settlement `:42-45`, graph refunds `:31-36`), 0017 (the build ledger is canonical). `CONTEXT.md:352-358` defines the generated element draft. Review UI: `GeneratedElementReview.tsx` (decision label `review.states.${draft.decision}` at `:754`).

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or open ruling |
| --- | --- | --- | --- | --- |
| Generated element draft decision | extend | New value `REVISION_REQUESTED`; setting it on a question draft starts a slot revision; a draft with an open revision cannot be kept, edited or re-decided | Review UI, keep, bulk save (skips it), GraphQL SDL, Playwright fixtures | Ruling of 2026-11-09; decision 5 |
| Slot revision | create | Durable record per request: draft, instruction, status, spend attempts, provider run, resulting draft, error | Accounting, dispatch, synchronization, review UI | The build stays COMPLETED while one slot regenerates, so it is not a build status |
| Element generation spend | extend | Spend class `QUESTION_SLOT_REVISION`; reservation without a build reset; optional link to a slot revision | Quota, ADR 0013 | Decision 3 |
| Generated element draft lineage | extend | `parentDraftId` + next `duplicationIndex`; new `revisionOfDraftId` distinguishes a revision from a duplicate | Review UI | Decision 4 |
| Capability `supportsIndividualRegeneration` | extend | From a static `false` to: runtime flag on and price configured | Review UI, Playwright fixtures | Decision 6 |
| Worker contract | extend (P1) | New event and result manifest for one slot | kg-content-generation worker | Contract below |

## Worker contract (P1 ↔ P2)

- **Request event** `course-question-blueprint-generation:slot-revision-requested`, `schema_version 1`, `operation_kind` `question-slot-revision`:
  - ids: `question_build_id`, `slot_revision_id`, `dispatch_attempt_id`, `slot_id` (`sourceElementId`);
  - the build's original start input, by reference: the worker-written `manifest/start.json` and its sha256, so the worker's start-manifest and pinned-evidence checks hold;
  - `previous_question`: the old draft's content as of the request;
  - `instruction` (optional);
  - `output` under `<questionOutputPrefix>/<buildId>/revisions/<slotRevisionId>/`. The nesting is load-bearing: KB purge deletes the build prefix recursively, so revisions are purged with it.
- **Execution policy.** KlickerUZH sends none, as for builds; the worker default applies.
- **Result.** A result manifest with status `completed` or `failed` (structured slot failure as today) and a one-question bank in the schema of `questions/final.json`, with its provenance entry. The question keeps the slot id, carries `targetDifficulty`, and records `revision_of` with the previous question's content hash.
- **Verification in KlickerUZH.** The same completion checks as a build (coordinates, graph lineage, provenance authority) with `expectedQuestionIds = [slot_id]`, plus a required `targetDifficulty`.
- **Recovery.** Matching by build id, `dispatch_attempt_id` and `operation_kind` `question-slot-revision`, anchored at the revision's dispatch time.

## P2 design

- **Schema (one generated migration).**
  - `REVISION_REQUESTED` in `GeneratedElementDecision`; `QUESTION_SLOT_REVISION` in `KBGraphQuotaSpendClass`.
  - Model `ElementGenerationSlotRevision`: `id`, `buildId` (cascade with the build), `draftId` (cascade with the draft), `instruction`, `previousQuestion` snapshot, `status` (REQUESTED, RUNNING, COMPLETED, FAILED), current `dispatchAttemptId`, provider ids, `dispatchedAt`, `resultDraftId` (SetNull), error fields, `syncLeaseOwner` and lease expiry, timestamps.
  - Open means REQUESTED or RUNNING: a partial unique index on `draftId` where status is open, added as the only hand-written SQL in the migration (precedent: `20260706151837_add_verifiable_credentials`, `20260825190000_kb_management_foundation`; a "Schema-level gotchas" entry in `docs/data-and-migrations.md`).
  - `GeneratedElementDraft.revisionOfDraftId` (SetNull). `ElementGenerationSpend.slotRevisionId` (optional). A retry gives the revision a new `dispatchAttemptId`; earlier spend rows stay linked through `slotRevisionId`.
  - Analytics schema mirrored with `pnpm run prisma:sync`.
- **Accounting.** `reserveSlotRevisionSpend` locks the build row, then the quota, and reserves `QUESTION_SLOT_REVISION` without touching the build status. Claim, settle and release reuse the existing functions with the semantics of decision 3. The price key `KB_ELEMENT_GENERATION_SLOT_REVISION_COST_MINOR_UNITS` gets its own predicate and stays out of `isElementGenerationCostConfigured`; its chart key is optional (no `required`), env values unchanged, `turbo.json` updated.
- **Gate.** `supportsIndividualRegeneration` becomes true only when `KB_ELEMENT_GENERATION_SLOT_REVISION_ENABLED` is set and the price is configured. Without it the service rejects `REVISION_REQUESTED`, so layer 1 alone exposes nothing usable.
- **Decision.** In one transaction under the build row lock: `setGeneratedQuestionDecision` accepts `REVISION_REQUESTED` (optional `instruction`) only when the gate is on, the draft is an unsaved question draft of a COMPLETED or INCOMPLETE build, the KB and its generation artifacts exist, and no revision is open; it snapshots `previousQuestion`, creates the revision and reserves. While a revision is open, decision changes, edits and keep of that draft are refused. After it ends, keep accepts `REVISION_REQUESTED` (`canKeep` checks the revision row under the lock). Bulk save skips such drafts without change. Flashcards refuse the value.
- **Dispatch.** The build query, under a revision lease, dispatches REQUESTED revisions through `dispatchCostAccountedElementGeneration` with the new operation kind. A failure before provider contact releases the reservation and marks the revision FAILED; it never goes through `recordBuildFailure`.
- **Synchronization.** A separate leased function `synchronizeSlotRevisions`, run from `getQuestionGenerationBuild` whenever an open revision exists, also for terminal builds. It queries only the revision's run, verifies the result as above, and in one transaction under the build lock creates the new draft (`parentDraftId`, `max(duplicationIndex)+1`, `revisionOfDraftId`) and marks the revision COMPLETED. Every write is conditional on the lease owner and the revision status, so a repeated poll creates no second draft. Its error handler writes only to the revision row; the build is never changed.
- **GraphQL.** `SetGeneratedElementDecisionInput` gains `instruction`; the draft type exposes `revisionOfDraftId` and its latest revision (status, error); `retrySlotRevision` re-dispatches a FAILED revision with a new reservation, refused once the old draft was kept or set back to open. The SDL snapshot is regenerated in the layer that changes the schema.
- **UI.** "Request revision" next to reject, with an optional instruction field, shown only when the capability is on; the page keeps polling while any revision is open; a running revision shows progress on the old draft; the new draft appears directly after it, labelled as a revision; failure shows the reason and a retry button. de/en i18n keys for the new state and actions.
- **Docs.** CONTEXT.md entry for slot revision; ADR 0013 note on slot-revision pricing and settlement; `docs/graphql-api-layer.md` mutation list; `docs/data-and-migrations.md` index entry.

## Test portfolio

| Risk | Obligation | Seam | Existing protection | Failure caught |
| --- | --- | --- | --- | --- |
| A revision request double-charges, charges without a dispatch, or changes the build | add new | accounting + decision service against real PostgreSQL (`elementGenerationAccounting.test.ts` style) | build reservations only | two open revisions for one draft; reservation left after pre-contact failure; build status changed; request accepted with the gate off |
| A revision result creates the wrong draft, duplicates on a repeated poll, or fails the build | add new | synchronization with a synthetic manifest and one-question bank (`elementGenerationCompletion.integration.test.ts` style) | build completion only | wrong parent or index; second draft; invalid result marks the build FAILED; missing `targetDifficulty` accepted |
| A draft with an open revision is kept, edited, re-decided or bulk-saved | extend existing | `elementGenerationDraftPersistence.test.ts` | keep and decision rules | keep or decision change succeeds mid-run; bulk save aborts instead of skipping |
| The review UI hides or misstates the revision state | extend existing | Playwright `Y-question-generation-review.spec.ts` with a fixture revision | review flow | action shown with the capability off; running and failed states missing; polling stops while a revision is open |

## Slices (P2) and stack layers

1. **Layer 1 — schema, accounting, gate and decision.** Migration, `reserveSlotRevisionSpend`, the gate (default off), the decision, keep and bulk-save rules, SDL snapshot; portfolio rows 1 and 3.
2. **Layer 2 — dispatch and synchronization.** Runtime method, revision dispatch, `synchronizeSlotRevisions`, `retrySlotRevision`, GraphQL fields; portfolio row 2.
3. **Layer 3 — review UI and docs.** UI, i18n keys, Playwright fixture and spec, docs; portfolio row 4.
4. Independent final review of the integrated stack; draft PRs; `/final-review-stack` once CI is settled.

## Recovery

- Migration generation fails or produces unrelated changes: stop and report; hand-written SQL is limited to the partial unique index.
- P1 not ready: P2 is complete after slice 4 against the synthetic worker result; the end-to-end run waits for its own approval.
- Any finding that changes the worker contract returns to both plans.

## Progress

- 2026-11-09: drafted on `rs/draft-revision-requested` from `origin/v3-ai` (fa84966358) from a read-only map of the decision, dispatch, accounting and UI code.
- 2026-11-09: independent plan critique (REVISE, eight findings) dispositioned: all accepted. Changes: charging model made explicit (decision 3), separate revision synchronizer and dispatch that never touch the build, start-input reference and result checks in the worker contract, real off-by-default gate with optional chart key, complete schema, build lock and keep/bulk-save rules, layer 1 inert without the gate, terminal condition without paid calls, decisions 6 and 7 added.
