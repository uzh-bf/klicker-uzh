# Request a revision of one generated element

## Approval summary

**Goal.** A lecturer reviewing a generated element draft can mark it "revision requested", optionally saying what should change. The system then generates a new draft for the same slot, linked to the old one, while the rest of the build stays as it is. The path is generic for every element type; this batch builds it for questions. Today a lecturer can only accept, reject, edit, duplicate or keep a draft; a better question for one slot means a new build.

**Origin.** User rulings of 2026-11-09: the draft decision gains `revision_requested`, which in KlickerUZH starts a revision request for that slot; then the grilling rulings recorded below. The kg pool store uses the same four values with the same meaning (`CONTEXT.md`: Draft decision).

**Outcome.**
1. `GeneratedElementDecision` gains `REVISION_REQUESTED`. Setting it on a draft whose element type supports revision (questions now) reserves the price of one revision and starts a revision request for that slot. The build stays COMPLETED or INCOMPLETE; other drafts stay reviewable and keepable.
2. The request is fulfilled by a **child build**: an ordinary element generation build for that one slot, linked to the parent build and the old draft, with the note and a snapshot of the old draft. It reuses the build lifecycle, lease, synchronization, retry and cost ledger. Its one new draft (`parentDraftId` and `revisionOfDraftId` = the old draft) is shown next to the old draft with the note. Accepting any draft of a revision chain rejects the chain's other unsaved drafts.
3. A revision works from the database alone: every build keeps a slot specification per slot (ADR 0057), so a revision still works after the build's blob artifacts or its knowledge base are purged, then without fresh evidence.
4. A failed revision shows the failure on the old draft and offers a retry; every dispatched run is charged (ADR 0013).

**Packages.**
- **P1 — slot specifications and slot revision in the kg worker (kg-content-generation).** The worker emits a slot specification for every question of a completed build, and gains a slot-revision entry point that starts from a slot specification, the previous question and the note, not from the build's start manifest. The kg pool store records the same slot specification per slot with its generation builds. Owned by its own execution plan in kg-content-generation; this plan fixes the contract (below).
- **P2 — revision requests in KlickerUZH (this repository, target `v3-ai`).** Child builds, slot specification storage and backfill, decision rules, GraphQL and the review UI.

**Availability.** No separate switch: revision is available wherever question generation is enabled (ADR 0056), priced from the configured question build price. Staging and production get it with their next rollout, which stays the user's decision.

**Approval mode.** Executable batch for P2 once approved, with the P1 plan drafted in kg-content-generation first; all product decisions below are settled.

**Authority requested.** P2: task branches from `v3-ai`, local commits, pushes and a native GitHub stack of draft PRs into `v3-ai` (the repository asks for `$stacked-change` and `$gh-stack` on cross-layer work; layers below), one independent final review, and the repository's standing `/final-review-stack` on the top PR once CI is settled. P1: drafting its kg plan. Withheld: merging, marking ready, deployment, environment configuration, running the backfill against any non-local database, paid model calls. The repository is public: tests and docs use synthetic data only.

**Terminal.** P2 draft PR stack open with passing focused tests (decision, child build, slot specification, chain rejection, UI) against a synthetic worker result. An end-to-end run against the P1 worker needs model calls and comes back as a named, separately approved run once P1 exists.

## Rulings (2026-11-09)

