# Question generation failure visibility plan

## Approval summary

When the PRD generation run failed, the lecturer saw a generic "Question-generation workflow did not complete" error. The worker actually knew exactly why: three Apply-level slots had no usable script evidence, and it printed per-slot rejection reasons before returning without a plan. Those reasons never crossed the artifact boundary, and Klicker's GraphQL layer maps any failed run to one generic status. The reliability companion fixes the worker so this failure class is largely prevented and self-repaired; this package makes whatever remains visible and useful.

Three changes land on the Klicker side. Structured failure reasons are parsed from the result manifest and carried into the GraphQL layer, replacing the generic workflow error with per-slot reason cards carrying stable reason codes and covered-topic suggestions. A new partial-delivery flow delivers the questions that passed while showing per-slot attention cards for the slots that did not, modeled on the existing incomplete-publication flow used by flashcards, and always ending in the existing per-element review states rather than bypassing review. Start-payload capability emission for the partial mode is gated behind a configuration constant with the manifest-hash compatibility handled worker-first, exactly like the objective_source precedent.

The material risks are strict-schema parsing and the rollout order. The artifact parser is strict Zod, so new fields must land with tolerant defaults for older worker artifacts and pre-existing persisted build summaries; the prior package fixed a real crash of exactly this class, and the same legacy-build regression tests are required here. The rollout order is enforced in code, not convention: the deployed worker rejects unknown start-payload fields, so the partial-mode flag must not be emitted until the companion worker release is deployed to PRD.

Done means: focused tests prove reason parsing, legacy-artifact tolerance, the gated emission, the partial-delivery transition, and both locales of the UI surfaces; affected checks and the screenshot gallery pass; a draft PR is open against v3-ai. Merge, deployment, and gate enablement remain separately authorized.

Approval authorizes planning, worktree and plan file, source edits in the named files, focused and affected checks, the screenshot gallery, conventional commits, ordinary push, draft PR creation, and package reviews. It does not authorize merge, marking ready, deployment, protected pushes, secrets, or spend.

## Execution details

### Working context

- Repository: uzh-bf/klicker-uzh at /Users/rschlae/Git/klicker/klicker-uzh.
- Worktree: trees/question-generation-failure-visibility, branch question-generation-failure-visibility, base 5b4f5949d6462db660e5ec99b8c74e8f261f4a61 (origin/v3-ai head).
- Target: v3-ai.
- Plan path: project/2026-09-18-question-generation-failure-visibility-plan.md.
- Companion plan: lightrag_research/project/2026-09-18-question-generation-reliability-plan.md in kg-content-generation (trees/fix/question-generation-reliability, target feat/question-generation-hatchet-workflow).
- Live evidence: failed PRD build 314ea070-4f19-4242-a1ac-dd3e5667ddfb (Hatchet run 667724c5-927f-42c4-a657-db8a09af4165) surfaced as the generic workflow-failed error; run logs carried per-slot grounding rejections for q02/q04/q06. Successful build 56ec3969-ef85-4d09-b478-b2a7b957eb1c produced six elements with five clustered on Controller/Treasurer pages 12-14, proving that a usable partial outcome existed even in the degraded run.

### Verified diagnosis

- Problem: questionGeneration.ts (~515-555, ~669) maps a FAILED run to the generic WORKFLOW_FAILED status and the error message "Question-generation workflow did not complete"; no run-level detail is read.
- Evidence: the worker persisted no structured reasons in the failing manifest (all-or-nothing return, stdout-only reasons), so even a perfect parser had nothing to read; the worker companion adds that surface, and this package consumes it.
- Problem: questionGenerationArtifacts.ts parses artifacts with strict Zod schemas throughout; unknown or absent optional fields must not break older artifacts, and persisted build summaries parsed by older code must not crash newer resolvers. The prior package's design-summary default fix (commit 4ccf4bcba7) is the recorded precedent of this failure class.
- Evidence: ElementGenerationBuildStatus (ops.ts ~1581-1596) already has an incomplete-publication flow (AWAITING_INCOMPLETE_PUBLICATION, PUBLISHING_INCOMPLETE, INCOMPLETE) used by flashcardGeneration.ts (~611), which is the existing model for delivering a partial result while keeping review control.
- Problem: the worker start payload is hashed (questionWorkflowStartManifestSha256, questionGeneration.ts ~148-171) and the worker's StrictModel rejects unknown fields; a partial-mode capability flag changes the hash and must follow the worker-first gate.

