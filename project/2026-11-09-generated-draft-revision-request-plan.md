# Request a revision of one generated element

## Approval summary

**Goal.** A lecturer reviewing a generated element draft can mark it "revision requested", optionally saying what should change. The system then generates a new draft for the same slot, linked to the old one, while the rest of the build stays as it is. The path is generic for every element type; this batch builds it for questions. Today a lecturer can only accept, reject, edit, duplicate or keep a draft; a better question for one slot means a new build.

**Origin.** User rulings of 2026-11-09: the draft decision gains `revision_requested`, which in KlickerUZH starts a revision request for that slot; then the grilling rulings recorded below. The kg pool store uses the same four values with the same meaning (`CONTEXT.md`: Draft decision).

**Outcome.**
1. `GeneratedElementDecision` gains `REVISION_REQUESTED`. Setting it on a draft whose element type supports revision (questions now) reserves the price of one revision and starts a revision request for that slot. The build stays COMPLETED or INCOMPLETE; other drafts stay reviewable and keepable.
2. The revision produces one new draft for the same slot (`parentDraftId` = the old draft, next `duplicationIndex`, `revisionOfDraftId`), shown next to the old draft with the request's note. Keeping any draft of a revision chain rejects the chain's other unsaved drafts.
3. A revision works from the database alone: every draft keeps a slot specification (ADR 0057), so a revision still works after the build's blob artifacts or its knowledge base are purged, then without fresh evidence.
4. A failed revision shows the failure on the old draft and offers a retry; every dispatched run is charged (ADR 0013).

**Packages.**
- **P1 — slot specifications and slot revision in the kg worker (kg-content-generation).** The worker emits a slot specification for every question of a completed build, and gains a slot-revision entry point that starts from a slot specification, the previous question and the note, not from the build's start manifest. The kg pool store records the same slot specification per draft. Owned by its own execution plan in kg-content-generation; this plan fixes the contract (below).
- **P2 — revision requests in KlickerUZH (this repository, target `v3-ai`).** Schema, slot specification storage and backfill, accounting, dispatch, synchronization, GraphQL and the review UI.

**Availability.** No separate switch: revision is available wherever question generation is enabled (ADR 0056), priced from the configured question build price. Staging and production get it with their next rollout, which stays the user's decision.

**Approval mode.** Executable batch for P2 once approved, with the P1 plan drafted in kg-content-generation first; all product decisions below are settled.

**Authority requested.** P2: task branches from `v3-ai`, local commits, pushes and a native GitHub stack of draft PRs into `v3-ai` (the repository asks for `$stacked-change` and `$gh-stack` on cross-layer work; layers below), one independent final review, and the repository's standing `/final-review-stack` on the top PR once CI is settled. P1: drafting its kg plan. Withheld: merging, marking ready, deployment, environment configuration, running the backfill against any non-local database, paid model calls. The repository is public: tests and docs use synthetic data only.

**Terminal.** P2 draft PR stack open with passing focused tests (decision, reservation, slot specification, dispatch, synchronization, chain rejection, UI) against a synthetic worker result. An end-to-end run against the P1 worker needs model calls and comes back as a named, separately approved run once P1 exists.

## Rulings (2026-11-09)

