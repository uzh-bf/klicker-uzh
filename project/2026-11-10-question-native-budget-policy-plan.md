# Connect application question builds to native budget admission

## Approved execution summary

The preflight found that Klicker reserves its fixed lecturer credits but sends no native provider-dollar policy to the shared worker. This blocks a genuinely bounded paid quiz smoke through the product. Propose one source-only application package connecting the existing worker `budget_policy`, without adding a second ledger, model proxy, public API field, UI control or financial table. The user approved this financial-contract extension on 10 November 2026 (message 01a1c602-6ed7-7ff2-accd-11a54c3306b3).

For new question builds only, read an optional server-owned `KB_QUESTION_NATIVE_BUDGET_POLICY` JSON setting. When configured and valid, record an explicit server-owned native budget mode for every new build and snapshot a configured canonical worker-compatible policy inside the existing build configuration JSON before a product reservation or provider dispatch. Preserve the snapshot for that build's whole lifetime. Leave the normalized user-request configuration hash and idempotency semantics unchanged; bind the budget to the native start-manifest hash. An idempotent repeat/race/retry uses the winning persisted snapshot, never the current environment template. Persist no secret. No DB migration is needed.

An absent setting preserves the existing unbudgeted contract and omits the new native field exactly. A malformed configured policy blocks a new question build before reserving lecturer credits, uploading input or dispatching a provider event; it must not disable flashcards or rewrite historical builds. Historical rows without native-budget metadata remain legacy. New unbudgeted rows have an explicit unbudgeted mode. A budgeted marker with missing/null/invalid policy, an unknown mode or malformed native metadata is rejected before reservation/dispatch/evidence acceptance. This detects incomplete policy metadata, not an adversarial rewrite of the entire database row. A budgeted build retains its snapshot after configuration is removed or changed. A corrupt stored policy blocks further dispatch/acceptance rather than dropping the budget or reconstructing it from current settings. Server policy never comes from the GraphQL/client request. The source batch does not configure or activate any cap in any environment.

Approval covers implementation, focused verification and mandatory checks in one isolated compiler, one independent source review, ordinary non-force task push/draft PR to `v3-ai`, and required current-head CI. No paid question generation, real application/DB/cloud writes, live configuration, ready/final-review trigger, merge, deployment or deletion is included. Ordinary hosted CI and automatic draft review may use repository resources/model quota; their invoice is unknown. The actual user approval accepts this ordinary automation; this delivery is not described as zero-cost.

Terminal: exact reviewed source, zero-provider contract evidence and required CI pass on a draft PR, or a concrete bounded failure with preserved artifacts. Proposed nonrenewing four-hour window starts at the first source edit. Allow at most two source candidates, one focused review correction round and one justified transient CI retry. A deterministic source failure consumes the remaining correction candidate; it never resets budgets. A deadline preserves running external jobs and reports the remaining state.

## Existing source and owner

Application repository `uzh-bf/klicker-uzh`; target `v3-ai`, refreshed to `48c037e5e963378ce4628380c478ea7eb34bd928`; its additional graph-result fix leaves the named budget paths unchanged. Old fixture worktree stays untouched. Intended new task worktree `/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/question-native-budget-policy`, branch `enhance/question-native-budget-policy`. Verify current target and worktree ownership before creating it. No force push or default/protected push. Main retains decisions, integration, review, CI and the original active native goal.

The published worker at `07ebb8130b9d4b8641df094d10181c01cde16145` already accepts `QuestionBudgetPolicy`: schema_version 1, positive decimal-string budget_usd, canonical per-token price_ceilings prompt/completion strings, positive bounded integer max_output_tokens. Its durable exclusive build ledger counts settled/pending/unresolved exposures and refuses uncertain redispatch. Budget-only accounting preserves native limits by rejecting requests outside policy rather than silently reducing fidelity. Do not change generator source, prices, models, checks or recovery policy in this package.