### Binding contracts

- Decision (failure classes): the UI renders exactly three classes. User-input failures show an actionable error with covered-topic suggestions from the graph. Self-repairable failures are repaired worker-side and never surface. System failures show a system-status message with retry guidance, never a stack or generic failure. The class comes from the structured reason, not from client-side inference.
- Decision (reason surface): the result-manifest parser reads the worker's structured per-slot reasons and exposes them as a typed GraphQL view: slot id, module, objective, objective source, requested Bloom level, evidence target, stable reason code, failure class, and suggestions. Reason codes are rendered through i18n keys in both locales; free-form worker detail stays out of the UI except as expandable diagnostics, never as the primary message.
- Decision (generic error replacement): a failed run with structured reasons renders the per-slot reason cards. A failed run without them (older worker, legacy artifact) keeps a legacy fallback state that still says the run failed, but with a distinct legacy marker so support can tell the two apart.
- Decision (partial delivery): the lecturer element-generation flow opts into the worker partial capability. On completed_partial, the build publishes the passing elements into the existing review flow with per-element review states and shows per-slot attention cards for the unsupplied slots, following the flashcard incomplete-publication transition model. Review decisions, element creation, and provenance accounting stay unchanged.
- Decision (strict mode): strict all-or-nothing remains available for real exam blueprints where a partial bank would misrepresent coverage; the choice is recorded on the build, not inferred from the run.
- Decision (gated emission): the partial-mode start-payload flag is emitted only behind an in-code off-by-default constant exactly like the BLUEPRINT_OBJECTIVE_SOURCE_ENABLED precedent, off until the companion worker release is deployed and verified in PRD. Enabling it is a code change and deploy under separate authority, not a runtime setting. The start-payload hash path handles the field symmetrically on both sides so the canonical hash stays stable for legacy builds.
- Invariant: no schema migration, no new secret, and no environment-backed configuration variable. The emission gate is the in-code constant above. No change to element review decisions, accounting, or provenance.

### Ownership and sequence

Delegation Map:

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| K1 Reason parsing + GraphQL surface | executor | Parser and resolver tests green |
| K2 Gated partial-mode emission + hash compat | main (cross-repo contract) | Gate and hash tests green |
| K3 Failure visibility UI | executor | Component tests green, both locales |
| K4 Partial-delivery flow | executor | Lifecycle tests green |
| K5 Verification + gallery + PR | main | Affected checks, screenshots, draft PR open |

Route: K2 is the cross-repo seam decision and stays with the main session. K1, K3, K4 are settled implementation slices delegated to executors in the serial order below. K5 is integration and delivery with the main session.

Execution order is serial on this one branch: K1 lands first, because K3 and K4 consume its parsed reason view and K2 shares its lifecycle file; then K2, then K3, then K4. K1, K2, and K4 all touch questionGeneration.ts and K1/K4 share the elementGeneration schema file, so parallel execution would create avoidable coordination risk. The delegation map assigns ownership, not parallel execution.

K1 - Reason parsing and GraphQL surface:

- Files: packages/graphql/src/services/questionGenerationArtifacts.ts, packages/graphql/src/services/questionGeneration.ts, packages/graphql/src/schema/elementGeneration.ts, packages/types/src/questionGeneration.ts, packages/types/src/elementGeneration.ts, plus focused tests in packages/graphql/test.
- Parse the structured per-slot reasons from the result manifest with tolerant defaults for older artifacts; expose the typed view on the build query. Legacy manifests without reasons parse to an empty list and the legacy fallback state.
- An unknown reason code parses successfully and carries its failure class and structured fields; the parser never rejects an artifact for an unknown code.
- Check: focused artifact tests including a legacy-artifact fixture and the persisted-legacy-build regression shape from the prior package.
- Check addition: an unknown-code fixture parses to the fallback rendering data.