1. **Note.** Optional free text (up to 1000 characters). It belongs to the reworked draft through its revision request: each request keeps its own note and a snapshot of the draft as it was, so retries, replaced requests and chains keep every note. Shown on the old draft as the reason and on the new draft as "revision of …"; deleted with the build; sent to the worker and the generation model as the revision brief.
2. **Generic path.** Names and contracts are element-generic (spend class `ELEMENT_REVISION`, revision request, slot specification). Each element type declares whether it supports revision; questions do now, flashcards say "not available yet".
3. **Cost.** Every dispatched run is charged like every element-generation dispatch (ADR 0013): the spend settles once the provider accepts the dispatch; a failed run and its retry are each charged. Released only before provider contact or when recovery finds no run after the grace period. The price is one question's share of its build: the configured question build price divided by the build's requested question count, rounded up; an optional setting can override it later.
4. **Concurrency.** One open request (requested or running) per draft; any number of drafts of a build may be in revision; a revised draft can be revised again (a chain). A failed request can be retried or replaced by a new one.
5. **Old and new drafts.** The old draft keeps `REVISION_REQUESTED`; while its request is open it cannot be kept, edited or re-decided. Keeping any unsaved draft of a revision chain rejects the chain's other unsaved drafts; manual duplicates are untouched.
6. **Availability.** No separate switch; see above.
7. **Durable inputs.** Each draft keeps a slot specification in the database (ADR 0057): the slot's design entry with its graph selection as ids, and the text of the cited evidence and assertion statements. Evidence text is removed with its knowledge base; a revision then proceeds without fresh evidence and the lecturer sees that the source material is gone. Builds that predate this are backfilled while their blob files exist and otherwise revised from the stored slot summary.
8. **Shared language.** `CONTEXT.md` defines Slot, Slot specification, Draft decision and Revision request; the kg glossary carries the same meaning of revision requested.

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
- ADRs: 0013 (KlickerUZH reserves and settles graph cost; element-generation settlement `:42-45`, graph refunds `:31-36`), 0017 (the build ledger is canonical). `CONTEXT.md` defines the generated element draft, slot, slot specification, draft decision and revision request. Review UI: `GeneratedElementReview.tsx` (decision label `review.states.${draft.decision}` at `:754`).
- Persistence today: a draft stores `original`, `current`, `citations` (ids and pages, no text, `packages/types/src/questionGeneration.ts:126`) and `provenance` (ids and digests, `:147`), written at `elementGenerationCompletion.ts:124-146`; no design data beyond `sourceElementId`. The build stores `configuration` (`questionCount`, language, objectives), `designSummary.slots[]` (objective, Bloom level, difficulty, evidence entity ids, `:265`) and `planSummary` (`:280`). The kg design slot (`assessment_design.py` near `:2556`) carries objective, topics, format, difficulty, question kind and `graph_resolution` as ids; chunk text is resolved at generation from the pinned graph bundle (`question_evidence.py:183`). KB purge keeps drafts and builds but deletes the bundle and artifacts, so no evidence text survives today.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or open ruling |
| --- | --- | --- | --- | --- |
| Draft decision | extend | New value `REVISION_REQUESTED`; starts a revision request; a draft with an open request cannot be kept, edited or re-decided | Review UI, keep, bulk save (skips it), GraphQL SDL, Playwright fixtures | Rulings 4, 5 |
| Revision request | create | Durable record per request: draft, note, draft snapshot, status, spend attempts, provider run, resulting draft, error | Accounting, dispatch, synchronization, review UI | Ruling 1 |
| Slot specification | create | Stored per draft at completion and by backfill; evidence text removed with the knowledge base | Completion, KB purge, revision dispatch, kg pool store | Ruling 7, ADR 0057 |
| Element generation spend | extend | Spend class `ELEMENT_REVISION`; reservation without a build reset; derived price; optional link to a revision request | Quota, ADR 0013 | Ruling 3 |
| Draft lineage | extend | `revisionOfDraftId`; keeping one draft of a revision chain rejects the others | Keep, review UI | Ruling 5 |
| Capability `supportsIndividualRegeneration` | extend | Per element type: true for questions when question generation and its price are configured | Review UI, Playwright fixtures | Rulings 2, 6 |
| Worker contract | extend (P1) | Slot specifications in the build result; new slot-revision event and result | kg worker | Contract below |

## Worker contract (P1 ↔ P2)

