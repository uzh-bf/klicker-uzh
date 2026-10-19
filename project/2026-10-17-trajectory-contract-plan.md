# Trajectory producer and importer compatibility

Current execution: the approved migration section below supersedes the earlier
optional product-adapter ownership and merge/pin recommendation. Earlier
verification receipts cover the prior implementation, not migration acceptance.

## Approval summary

Align the existing application capture validator and the framework's optional
Klicker importer so authored trajectories have the same meaning at both
boundaries. The user authorized proceeding through the agreed consolidation
roadmap with a native goal on 17 October 2026. Approval mode: executable batch
for source changes, offline verification and coordinated draft delivery.

Require a nonempty, unique, one-based, in-range assessment selection. Reject
unknown fields at the corpus, case and turn boundaries, including ambiguous
literal/repeated turns. Preserve exact authored text and identifiers, the
previous assistant answer plus suffix, receipt version 2, source provenance,
parent chains and planned incomplete/unstarted coverage. Keep capture and
provider admission app-native; assessment remains in framework Python.

This deliberately tightens acceptance of malformed version-1 corpora. Valid
unordered assessment lists will also become sorted in normalized framework
output, matching capture's existing normalization. Receipt shapes stay
compatible, so no format bump or receipt rewrite is needed. Check all tracked
synthetic corpora before delivery. A
failure in an existing valid consumer would require reassessing compatibility,
not silently changing its data. No scoring, metric, dependency or runtime change
is included. No product primitive changes; this repairs an existing authored
trajectory contract. ADR 0001's transport/evidence separation remains sufficient.

Finish with matching synthetic acceptance tests, an actual offline producer to
importer round trip, reviewed source, exact-head CI and the two existing drafts.
Neither merge nor a framework-pin change is included. Paid capture, judge calls,
real-ledger initialization, prompt apply and deployment remain separate gates.
Independent zero-spend assessment preparation may continue within the roadmap;
judge admission or a new evaluation policy requires a concrete subsequent plan.

## Execution details

### Context, ownership and sequence

Boundary owner: self. Execution mode: standard (exact runtime model identity is
not exposed). Reuse the existing task worktrees and draft topology:

- Klicker: `trees/evaluation-ownership-plans`, branch
  `docs/evaluation-ownership-plans`, target `v3`,
  [PR 6578](https://github.com/uzh-bf/klicker-uzh/pull/6578).
- Framework: `trees/explainer-validation`, branch `test/explainer-validation`,
  target `main`, [MR 57](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/57).

The app branch integrated `v3` at `0f222786e86c625c7bfbff594a952de770d15ac5`
to include the current OCR deadline repair before new source CI. Framework main
is `d4ee03e51566c3d8a847ff0daf28ad47332c8373`. Existing corpus additions and
documentation remain part of these drafts; no stack, new audience or extra
runner is created. Existing plans remain historical; this plan owns the new
source package. Project artifacts stay under `project/` in both repositories.

Delegation Map: main owns slice 1 (producer), slice 3 (cross-language proof,
documentation, integration and delivery). One trusted generic executor owns
slice 2 (framework validator and existing test suite), depending only on this
frozen contract. Slices 1 and 2 may run concurrently with disjoint paths; slice
3 depends on both. The private framework requires trusted routing. Each owner
verifies its own seam; main checks the cross-repository result.

### Binding contract and compatibility

The existing corpus version 1 has exactly `version` and `cases`; each case has
exactly `id`, `group`, `language`, `mode`, `support`, `rubric`,
`assessmentTurns` and `turns`. Required text remains nonblank and is preserved
verbatim. Groups, languages and modes retain their existing enumerations.
Case IDs remain unique without trimming or normalization.

A literal turn has only `message`, a nonblank string. A repeated turn has only
`repeatPrevious: true` and a string `suffix`, appears after turn one, and uses
the entire preceding visible assistant answer plus that exact suffix. Empty
suffix is valid. Null/boolean version values and booleans in assessment indices
are invalid. JSON numeric spelling does not change meaning: `1` and `1.0` both
denote version 1 or assessment turn 1. Assessment selections may be authored out of order; both boundaries
normalize them to ascending order without changing the caller's corpus object.
Other malformed types fail validation before capture/login or import output.

The producer already rejects unknown corpus/case fields and duplicate indices;
the importer already rejects empty selections and exact turn-shape mismatches.
Repair their intersection, including Python's boolean-as-integer version alias
and JS's mixed repeated turn with a non-string `message`. Do not expand receipt
validation, change summary semantics or migrate historical receipt data.

Both implementations independently validate the same contract. Their existing
test-owned inline fixtures are sufficient; public app CI must not require the
private submodule. Preserve existing ancestry, mapping, unsupported Quizzer and
incomplete/unstarted coverage tests. Hashes remain diagnostics, never source
support or anonymization evidence. No captured source passages enter Git.

### Test portfolio and work slices

| Consequential failure                                                         | Obligation and stable seam                                                           | Existing protection / missing evidence                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| A capture is admitted but cannot be imported, or assessment silently vanishes | Test obligation: extend existing; app validator and public framework importer        | Existing suites cover ordinary shapes; missing empty/duplicate/unknown/ambiguous variants    |
| Valid selection or repeat text changes between boundaries                     | Test obligation: extend existing; synthetic multi-turn import/capture                | Existing parent/source checks remain; add unordered assessment and empty-suffix preservation |
| Compatible-looking handwritten receipts hide producer drift                   | Test obligation: none for new maintained tests; one-time network-disabled round trip | Existing suites independently test each side; actual JS output supplies the missing proof    |

1. Producer repair. Route: main; tightly coupled public contract and proof
   design remain parent-owned. Paths:
   `apps/chat/scripts/tutor-trajectory.mjs` and
   `apps/chat/test/tutor-trajectories.test.mjs`. Start with focused failing tests,
   then the smallest validator changes. Acceptance: the existing suite covers
   the agreed valid/invalid variants without mutating authored input.
2. Importer repair. Route: trusted generic executor. Owned paths:
   `src/adapters/klicker_trajectories.py` and
   `tests/test_klicker_trajectories.py`. Start with focused failing tests, then
   repair only corpus validation. Acceptance: public import agrees with slice
   1 and existing receipt/coverage tests pass. Commit one coherent repair per
   repository. Both source slices arm simplifier and risk review for correctness,
   compatibility, data integrity and the cross-system seam.
3. Compatibility proof and delivery. Route: main; critical-path integration
   prevents delegation of the cross-language acceptance decision. Use existing
   synthetic transport/runner helpers for a temporary offline capture and import
   its untouched output; keep the temporary test/proof outside tracked files.
   Add a temporary, uncommitted test block in the existing
   `apps/chat/test/tutor-trajectories.test.mjs`, invoking `withRunnerScenario`
   and copying its untouched corpus/output bytes to
   `project/_local/trajectory-contract/` inside the callback before cleanup.
   Temporarily use UUID thread IDs in that synthetic helper; filter execution
   to this proof test with Vitest `-t 'offline producer import proof'`.
   Produce a complete run spanning development/reserved/control, literal and
   repeated turns and Tutor/Explainer/Quizzer, plus a turn-limited run with
   partial and unstarted trajectories. Scratch synthetic ledgers are allowed.
   Import each file using the existing Python CLI with no filter; assert exact
   user/answer text, ascending assessment selection, ancestry/source metadata,
   eligible Tutor/Explainer, unsupported Quizzer, incomplete and unstarted rows.
   Remove only this temporary instrumentation before committing and rerun the
   permanent app suite. No copied helper or maintained verification script.
   Check all tracked corpora with the existing validators. Update
   `evaluation/README.md`, the consolidation section of
   `project/2026-10-12-chatbot-evaluator-plan.md`, the current-direction section
   of `project/2026-10-01-tutor-prompt-quality-roadmap.md`, framework
   `examples/klicker/explainer-compression/README.md` and
   `project/2026-10-16-explainer-validation-plan.md` with the contract and
   compatibility impact. Add no module or dependency.

Verification uses Node 24.21.0 with existing dependency volumes and Python 3.12,
with external network disabled for local checks. Use repo-native formatting,
lint and focused tests; locked framework pytest/ruff run in hosted CI. No app,
DevPod, devrouter, browser or provider runtime is justified. Unchanged existing
test evidence is reusable. The temporary round trip exercises the real runner
and mapper with synthetic fetch only, not an application quality verdict.

### Delivery and subsequent gates

Commit and push only reviewed synthetic source/docs on the existing task
branches. Inspect staged and PR/MR text for secrets and real-environment data.
Keep both drafts, verify CI through supported watchers, inspect actionable
feedback and complete trusted integrated final review over both full diffs.
Public app tests run without the private submodule. This repair works with the
existing pinned framework for receipt readability. Full strict validation and
ascending import normalization require the repaired reader; landing that repair
and later updating the pin are separate human-controlled delivery steps.

After the source package, inspect the existing DeepEval saved-transcript path
and record the concrete zero-spend calibration prerequisites in the current
plan. Reuse existing metrics and manual rubric, preserve missing evidence and
exclude arm labels. No new scorer, wrapper, simulator, judge guard or experiment
format is authorized by this contract repair. Paid judging requires distinct
pricing/routing/admission qualification and budget; the $55/48-turn capture
option does not supply it. Phase 3 requires demonstrated unattended workflow
need and is not an automatic implementation instruction.

Terminal: coordinated drafts with compatible source, offline proof, resolved
actionable reviews and exact-head CI; report the next concrete gate. Recover
source by ordinary revert, leaving historical ledgers and the isolated baseline
untouched. Pause only for a material contract/risk/authority departure or an
exhausted required review/capability route, while finishing independent work.

## Progress

Planner: APPROVED after two rounds; accepted executable round-trip mechanics,
explicit ordering compatibility, single-owner slices and exact test/doc scope.
Optional opposing-provider plan challenge also approved. Slice 1 committed as
`90b132fee9`: the invalid-input regression failed before repair; all 25 trajectory
tests pass afterward, and 54 focused trajectory/guard/target tests pass offline.
Biome passes with existing warnings. Staged secret scan passed; the data hook's
existing synthetic-credential false positive was inspected and bypassed with its
documented override. No credentials or real data entered the diff.

Slice 2 committed as framework `0f41dfc`: 49 importer tests pass after nine new
variants failed against the old reader. A 19-variant cross-language matrix agrees
on valid/invalid inputs, including integral numeric JSON spellings. Receipt checks
are unchanged. Slice 3 produced actual JS runner
receipts offline: complete Tutor/Explainer/Quizzer and budget-stopped partial/
unstarted rows across all three groups. Temporary test instrumentation was
removed; permanent app tests passed again. The prior pinned reader imports the
untouched completed receipt file. The repaired reader's API and exclusive-output
CLI import both complete and stopped files, preserving exact text, IDs, ancestry,
source metadata, ascending selections and all planned rows.
No model/provider call, app runtime or real budget initialization occurred.

Current substantive app delta: 49 lines, excluding project artifacts and README;
this complete isolated compatibility repair extends the existing draft.
Initial source and offline verification are complete. App simplification and
slice review found no issues; scoped static analysis found none. Framework
pipeline 686449 passed formatting, lint and 414 tests. Framework slice review
and app hosted CI remain pending. Integrated final review identified integral
float indices in Python output and premature completion wording here. The existing
test reproduced the output-type defect; normalize those indices to Python ints.
Corrected-source verification and the same reviewer's focused follow-up remain
pending. Draft descriptions will carry final receipts only after completion.

Next delivery gate: land the coordinated reader repair, then reconcile the app
pin to its merged SHA with fresh CI. These actions need named merge/pin authority.
The zero-spend assessment preparation uses the existing saved-conversation
`ConversationalTestCase` and YAML `conversational_geval` path. Current
`outcome_achievement` parameters exclude METADATA, but an actual judge-request
serialization check, frozen manual disagreement criteria and a distinct capped
judge route/budget remain prerequisites. No scorer or judge guard was added.

## Generic-only framework ruling — 17 October 2026

The user requires everything merged into the evaluation framework to be generic
and potentially applicable to other use cases. An optional product-specific
adapter inside that repository does not satisfy this requirement. Renaming one
while retaining product policies would not satisfy it either. This supersedes
the earlier ownership decision and recommendation to merge framework MR 57 and
then update the application pin. Both drafts require ownership rework first.

The framework owns reusable evaluation contracts, planned-record coverage,
DeepEval metrics, judge execution and reporting. Domain choices must come from
caller-supplied data or configuration. Tests must demonstrate generic behavior
with synthetic inputs rather than assume named application tools or modes.

The application owns its capture protocol and receipt translation, ancestry and
source-mapping validation, tool requirements, supported modes, course corpora,
prompts, routing and spend admission. It should export the framework's existing
normalized saved-conversation format. This boundary does not require another
runner, script family or evaluation engine.

The active framework draft currently changes an application-named adapter,
tests and example corpus. Its importer hardcodes `KB_doc_query` and eligibility
for Tutor and Explainer. These are application policies. The adapter, tests,
example and README entry already exist on framework main, so revising only new
draft additions would leave the ownership problem in place.

The next coordinated package must put this translation and its fixtures under
application ownership, verify the replacement against the preserved synthetic
round-trip evidence, and leave only demonstrably generic changes in MR 57.
Identify callers and settle compatibility before removing the existing framework
entrypoint. Preserve captured evidence, controls, incomplete/unstarted coverage
and cost protections. Historical plans and Git history remain historical records.

This section records the binding direction; it does not approve deletion of an
existing framework entrypoint, merging, pin advancement, deployment, new paid
capture or paid judging. The implementation package and compatibility handling
must be resolved before that migration.

## Approved caller-owned import migration

### Approval summary

The user approved relocating the existing importer, tests and corpus into the
application, verifying the replacement, and then removing the framework's legacy
entrypoint. Approval mode: executable batch. Keep the existing two drafts and
their targets. Deliver reviewed source, offline compatibility evidence and CI;
keep both drafts. Merge, ready, pin advancement, deployment, real-ledger
initialization and paid target/judge calls are excluded.

Move protocol interpretation rather than reproduce it. Preserve corpus version
1, receipt version 2, exclusive output creation, exact learner text, ancestry,
source diagnostics, application eligibility and every planned result. The
framework consumes the same existing normalized conversation artifact. Its
metric mode selectors must accept caller-defined nonblank labels instead of a
built-in application mode allowlist. This extends accepted labels; existing
normalization, configured metric filtering and missing-mode failures remain.
No new evaluator, runner, package or application runtime is needed.

### Contracts, owners and slices

Execution mode: standard; model identity is unavailable. Full-path package for
the cross-repository contract migration. Main owns the boundary and final proof.
Primitive impact: reuse the existing conversation artifact and assessment
contracts; retire the consumer-specific framework entrypoint after its app-side
replacement works. No new product primitive. ADR 0001's transport/evidence
separation is preserved, with consumer-specific translation owned by callers.

Delegation Map: main owns slice 1 (app migration) and slice 3 (framework cleanup,
documentation, integration and delivery). A trusted executor owns slice 2
(generic framework label handling and its existing tests), independent of slice
1. Slice 3 depends on successful replacement verification. One planner reviews
this derived execution plan; migration risk and final review cover both repos.

1. App-owned replacement. Route: main; cross-repository relocation and public
   data inspection are coupled. Move the existing implementation to
   `evaluation/adapters/klicker_trajectories.py`, its suite to
   `evaluation/tests/test_klicker_trajectories.py`, and the authored example to
   `evaluation/data/explainer-compression/{README.md,corpus.json}`. Only adjust
   imports and execution paths; preserve semantic tests and all case objects.
   Add the relocated suite to the existing uv-based check in
   `.github/workflows/check.yml`, using pytest 9.1.1 (the existing framework lock
   version), without private submodule access. The runtime importer stays
   standard-library only. Acceptance: 49 migrated tests pass offline and actual
   preserved synthetic JS runner output imports identically through API/CLI.
2. Generic label handling. Route: trusted executor. Owned framework paths:
   `src/utils/utils.py`, `src/customization/custom_metrics.py`,
   `tests/test_gt_loader.py`, `tests/test_chat_export.py`,
   `tests/test_metric_definitions.py`, `src/evaluators/run_evaluation.py`, and the existing
   coverage test in `tests/test_run_evaluation.py` if needed. Remove the fixed
   Tutor/Explainer allowlist. Retain trimming/lowercasing, nonblank string
   validation, selector uniqueness and matching. Use arbitrary synthetic labels
   to protect configured inclusion/exclusion and planned-record preservation.
   Replace obsolete unknown-label rejection in both chat-export seams with
   caller-defined label acceptance. Acceptance: focused existing suites pass
   without provider calls; existing
   metric configs retain their meaning. No new config or dependency.
   Update product-specific mode errors in the runner. Unmatched configured labels
   remain explicitly skipped with `no_metrics` and null success, preserving the
   existing metric-exclusion contract rather than introducing another allowlist.
3. Retire legacy ownership and deliver. Route: main; integration boundary.
   After slice 1 passes, delete the framework importer, its relocated tests and
   example files. Remove the new product-specific framework plan from this
   draft; retain its useful run/assessment protocol in the migrated example
   README and app plans. Replace it with a short generic framework migration
   plan at `project/2026-10-17-conversation-import-boundary-plan.md`. Update
   framework `README.md`, `AGENTS.md` and ADR 0001 for caller-owned translation
   and the existing normalized conversation contract. Preserve historical plans
   already on main; do not clean unrelated product integrations.
   Update app `evaluation/README.md`, the current ownership/phase sections of
   `project/2026-10-12-chatbot-evaluator-plan.md` and
   `project/2026-10-01-tutor-prompt-quality-roadmap.md`.
   Acceptance: no active references to the removed importer remain; framework
   additions contain generic behavior/data/docs only. App commands work without
   the old module. Keep the current pin: the unchanged normalized output remains
   readable by the pinned framework, independently of the pending migration.

### Verification and recovery

Test portfolio: relocate the existing protocol suite for lossless translation
and invalid-input rejection; extend existing framework tests only for arbitrary
configured labels and retained inclusion/exclusion; replace/consolidate the two
chat-export unknown-label rejection tests with generic acceptance at those same
seams; reuse the existing planned
coverage test for failed/unstarted/unsupported/limited rows. No prose/corpus
content assertions, duplicate test framework or paid evaluation.

Run Python 3.12 and Node 24.21 checks in existing containers. Local checks use
network-disabled containers and existing dependencies. Reuse the preserved
complete/stopped synthetic producer receipts for exact before/after artifact
comparison, plus exclusive-output CLI invocation. Keep proofs under ignored
`project/_local/`; do not touch real receipts, ledgers or the isolated baseline.
Additionally consume the new app output through the pinned `d4ee03e` generic
conversation loader and preserved-capture evaluation path with model construction
and `evaluate` stubbed. Use a temporary extracted source snapshot, not a private
submodule initialization. A disposable ignored Linux verification environment
may install the existing frozen framework lock; test execution stays network-disabled.
Run focused app capture/guard tests, framework pytest/ruff, workflow syntax and
diff checks. Hosted app CI must execute the migrated suite without the private
submodule. No browser-only contract changes; no browser/runtime is justified.

Inspect source and staged data for secrets, personal and real-environment data
before each commit and description update. Commit coherent slices, simplify and
review substantive code, then obtain one trusted integrated final review over
both full branch diffs. Push ordinary task branches, update both draft descriptions
for the ownership correction and verify CI with one supported watcher per run.
Address actionable feedback within this batch. Terminal: reviewed coordinated
drafts, replacement proof and CI verified. Recovery is an ordinary source revert;
do not delete historical evidence or rewrite published Git history.

### Migration progress

User approval recorded. Fresh remote reads show both task branches ahead of their
targets without target drift. Planner APPROVED after adding both CSV export seams.
App replacement committed as `755a58783c`: importer byte-identical to the previous
framework draft, suite import-path-only adjustment, corpus unchanged. All 49 tests
pass offline with both existing pytest 9.0.3 and frozen pytest 9.1.1. Actual
complete/stopped producer artifacts match through API/CLI; exclusive output holds.
The pinned `d4ee03e` conversation loader and preserved-capture reporting path accept
the new app output with `evaluate` and model construction stubbed, network disabled.
All planned rows survive and only eligible rows reach the stub. The pin stays.
Framework generic-label edits pass all 379 tests offline and hosted CI. App
simplification found no useful reductions. Five automated review findings were
verified: reject boolean numeric aliases and malformed error-record shapes while
preserving integral JSON spellings and stale/null error-turn diagnostics. Nine
regressions failed before repair; all 59 importer tests pass afterwards. Actual
complete/stopped outputs still match the preserved normalized artifacts, so pinned
reader evidence remains valid. This tightening changes malformed input acceptance,
not corpus/receipt versions or valid capture output. The source risk review and
simplification follow-up found no issues. The integrated review's two documentation
findings are corrected: caller-owned experiment identity and the relocated runner
pointer. Final review and exact-head CI receipts are maintained in
[PR 6578](https://github.com/uzh-bf/klicker-uzh/pull/6578) and
[MR 57](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/57).
The subsequent sequence requires the app migration before framework retirement;
both remain draft until explicitly authorized otherwise. No framework pin change
is needed. No additional solution document is added: the durable ownership rule
already lives in ADR 0001, agent guidance and the application evaluation README.
Scoped static analysis ran 290 rules on two migrated Python files with no findings.
An ignored Linux verification environment installs the existing frozen lock only;
no runtime/dependency manifest, budget or actual model call changed. Advisory
external routing comparison skipped: private source/architecture scope and held
paid evaluation provide no eligible outbound task input.