The application currently stores normalized caller configuration in `ElementGenerationBuild.configuration`. It reconstructs the start payload both for initial/resumed dispatch and for plan evidence; all paths must consume the same optional snapshot. Its explicit question retry creates a new dispatch attempt for the same build ID, so no new native budget, cap or ledger identity may be created. The durable worker ledger location is also part of the bound budget identity. For budgeted builds, compare the persisted output container/build prefix with the proposed runtime destination; reject any drift before retry-credit reservation, upload, dispatch or evidence acceptance. Reuse the persisted destination in the native payload and provenance paths. Do not relocate the same build to a new ledger. Legacy coordinate behavior remains unchanged. Product retry reservation/settlement remains the existing separate quota behavior. Unknown native exposure remains held by the worker.

## Primitive impact and contract decisions

| Primitive | Disposition | Contract and ownership |
| --- | --- | --- |
| Question build | extend | Snapshot one server-owned optional native policy before initial reservation; preserve it across every lifecycle path. No client-chosen caps or routes. |
| Lecturer quota spend | reuse | Fixed product credit reservation/settlement remains authoritative and separate; no price/currency/counter changes. |
| Native build-budget ledger | compose | Send existing worker policy with the same immutable build ID/manifest binding. Do not add a parallel ledger or bypass unknown-exposure holds. |
| Generation result/provenance | reuse | Complete/partial/failure and current content/receipt admission stay unchanged; payload/hash reconstruction includes the frozen budget when present. |

Extend existing ADR0013's distinction between product quota and optional native budget rather than create another financial primitive or ADR. Update the existing domain documentation's cost-boundary paragraph. No UI change or new browser interaction is proposed; retain existing caller/browser evidence outside this server contract.

## Allowed source surfaces and sequence

Only these existing production surfaces are expected:
- `packages/graphql/src/services/questionGenerationConfiguration.ts`: parse/validate canonical server policy without adding it to client-normalized configuration. Preserve exact decimal-string wire units; reject nonfinite, negative/zero-invalid, unsupported and unbounded values under worker semantics. Existing matching unknown field/strictness behavior must be retained.
- `packages/graphql/src/services/questionGenerationRuntime.ts`: extend the native start payload's type with the optional worker policy contract; no shared runtime constructor/configuration change affecting flashcards.
- `packages/graphql/src/services/questionGeneration.ts`: snapshot for a new build, retain existing request-hash idempotency and winning-row behavior, and feed the persisted mode/policy and bound ledger coordinates to all start-payload/provenance reconstruction and retry paths. Reject runtime output-container/prefix mismatch for budgeted builds before retry credits or other side effects. Question-manifest canonicalization must match the pinned Python worker for policy route-key ordering/defaults/decimal normalization; do not change the shared canonical helper or unrelated hashes. Local persisted-server metadata may extend the existing JSON shape; no public GraphQL input or shared browser configuration type changes.
- `turbo.json`: include the new server setting in globalEnv, preserving existing invalidation and secret handling.
- Existing tests `questionGenerationConfiguration.test.ts`, `questionGenerationLifecycle.test.ts`, `questionGenerationRuntime.test.ts` and, only if the actual provenance caller cannot be exercised there, `elementGenerationCompletion.integration.test.ts` (the only conditional extra path; trigger is demonstrated missing caller coverage).
- Existing `docs/adr/0013-klicker-reserves-and-settles-graph-cost.md`, the cost boundary in `docs/domain-model.md`, and new task plan `project/2026-11-10-question-native-budget-policy-plan.md` in the new branch. No new module, test file, dependency, migration or production abstraction.

After approval, create that worktree/plan, implement one coherent candidate and validate before external delivery. Stop for a material behavior/ownership/schema/data-boundary change rather than widening this scope. Routine mechanical decisions stay with main.

## Verification portfolio