- **Build result.** The result manifest of every completed question build carries one slot specification per question (schema version 1): the design slot entry (objective, topics, format, difficulty, question kind, `graph_resolution` ids) plus the text of the cited evidence chunks and assertion statements. KlickerUZH verifies it against the bank's slot ids and stores it with the draft.
- **Request event** `element-generation:slot-revision-requested`, `schema_version 1`, `operation_kind` `element-slot-revision`: `build_id`, `revision_request_id`, `dispatch_attempt_id`, `element_type` (`question`), `slot_id`, `language`, the stored slot specification (evidence text may be absent), `previous_element` (the snapshot), `note` (optional), the build's `graph_version_id` when the graph still exists (the worker may refresh evidence from it; otherwise it uses the given evidence or none), and `output` under `<questionOutputPrefix>/<buildId>/revisions/<revisionRequestId>/` (purged with the build's prefix).
- **No start manifest.** The entry point does not load the build's start manifest, design, plan or bank and does not run their stage contracts; it validates the slot specification and its own output instead.
- **Execution policy.** KlickerUZH sends none; the worker default applies.
- **Result.** A result manifest with status `completed` or `failed` (structured failure) and a one-element bank in the build's bank schema with provenance and a fresh slot specification; the element keeps the slot id, carries `targetDifficulty`, and records `revision_of` with the previous element's content hash and whether evidence was refreshed, reused or absent.
- **Verification in KlickerUZH.** Coordinates and provenance checks as for a build with `expectedQuestionIds = [slot_id]`; graph lineage only when the graph was used; required `targetDifficulty`.
- **Recovery.** Matching by build id, `dispatch_attempt_id` and `operation_kind`, anchored at the request's dispatch time.

## P2 design

- **Schema (one generated migration).**
  - `REVISION_REQUESTED` in `GeneratedElementDecision`; `ELEMENT_REVISION` in `KBGraphQuotaSpendClass`.
  - `GeneratedElementDraft.slotSpecification` (JSON, nullable for old drafts), `evidencePurgedAt`, `revisionOfDraftId` (SetNull).
  - Model `ElementRevisionRequest`: `id`, `buildId` and `draftId` (cascade), `note`, `draftSnapshot`, `status` (REQUESTED, RUNNING, COMPLETED, FAILED), current `dispatchAttemptId`, provider ids, `dispatchedAt`, `resultDraftId` (SetNull), error fields, sync lease fields, timestamps.
  - Open means REQUESTED or RUNNING: a partial unique index on `draftId` where status is open, the only hand-written SQL (precedent `20260706151837_add_verifiable_credentials`, `20260825190000_kb_management_foundation`; a "Schema-level gotchas" entry in `docs/data-and-migrations.md`).
  - `ElementGenerationSpend.revisionRequestId` (optional). A retry gives the request a new `dispatchAttemptId`; earlier spend rows stay linked.
  - Analytics schema mirrored with `pnpm run prisma:sync`.
- **Slot specifications.** Completion stores each draft's slot specification from the result manifest; a build without them (an old worker) leaves the field empty. The KB purge also clears evidence text from the specifications of its builds' drafts and stamps `evidencePurgedAt`. A backfill task reads the design and the pinned bundle of builds whose artifacts still exist and writes the specifications; it is idempotent and only run locally in this batch.
- **Accounting.** `reserveRevisionSpend` locks the build row, then the quota, and reserves `ELEMENT_REVISION` at the derived price without touching the build status. Claim, settle and release reuse the existing functions. No new environment key is required; `isElementGenerationCostConfigured` is unchanged.
- **Decision.** In one transaction under the build row lock: `setGeneratedQuestionDecision` accepts `REVISION_REQUESTED` (optional `note`) only for an unsaved draft of a supporting element type in a COMPLETED or INCOMPLETE build with no open request; it snapshots the draft, creates the request and reserves. While a request is open, decision changes, edits and keep of that draft are refused. Keep accepts `REVISION_REQUESTED` once the request has ended, and rejects the chain's other unsaved drafts in the same transaction. Bulk save skips drafts with an open request; when it saves several drafts of one chain it refuses with a clear message. Flashcards refuse the value as not available yet.
- **Dispatch.** The build query, under a request lease, dispatches REQUESTED requests through `dispatchCostAccountedElementGeneration` with the new operation kind; the payload carries the slot specification or, for an old draft without one, the build's slot summary. A failure before provider contact releases the reservation and marks the request FAILED; it never goes through `recordBuildFailure`.
- **Synchronization.** A separate leased `synchronizeRevisionRequests`, run from `getQuestionGenerationBuild` whenever an open request exists, also for terminal builds. It queries only the request's run, verifies the result, and in one transaction under the build lock creates the new draft (`parentDraftId`, `max(duplicationIndex)+1`, `revisionOfDraftId`, its slot specification) and marks the request COMPLETED. Every write is conditional on the lease owner and the request status. Its error handler writes only to the request.
- **GraphQL.** `SetGeneratedElementDecisionInput` gains `note`; the draft type exposes `revisionOfDraftId`, the request that produced it (note), its own requests (status, note, error, newest first) and whether its evidence is gone; `retryRevisionRequest` re-dispatches a FAILED request with a new reservation, refused once the draft was kept or set back to open. The SDL snapshot is regenerated in the layer that changes the schema.
- **UI.** "Request revision" next to reject, with an optional note, shown when the capability is on for the element type; the page keeps polling while a request is open; the old draft shows progress and its note; the new draft follows it, labelled as a revision with the same note; earlier requests stay visible as history; a hint shows when the source material is gone; failure shows the reason and a retry button. de/en i18n keys.
- **Docs.** ADR 0057 (accepted with the stack); ADR 0013 note on revision pricing; CONTEXT.md terms (done); `docs/graphql-api-layer.md`; `docs/data-and-migrations.md`.

