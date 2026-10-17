# Trajectory producer and importer compatibility

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
are invalid. Assessment selections may be authored out of order; both boundaries
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

| Consequential failure | Obligation and stable seam | Existing protection / missing evidence |
| --- | --- | --- |
| A capture is admitted but cannot be imported, or assessment silently vanishes | Test obligation: extend existing; app validator and public framework importer | Existing suites cover ordinary shapes; missing empty/duplicate/unknown/ambiguous variants |
| Valid selection or repeat text changes between boundaries | Test obligation: extend existing; synthetic multi-turn import/capture | Existing parent/source checks remain; add unordered assessment and empty-suffix preservation |
| Compatible-looking handwritten receipts hide producer drift | Test obligation: none for new maintained tests; one-time network-disabled round trip | Existing suites independently test each side; actual JS output supplies the missing proof |

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
Baseline: 24 app trajectory tests and 30 framework importer tests pass offline.
Slices 1 and 2 are next; slice 3 depends on both. Existing draft CI is green on
earlier heads. Required delivery: drafts plus exact-head CI, not runtime
acceptance. No source edits or paid evaluation have run in this package.
