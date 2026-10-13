# Pool-informed question generation for lecturers

## Approval summary

**Current direction, 13 October 2026:** generate useful new questions using
relevant existing questions before generation, suppress detected duplicates
before lecturer review, and replace discarded candidates within a finite run
budget. This replaces the earlier warning-only acceptance target and its proposed
immediate STG activation. The course graph continues to cover all course content;
the generation request supplies the focus, objectives, format, language,
difficulty and Bloom targets.

The existing immutable snapshot, source identity, similarity, calibration and
style-selection work is the foundation. Use a broad authorized corpus for
comparison and a small request-relevant subset for examples. Existing questions
provide style and coverage context; course evidence establishes correctness.
Questions that share a topic can still be useful and distinct. Semantic scores
nominate pairs for adjudication; the old warning threshold is insufficient proof
for automatic rejection.

The engineer owns refinement of [Klicker PR #6317](https://github.com/uzh-bf/klicker-uzh/pull/6317).
Keep it draft until the stronger contract is implemented and verified. Our side
owns the generic worker selection, duplicate admission, bounded replacement,
accounting and cross-consumer qualification. Shared interface decisions precede
implementation on either side. This document is the coordination source; no
parallel Klicker implementation is assigned to us.

This request authorizes plan and PR-description refinement. It does not execute
merges, deployments, flag activation or paid generation. Existing source receipts
remain useful but do not establish the new behavior. Completion requires a real
synthetic lecturer journey that exposes only accepted candidates, preserves
request intent and reports any shortfall honestly. The earlier USD 2 ledger and
unresolved reservations remain intact; a browser-triggered run needs its own
qualified allowance and enforcement.

## Execution details

### Verified baseline and reusable components

Klicker source baseline: `e24d1abcf6`; target `v3-ai`. Refreshed remote state is
12 commits ahead and 65 behind that target. Refresh and integrate deliberately
when implementation readiness requires it; this documentation change does not
merge target code. Generator source baseline: remote tip `9bb6593c50` of
`rs/exam-quality-p6-style-pool`; generator main is `dbf5e57`. These tips moved since
the previous deployment preparation. Prior final review does not cover those
additional changes.

| Existing component | Current behavior | Reuse and remaining gap |
| --- | --- | --- |
| `questionGenerationLibrary.ts` in Klicker | Selects recent active owned SC/MC/KPRIM records, capped at 500; pins a schema-2 comparison-only snapshot | Preserve authorization, stable identity, byte limits, hashes and recovery. Replace recency-only selection; supply eligible examples and trustworthy metadata. |
| `Element` and `GeneratedElementDraft` | Element has tags and optional reviewed difficulty; generated drafts may carry Bloom metadata | Reuse available, current provenance. There is no universal topic/Bloom classification for all library questions. Missing or stale metadata stays unknown. |
| Worker `question_library.py` and `question_blueprint_tasks.py` | Validate snapshots and pass explicitly permitted generation references into existing design/stem/final generation paths | Klicker currently grants no `example` permission. Existing conversion requires complete keys and at most five choices. Do not grant example use to every comparison record. |
| Worker `past_papers.py` and `quality_metrics.py` | Per-slot selection uses module, difficulty, Bloom and lexical relevance; caller-provided examples have generic quiz framing and source-aware style handling | Extend these existing consumers. Shared wire metadata currently lacks topic/Bloom/language selection fields; avoid a second selector in Klicker. |
| `semantic_distinctness.py` and existing review flow | Reuse stable comparison records, embeddings, candidate bands and overlap warnings | Add adjudicated acceptance and replacement in the maintained worker path. A warning acknowledgement must no longer admit a detected duplicate in the new mode. |

Relevant implementation seams in Klicker are
`packages/graphql/src/services/questionGenerationLibrary.ts`,
`questionGeneration.ts`, `questionGenerationArtifacts.ts`,
`questionGenerationDrafts.ts`, `packages/types/src/questionGeneration.ts`, and the
existing generation/review components. Worker seams are under
`lightrag_research/hatchet_workflows/` and
`lightrag_research/questions_generation/`. Extend those modules and their tests;
new services, indexes and permanent metadata migrations need demonstrated need.

### Product primitive impact

| Product primitive | Disposition | Contract change and owner |
| --- | --- | --- |
| Owned question and immutable pool snapshot | Extend | Klicker authorizes content and permitted purposes, exports selection metadata and coverage, and pins the exact input. Worker consumes it without a database connection. |
| Generation request and approved design | Extend | Preserve requested coverage and pedagogical targets while selecting examples and replacing rejected candidates. Klicker owns intent; worker owns execution. |
| Generated candidate and accepted draft | Extend | Worker records accepted/rejected/unresolved disposition before returning reviewable content. Klicker exposes and saves only accepted candidates. |
| Build attempt and cost receipt | Extend | Worker enforces one aggregate allowance across attempts, validates outputs and preserves lineage; Klicker settles once using the agreed billing outcome. |

### Lecturer workflow and usefulness

1. The lecturer chooses course evidence and generation targets, including an
   optional focus. Explain that eligible owned questions inform generation and
   duplicate screening. Use existing controls where possible; use a request-level
   opt-out for style examples while keeping comparison active in this mode.
2. Before producing candidate questions, pin the authorized pool and request.
   Plan source-grounded slots against relevant existing coverage. Prefer useful
   gaps, new applications or reasoning tasks within the requested objectives;
   existing coverage never excludes an entire topic automatically.
3. Select a few suitable examples per slot. Guide clarity, structure, expected
   reasoning and plausible distractors. Generate from course evidence, then check
   correctness, answer validity, focus/target alignment and novelty.
4. Replace rejected candidates internally, keeping accepted work. Show progress
   and counts without exposing discarded question text as review cards. The
   lecturer may still review the design; candidate stems must pass screening
   before the first screen that displays them for review.
5. The lecturer reviews and edits accepted questions, then saves selected drafts.
   Material edits to stems, choices or keys invalidate their screening status and
   require bounded revalidation before saving. Display partial completion and
   coverage limits when applicable; do not promise an absolute duplicate-free
   library or empirical difficulty accuracy.

Usefulness means source-grounded, correct, aligned with the requested objective,
format and cognitive demand, with plausible distractors and useful novelty. It
is measured separately from stylistic resemblance. The existing quality stack
owns these checks; prompt examples cannot substitute for them.

### Pool selection and metadata contract

**Comparison corpus.** Include authorized active, directly owned SC/MC/KPRIM
questions across formats, including drafts, review and ready states. Shared,
derived, archived and deleted content remains excluded under the existing
boundary. A topic, difficulty or Bloom mismatch must not remove a possible
semantic duplicate. Do not duplicate `ElementInstance` placement snapshots.

**Style examples.** From the authorized corpus, select only records explicitly
permitted for `example` use, with usable keys and supported representations.
Prefer READY records with reliable provenance; READY alone is not evidence of
correctness. Exclude unresolved quality defects and ambiguous keys. Unknown-key
or oversized-option records can still participate in comparison. Never infer
`reuse`, `update` or empirical `calibration` permission from ownership or example
permission; generated output remains new-only.

Klicker performs authorization and bounded candidate retrieval; the worker owns
one shared per-slot semantic ranking policy for DB and file inputs. Resolve
selection in this order:

- Hard eligibility: allowed purpose, usable format/key, explicit source scope,
  exclusions and configured byte/token limits. Same response format and requested
  language are the initial style-example policy; cross-format comparison remains.
- Relevance: requested objectives and focus, then topic or verified module
  alignment. Tags are useful signals, not proof of a course/module identity.
- Pedagogical fit: labelled difficulty proximity and Bloom demand, followed by
  quality/provenance. Bloom and difficulty remain separate dimensions.
- Diversity: avoid several paraphrases of one example, cover varied reasoning
  and distractor patterns, and use stable identity as the final tie-break.

Start with up to three examples per slot within a token cap. If suitable examples
are scarce, widen soft difficulty/Bloom preferences before relaxing relevance;
use fewer or no examples when necessary. Never silently import unrelated topics
or another owner's questions. Record selected IDs, scores/reasons, policy version
and fallback level so the run can be explained and reproduced.

Preserve source namespace, ID, revision and content hash. Add only the metadata
needed for selection: topic/tags or mapped objectives, language, Bloom and
labelled difficulty with provenance and mapping version. Reuse reviewed labels
and version-matching generation metadata first. Optional model inference must be
explicitly labelled and included in the budget; it must not mutate source
questions or masquerade as lecturer review. Empirical calibration additionally
requires its existing setting, scoring basis and sample-size context. This phase
does not query participant-level responses or introduce IRT calibration.

The current recent-first 500-record snapshot can miss older relevant questions.
First reuse existing permitted search/filter infrastructure and deterministic
selection, with a complete comparison corpus when it fits. For larger pools,
select a broad request-relevant comparison corpus independently of the example
subset, record eligible/considered/included counts and truncation, and qualify
recall against older duplicates. Keep an explicit coverage warning. A persistent
embedding index is deferred until measurements justify it; absence of an index
must not be presented as complete-library screening.

Freeze the comparison corpus and example candidates once per build. Before each
slot is generated, pin its chosen example IDs and selection policy; replacements
can select different examples only from that frozen input, recording the change.
Content hashes must continue to describe content, while the build fingerprint
also covers permissions, metadata and selection policy. Do not silently overload
`module_id`, `scope` or calibration fields with new semantics.

Both current worker models and request envelopes are strict. Agree a versioned
contract extension before adding metadata or execution policy. Preserve snapshot
v1/v2 and no-pool readers; deploy the compatible worker before the producer emits
the new revision. New strict behavior requires explicit worker capability and a
pinned policy; old snapshots must not gain example permission by default.

### Duplicate admission and bounded replacement

Use the existing canonicalization, embeddings and semantic comparison records.
Check against the frozen comparison corpus, other candidates in the batch, and
all accepted candidates retained during replacement. Reject repeated source IDs
or exact content matches deterministically. Use semantic retrieval to shortlist
likely overlaps, then a bounded adjudicator with the question, expected answer,
objective, evidence target and reasoning operation to distinguish:

| Decision | Treatment in the new mode |
| --- | --- |
| Exact duplicate or confirmed near-duplicate | Retain audit evidence, discard from the reviewable result, attempt a replacement if allowance remains. |
| Related but substantively distinct | Retain if other quality gates pass, even with high topical similarity. |
| Unresolved, checker unavailable or conflicting evidence | Quarantine from reviewable content; finish with an explicit shortfall/failure if it cannot be resolved within bounds. |

Do not turn the existing synthetic warning threshold (`0.79`) into an automatic
rejection threshold. Calibrate candidate retrieval and final decisions separately
on a labelled set of paraphrases, translations, equivalent numeric variants,
changed option order, different response formats and related-distinct reasoning.
Record false rejection as well as missed duplicates. The same topic, Bloom level
or answer value is insufficient for automatic rejection.

Screen planned stems before teacher stem review to avoid spending on obvious
repeats. Recheck completed questions after options, keys and repairs are final;
changing these can change the assessed task. Pool records and question content
are untrusted data, never generation or judge instructions. Prevent copying from
examples; the duplicate gate includes the examples themselves.

For requested count N, the proposed initial policy is at most **2N total
candidates**, with at most **two replacement rounds** and at most **three attempts
for any slot**, all also subject to one money ceiling, time limit and bounded
validator/repair calls. The earliest exhausted limit stops further work. These
are proposed test defaults, not measured optimal values or current behavior.
Generate replacements only for deficits. Preserve each slot's objective, format,
focus, difficulty/Bloom target and evidence scope. Carry rejection reasons and
avoidance references so a replacement tries a different angle instead of another
paraphrase. A final same-build check resolves duplicates across concurrent slots
before committing the accepted set; choose a deterministic survivor using quality
results and stable identity.

Persist attempt identity, reservations, candidate lineage and disposition before
external calls/acceptance commits. Hatchet redelivery resumes the same attempt;
it must not redispatch an ambiguous paid call or regenerate accepted slots.
Automatic replacement is part of the approved run budget, not permission for
unbounded workflow retries. Reserve worst-case costs for generation, embedding,
adjudication, validation, repair and provider retries. Preserve unresolved spend
exposure. Keep existing no-charge-for-failed-build behavior. Provider spend and
lecturer credit settlement are separate; partial acceptance must settle only
once and must not silently charge for rejected candidates. Agree how partial
results map to the current billing policy before activation.

If the cap is reached, return K accepted candidates and an N−K shortfall with
machine-readable reasons. The lecturer can retain the accepted subset or start
a separately authorized run. Never pad with rejected items or count placeholders
as successful questions. If K=0, report no acceptable results. The existing worker
asserts `len(questions) == requested`; both this boundary and Klicker artifact
validation need an explicit partial-result contract, not a removed assertion.

The strict result includes accepted candidate IDs, requested/accepted/rejected
counts, unresolved/shortfall reasons, comparison coverage, policy/input hashes
and internal audit references. Teacher APIs and save endpoints enforce accepted
status; hiding a card only in React is insufficient. Raw rejected questions stay
in restricted build artifacts, outside teacher review lists and exports.

The novelty claim is scoped to the pinned corpus. Before saving, Klicker checks
whether this build's accepted drafts changed or relevant library content changed
since pinning. A detected change requires bounded revalidation or a clear stale
state; it cannot silently imply a fresh whole-library check. Revalidation uses a
new recorded check input without rewriting the original snapshot. Initial scope
does not guarantee cross-build uniqueness under simultaneous independent saves;
make that limit explicit rather than adding global locks without a use case.

### Ownership and delivery sequence

| Owner | Work and boundary | Completion evidence |
| --- | --- | --- |
| Engineer — Klicker PR | Own #6317 application code: authorized retrieval, metadata projection and purpose grant, UI controls, pinned request, strict result parsing, accepted-only review/save, shortfall and billing handling. Preserve existing auth and snapshot recovery. | Actual TS snapshots accepted by the worker; endpoint enforcement, relevant UI interactions and saved-draft reload verified. |
| Our side — generator | Reuse current pool selector/style/calibration/scorer; extend the shared contract and implement pre-generation coverage, adjudication and bounded replacement in the maintained workflow. No parallel Klicker implementation. | Same behavior through injected DB snapshots and file-based quiz pools; durable attempts, budget and accepted-set invariants verified. |
| Our side — qualification and release preparation | Maintain cross-consumer fixtures, novelty/usefulness evaluation, exact-head worker review, image/rollout preparation and synthetic STG protocol. Coordinate with engineer's final head. | Comparable metrics, pinned source/image evidence and a joint end-to-end result; source checks reported separately from live acceptance. |

Contract coordination is a dependency, not two implementations. The engineer
owns the proposed request/result schema on the Klicker side; we implement and
review its Python counterpart together before either side activates it. This
plan update sends no message to the engineer and assigns no unsolicited review.

Implementation order after agreement:

1. Freeze request/pool/result semantics and synthetic examples, including unknown
   metadata, allowed uses, partial results, cost policy and old-version behavior.
2. Engineer implements pool projection and UI integration while our side extends
   shared selection and screening against those frozen fixtures.
3. Complete bounded replacement, idempotent accounting and accepted-only API/save
   enforcement; verify both adapters and legacy consumers.
4. Review both exact heads, deploy compatible worker before producer, enable only
   the synthetic STG actor, then execute the lecturer acceptance protocol.

### What can merge and what remains held

| Delivery | Recommendation and condition |
| --- | --- |
| Existing generator [!27](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/27) through [!33](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/33) | Foundation merge candidates independently of the Klicker refinement. All seven current heads have successful matching pipelines and are mergeable as inspected. Review the new changes since earlier review, then land bottom-up only under named merge authority, checking each retargeted layer. Merge does not establish the new strict behavior or authorize activation. |
| Generator [!34](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/34) and [!35](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/35) | Both current tips are ancestors of the integrated generator tip. Preserve one landing path; verify inclusion after landing and close superseded MRs only when authorized. They are currently mergeable; the previous conflict observation is stale. |
| [Klicker #6317](https://github.com/uzh-bf/klicker-uzh/pull/6317) | Hold draft for the engineer's refinement even though existing code/tests pass. Warning-only completion is no longer the requested product. Preserve the existing nullable snapshot migration and GrowthBook wiring. |
| Shared worker refinement | Our next implementation package after agreeing the contract. Reuse existing integration work; do not create competing code on active generator branches. Resolve the current owner before writing, then choose a follow-up against landed main or the agreed stack tip. No new stack topology is assumed approved here. |
| STG rollout and paid lecturer E2E | Hold activation until both refined components and the enforced test allowance are ready. Follow `v3-ai` → configured STG source (`v3-adaptive-learning` at last verification), with compatible worker first. PRD activation remains separate. |

The existing [comparison budget driver !39](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/39)
is a stage-test tool. It does not enforce the browser-to-Hatchet allowance and is
not a dependency for this new worker loop. The old ledger reported USD 1.23866106
accounted; that historical value neither proves current headroom nor grants new
spend. Do not repeat paid runs until the applicable allowance is established.

### Verification portfolio and acceptance

Extend the existing suites rather than duplicating identity, import, calibration
or similarity tests. The following are behavioral obligations, not prose or
fixture-content snapshots.

| Risk / behavior | Test obligation and primary seam | Acceptance evidence |
| --- | --- | --- |
| Unauthorized or unsuitable examples | Extend producer and shared selector tests | Other-owner/archived content excluded; unknown keys remain comparison-only; stale metadata is unknown; no empirical claims inferred. |
| Request relevance and pre-generation influence | Extend selector and real producer→worker fixture tests | Topic/objective, format and pedagogical targets affect chosen examples and gap planning before generation; missing labels and empty pools have explicit fallbacks. |
| False duplicate decisions | Extend semantic evaluation fixtures | Exact/near duplicates withheld; related-distinct reasoning survives; cross-format, multilingual and numerical cases scored with recall and false-rejection reports. |
| Replacement, budget and replay | Extend workflow tests with synthetic deterministic providers | Deficit-only replacement, at most 2N candidates and configured limits, unresolved reservations retained, resumed attempts not redispatched, accepted slots retained, correct partial counts. |
| Review and save boundary | Extend GraphQL/artifact tests plus browser E2E | Rejected/unresolved text absent from review responses/cards/exports; direct save refuses it; material edits and stale evidence require revalidation; shortfall survives reload. |
| Compatibility and generalizability | Extend existing DB/CSV/XLSX qualification | Equivalent normalized inputs select equivalent records; v1/v2/no-pool and comparison-only paths keep their declared behavior; new policy requires capability negotiation. |

Before paid qualification, agree an explicit success rubric on a held-out
synthetic set. Compare the baseline against the new mode with the same graph,
requests, models and allowance. Measure accepted useful questions per requested
question, duplicate leakage, false rejection of related-distinct items,
focus/objective/Bloom alignment, difficulty appraisal, distractor validity,
accepted yield, latency and cost per accepted question. Predicted difficulty and
Bloom fit remain appraisals until validated by appropriate observations. Report
sample size and uncertainty; one successful pair is functional proof, not a
quality claim. Starting rollout targets are zero known duplicates in the review
set and zero rejected/unresolved records admitted by API tests; semantic quality
must be judged on the held-out examples without tuning on those same cases.

The STG journey uses the synthetic lecturer and ready synthetic course graph:
prepare relevant/unrelated pool controls, request a small focused batch, inspect
selection receipts and internal rejected/replacement lineage, review only
accepted questions, save a subset and reload it. Observe a replacement and a
bounded shortfall through an isolated synthetic provider harness first; do not
alter production application code or manufacture paid failures to force them.
Real-model STG checks validate the actual application path; absence of a live
rejection event is reported as unobserved, not fabricated evidence. Restore
actor flag rules and temporary configuration afterward. Keep receipts and
synthetic drafts; deletion requires separate authority.

## Progress and review provenance

- Execution mode: solo, with main-session source investigation and plan
  self-review. This turn changes documentation only. Product-primitives,
  sliced-workflow and writing-for-agents guidance inform this revision.
- Existing source acceptance: both snapshot schemas passed actual TS→Python
  compatibility probes after control-character validation was corrected at
  `5db997597a`. At `e24d1abcf6`, 20 producer, 27 feature-flag and 26 lifecycle
  tests passed in focused containers. Hosted required checks, GraphQL/unit tests,
  full build and all eight Playwright shards now pass. The pending platform
  final-AI-review status is distinct from the previously user-approved self-review.
- Existing local browser evidence covers route rendering and reload, not this
  stronger accepted-only workflow. No full lecturer STG acceptance is claimed.
- Current generator pipelines verified at `0a117f9bda`, `737426fab4`,
  `8ef3cdf2c4`, `b6cf1b8362`, `330683c6bc`, `af4cb170a9`, `9bb6593c50`.
  All are open; none was merged during this refinement. Earlier receipts and
  superseded warning-only plans remain recoverable in Git history.
- Current terminal: publish this plan revision and align the existing PR
  description, then leave Klicker implementation with the engineer. The immediate
  next implementation step is joint contract agreement, followed by our shared
  worker package. No merge, live configuration, deployment or inference in this
  planning task. No new tests are needed for the documentation-only change. Main-session
  plan review checked ownership, compatibility, accepted-only boundaries, bounded
  spend and partial-result semantics; no blocking inconsistency remains. Source
  references and links were checked, with diff and staged secret checks required
  before publication. This is self-review, not independent review evidence.
