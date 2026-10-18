# Saved Explainer assessment qualification

## Approval summary

Current approved batch: repair automatic judge-gateway retries, verify the
synthetic HTTP entrypoint and CI, and deliver a draft PR against `v3`. The
gateway repair contract below extends the completed preparation authority;
paid execution, marking ready, merge and deployment remain excluded.

Use the framework's existing saved-conversation assessment to check whether an
Explainer preserves technical qualifications when shortening an answer. Application
capture, corpus interpretation and receipt translation remain application-owned;
all framework changes must be generic and usable by other callers. Reuse the
existing `outcome_achievement` ConversationalGEval metric at threshold 0.7 rather
than introduce a scorer, runner or simulator.

Approval mode: executable batch for readiness preparation, approved on 18 October
2026 after the Astra consultation. Update this plan and the existing quality
roadmap, inventory saved manual reference evidence privately, repeat the actual
assessment path offline on the merged framework, and prepare a frozen minimal
calibration protocol with a separate budget proposal. Finish with verified
readiness evidence and the concrete next paid-approval boundary. No provider
call, paid capture/judging, deployment, prompt apply, real-ledger initialization
or framework-pin advancement is authorized. Keep all earlier budgets unchanged.

Offline qualification has verified the actual judge-input path with an in-memory
model and networking disabled: conversation content, scenario and expected outcome
reach the metric, while case names, arm labels and receipt metadata are excluded.
This establishes serialization, not judge accuracy. Citation support remains
unassessed unless the exact passages supplied to the model are available.

Generic judge admission is merged in
[MR 61](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/61).
It bounds output, attempts and cumulative reservations before each request under
a caller-qualified route contract. The next milestone is calibration preparation,
not another framework implementation. Offline checks cannot establish actual
provider schema reliability or usage reporting; those billable qualification
attempts belong inside the later proposed judge budget.

## Existing contracts and evidence

### Approved gateway repair

The user subsequently approved a narrow caller-owned gateway repair through a
draft PR against `v3`. Set `router_settings.num_retries` and
`router_settings.max_fallbacks` to zero in `evaluation/litellm.yaml`. Extend the
existing launcher tests, rather than add an evaluator or proof runner. Use the
exact pinned gateway image with synthetic provider responses and networking
disabled to verify the real proxy configuration and HTTP completion entrypoint.
Require one upstream send on success and server failure, with the model,
reasoning setting, strict response schema and output bound preserved. The
unmodified retry defaults must reproduce amplification as a negative control.

This is one full-path repair slice because retry amplification crosses the
approved cost boundary. Main owns configuration, synthetic integration and
delivery; tightly coupled endpoint-test implementation stays with main. A
read-only worker can verify CI wiring independently. The feature-wide test
obligation is `extend existing`: protect one admitted request from hidden
upstream retries at the actual gateway seam. Existing launcher tests protect
credential transport but do not observe provider sends. No new dependencies,
framework changes, pin update, model switch or product primitive are needed.

Acceptance is focused container checks, the synthetic HTTP regression, scoped
review and CI on the draft head. Ordinary task-branch commits and push are
authorized. Merge, marking ready, deployment, real-ledger initialization and
paid inference remain separate gates. The existing budgets stay unchanged.
Finish this batch with the draft link and separate source, CI and zero-spend
entrypoint results; failed external checks must be reported without disguising
them as readiness.

