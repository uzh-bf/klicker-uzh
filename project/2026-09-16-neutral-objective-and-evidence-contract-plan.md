# Neutral objective and evidence-source contract plan

## Approval summary

When a lecturer starts element generation without writing learning objectives, Klicker's GraphQL layer fabricates one per selected Bloom level (`Prüfe das ausgewählte Wissensbasismaterial auf der kognitiven Stufe Verstehen.`). This placeholder is not a real objective, but the content-gen worker treats its presence as a creator objective, which suppresses per-slot evidence anchoring and collapses an entire generated bank onto one topic. The same placeholder also misleads lecturers in the design review, which lists it as if it were their own guidance.

Removing the placeholder outright would also remove the lecturer's Bloom-level selection from the worker blueprint: those neutral objectives are currently the only rows that carry each selected Bloom level, and the worker's generated questions are validated against them. This package therefore keeps the neutral objectives and marks them: the configuration layer records `objectiveSource: provided | neutral` per objective, the blueprint rows carry `objective_source` so the worker can treat neutral slots like objective-less slots for evidence anchoring, and the UI renders neutral objectives clearly as generated defaults. A structural review surface is added: the design review lists the evidence entities grounding each slot, so a reviewer can see when six slots ground on one concept set instead of discovering it after generation.

The already-drafted digest fix (PR #6088, commit `770e1304`) remains on this branch untouched; this plan adds to the same package only if that PR's merge state allows, otherwise it lands on a fresh branch off `v3-ai`. Grounding policy, Hatchet workflow names, artifact schemas, and element review decisions stay unchanged.

The material risk is the cross-repo rollout order: the currently deployed worker rejects unknown fields on blueprint objective rows, so this package's blueprint-marker emission must not reach production before the content-gen fix is deployed to PRD. The plan pins that seam explicitly: the marker lands behind the configuration layer now, and emission is enabled only after the worker fix is live; until then, PRD keeps today's behavior.

Done means: unit tests cover neutral-objective marking and UI rendering; the design review surfaces per-slot evidence entities and concentration; full affected checks pass; a draft PR is open with blueprint marker emission gated behind the worker release. Merge, deployment, and marker emission enablement stay separately authorized.

Approval authorizes: worktree/branch setup, source edits in the named files, focused and full affected checks, conventional commits, ordinary push, draft PR creation, and specialist reviews. It does not authorize merge, marking ready, deployment, or changes to PR #6088's review state.

## Execution details

### Working context

- Repository: `uzh-bf/klicker-uzh` at `/Users/rschlae/Git/klicker/klicker-uzh`, worktree `trees/fix-kb-digest-material-type` if PR #6088 is still open (its branch is `fix/kb-graph-digest-material-type`, head `770e1304134d2ed6005c8150d8505a0ed72eccc9`); otherwise a fresh worktree off `origin/v3-ai`.
- Target branch: `v3-ai`.
- Artifacts root: `project/` (most recent plan root; the dated flat files are the active convention).
- Cross-repo seam: the blueprint objective entries gain `objective_source: "provided" | "neutral"`. The deployed worker (image `28c5630b`) rejects unknown blueprint objective fields (closed `_JSON_OBJECTIVE_FIELDS` allowlist in its exam_blueprint.py), so this package must not emit the marker into production blueprints until the content-gen fix is merged, published, and deployed to PRD. The content-gen side is planned in `lightrag_research/project/2026-09-16-question-evidence-slot-anchoring-plan.md` in kg-content-generation.
- Live evidence from PRD build `c7370d09`: all six questions carried `objectiveSource="provided"` for a machine-generated objective; every slot received the same evidence entities and pages; all six titles collapsed.

### Root cause and binding contracts

- Problem: `neutralObjective` in `packages/graphql/src/services/questionGenerationConfiguration.ts` fabricates an objective whenever the lecturer supplied none, so downstream cannot distinguish creator intent from a Bloom-level placeholder.
- Decision: keep synthesizing the neutral objectives (they remain the Bloom-level carrier), but tag each synthesized entry `objectiveSource: "neutral"` and each lecturer entry `objectiveSource: "provided"`. The GraphQL schema exposes `objectiveSource` on every objective; the existing objectives list length and ids stay unchanged, so artifact parity checks in `questionGenerationArtifacts.ts` keep passing.
- Decision: the blueprint builder passes `objective_source` per objective row to the worker, values `provided` and `neutral`. Unknown values fail validation on the worker side, not here. Emission is gated: until the companion worker release is deployed to PRD, the blueprint builder must not include the field (the deployed worker rejects unknown objective-row fields); the plan records the gate and the enabling step rather than shipping an unconditional emission.
- Decision: the design review UI surfaces the evidence entities for each planned slot from `resolved_slots[].graph_resolution` (primary candidate `evidence_candidates[0].entity_ids`, falling back to `entity_ids`), which the worker already persists and the Klicker Zod contract already passes through. A concentration notice renders when a module's slots share one primary entity set. This is an advisory surface like the existing coverage warnings; it never blocks.
- Decision: neutral objectives, where still shown, render with an explicit "generated default" label rather than as lecturer guidance. Builds created before this change carry no `objectiveSource`; the UI treats a missing value as legacy/provided so those builds render unchanged.
- Invariant: no schema migration is required; `objectiveSource` is written into the configuration at normalize time and persisted in the build's JSON configuration, with a registry-free read path. The configuration hash changes for newly created builds once objectives carry the field; it is only compared against builds produced by the same code path, so this is benign and needs no compatibility branch. No element, draft, or provenance model change.

### Ownership and sequence

Delegation Map:

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| K1 Neutral-objective marking + schema source | main (coupled cross-repo contract) | Configuration and schema tests green |
| K2 Blueprint marker + UI neutral rendering | executor | Artifact-builder and component tests green |
| K3 Design-review concentration surface | executor | Component test with shared-entity fixture green |
| K4 Whole-branch verification + PR | main | Affected checks, review, draft PR open |

Route: K1 `main` (the cross-repo seam decision); K2, K3 `executor`; K4 `main`.

K1 — Configuration and schema:

- Files: `packages/graphql/src/services/questionGenerationConfiguration.ts`, `packages/graphql/src/schema/elementGeneration.ts`, `packages/types/src/elementGeneration.ts`, `packages/types/src/questionGeneration.ts`, `packages/graphql/test/questionGenerationConfiguration.test.ts`.
- Tag synthesized objectives `objectiveSource: "neutral"` and lecturer objectives `"provided"`; keep the existing ids, texts, lengths, and Bloom levels. The configuration's inline `objectives` type and the design-summary `objectives` type both live in `packages/types/src/questionGeneration.ts` (not `elementGeneration.ts`), so both gain the field there; `ElementGenerationObjective` in `elementGeneration.ts` is the UI-facing objective view. Expose `objectiveSource` on the objective view in the GraphQL schema. Replace the test that pins fabricated text as provided guidance with behavior coverage: synthesized entries are marked neutral, lecturer entries provided, and German/English texts still carry the selected Bloom levels.
- Check: `pnpm --filter graphql test -- questionGenerationConfiguration` or the repository's equivalent focused runner.

K2 — Blueprint marker and UI:

- Files: `packages/graphql/src/services/questionGenerationBlueprint.ts`, `packages/graphql/src/services/questionGenerationArtifacts.ts`, `packages/graphql/src/schema/elementGeneration.ts`, `packages/types/src/questionGeneration.ts`, `packages/types/src/elementGeneration.ts`, `apps/frontend-manage/src/components/elements/generation/ElementGenerationReviewGate.tsx`, `packages/i18n/messages/en.ts`, `packages/i18n/messages/de.ts`, plus their focused tests.
- Emit `objective_source` per blueprint objective row from `createQuestionGenerationBlueprint`, guarded so the field is omitted until the companion worker release is confirmed deployed to PRD; record the enabling step in Progress. Extend the design-summary parser in `questionGenerationArtifacts.ts` to read per-slot evidence entities from `resolved_slots[].graph_resolution` (`evidence_candidates[0].entity_ids`, falling back to `entity_ids`) and carry them into the design summary slots; add the corresponding slots field to both shared summary types and the GraphQL `ElementGenerationDesignSummaryView`, whose current type has no slots field. The parser must extract entity ids only, preserving the existing constraint that `graph_resolution` internals never escape the server. Render neutral objectives with a generated-default label in `ElementGenerationReviewGate.tsx` using a new i18n key in both message files; render `undefined` objectiveSource as legacy/provided.
- Check: focused artifact-builder test plus the component test.

K3 — Design-review concentration surface:

- Files: `apps/frontend-manage/src/components/elements/generation/ElementGenerationReviewGate.tsx`, `packages/i18n/messages/en.ts`, `packages/i18n/messages/de.ts`, plus a focused component test. The slots data surface it renders comes from K2's `ElementGenerationDesignSummaryView`/type additions.
- Display per-slot evidence entities in the design review when the worker returns them, and a concentration notice when a module's slots share one primary entity set. Slots without surfaced entities render nothing extra, so older worker artifacts and pre-marker builds remain valid.
- Check: focused component test using a synthetic shared-entity fixture.

K4 — Verification and delivery:

- Run the repository's affected checks: graphql configuration/artifact tests, the frontend-manage component tests, `tsc --noEmit`, Biome on changed files. Inspect the exact diff. Commit only planned files.
- Full-path reviews per the gates; persist reports under `project/_local/reviews/`.
- Deliver as a draft PR against `v3-ai`. If it shares the branch with PR #6088, keep that PR's digest change first in the stack and update its description to cover both behaviors.

### Test portfolio

| Risk | Obligation | Seam | Existing protection | Slice |
| --- | --- | --- | --- | --- |
| Neutral objective masquerades as lecturer guidance | Add new | Configuration test with empty input | None; current tests pin fabrication as provided | K1 |
| Worker cannot tell neutral from provided | Add new | Artifact-builder test | None | K2 |
| Lecturer mistakes default for guidance | Add new | Component test on objective rendering | None | K2 |
| Concentration invisible in review | Add new | Component test with shared `graph_resolution` entities | None; Zod passes the field through today | K3 |
| Legacy build without the marker renders as neutral | Add new | Component test with `objectiveSource` absent | None | K2 |
| Digest fix regression | None | PR #6088's existing 80 tests | Already green on the branch | K4 rerun |

### Verification

- Focused per slice as named above.
- Whole package: affected graphql and frontend-manage test files, `tsc --noEmit`, Biome check on changed paths, and the i18n message key check for both locales.
- Browser verification is not required for the schema/config change; the UI slices carry component tests with synthetic fixtures. Live e2e stays with the separately authorized deployment/rebuild sequence.

### Authority

- Granted: worktree/branch setup, named-file edits, focused and affected checks, conventional commits, ordinary push, draft PR creation, specialist reviews.
- Withheld: merge, marking ready, deployment, image publication, cluster changes, secrets, changes to PR #6088's review state, and any change requiring a database migration.
- Binding cross-repo order: blueprint `objective_source` emission stays disabled in production until the companion kg-content-generation release is deployed to PRD; enabling it before that is a rollout-seam violation, not an implementation choice.
- Terminal: reviewed draft PR open against `v3-ai` with both behaviors covered by tests, or the same changes appended to PR #6088 with its description updated.
- Pause: the worker contract requires a schema-level breaking change beyond the planned optional field; a schema migration becomes necessary; PR #6088 merges mid-package making the branch base stale; another writer appears on the branch; implementation needs files outside the named set.

## Progress

- Status: draft awaiting approval.
- Active slice: none.
- Next action: user approval of both plans; then K1 and the content-gen S1.
## Progress (updated)

 - Status: K1 committed and green; K2 and K3 in flight.
 - Active slice: K2/K3 (blueprint marker + design-review evidence surface).
 - Completed: K1 (1e8e48020a) marks synthesized objectives neutral and lecturer objectives provided, exposes objectiveSource on the ElementGenerationObjective GraphQL view, adds the optional field to the configuration, design-summary, and UI objective types, regenerates schema.graphql, and replaces the prose-pinning test with behavior coverage. Focused questionGenerationConfiguration and questionGenerationArtifacts suites pass (99 tests); the graphql typecheck shows no new errors (659 baseline, 659 after); Biome is clean on the changed files.
 - Next action: K2/K3, then K4 whole-branch verification and the draft PR update.
 - K2 blueprint gate: emission of the `objective_source` blueprint marker stays disabled behind `BLUEPRINT_OBJECTIVE_SOURCE_ENABLED = false` in `packages/graphql/src/services/questionGenerationBlueprint.ts`; the builder also accepts an explicit `emitObjectiveSource` option used only by tests. Enabling step: once the companion kg-content-generation worker release that accepts `objective_source` on blueprint objective rows is deployed to PRD, flip the constant to true and re-run the blueprint suite. Not enabled in this package.
 - K2 evidence surface: `parseQuestionGenerationDesign` reads per-slot entity ids from `resolved_slots[].graph_resolution` (`evidence_candidates[0].entity_ids`, falling back to `entity_ids`), carries them as `evidenceEntityIds` on the design-summary slots, exposes them on the new GraphQL `ElementGenerationDesignSlot` view, and publishes them in `schema.graphql`. Only ids leave the parser; `graph_resolution` internals stay server-side (guard test kept). The review gate renders a generated-default label for `objectiveSource: 'neutral'` and treats a missing value as legacy.
 - K3 concentration surface: the design review lists each slot's evidence entities when the worker returns them, and shows an advisory concentration notice when a module's slots with surfaced entities all share one identical entity set. Slots without surfaced entities render nothing extra, so pre-marker builds and older worker artifacts stay valid. `designReviewSlotEvidence`/`designReviewConcentration` live in `designReviewSummary.ts` and are covered by `elementGenerationDesignEvidence.test.ts` with a shared-entity fixture.
- Planner pass: the read-only planner child was unavailable (account usage limit until 2026-09-20). The planning-stage challenge was completed in the main session instead; its corrections (retain-and-mark rather than removal, worker-first rollout gate, blueprint-builder file, i18n files, `graph_resolution` evidence path) are incorporated above.
- Independent review: one read-only GLM 5.3 review pass returned APPROVE_WITH_CORRECTIONS. Its verified findings folded in above: `packages/types/src/questionGeneration.ts` type surfaces, the design-summary slots exposure surface, the `undefined`-legacy rendering rule, and the configuration-hash note. Its worker-side findings (stems metadata/checkpoint field list, `blueprint_to_assessment_design` propagation, `load_plan` neutral acceptance, focus-text handling) are folded into the companion content-gen plan.
- K4 verification: whole-branch typecheck baseline established rigorously by temporarily restoring the pre-change `ElementGenerationReviewGate.tsx`/`designReviewSummary.ts` pair and diffing the sorted error lists. True baseline is 35 pre-existing errors (unbuilt `@klicker-uzh/markdown`/`@klicker-uzh/word-cloud` workspace deps and shared-components JSX noise); the two new errors were in this package and are fixed by `b25334e018`, which carries the canonical `ElementGenerationBloomLevel` on the review view model and defaults a missing value to `null`. Final: 35 errors, none in the changed files.
- K4 checks: `frontend-manage` `node --test` suite 10 passed; graphql `questionGenerationArtifacts`/`questionGenerationBlueprint`/`questionGenerationConfiguration` 114 passed; Biome clean on the four changed files; the `graph_resolution` internals guard test at `questionGenerationArtifacts.test.ts:737` retained.
- Corrective finding from the companion worker review: the serialized evidence candidate gained an `is_primary` marker that no consumer reads (Klicker identifies the primary bundle by candidate position) and that the worker review-artifact validator rejects as an unknown field, failing every interactive design save after a graph resolution. Removed in the companion branch `9f4da91`; this branch's parser never depended on it.
- Remaining: K4 slice/final review gates and the PR #6088 description update. Emission stays disabled until the worker fix is merged and deployed to PRD.