K2 - Gated partial-mode emission and hash compatibility:

- Files: packages/graphql/src/services/questionGenerationBlueprint.ts, packages/graphql/src/services/questionGeneration.ts, focused tests.
- Add the partial-mode start-payload flag behind an off-by-default constant; keep the emission gate enforced in code; ensure the hash manifest includes the field only when emitted so legacy builds keep today's hash.
- Check: focused blueprint and lifecycle tests proving the gate is off, the hash is stable for legacy builds, and the explicit test-only override cannot reach production.

K3 - Failure visibility UI:

- Files: apps/frontend-manage/src/components/elements/generation/ElementGenerationReviewGate.tsx and the generation status/error surface components reached from it, packages/i18n/messages/en.ts, packages/i18n/messages/de.ts, apps/frontend-manage/src/lib/designReviewSummary.ts or the sibling summary helper that owns the slot view model, plus focused component tests.
- Render per-slot reason cards keyed by stable reason code and failure class; covered-topic suggestions render as chips; the system class shows retry guidance; the legacy fallback renders distinctly. All text through i18n in both locales; locate elements by test ids, never pinned prose.
- An unknown reason code renders through its failure class and structured fields, never the raw code or a raw i18n key, so a future worker release cannot surface an untranslated identifier.
- completed_partial with zero passing elements renders the per-slot failure-reason surface rather than an empty review state; K4 covers that transition and this slice owns its rendering.
- Check: focused component tests with synthetic reason fixtures covering all three failure classes plus the legacy fallback; the gallery in K5 covers real browser captures.

K4 - Partial-delivery flow:

- Files: packages/graphql/src/services/questionGeneration.ts, packages/graphql/src/ops.ts, packages/graphql/src/schema/elementGeneration.ts, focused lifecycle tests.
- On completed_partial, transition through the incomplete-publication model to the existing review states, publish passing elements with their per-element review flags, and persist the per-slot attention cards on the build summary. Failed publication rolls back as today.
- A partial result with zero passing elements ends in the failure-reason surface rather than an empty review state.
- Check: focused lifecycle tests covering partial success, zero passing elements, publication failure, and the strict-mode build.

K5 - Verification, gallery, and delivery:

- Run the affected checks per repository convention: focused graphql suites, frontend-manage component tests, tsc with an explicit out-of-tree tsbuildinfo, Biome on changed files, schema regeneration byte-stability.
- Build the screenshot gallery for the changed generation states (failure reason cards, partial delivery, legacy fallback) in both locales and the relevant manage-UI viewport; run actual interaction checks on the transition from failed to partial-review. Record unavailable coverage explicitly.
- Full-path gates: simplifier on the substantive slice, slice-reviewer for the cross-system seam, final-reviewer on the integrated package. Persist reports under project/_local/reviews/.
- Deliver as a draft PR against v3-ai.

### Test portfolio

| Risk | Obligation | Seam | Existing protection | Slice |
| --- | --- | --- | --- | --- |
| Structured reasons lost between worker and UI | Add new | Result-manifest parser test with reason fixture | None; generic error today | K1 |
| Older worker artifacts break the parser | Add new | Legacy-artifact fixture test | Strict Zod catches unknowns; tolerance unasserted | K1 |
| Persisted legacy build summary crashes resolver | Add new | Resolver default test (prior package precedent) | 4ccf4bcba7 fixed the same class once | K1 |
| Partial flag emitted before worker supports it | Add new | Gate-off and hash-stability tests | objective_source gate precedent | K2 |
| Lecturer cannot tell which slots failed and why | Add new | Component tests per failure class | None | K3 |
| Reason text unmaintainable or untranslated | Add new | i18n key coverage in both locales | Existing key checks | K3 |
| Partial bank bypasses element review | Add new | Lifecycle test ending in review states | Existing review-state tests | K4 |
| Partial publication failure leaves orphan elements | Extend existing | Lifecycle publication-failure test | Flashcard incomplete flow precedent | K4 |
| UI states render incorrectly | Add new | Screenshot gallery with interaction checks | None for these states | K5 |