Application baseline: merged
[PR 6578](https://github.com/uzh-bf/klicker-uzh/pull/6578), revision
`df493c6b7ed4d9718ccf5fafde4be9fa70f16c19`. The app-owned importer and corpus
are present on `v3`; the existing framework pin is `d4ee03e`. Generic framework
retirement is merged in
[MR 57](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/57)
at `ea02150a531739e7c74740c100af111a0996b4b2`, after the caller replacement.
The current normalized artifact works with the current pin. Merged framework
`bcc272813d9470782d1aa9da2341b7bce3f88908` includes the retirement and generic
admission. Its [post-merge pipeline](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/pipelines/687299)
passed all 469 tests, Ruff lint and formatting. Standalone qualification can use
that revision without changing the app pin. A later integrated pin update must
also reconcile the portable integration harness's exact revision check.

The frozen lock uses DeepEval 4.2.5. The selected profile is
`data/input/metrics/conversations.yaml`, not the default single-turn metrics file.
`outcome_achievement` uses ROLE, CONTENT, SCENARIO and EXPECTED_OUTCOME. Its existing
evaluation steps assess the complete exchange. `assessmentTurns` is diagnostic
capture metadata and does not select judged turns. Neither metadata exclusion
nor a valid schema establishes that a judge is calibrated.

The initial zero-spend serialization probe exercised the actual framework loader, metric
factory and SDK metric method on a synthetic four-turn case. Both the current
pin and then-pending framework head reached exactly one in-memory, schema-aware model
call with all selected fields present. Arm, case name, manual label, turn metadata
and unselected retrieval context were absent. The stub score has no quality
meaning. Source or profile changes require requalification; provider and async
transport behavior remain unverified.

Use current official
[DeepEval conversation-metric documentation](https://deepeval.com/docs/metrics-conversational-g-eval)
for intended API behavior; the installed locked source and executable probe are
the evidence for this version. Keep private receipts, prompts and any excerpts
under ignored `project/_local/`, outside public/shared artifacts.

## Approved preparation sequence

Execution mode: standard; exact solo-allowlisted runtime identity is unavailable.
Main owns private evidence, reference judgments, route qualification, plan edits
and final proof. A bounded trusted metadata search locates existing synthetic
receipts without reading answer bodies. The source package is already complete;
this batch adds no framework code, maintained runner, scorer or proof script.
The existing `project/` directory remains the sole artifacts root. Detailed
evidence, hashes and frozen manifests stay ignored under `project/_local/`.

1. Reconcile source milestones in this plan and the existing quality roadmap.
   Acceptance: source merge/CI, app pin and unproven quality are separate facts.
2. Inventory preserved Explainer development/control captures and their original
   manual criteria. Privately verify clear preservation and meaning-changing
   loss examples; exclude missing or ambiguous references from hard labels.
   The six authored examples are the concise control, NULL/non-null regression
   and four inspected reserved examples; authorship is not captured behavior.
   Acceptance: the private index classifies each actual initial answer, revision
   and criterion judgment as available, missing or ambiguous, with provenance.
   Freeze only defensible captured references; a missing preservation/loss pair
   limits the pilot rather than permitting labels for unrun authored examples.
   Missing source passages remain unassessed. Do not create new answers.
3. Repeat the normalized-artifact loader, metric factory and real locked SDK
   metric path on the merged framework with networking disabled. Use synthetic
   fakes at the request boundary and temporary synthetic ledgers only. Observe
   actual judge prompts, bounded requests, durable reservations and refusal after
   exhaustion; exercise sync and async paths selected for the protocol.
   Require both guarded sync and async paths at `bcc2728`, replacing only the
   outbound client. Record sends, committed reservations, exact output limit,
   route/model/options binding, zero retry settings and selected judge fields.
   Fake responses exercise schema parsing and raw usage validation. Force
   exhaustion and prove the refused attempt adds zero sends. Verify labels and
   unselected metadata remain absent from judge prompts. Producer output must
   prove execution with no networking or provider credentials. Fake scores have
   no quality meaning.
4. Freeze the smallest existing calibration set, original criteria, unchanged
   threshold, exact execution profile and repeated subset. Research the existing
   judge route's current official tariffs, context/output limits, cache policy,
   retry/fallback behavior and fees. Propose an allowance covering qualification
   calls, internal metric subcalls and uncertain failures before any first paid
   send. Unknown route identity or unsupported bounds block paid readiness;
   finish independent preparation and name the missing evidence.

The local judge gateway config uses `drop_params: true`. At the initial
checkpoint, output-bound forwarding was unresolved; the approved follow-up
verified it offline and exposed retry amplification instead. Before any first paid call, require
authoritative deployment/model identity, applicable tariffs and fees, enforced
output bounds and retry/fallback contracts. Paid probes may observe schema
handling and usage reporting only after those independent assumptions are
qualified. A probe cannot justify the allowance for its own first call.

Freeze available evidence, criteria, threshold and repeats independently of
unresolved route fields. The preparation terminal permits a conditional proposal
with each exact missing fact and dispatch prohibited until resolution and
explicit approval. Always select `conversations.yaml`; the app wrapper's default
single-turn profile is unsuitable. Small paid samples cannot establish general
provider reliability.

No runtime stack is needed. Reuse frozen container dependencies, existing
framework entrypoints and repository checks. A pin update is a later application
integration action, not a prerequisite for standalone qualification. Do not
change metrics or thresholds to compensate for a failed calibration.

## Calibration contract to freeze before judge execution

### Approved zero-spend compatibility and route follow-up

The user approved this follow-up after the preparation checkpoint. Main owns
the preserved evidence, compatibility derivation, Azure metadata inspection and
final proposal. A trusted read-only worker owns static gateway/dependency mapping.
Use the same branch and plan; no framework or application contract changes are
needed for a one-time private compatibility artifact.

Preserve the original legacy receipt and version-one manifest byte-for-byte.
Check its capture-time corpus hash, original selected case, completed status,
planned/completed/submitted counters, unique arm/model and contiguous repeat-zero
turn pair. Derive missing summary identity/count fields only from that evidence.
Project turn records onto the existing strict importer fields, retaining excluded
legacy diagnostics in the untouched original. Record every derivation, exclusion,
input/output hash and provenance limit in a separate version-two manifest.
The unchanged strict importer must accept the derived artifact. The merged
framework loader must accept both references with exact original content/rubrics.
Keep the original manual judgments separate from judge input and do not recapture.

Inspect the existing Azure deployment through read-only management metadata,
using the approved Infisical mapping without printing or persisting its values.
Bind model/version, region and SKU to current official tariffs. Examine the exact
pinned gateway's forwarding, retry/fallback and cache behavior with synthetic
request-boundary fakes and networking disabled. Record capability gaps instead
of replacing the route or changing gateway configuration. Temporary preparation
code stays outside maintained source; all evidence remains ignored.

Finish with a reviewed private protocol and a final conditional judge-budget
proposal. Missing route access or unsafe forwarding blocks only paid readiness;
finish reference verification and report the exact remaining gate. No provider
inference call, real ledger, pin update, prompt apply, merge or deployment is
authorized. This is evidence preparation, not a new evaluation implementation.

Use existing saved development/control trajectories and their original rubrics.
Freeze the exact input manifest, selected metric/profile, SDK/model/route,
criteria, thresholds and requested repetitions before examining judge output.
Keep answers, criterion-level manual labels and their provenance private. The
judge receives the rubric and admissible evidence, never arm labels or expected
manual scores. Do not rename cases or edit captured answers to influence scores.

Retain per-criterion manual 2/1/0/U judgments with answer excerpts. U means missing
evidence and cannot become a pass. Record first-answer failure separately from
shortening failure; an absent initial answer leaves the revision unassessed.
The existing scalar outcome metric does not reproduce the manual ordinal rubric
or isolate turn two. Compare verdicts and reasons against every essential
criterion; keep that limitation explicit rather than claim equivalent scores.

For this exploratory comparison, every original rubric criterion is essential
unless the frozen authored rubric already marks it optional. Keep the original
criterion meanings. The manual conversation verdict is fail if any essential
criterion is 0 or 1, unassessed if none fail but any is U, and pass only if all
are 2. Compare the metric's existing threshold decision with that verdict;
unassessed rows never become true positives or negative reference labels.

Freeze these exploratory acceptance rules before any paid judge call:

- A judge pass on a manually established essential-criterion violation is a
  false pass and blocks unattended acceptance.
- Every pass/fail disagreement receives manual adjudication as judge error,
  reference-label error, rubric defect, ambiguity or instability. Do not adjust
  thresholds to fit observed results; a label correction invalidates comparisons
  that already saw it.
- Missing or incomplete cases, unsupported modes and errors remain in planned
  coverage and are reported separately from assessed decisions.
- Citation correctness requires the actual model-visible passages and citation
  mapping. Hashes and retrieval success alone leave that axis unassessed. The
  current outcome metric does not select retrieval context. Any emitted citation
  with missing support evidence leaves overall quality acceptance inconclusive,
  even if the outcome metric passes. Do not invent a citation requirement for an
  answer whose original contract does not require one and which emits none.
- Development controls and inspected reserved examples are not blind holdouts.
  Small-sample calibration cannot establish course-wide accuracy or learning gains.

With admission merged, separately qualify exact judge routing, pricing,
schema reliability, output/retry bounds and cache behavior. Propose a distinct
incremental judge budget from those bounds. The optional $55/48-turn capture
allowance is not judge authority and must not be repurposed. Later paid approval
must name inputs, metrics, repetitions, cap, stop conditions and evidence custody.

## Progress and next gate

Offline serialization qualification and source audit are complete. No new
evaluation implementation or maintained proof script was added. Main retains
the executable proof results privately; a read-only child independently inspected
metric selection and judge transport. The request-boundary admission requirement
above corrects the child's suggestion that a gate around `evaluate()` suffices.

Post-merge codebase CI passed on `df493c6b7e`, including all 69 importer tests;
unit and locale checks also passed. Its browser run was cancelled by a newer
`v3` push; all eight browser shards passed on successor `27421631db` in
[run 39124771867](https://github.com/uzh-bf/klicker-uzh/actions/runs/39124771867).
The intervening diff changes CI and documentation only; evaluation files are unchanged. The
branch-wide SonarCloud security/reliability gate remains red as it already was
on the preceding `v3` revision. The scanner workflow succeeded; that does not
make its external quality gate pass. The new Python importer is outside the
configured scan scope, so dedicated test and review evidence covers it.

The user merged framework
[MR 57](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/57).
Its exact merged revision `ea02150a531739e7c74740c100af111a0996b4b2` passed
[pipeline 687213](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/pipelines/687213).
The producing job ran all 379 tests; Ruff lint and format also passed. This is
post-merge evidence, separate from the earlier MR-head pipeline.

The ownership migration and generic judge-admission source milestones are
complete. [MR 61](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/61)
merged as `bcc2728`; its post-merge producer ran all 469 tests and passed Ruff.
The app pin remains `d4ee03e`. Source is not a calibrated quality result.

The Astra consultation recommended a bounded pilot proposal, standalone merged
framework qualification before any optional pin update, and a budget that also
covers billable provider qualification. The user approved this readiness batch
and requested a native goal. The derived preparation plan passed the same Astra
planner after one focused correction covering falsifiable guard proof,
first-call pricing prerequisites, captured-reference provenance and a conditional
terminal. The report is retained under ignored `project/_local/reviews/`.

Readiness preparation has reached that conditional terminal. A standalone checkout
at `bcc2728` passed the actual loader/factory/locked-metric/guard proof in sync
and async mode, with committed-before-send reservations, the exact output bound,
zero retries, schema/usage checks and no extra send after exhaustion. Temporary
synthetic ledgers and read-only frozen dependencies were used with networking
disabled. No maintained proof script or application runtime was added.

The private evidence index and input manifests preserve original answers,
rubrics, manual judgments and hashes. The approved follow-up resolved legacy
compatibility through a provenance-bearing private projection. The unchanged
strict importer and merged framework loader accept both references; exact
content and rubric checks passed. Original receipts and the first manifest are
unchanged. Conditional sibling revisions and unrun authored examples are not
promoted to independent complete trajectories or hard reference labels.

The private protocol proposes a separate US$8 judge-only cap, eight attempts at
US$1 reserved per attempt, including provider qualification and calibration.
The existing deployment and tariff binding were checked privately. The exact
pinned gateway's network-disabled wire replay preserves the output bound and
strict response schema but reveals retry amplification on a synthetic server
error. The approved repair now sets retries and fallbacks to zero in the actual
configuration. Its pinned-image proxy test loads that configuration and calls
the authenticated HTTP completion endpoint with synthetic provider responses.
Success and HTTP 500 each produce one upstream send; removing the settings
reproduces three sends on HTTP 500. Schema, reasoning and output bounds survive
forwarding. The standalone launcher suite passes all ten tests with no skips
inside that image and no networking. Framework implementation is unchanged.
Detailed arithmetic, compatibility provenance, limitations and producer results
remain ignored under `project/_local/calibration-readiness/`.

Existing manual-verdict and citation-contract review remains applicable. The
metric and threshold remain unchanged. No provider call, real ledger, pin
advancement, prompt apply or deployment occurred. Any new legacy normalization,
route, evidence, scope or cost departure returns to the user before dependent
execution. The compatibility/route follow-up was approved and completed as
qualification evidence, with the gateway defect explicitly held. Paid work
remains a separately named approval after its source repair; calibration and
broad chatbot-quality acceptance are still outstanding. The source repair is
published in draft [PR 6603](https://github.com/uzh-bf/klicker-uzh/pull/6603).
Its checks and review reports are the exact-head delivery evidence; draft
publication does not establish CI completion or authorize later gates.

Gateway slice: committed as `7960b6edea`, 157 substantive added lines across
configuration, the existing test module and its existing CI step. Test delta:
one regression added; no tests removed. Forty-three focused CI-contract tests,
Ruff lint/format and the focused Opengrep scan pass. Host-stdlib mode passes
nine tests and intentionally skips the image-only regression; CI separately
requires the complete image suite. Browser screenshots do not apply to this
nonvisual gateway change. A deliberate `v3` integration at
`00a1906405669a38c9caf683641d0f1e6e392b6c` brings the current CI contracts into
the branch before draft verification; unrelated target changes are not part
of this repair. The approved implementation plan passed one Astra planner
round. The slice risk review passed with no findings; the dedicated simplifier
found no justified net reduction. Integrated final review and hosted checks
continue at the draft boundary, with reports retained privately. The package
contains 166 substantive added lines including the existing solution update.
It introduces no new evaluator implementation or source module.