1. **Configuration admission.** Extend the existing configuration suite: optional absence; valid exact worker shape; malformed/unknown or invalid amounts, route keys and output ceilings; no parsed-policy leakage into public request normalization. A configured invalid policy causes zero product reservation/upload/provider dispatch for a new build. Do not invent a default USD amount or tariff.
2. **Frozen lifetime and race.** Extend lifecycle tests with the actual start service and in-memory synthetic DB boundary: policy A snapshot survives environment policy B/removal/invalidity, duplicate/racing idempotent submissions use the persisted winner, crash recovery does not duplicate a dispatch, and retry preserves build ID/native cap. Historical metadata absence remains legacy, while new unbudgeted mode is explicit. Removing/nulling policy from a budgeted row rejects before reservation/dispatch/evidence acceptance. Test runtime output container/prefix drift on resume and explicit retry: no upload, credit reservation, provider event or second ledger may occur. Keep one genuine legacy retry control.
3. **Actual wire and provenance.** Capture the actual TypeScript start builder output and compare its canonical start-manifest digest with the pinned worker schema/hash through a zero-network contract harness in the declared compiler, using its locked Python oracle and test-owned synthetic graph refs. Require exactly these two independent protocol controls: (a) one budgeted vector combining multiple mixed-case route keys whose locale/code-point order differs, omitted worker policy defaults and a decimal string normalized by the worker (for example budget_usd `+5.00` normalizes to `5.00`); (b) one vector with no budget_policy that reproduces the legacy digest. Compare both against actual `QuestionBlueprintInput.model_validate` plus `manifest_sha256` from pinned worker source, retain the oracle revision and normalized bytes/digests, and exercise the real TypeScript builder/reconstruction. A single-route, all-defaults-explicit, already-normalized example cannot satisfy this requirement. Extend existing test files with these machine-protocol vectors; no new fixture controller or test file. The initial, resumed and provenance-reconstructed payloads must agree. Reuse the unchanged worker ledger's existing before-POST denial, unknown-exposure and all-stage tests; do not claim a new paid provider or deployed proof from those tests. Price ceiling strings are per token, not per million: conversion must never occur silently at this seam.
4. **Credit/consumer compatibility.** Reuse/extend existing admission and denied-rollout controls, partial-result/provenance checks and flashcard regression coverage. Product reservation/settlement semantics do not become provider billing. Do not assert native invoice enforcement from a mock or credit deduction.

Tests assert state, side effects, machine protocol and immutable policy identity, not question prose. No question is generated and no real DB, cloud store or paid provider is contacted by local qualification.

## Runtime, review and delivery bounds

Propose one isolated compiler `klicker-question-budget-policy-checks-20261110` with image `node@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40`, a 12GiB memory/6CPU limit and exact repository Node/pnpm pins. The prior task proved this image/cache path; verify source labels and use retained cache `klicker-partial-result-pnpm-20261102`. Provision only repository-declared uv0.11.12/Python3.12 and the pinned worker dependency lock inside this compiler for the offline native schema/hash oracle; mount a read-only exact-source worker snapshot, not real artifacts or credentials. Never install tooling on the host or start an application/DB for these unit/contract checks. It has no application service, external provider key, published host port or database. Run repository-declared builds, type checks, formatting, lint and dependency/identity/privacy/secret gates there or on the host according to their native ownership; preserve every exit status. Stop it and verify stopped; retain its source/cache/artifacts. No container/volume removal or broader Docker cleanup.

Use one configured independent final reviewer through the existing subscription route, all applicable financial-integrity/security/architecture/correctness lenses on the frozen exact source. One same-reviewer focused correction is allowed. Native source-model work consumes the existing subscription allocation; no extra API credentials or paid question call. Public draft delivery may trigger ordinary automatic draft review and required CI. No human reviewer, comment or extra agent-triggered hosted review is included. Screenshots are not applicable because no rendered/browser contract changes; actual new browser behavior would require reassessment.