## Test portfolio

| Risk | Obligation | Seam | Existing protection | Failure caught |
| --- | --- | --- | --- | --- |
| A request double-charges, charges without a dispatch, misprices, or changes the build | add new | accounting + decision service against real PostgreSQL (`elementGenerationAccounting.test.ts` style) | build reservations only | two open requests for one draft; reservation left after pre-contact failure; build status changed; price not one question's share |
| A result creates the wrong draft, duplicates on a repeated poll, or fails the build | add new | synchronization with a synthetic manifest and one-question bank (`elementGenerationCompletion.integration.test.ts` style) | build completion only | wrong parent or index; second draft; invalid result marks the build FAILED; missing `targetDifficulty` accepted |
| Slot specifications are lost, or evidence text outlives its knowledge base | add new | completion and KB purge against real PostgreSQL | none | specification missing after completion; evidence text left after purge; backfill not idempotent |
| A draft with an open request is kept, edited or re-decided, or a chain keeps two drafts | extend existing | `elementGenerationDraftPersistence.test.ts` | keep and decision rules | keep mid-run succeeds; keeping one chain draft leaves another open |
| The review UI hides or misstates the revision state | extend existing | Playwright `Y-question-generation-review.spec.ts` with a fixture request | review flow | action missing for questions or shown for flashcards; running, failed and purged states missing; polling stops while a request is open |

## Slices (P2) and stack layers

1. **Layer 1 — schema, slot specifications, accounting and decision.** Migration, completion storage, purge clearing, backfill task, `reserveRevisionSpend`, decision, keep and bulk-save rules, SDL snapshot; portfolio rows 1, 3 and 4. The decision refuses `REVISION_REQUESTED` until layer 2 sets the capability, so layer 1 alone exposes nothing usable.
2. **Layer 2 — dispatch and synchronization.** Runtime method, request dispatch, `synchronizeRevisionRequests`, `retryRevisionRequest`, GraphQL fields, capability; portfolio row 2.
3. **Layer 3 — review UI and docs.** UI, i18n keys, Playwright fixture and spec, docs; portfolio row 5.
4. Independent final review of the integrated stack; draft PRs; `/final-review-stack` once CI is settled.

## Recovery

- Migration generation fails or produces unrelated changes: stop and report; hand-written SQL is limited to the partial unique index.
- P1 not ready: P2 is complete after slice 4 against the synthetic worker result; the end-to-end run waits for its own approval.
- Any finding that changes the worker contract returns to both plans.

## Progress

- 2026-11-09: drafted on `rs/draft-revision-requested` from `origin/v3-ai` (fa84966358) from a read-only map of the decision, dispatch, accounting and UI code.
- 2026-11-09: independent plan critique (REVISE, eight findings) dispositioned: all accepted.
- 2026-11-09: grilling rulings 1–8 recorded; ADR 0057 proposed; glossary terms added. The availability ruling replaces the earlier off-by-default gate; the durable-input ruling replaces the start-manifest reference in the worker contract.