1. **Note.** Optional free text (up to 1000 characters). It belongs to the reworked draft through its revision request, stored on the child build that fulfils it: each request keeps its own note and a snapshot of the draft as it was, so retries, replaced requests and chains keep every note. Shown on the old draft as the reason and on the new draft as "revision of …"; deleted with the build; sent to the worker and the generation model as the revision brief.
2. **Generic path.** Names and contracts are element-generic (spend class `ELEMENT_REVISION`, revision request, child build, slot specification). Each element type declares whether it supports revision; questions do now, flashcards say "not available yet".
3. **Cost.** Every dispatched run is charged like every element-generation dispatch (ADR 0013): the spend settles once the provider accepts the dispatch; a failed run and its retry are each charged. Released only before provider contact or when recovery finds no run after the grace period. The price is one question's share of its build: the configured question build price divided by the build's requested question count, rounded up; an optional setting can override it later.
4. **Concurrency.** One unfinished child build per draft; any number of drafts of a build may be in revision; a revised draft can be revised again (a chain). A failed request can be retried or replaced by a new one.
5. **Old and new drafts.** The old draft keeps `REVISION_REQUESTED`; while its child build is unfinished it cannot be kept, edited or re-decided. Accepting any unsaved draft of a revision chain (keep accepts first) rejects the chain's other unsaved drafts in the same step; setting it back to open restores none of them; manual duplicates are untouched.
6. **Availability.** No separate switch; see above.
7. **Durable inputs.** Each build keeps a slot specification per slot in the database (ADR 0057): the slot's design entry with its graph selection as ids, and the text of the cited evidence and assertion statements. Evidence text is removed with its knowledge base; a revision then proceeds without fresh evidence and the lecturer sees that the source material is gone. Builds that predate this are backfilled while their blob files exist and otherwise revised from the stored slot summary.
8. **Shared language.** `CONTEXT.md` defines Slot, Slot specification, Draft decision and Revision request; both systems fulfil revision requested through a generation build for the slot.
9. **Simplification (final pass).** A revision request is fulfilled by a child build, not a separate record; slot specifications live per slot on the build; the chain rule sits in accept.

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
- Build rows: `ElementGenerationBuild` (`knowledge.prisma:366-455`) carries the full lifecycle (status, stage, provider ids, dispatch attempt, retry count, sync lease, errors, spends); `sourceGraphBuildId` uses `Restrict`, and the KB purge keeps the graph-build ledger row; builds are unique only on `[ownerId, idempotencyKey]`. Keep allows OPEN or ACCEPTED (`elementGeneration.ts:604-612`).

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or open ruling |
| --- | --- | --- | --- | --- |
| Draft decision | extend | New value `REVISION_REQUESTED` starts a revision request; accepting a chain draft rejects the chain's other unsaved drafts; a draft with an unfinished child build cannot be kept, edited or re-decided | Review UI, keep, GraphQL SDL, Playwright fixtures | Rulings 4, 5 |
| Revision request | compose | Product term only: a draft decision plus the child build that fulfils it; no new record | Review UI | Ruling 9 |
| Element generation build | extend | Optional `parentBuildId`, `revisionOfDraftId`, `revisionNote`, `revisionDraftSnapshot`; a child build has one slot and is hidden from build lists | Dispatch, synchronization, accounting, retry, KB purge | Ruling 9 |
| Slot specification | extend | The build's per-slot design summary grows into the full slot specification; evidence text cleared by the KB purge | Completion, purge, backfill, kg pool store | Ruling 7, ADR 0057 |
| Element generation spend | extend | Spend class `ELEMENT_REVISION` at the derived price for child builds | Quota, ADR 0013 | Ruling 3 |
| Draft lineage | extend | `revisionOfDraftId` on the new draft; chains group by it | Review UI | Ruling 5 |
| Capability `supportsIndividualRegeneration` | extend | Per element type: true for questions | Review UI, Playwright fixtures | Rulings 2, 6 |
| Worker contract | extend (P1) | Slot specifications in the build result; a revision start event for child builds | kg worker | Contract below |

## Worker contract (P1 ↔ P2)

- **Build result.** The result manifest of every completed question build carries one slot specification per slot (schema version 1): the design slot entry (objective, topics, format, difficulty, question kind, `graph_resolution` ids) plus the text of the cited evidence chunks and assertion statements. KlickerUZH verifies it against the bank's slot ids and stores it in the build's design summary.
- **Revision start event** `element-generation:slot-revision-requested`, `schema_version 1`, `operation_kind` `element-slot-revision`, sent for a child build: `build_id` (the child), `parent_build_id`, `dispatch_attempt_id`, `element_type` (`question`), `slot_id`, `language`, the parent's slot specification (evidence text may be absent; for an old build the reduced slot summary), `previous_element` (the snapshot), `note` (optional), `graph_version_id` when the graph still exists (the worker may refresh evidence from it), and the child build's own `output` prefix under `<questionOutputPrefix>/<childBuildId>/`.
- **No start manifest.** The entry point does not load the parent's start manifest, design, plan or bank and does not run their stage contracts; it validates the slot specification and its own output.
- **Execution policy.** KlickerUZH sends none; the worker default applies.
- **Result.** The ordinary build result manifest (`completed` or `failed`) with a one-element bank, provenance and the slot's fresh specification; the element keeps the slot id, carries `targetDifficulty`, and records `revision_of` with the previous element's content hash and whether evidence was refreshed, reused or absent.
- **Verification in KlickerUZH.** The existing completion checks with `expectedQuestionIds = [slot_id]`; graph lineage only when the graph was used; required `targetDifficulty`.
- **Recovery.** The existing build recovery keyed on the child build id, `dispatch_attempt_id` and the new `operation_kind`.

## P2 design

- **Schema (one generated migration, no hand-written SQL).**
  - `REVISION_REQUESTED` in `GeneratedElementDecision`; `ELEMENT_REVISION` in `KBGraphQuotaSpendClass`.
  - `ElementGenerationBuild`: optional `parentBuildId` (cascade with the parent), `revisionOfDraftId` (SetNull), `revisionNote`, `revisionDraftSnapshot`; `evidencePurgedAt`.
  - `GeneratedElementDraft.revisionOfDraftId` (SetNull).
  - Analytics schema mirrored with `pnpm run prisma:sync`.