Database-backed completion coverage, if armed by the named missing-caller trigger, executes only in the existing ordinary `test-graphql` job under `test-graphql.yml` using its disposable marked synthetic PostgreSQL. Preserve log/receipt proof that the new case executed; do not count an unavailable or skipped case as a pass. All local proof uses the compiler described above. An unavailable Python oracle or CI DB runner leaves that required proof incomplete at the bounded stop.

Planning-stage verified evidence: the current runtime output container/prefix is reconstructed in dispatch and provenance while the native ledger path derives from that output. A direct synthetic key-order probe also demonstrates that `Azure/...` and `azure/...` order differently under localeCompare and code-point order. Both are source-bound hazards, not observed production losses. Configuration projection already uses an explicit public view, so the server snapshot need not add a UI/API output field. These facts explain the extra identity/hash tests without claiming completed implementation.

Before each approved commit inspect exact staged paths, every hunk, secrets and real personal/production-derived facts. Hooks remain blocking; use equivalent container checks only where host/container split requires it, with explicit identity/secret gates. Ordinary push and draft PR follow only after applicable verification. Actual exact-head CI and source review must pass before reporting the source batch delivered. A failed reviewer route follows bounded in-scope continuity, not paid API fallback or repeated reviews.

## Guarantees and residual holds

This connection would qualify opt-in native admission under its frozen reservation/price assumptions. It does not create an upstream-wallet or universal invoice guarantee; provider billing terms, actual routes, request limits, retries/overshoot and receipts still need qualification before spending. No environment is enabled and no old ledger/reservation/cap is reset. The proposed USD5 staging smoke remains held. General first-draft quality, deployed Klicker save/settlement, full accepted Finance I exam and checked local course-team package remain unfinished.

## Approved slices and review

Boundary owner: main session. Full-path, single cohesive server financial-contract package; no stack or new product capability. Source production changes remain in the named existing modules. The plan commit precedes one coherent implementation candidate; a single correction candidate may follow required review or deterministic CI feedback. No new module, dependency, migration, test file or runtime service.

1. Preserve optional admission and the immutable build lifetime: configuration parser, server-owned mode/snapshot, dispatch/retry/output fencing and provenance. Earliest proof is existing synthetic lifecycle tests showing invalid policy has zero credit/upload/provider side effects and a frozen policy survives changed environment settings.
2. Qualify native serialization and caller behavior: exact locked Python oracle for the joint normalization/order vector and legacy control, lifecycle/reconstruction tests, maintained compatibility evidence and existing domain/ADR updates. No SQL fixture change unless the declared missing-caller trigger is reproduced.
3. Freeze the coherent candidate, run required checks and privacy/secret gates, independent final source review, ordinary task push and draft PR, then exact-head required CI. Reuse equivalent verification and stop the exact compiler after its final check. Terminal receipts stay ignored; no receipt-only followup commit.

Planning critique: independent native planner initially requested ledger-destination fencing, canonical hash parity, explicit mode metadata and declared oracle/SQL runners. All were verified and incorporated. Its sole focused review flagged an omitted joint vector; main inserted and verified the explicit joint and legacy controls. The last insertion did not receive another model pass. This is completed critique with main dispositions, not an independent APPROVED verdict. Final implementation review remains required.

## Progress

Root outcome: reliable initial question generation, delivered through Klicker with truthful review/save/credit behavior; broader native quality and complete accepted exam remain incomplete. This package enables bounded future product evaluation through the existing worker ledger. Source tests cannot prove deployed enforcement or question quality.

Authority: actual user approval above covers this finite source/review/draft-CI batch, including ordinary automation's unknown cost. Live settings, paid question generation, real application/cloud writes, ready, merge and deployment remain separate.

Current status: the optional server policy, frozen metadata, output fencing, shared dispatch/provenance reconstruction and compatibility tests are implemented in the approved paths. No new module, dependency, schema or migration was needed. The primary checkout and old fixture worktree are preserved.

Terminal: exact-head source review and required CI pass on the draft PR, or bounded incomplete evidence. Four-hour deadline starts with this plan creation and never renews. Aggregate limits: two implementation candidates, one focused reviewer correction, one justified transient CI retry. One plan commit is preparation, not an implementation candidate.