### Verification

- Focused: the named suites per slice.
- Whole package: affected graphql and frontend-manage suites, tsc with explicit out-of-tree tsbuildinfo, Biome on changed files, schema regeneration byte-stability, screenshot gallery in both locales.
- Live PRD proof is out of scope and stays with the separately authorized deployment and e2e sequence after both packages merge.

### Authority

- Granted: worktree, plan file, source edits in the named files, focused and affected checks, screenshot gallery, conventional commits, ordinary push, draft PR creation and updates, package reviews.
- Withheld: merge, marking ready, deployment, protected pushes, secrets, spend, enablement of the partial-mode emission gate.
- Binding rollout order: the companion worker release must accept completed_partial and the start-payload flag and be deployed to PRD before this package emits the flag; the gate constant enforces this in code.
- Terminal: reviewed draft PR open against v3-ai with all surfaces tested and the gallery captured; plan committed as the branch's first commit.
- Pause: the worker artifact contract requires a breaking change beyond optional fields; a schema migration becomes necessary; the partial-delivery flow cannot reuse the incomplete-publication transition without new state semantics; another writer appears on the branch; implementation needs files outside the named set.

## Progress

- Status: approved and in execution; K1-K4 complete, K5 in progress.
- Active slice: K5 verification, gallery and delivery.
- Completed: K1 reason parsing and GraphQL surface (c27d8c1c56); K2 gated partial-mode emission and hash compatibility (20d075e2c6, hardened by 796ade4d5c); K3 failure visibility UI (f1db81fa54); K4 partial-delivery flow (3ce0d30084).
- Latest verified head: b21b7a8edf on question-generation-failure-visibility.
- Unresolved required gates: none on this branch. The slice-reviewer pass returned APPROVE on 5b4f5949d6..052e9930; the final-reviewer pass returned "findings" on 5b4f5949d6..f246f054e3 and all three findings are dispositioned below; the gallery is captured.
- Required delivery layer: source draft PR against v3-ai.
- Achieved delivery layer: branch pushed; draft PR open against v3-ai at https://github.com/uzh-bf/klicker-uzh/pull/6152.
- Blockers: none for this branch. The planner/simplifier/final-reviewer Codex-native routes were blocked by the account usage limit until 2026-09-20 10:36; the final-reviewer pass was completed through the Claude CLI route instead, and the simplifier is recorded as a main-session pass.
- K1 evidence: 105 focused tests pass across questionGenerationArtifacts, questionGenerationLifecycle and elementGenerationSchema; tsc clean; Biome clean; schema regeneration byte-stable. Parser invariants for completed_partial require final_questions present, slot_failures non-empty, no review or rejection metadata, and a unique review-id list.
- K2 evidence: new questionWorkflowStartPayload and questionWorkflowStartManifestSha256 exports build both the dispatch payload and the GENERATING_ITEMS provenance-recompute payload through one shared builder; QUESTION_PARTIAL_RESULTS_ENABLED defaults to false and the allow_partial_results key is absent while the gate is closed, keeping legacy start-manifest hashes byte-identical. 121 tests pass across questionGenerationArtifacts, questionGenerationLifecycle, elementGenerationSchema, questionGenerationBlueprint and the new questionGenerationPartialGate suite; tsc clean; Biome clean.
- K3 evidence: elementGenerationSlotFailures maps the parsed reasons into a dependency-free view model that keys the card by the stable reason code but renders the explanation of that code, falling back to the failure class explanation for a code the client does not know. Unknown failure classes degrade to system. elementGenerationResultSurface decides between the slot-failure cards, the distinct legacy failure surface, and the empty-draft state, so a zero-passing partial run renders the reason surface. Both locales carry every key. 11 frontend-manage tests pass independently at the integrated head.
- K4 evidence: completed_partial settles the build as INCOMPLETE through the same incomplete-review model the flashcard flow uses, delivers the passing subset with its review flags, and persists the per-slot attention cards on the build summary so the query serves them without re-downloading the result manifest. parseQuestionGenerationFinalBank accepts a non-empty subset only for a partial result; the strict path still requires the exact requested count. Completed-with-review drafts on an INCOMPLETE build are reviewable by design, because otherwise the terminal state would be unreachable.
- K5 evidence so far: 170 tests pass across eight non-database graphql suites at the integrated head; tsc with an explicit out-of-tree tsBuildInfoFile is clean; Biome clean on all changed files; pnpm run check in packages/graphql regenerates the schema byte-stably and typechecks; pnpm run check in apps/frontend-manage is clean. elementGenerationCompletion.integration.test.ts requires a freshly provisioned marked disposable klicker_test database and was reported green by the executor at its own head; the main session cannot reproduce it in this environment, which is an environment gate rather than a source failure.
- Planning-stage challenge: the read-only planner route was unavailable (account usage limit until 2026-09-20 10:36). The challenge was completed in the main session against the planning checklist: the generic-error replacement was split from partial delivery so failure visibility lands even if partial mode stays gated; the legacy-artifact and persisted-summary regression shapes were made explicit portfolio rows because that failure class already occurred once; the partial flow was constrained to the existing incomplete-publication transition and existing review states; and the emission gate was made code-enforced with hash stability for legacy builds. An independent read-only GLM 5.3 review pass then returned APPROVE_WITH_CORRECTIONS; its corrections are folded into this draft and recorded below.
- Plan review corrections folded in: the explicit serial execution order (K1, then K2, K3, K4 on one branch); the emission-gate mechanism clarified as an in-code constant rather than a configuration variable; unknown reason codes must parse and render through failure class and structured fields with a defined fallback; and the zero-passing partial case renders the failure-reason surface instead of an empty review state.
- K5 gallery evidence: 8 captures at 1440x900 through the repository Playwright host runner, committed as c1e02e5d9e with playwright/profiles.json, playwright/util/fixtures/questionGenerationReview.ts and playwright/tests/Y-question-generation-failure-gallery.spec.ts. Coverage: failed build with four structured reason cards (two user_input including an unknown code, one self_repairable, one system) in both locales; INCOMPLETE build with one delivered reviewable draft and three attention cards; legacy failed build with no reasons; INCOMPLETE with zero passing drafts rendering the reason surface and no review table. Manifest, index.html and gallery.md are written under project/_local/gallery/question-generation-failure-visibility/. The delivered-draft editor interaction passed. The captures were inspected structurally (DOM and test-id counts, layout assertions), not visually; a human visual pass remains advisable and is recorded in the manifest warnings.
- Final-review disposition (report at project/_local/reviews/2026-09-18-question-generation-failure-visibility-final-review.md):
  - Finding 1 (medium) accepted and fixed in b21b7a8edf. The run-level FAILED/CANCELLED branch wrote the generic message and returned before result.json was ever read, so a provider-reported failure had no reason surface. The branch now reads result.json opportunistically, accepts only a manifest that parses as a failed result, persists resultManifestArtifact plus planSummary.slotFailures, and keeps the generic message otherwise. Two focused lifecycle tests added.
  - Finding 2 (low) accepted and fixed in b21b7a8edf. The self_repairable class copy claimed the element was corrected, but every persisted reason describes an unsupplied slot. Both locales reworded.
  - Finding 3 (low, advisory) accepted as an ordering constraint. The strict-vs-partial choice is a global constant with no per-build record; latent while the gate is closed, so it is recorded as a prerequisite of the enablement commit rather than corrected now.
- Cross-repo dependency surfaced by finding 1: in strict mode the worker currently writes no result.json at all when the stems stage aborts, so this branch has nothing to read for the live symptom until the companion worker persists a failed manifest carrying slot_failures. That obligation is with worker slice W5, and the Klicker side is already compatible with it (it accepts a failed manifest with reasons).
- Next action: none on this branch. Delivery layer reached: reviewed draft PR open against v3-ai. Merge, deployment and gate enablement remain separately authorized and are blocked on the companion worker release.