- **Slot specifications.** Completion stores each slot's specification in `designSummary.slots[]` from the result manifest; builds from an old worker keep today's summary. The KB purge clears evidence text from its builds' slot specifications and stamps `evidencePurgedAt`. A backfill task fills slot specifications for builds whose artifacts still exist; idempotent, run only locally in this batch.
- **Decision and child build.** In one transaction under the parent build's row lock: `setGeneratedQuestionDecision` accepts `REVISION_REQUESTED` (optional `note`) only for an unsaved draft of a supporting element type in a COMPLETED or INCOMPLETE build with no unfinished child build for that draft; it creates the child build (one requested element, configuration derived from the parent, same `sourceGraphBuildId`, idempotency key derived from the draft and its revision) and reserves `ELEMENT_REVISION` at the derived price through the existing build reservation. While the child build is unfinished, the old draft's decision changes, edits and keep are refused.
- **Accept rule.** Setting a draft to ACCEPTED, including the accept step inside keep, rejects the other unsaved drafts of its revision chain (linked through `revisionOfDraftId`) in the same transaction under the parent build lock. Keep and bulk save need no chain logic. Keep also accepts `REVISION_REQUESTED` once the child build is finished.
- **Dispatch, synchronization, retry.** The existing build paths, with one branch: a child build dispatches the revision start event instead of the build start event. Polling the parent build also synchronizes its unfinished child builds through the existing leased synchronizer; a child build's failure stays on the child. Retry is the existing build retry on the child. Completion of a child build writes its one draft into the parent's review with `parentDraftId` and `revisionOfDraftId` = the old draft.
- **Build lists.** Lecturer build lists and counts filter `parentBuildId IS NULL`.
- **GraphQL.** `SetGeneratedElementDecisionInput` gains `note`; the draft type exposes `revisionOfDraftId`, its revision note and its child builds (status, note, error, newest first), and whether its evidence is gone. The SDL snapshot is regenerated in the layer that changes the schema.
- **UI.** "Request revision" next to reject, with an optional note, shown when the capability is on for the element type; the page keeps polling while a child build is unfinished; the old draft shows progress and its note; the new draft follows it, labelled as a revision with the same note; earlier requests stay visible as history; a hint shows when the source material is gone; failure shows the reason and the existing retry. de/en i18n keys.
- **Docs.** ADR 0057 (accepted with the stack); ADR 0013 note on revision pricing; CONTEXT.md terms; `docs/graphql-api-layer.md`; `docs/data-and-migrations.md`.

## Test portfolio

| Risk | Obligation | Seam | Existing protection | Failure caught |
| --- | --- | --- | --- | --- |
| A revision request double-charges, misprices, changes the parent build, or starts two child builds | add new | decision service + accounting against real PostgreSQL (`elementGenerationAccounting.test.ts` style) | build reservations only | two unfinished child builds for one draft; parent status changed; price not one question's share |
| A child build's result lands on the wrong draft or fails the parent | add new | completion with a synthetic manifest and one-question bank (`elementGenerationCompletion.integration.test.ts` style) | build completion only | wrong `parentDraftId`/`revisionOfDraftId`; second draft on a repeated poll; parent marked FAILED; missing `targetDifficulty` accepted |
| Slot specifications are lost, or evidence text outlives its knowledge base | add new | completion and KB purge against real PostgreSQL | none | specification missing after completion; evidence text left after purge; backfill not idempotent |
| A chain ends up with two accepted drafts, or a draft is changed mid-revision | extend existing | `elementGenerationDraftPersistence.test.ts` | keep and decision rules | accepting one chain draft leaves another unsaved draft open; keep or decision change succeeds mid-revision |
| The review UI hides or misstates the revision state | extend existing | Playwright `Y-question-generation-review.spec.ts` with a fixture child build | review flow | action missing for questions or shown for flashcards; running, failed and purged states missing; polling stops while a child build is unfinished |

## Slices (P2) and stack layers

1. **Layer 1 — schema, slot specifications, decision and accept rule.** Migration, completion storage, purge clearing, backfill task, child build creation and reservation, accept rule, list filter, SDL snapshot; portfolio rows 1, 3 and 4. The decision refuses `REVISION_REQUESTED` until layer 2 sets the capability, so layer 1 alone exposes nothing usable.
2. **Layer 2 — child build dispatch and synchronization.** Revision start event, child synchronization from the parent, child completion into the parent review, GraphQL fields, capability; portfolio row 2.
3. **Layer 3 — review UI and docs.** UI, i18n keys, Playwright fixture and spec, docs; portfolio row 5.
4. Independent final review of the integrated stack; draft PRs; `/final-review-stack` once CI is settled.

## Recovery

- Migration generation fails or produces unrelated changes: stop and report.
- P1 not ready: P2 is complete after slice 4 against the synthetic worker result; the end-to-end run waits for its own approval.
- Any finding that changes the worker contract returns to both plans.

## Progress

- 2026-11-09: drafted on `rs/draft-revision-requested` from `origin/v3-ai` (fa84966358) from a read-only map of the decision, dispatch, accounting and UI code.
- 2026-11-09: independent plan critique (REVISE, eight findings) dispositioned: all accepted.
- 2026-11-09: grilling rulings 1–8 recorded; ADR 0057 proposed; glossary terms added.
- 2026-11-09: final simplicity pass (advisor) accepted by the user: child builds replace the revision record, its poller, retry path and partial index; slot specifications live per slot on the build; the chain rule sits in accept.