Native oracle preparation found a pre-existing worker/application mismatch: the pinned worker includes the optional question-library null default in its manifest hash, while the historical caller omits it. Preserve historical metadata-absent reconstruction exactly. The explicit metadata on new builds selects current worker defaults for both budgeted and unbudgeted manifests, while leaving unbudgeted wire payloads unchanged. Verify current-worker budgeted and no-budget controls plus an independent historical hash stability control. This is part of the approved normalization/default compatibility contract, not a change to old evidence or acceptance verdicts.

Local verification: five focused configuration/lifecycle/runtime/artifact suites pass (231 tests), including flashcard compatibility. Actual TypeScript budgeted and unbudgeted payload hashes match the pinned worker under locked Python dependencies; a third control preserves the historical digest. The actual provenance caller is exercised in the existing lifecycle suite, so the conditional SQL-fixture edit is not armed. Database-backed accounting tests correctly refuse this compiler and remain required in ordinary disposable CI. GraphQL type checks, schema stability, focused formatting, host hook/identity contract tests and changed-service Opengrep pass; the broader type/build dependency check also passes (42 tasks); the remaining hook and external gates are pending. The compiler uses an explicit 8GiB Node heap within its unchanged 12GiB limit after the default 2GiB heap failed. No provider calls occurred.

Next action: complete mandatory checks, hold the first implementation candidate, obtain the independent final review, then ordinary task push/draft PR and required exact-head CI. Delivery remains pending those gates. Terminal receipts stay ignored; there is no receipt-only followup commit.


### Bounded CI correction

Initial required CI exposed eight question cases in the existing failure-ordering SQL suite. Its whole-module configuration mock hid the newly imported functions before the test barrier. Extend only that existing mock in `packages/graphql/test/elementGenerationStartFailure.integration.test.ts` to preserve real exports while stubbing normalization. This additional existing test path completes the package's own integration contract; no new module, fixture controller, database runtime or business behavior is introduced.

The ordinary draft review also identified that the output-destination fence unnecessarily blocked settled-build reads. Exempt terminal retrieval and idempotent returns from destination comparison while retaining metadata validation. Explicit retry performs the destination comparison before credit reservation; preparation and synchronization retain their existing checks. Existing lifecycle regressions cover all four terminal states and preserve the prior zero-side-effect drift tests. Document the required worker pairing and controlled admission during rollout/rollback in ADR 0013.

This is the single remaining correction candidate. The original source review covers the unchanged financial parser, snapshot, wire/hash and acceptance paths. Its one focused correction was used for canonical report formatting and is exhausted. Main verifies the narrow correction and reuses that unaffected coverage; any new consequential review gap must remain explicit. Ordinary draft review and required CI may provide current-candidate evidence without another agent-triggered review. No further manual model consultation or source candidate is authorized. The unrelated browser bookmarking timeout is preserved as unclassified; a new source candidate's normal CI is not counted as a transient retry or proof of its cause.

Current delivery: first candidate is a draft at [PR #6849](https://github.com/uzh-bf/klicker-uzh/pull/6849). Corrected source, required current-head CI and applicable review coverage remain pending. The original four-hour window, unchanged native accounting, and one aggregate evidence-backed transient retry remain binding. Compiler resumes only for these authorized local checks and stops again afterward.


## Approved source-only admission extension — 10 November 2026

Actual user instruction: “approved, proceed with the source-only admission control so existing builds can finish while new starts and retries are blocked. reuse passing evidence and keep merge, deployment, writes and paid generation separately gated.” This new coherent extension stays in draft PR #6849 on the same worktree/branch. The earlier budget-policy source batch and focused correction review are complete; their historical limits and evidence remain unchanged. This section supersedes earlier current-progress wording for the active extension only.

The question build primitive gains an admission decision, distinct from its existing authorization and lifecycle. Add question-generation-admission, false by default, to the existing registry. Evaluate it per authenticated actor with the existing feature helper only before a genuinely new build or explicit retry reserves product credits. Existing idempotent starts return their persisted build and can resume accepted PREPARING_INPUT work. Keep polling, review decisions, publication, save and settlement available under existing entitlement/ownership checks. Missing/false/erroring decisions reject with existing QUESTION_GENERATION_UNAVAILABLE before reservation/upload/dispatch. Flashcard behavior, frozen native budget and current retry limits stay unchanged. No client field, schema, module, migration or dependency is added.

Known boundaries: feature updates are eventually observed, not an atomic distributed cutoff. A request admitted before a close or while a prior payload is valid may finish; do not cancel it. Explicit retry has no idempotent replay success branch today: once accepted, the same request no longer meets FAILED status. Recovery proceeds by polling the accepted build; preserve those semantics. Concurrent starts with a winning persisted row retain its budget/identity. This extension does not add a shared transaction or new lock.

Paths: existing feature-flags/src/contracts.ts and test/contracts.test.ts; graphql/src/services/questionGeneration.ts; questionGenerationLifecycle.test.ts; elementGenerationStartFailure.integration.test.ts; ADR0013 and this plan. Caller inventory: lifecycle and SQL failure-ordering tests exercise actual start/retry; generic focus-topic tests mock them and schema tests inspect declarations. Browser review tests seed accepted builds. Shared fixture helpers have no newly gated caller and need no blanket enablement. The actual positive contexts get synthetic evaluator and cached betaPreference, not a mock bypass of the helper. Existing denied entitlement, corruption, output drift, native hash and financial tests remain applicable.

Test portfolio: new starts/retries deny missingfalse/error flags with zero reservations/upload/provider; trueflag preserves normal lifecycle; accepted PREPARING_INPUT recovery, idempotency and design review continue while admission is false; terminal save/reload/credit and flashcards reuse unchanged suite coverage. No question prose or GUI changes. Extend existing tests only. Local compiler checks and ordinary disposable GraphQL/browser CI complete current-source verification; no real DB or local application runtime. Native writer/ledger/hash semantics unchanged, reuse pinned oracle and original source review.

ADR0013 will name per-actor targeting, defaultclosed release ordering, retention of question-generation entitlement, a drain criterion covering requests accepted before convergence, active states and unknown reservations, and compatible rollback. A failed/unknown drain remains a release hold. No feature flag is created or enabled in GrowthBook by this source work. No source test claims live enforcement or pedagogical quality.

Main owns implementation, review and draft delivery. Use the same isolated retained compiler at12GiB/6CPU; stop it after checks/push. One initial candidate plus at most one focused correction, one independent source review plus same-reviewer focused verification, one justified transient CI retry, and a four-hour implementation window with20min for local shutdown. No third candidate, paid generation, real-data writes, ready, hosted-final-review trigger, merge, deployment or deletion. Final terminal is exact-source review plus required CI (or explicit bounded gap) on the draft. Preserve original goal; broader release, fixture and native quiz/exam outcomes remain unfinished.

Planning critique: Opus5.5/high requested/reported, packet-only; four findings verified and dispositioned. Caller inventory, retry semantics, per-actor/defaultclosed effect and concrete drain criteria above resolve the actionable issues. No additional plan review is needed to restate those source facts. Private evidence and new-batch counters live beside the previous source review. Next: implementation, focused checks, commit, one actual-source review and ordinary task CI; reconcile terminal evidence privately without a receipt-only commit.

Extension progress: implementation is confined to two existing production files, three existing test files and ADR0013. Focused lifecycle/configuration/runtime/artifact tests pass (241); feature-flag package tests pass (75). Actual helper evaluation is exercised in deny/allow cases; accepted preparation and design review proceed with admission false. Full hooks, source review and current-source CI remain pending. No live configuration was changed.


## Approved source closure — 10 November 2026

The user approved the source-only closure and required CI (message
msg_01a1c717-8423-7c73-8a47-43d7c3d16141). This is the active batch;
previous batch limits and terminal evidence remain historical. Preserve the
existing goal, old manifests, financial reservations and recovery limits.

Integrate target `a71ce5ae59e58d5df66c05ccad8b43481a48dde6` into this task
branch, retaining the target's revision support with its default-off worker
switch. Preserve independently frozen native budget and slot-specification
fields in dispatch and provenance. The default-off revision route must not
dispatch a child; no new revision enablement is part of the pilot.

Extend `question-generation-admission` to flashcard new starts and explicit
retries, after idempotent lookup and before reservation or dispatch. Accepted
question and flashcard lifecycle operations remain authorized through existing
entitlement checks. Reuse existing service modules and lifecycle tests; no new
flag, endpoint, worker, schema or dependency. The broader flag meaning must be
disclosed before any later rollout. Direct native issuers require their own
owner-controlled drain; this application gate does not control them.

Add optional structured
`backendGraphql.elementGeneration.nativeBudgetPolicy` to the chart, null by
default. Emit every non-null value, including an empty map, as JSON in
`KB_QUESTION_NATIVE_BUDGET_POLICY`. An absent/null value omits the setting;
a malformed configured value blocks only new question starts before
reservation, without process startup failure. Existing question retries use
their frozen metadata; flashcards depend on the admission flag without adopting
the question-dollar policy. No policy amount or staging override is activated.

Verification extends existing lifecycle/configuration/runtime tests for both
admission paths, accepted continuation, frozen retry policy and combined
manifest options. Add one chart rendering contract test only if existing tests
cannot observe absent/null, valid and non-null empty/invalid values. Preserve
unchanged core financial/oracle and source review evidence. Required current-head
CI supplies disposable SQL and browser coverage; local checks use only the
retained compiler, with no local database or application server.

Main owns conflict resolution, source and exact-head checks, one integrated
Opus 5.5/high review plus one focused correction, ordinary non-force task push
and this draft PR's description. The four-hour window starts at the first source
mutation. Allow three commits (integration, implementation, one correction),
one shared review/deterministic-CI correction round and one justified transient
CI retry. Gather known required failures before the corrective commit, then
verify its diff through the same review route and current-head CI. Further
required corrections, unsafe conflicts or the deadline leave an explicit hold.
No automatic target chasing or cancellation of healthy external CI.

Terminal: reviewed exact source and required CI on the draft, stopped retained
compiler and a concrete later release decision or named remaining blocker.
Merge into a target, ready/hosted-final-review trigger, deployment, live flag or
policy changes, real fixture/application writes, paid generation and deletion
remain separately gated. Legacy retry reopening is excluded. Ordinary draft
CI/automated review costs remain disclosed as not dollar-capped.

Plan critique: one initial Opus 5.5/high packet review and one focused correction
completed. Main verified blueprint dispatch is the existing guarded question
start path; accepted explicit flashcard release ownership, nil-versus-empty
rendering checks, request-time malformed-policy rejection, frozen retry policy,
post-integration revision-disabled checks and shared correction limits. The
reports are private; they qualify this approach, not implementation or rollout.

Closure progress: the pinned target is integrated and mandatory hooks pass.
The shared admission hold and optional chart policy are implemented in existing
modules. The integration exposed a replay issue: the slot-specification switch
was read again on retry. New builds now freeze it before reservation and all
later dispatch/evidence paths use that value; historical null values stay
omitted. Existing lifecycle tests protect this alongside the frozen budget.
The focused configuration/lifecycle/runtime/artifact/provider suite passes
256 checks. The existing staging chart check now covers null omission and
non-null valid/empty/invalid JSON forwarding only to the backend. It passes
locally with Helm 4.3.0; required CI qualifies its pinned Helm 3.21.4.
No new test file, dependency, migration or live configuration was added.
Integrated source review and required candidate CI remain pending. Legacy
retry reopening and all live effects remain gated.
