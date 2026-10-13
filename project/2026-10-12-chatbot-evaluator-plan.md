# Faithful chatbot evaluation with bounded provider spend

## Approval summary

Extend the existing local trajectory evaluator so observed chatbot failures can be
tested under the application's citation contract, in Tutor, Explainer and Quizzer
modes, with a hard admission limit on provider spend. The user approved this
package on 12 October 2026 through a draft PR, together with scoped updates to
the two global chatbot skills. Approval mode: executable batch.

Source receipts will reuse the application's normalization and citation mapping
instead of maintaining a separate twelve-source implementation. They will identify
the mapping as reconstructed from persisted tools, rather than claiming new
provider telemetry. Explainer uses the same history, stream and persistence
verification as the other modes.

The current post-completion application-credit ledger is not a dollar limit. Add
a local evaluation-only provider guard with a durable shared ledger. It charges a
conservative maximum for every forwarded model request before dispatch, retains
that reservation on success or failure, and denies requests when the remaining
cap cannot cover it. Operator-qualified model context bounds and upper prices
are required inputs; no tariff is inferred from application credits. Every
billable call must traverse this guard. Source delivery does not establish that
a live environment has that routing or current tariffs.

Finish with verified source, focused regression evidence, configured reviews,
an ordinary task-branch push and a draft PR against v3. No merge, live prompt
apply, production data inspection, deployment, provider change, credential/key
creation or paid evaluation run is included. Verification uses synthetic local
transports with zero provider spend. No dependencies or schema changes.

## Execution details

### Baseline and ownership

- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Worktree: `trees/chatbot-evaluator`; branch `enhance/chatbot-evaluator`.
- Target: `v3`, fetched baseline `bf96b7059b`. The primary checkout is clean and
  ten commits behind the fetched target. Related citation [PR #6483](https://github.com/uzh-bf/klicker-uzh/pull/6483)
  remains open; this package imports the actual application mapper so its
  capacity follows that independently delivered change.
- Artifact root: existing `project/`. Historical context:
  `2026-10-12-chatbot-learning-quality-plan.md` on the preceding task branch.
- Execution mode: standard; the runtime identifies GPT-6 but does not expose the
  exact solo-allowlist model ID. Main owns budget semantics, privacy, integration
  and final proof. A bounded executor owns trajectory mapping and Explainer.
  Main owns global skills on the canonical dotfiles master checkout, preserving
  unrelated client configuration changes. No protected branch push.

### Binding contracts

1. Reuse `isDocQueryToolName`, `normalizeSourcesFromParts`, `parseDocQueryPayload` and
   `sourceCitationIndices`. Preserve first-appearance identity, pages/video
   positions, cross-call deduplication and explicit null indices for overflow.
   Receipts omit raw source text, titles/references, arguments, reasoning and URLs.
   Record per-tool-call identity, original one-based positions, nullable indices,
   SHA256 normalized identity, type and safe numeric page/time metadata. Include
   reconstruction version and source-revision fingerprint. Test parity against
   `withModelCitationIndices` with synthetic envelopes. This is a
   reconstruction, not proof of the exact historical model input.
2. Accept Explainer without weakening first-turn retrieval, parent/history,
   streamed-tool identity or persistence validation. Pin requested model and
   reasoning effort; default to the current supported fixed model rather than a
   retired registry ID. Preserve receipt comparison semantics.
3. The shared versioned ledger caps submitted turns at 120 and reserved provider
   spend at US$5 by default. Application credits remain a separate observational
   field. Legacy ledgers fail with a migration instruction rather than silently
   becoming dollar evidence. Each mutation holds an exclusive file lock and
   writes an atomic replacement durably before network dispatch. Stale locks and
   interrupted turns fail closed; no automatic budget reset or reservation refund.
   Every mutation locks, rereads, validates, updates, atomically replaces and
   fsyncs before unlocking. Use safe integer microdollars and immutable caps,
   experiment UUID and policy hash. Separate `.run` and `.lock` files distinguish
   the run lease from short mutation locks. Runner mutates lifecycle/credits;
   a responsive Unix socket with the exact run-lock token proves live ownership,
   so stale locks cannot admit after runner exit. Guard and runner share the
   same local OS/filesystem. Guard startup rejects uncertain ledgers.
   guard mutates reserved spend. An active turn carries a random owner token;
   the runner holds an exclusive run lock until exit. An interrupted active turn
   remains uncertain on restart. The guard may reserve during an active turn;
   runner updates never overwrite guard updates. Guard startup requires the
   existing ledger; only explicit offline initialization creates one.
4. Provider guard accepts only explicitly priced OpenAI-compatible text request
   paths, configured models and bounded output requests. It rejects images,
   unpriced endpoints/models, unsafe URLs, credentials in URL fields and redirects.
   Require one completion (`n` absent or 1), reject provider-hosted paid tools,
   tier/routing/service overrides, unqualified fields and modalities. The output
   bound must include reasoning tokens for the qualified provider. Forward only
   an explicit request-field allowlist; support `/v1/responses` and
   `/v1/chat/completions` with function tools only.
   Reserve the full qualified model input-context cost plus the explicit output
   ceiling, rounded up in integer microdollars. This is the provider's enforced
   architectural context limit, not an arbitrary smaller input estimate. The
   conservative US$5 cap may stop well before 120 turns; 120 is a ceiling, not
   a promised allocation. Forward no request without a successful durable
   reservation. Each step, retry and allowed auxiliary model call reserves
   independently; requests outside an active turn are denied. The application
   retains its existing five-step limit. Forward SSE chunks immediately. Do not forward
   arbitrary client headers. No request/response text or upstream errors in logs.
5. Bind the guard's canonical pricing policy hash to the shared ledger. The
   canonical upstream API base belongs in that policy and must match guard
   configuration, status and qualification. Endpoint drift invalidates proof.
   policy is a private operator input with provider, qualification evidence,
   context/output bounds and conservative prices. Actual cost is bounded only
   for the qualified route and tariffs. Run qualification must establish that
   model steps, summaries, retries and any paid tools have no alternate egress;
   absent proof means no paid run. Free deterministic tools may remain local.
   Fixed-model comparisons only: reject Auto model routing, whose classifier and
   embedding egress are outside this qualified text-model guard. An `auto` arm
   label is historical metadata and does not grant Auto-model routing.
6. Placement is application -> local guard -> qualified upstream, using the
   application's evaluation-only `OPENAI_BASE_URL` and runtime-injected key.
   Listener defaults to loopback; container access uses an explicitly selected
   private bind address and authentication. Upstream keys stay only in the guard.
   A qualification receipt identifies chatbot/model, application origin,
   guard origin, experiment UUID, pricing hash and egress proof for all paid paths.
   The runner requires that receipt and authenticated guard status before login;
   availability alone is not routing proof. Synthetic fake-application wiring
   verifies the adapter path; live wiring qualification is deferred. The package
   provides local admission/accounting only, not a claim of live paid routing.
   Retain turn
   accounting on failed or invalid runs. Synthetic integration tests establish
   admission behavior, not current provider billing or application answer quality.

### Skills handoff

Keep the two skills separate. Store one shared handoff reference under
`rs-chatbot-quality-iteration/references/prompt-handoff.md`, pointed to by both
SKILL.md files. It owns failure/confidence, mode contract, synthetic reproducer,
baseline fingerprint, acceptance/control/regression cases, budget, custody,
authority and return evidence. A prompt-only request can construct that same
handoff without a production conversation review. Returning an iteration result
does not require redoing an unchanged baseline analysis.

Assess assistance against the selected mode: direct explanations in Explainer,
appropriate scaffolding in Tutor, answer withholding/retry policy in Quizzer,
information layering and learner discovery only when a persona contract requires
them. Fix the blanket coaching-leak definition and the simulation reference's
shortcut and unconditional browser rules; consistency-check the review protocol.
Real student evidence remains
anonymous and out of prompt-workflow transcripts. No skill rename or catalog change.

### Research and design disposition

Current Node 24 module documentation confirms supported TypeScript loading;
reuse the already pinned tsx dependency for extensionless application imports.
No new DeepEval setup: the existing JS evaluator is the approved seam. Pricing
is an explicit operator qualification rather than a stale hard-coded provider
recommendation. No user-facing product primitive changes. No ADR needed for
local evaluation tooling; widening to production provider routing re-arms that
decision and its authority boundary.

### Test portfolio

| Risk | Obligation and primary seam | Distinct failure |
| --- | --- | --- |
| Divergent source numbering | Extend existing trajectory tests against the real mapper | Different pages/cross-call duplicates/refined sources/overflow are mislabelled |
| Explainer loses trajectory invariants | Extend existing synthetic persisted-transport tests | Mode accepted but history/tool/persistence checks bypassed |
| Spend exceeds cap under retries/concurrency/crash | Add provider-guard integration tests with fake HTTP upstream; extend runner tests | Upstream sees requests before reservations, lost ledger writes, refunded failures or policy drift |
| Unbounded or unpriced request forwarded | Same provider-guard seam | Missing output bound, unknown model, unsupported modality or redirect bypasses accounting |
| Skill workflows disagree | No new automated tests; frontmatter/link validation and three synthetic walkthroughs | Missing handoff, role-play rubric applied to Explainer, or real-text transfer inferred |

Existing fetch mocks stay in the trajectory suite for its established transport
seam. The new guard uses a real local HTTP fake upstream to observe forwarded
calls; no new extensive provider mocks. Pure evaluator source edits change no
browser interaction or visible UI, so screenshots and application browser startup
do not apply. Tests/toolchain run in the exact minimal task container.

### Slices and delivery

Delegation Map: main owns slices 1, 3 and 4. One clean-context executor owns
slice 2; it depends on the approved plan and returns before main modifies the
trajectory test file. All owners stop only on the named data/authority/capability
boundary. Slice 1 accepts schema/link checks and three synthetic walkthroughs;
slice 2 accepts `pnpm --filter @klicker-uzh/chat test:run test/tutor-trajectories.test.mjs`;
slice 3 adds `test/evaluation-spend-guard.test.mjs test/klicker-evaluation-target.test.mjs`
to that command. Slice 4 accepts integrated review, draft readback and shutdown proof.
Run tests through `devrouter exec <exact-worktree> -- <command>`.

1. Main: approved skill handoff and mode assessment updates, linked-reference
   validation and synthetic walkthroughs. Also edit the existing
   `rs-chatbot-prompt-iteration/references/simulation-and-evidence.md` and
   `rs-chatbot-quality-iteration/references/review-protocol.md`. Scoped local
   dotfiles commit only.
2. Executor: `apps/chat/scripts/tutor-trajectory.mjs` and
   `apps/chat/test/tutor-trajectories.test.mjs` for source mapping/Explainer and
   new mapping receipts. The same worker owns runner blocks in that test and
   `apps/chat/test/klicker-evaluation-target.test.mjs` against main's frozen
   ledger/qualification interfaces. Main integrates after ownership returns.
   Use existing tsx to load the application module; no application-source
   rewrite to make evaluator loading easier. Use `tsImport` from `tsx/esm/api`
   inside the ESM script where supported. The pinned version's extensionless
   resolution fails there; its existing registration entrypoint is the verified
   plain-Node fallback. Vitest imports the same application module.
3. Main: new `apps/chat/scripts/evaluation-budget.mjs` and
   `apps/chat/scripts/evaluation-spend-guard.mjs`, existing
   `run-tutor-trajectories.mjs` and `klicker-evaluation-target.mjs`, new
   `apps/chat/test/evaluation-spend-guard.test.mjs`, and scoped updates to the
   existing `apps/chat/test/klicker-evaluation-target.test.mjs` and trajectory
   tests. Freeze policy and ledger schema before edits.
   Document setup, qualification, conservative reservations, private custody and
   limits in existing `evaluation/README.md`. No committed real tariff or secret.
4. Main: focused tests, native formatting/lint/type checks appropriate to scripts,
   simplification and risk review of committed slices, integrated final review,
   ordinary push, draft PR creation/readback, exact-runtime shutdown/readback.

Restore source with an ordinary revert. Guard state is retained; a new budget
file is a new explicitly declared experiment, not recovery from an exhausted or
ambiguous one. This package never resets an existing ledger or applies live prompts.

## Progress

- Skills: installed and locally committed as dotfiles `0e2daa2`; linked handoff
  and frontmatter checked. Walkthroughs cover quality-to-prompt, prompt-only,
  and Explainer direct help versus Quizzer release/persona discovery contracts.
- Mapping and Explainer: implemented and verified against the application
  projection, including other retrieval servers and suffixed names. The local
  first-turn KB requirement remains strict; all worker ownership has returned.
- Budget: US$5/120-turn durable admission, endpoint binding and live run lease
  implemented. Completed canary failures account known credits before assessment;
  interrupted calls still fail closed and reservations are never refunded.
- Verification: 41 synthetic tests pass in the exact task container. Scoped
  Biome/ESLint, formatting, plain-Node help, chat typecheck and secret checks pass.
  Earlier passing checks reused where the tested source boundary is unchanged.
  The data-hygiene heuristic flagged synthetic test assignments; exact staged
  diffs and gitleaks confirmed false positives before its documented override.
- Reviews: recovery planner approved; mapping and budget slice reviews have no
  qualifying findings. Integrated final review passed after the completed-canary
  correction; focused late mixed-server confirmation recorded privately.
- Packaging: one coherent evaluator package, full path; 2,533 substantive changed
  lines including maintained tests, excluding project-artifact documentation.
- Delivery: [draft PR #6489](https://github.com/uzh-bf/klicker-uzh/pull/6489) targets
  `v3`. Fresh fetch shows no target drift from `bf96b7059b`. Hosted checks remain
  pending; the prior-head OpenCodeReview job failed at its provider HTTP request.
  No human reviewer requested. Global skill changes are local dotfiles `0e2daa2`.
- Runtime: exact source path `trees/chatbot-evaluator`, workspace
  `enhance-chatbot-evaluator`, minimal `mcp` profile; stopped after verification,
  provider state and zero exact routes checked. No paid evaluation calls.
- Terminal: approved draft source delivery and installed skills complete. Merge,
  deployment, prompt apply and paid evaluation were not requested. Before a paid
  run, qualify current tariffs and every billable application egress path; source
  tests alone do not prove live routing. Unix-socket path length and lock
  contention remain fail-closed operational qualification considerations.

## Approved routing continuation — 2026-10-13

The user approved fixes in draft PR #6489, a host Devrouter upgrade and
zero-spend application routing qualification. No paid evaluation, provider
generation, merge, readiness change or deployment is authorized. Planner
approved the revised continuation after resolving startup precedence and the
qualification bootstrap. Target remains `v3`; source starts at `acf2edec2f`.

1. Executor owns only `apps/chat/scripts/evaluation-spend-guard.mjs` and its
   existing guard tests. Accept exactly the application's two true cache-bypass
   flags and strip this proxy-only field before forwarding. Validate and retain
   a nonempty native `prompt_cache_key` of at most 64 characters. Keep every
   other field and spend restriction intact.
2. Main owns `openaiCachePolicy.ts`, its existing tests and the chat route.
   Optional `KLICKER_EVAL_GUARD_ORIGIN` binds the default provider to that
   local origin plus `/v1` and rejects chatbot key/base overrides before
   decryption or provider construction. Production behavior without this
   opt-in remains unchanged.
3. Main owns `.devcontainer/post-start.sh`, `turbo.json` and existing
   `util/test-dev-runtime.sh`. Capture explicit incoming evaluation settings
   before canonical sourcing, restore them immediately afterward, and require
   complete guarded configuration. Fingerprint origin, effective base URL,
   registry JSON and nonsecret `KLICKER_EVAL_GUARD_GENERATION`, never credentials.
   Generate a new marker whenever synthetic credentials change. Existing
   managed process replacement supplies restart acceptance.
4. Main owns private `project/_local/qualify-application-routing.mjs`, ignored
   wire-proof output, existing evaluation README and this plan. After both
   source slices, run the exact Chat/API/MCP application against a fake local
   Responses upstream in its container. Use the existing ledger lease and turn
   primitives directly; preserve the production runner's qualification gate.
   An evaluation-only registry maps selection `gpt-6-luna` to deployment
   `openai/gpt-6-luna`. Force one pre-stream failure, observe the actual SDK
   retry and MCP tool step, and read durable reservations at every upstream
   arrival. Verify persisted messages, override/mismatch rejection, managed
   restart and shutdown. This synthetic transport proof is not a positive
   real-provider qualification receipt.

Test portfolio: extend guard tests for field validation/forwarding; extend
cache-policy tests for endpoint and override enforcement; extend managed
runtime tests for configuration precedence/fingerprint contracts. Add no
maintained end-to-end suite: the named private probe provides bounded runtime
evidence. No new dependencies, schema, production registry or provider config.

Host Devrouter needs at least 0.3.0. Shared state was written by 0.3.1, so the
approved upgrade follows that compatible version rather than downgrading state.
Use only the exact worktree's `chat,mcp` selection; retain volumes. Complete
container-native focused checks, committed-slice simplification/risk review,
integrated final review, ordinary push and existing draft PR update. Stop and
verify the exact runtime afterward. Source recovery is an ordinary revert;
retain ledgers and never reset an exhausted experiment.

Continuation discoveries: preserve the real boundary export in the existing
`account-usage-route.test.ts` partial mock; its route imports the new check.
Extend the existing OpenRouter local Chat solution with the zero-spend lesson,
rather than creating another document. Devrouter's generated discovery refresh
would remove custom repository guidance; its unrelated edits were restored.

Continuation progress: guard slice `8f2e622e36` passed risk review; accepted
simplification removes the unnecessary parsed-request clone. Sixteen focused
checks and the managed runtime suite pass in the exact container. Source
credential heuristics flagged only synthetic prompt-cache assignments; exact
staged inspection and gitleaks passed before the documented false-positive
override. Full application proof and final delivery remain in progress.

Actual SDK qualification exposed an additional alias seam: prefixed deployment
IDs are not recognized as reasoning models. Main extends the existing Responses
provider options with the SDK's supported `forceReasoning` override only for
guarded evaluation of registry-declared reasoning models. Extend the existing
cache-policy SDK test for the reproduced missing reasoning settings; no new
provider abstraction or production routing change.

Routing acceptance: real API login, seeded participant/disclaimer/thread,
Responses serialization, forced pre-stream failure and actual SDK retry,
local authenticated MCP execution and persisted answer/tool passed against
only a fake loopback upstream. Three arrivals observed durable cumulative
reservations of 531,144, 1,062,288 and 1,593,432 microdollars. These are
synthetic reservations, not billed dollars. Chatbot base/key overrides and
an application endpoint mismatch produced no additional upstream arrival.
Two managed process replacements passed. Private wire proof is retained
separately; no positive real-provider qualification receipt was created.

Verification: 86 focused Vitest checks across evaluator, cache/provider and
affected account route pass. Container chat typecheck, scoped ESLint, Biome,
shell syntax and documentation formatting pass. Existing managed runtime
suite passes; its unchanged boundary evidence is reused. Only pre-existing
Biome warnings remain. No browser interaction or visible UI changed.
Devrouter active host CLI and delivered helper are 0.3.1; minimal `chat,mcp`
runtime startup passed with no LiteLLM service. Delivery and reviews pending.

App slice review found no high-severity issue. Its positive-effort concern is
accepted: `forceReasoning` additionally requires a concrete provider effort.
This preserves the qualified low-effort path and avoids forcing reasoning for
`none`. The documented nonsecret credential-generation requirement is retained;
the synthetic test credential is not a secret exposure. Simplification accepts
one guarded shell fixture instead of two equivalent fresh-process runs.
Exact runtime stop succeeded and removed four routes; fresh route read-back
contains zero routes for this worktree. No volumes or workspace were deleted.

The initial integrated final review passed at `83ac675f43`. A fresh fetch then
identified target `0a8d4652915c9ee6d86136050186bb97e054387d`, which raises the
application citation cap to 99. One standing-approved readiness integration
resolves the shared solution-note conflict by retaining both independently
applicable explanations. The evaluator already consumes the application cap;
its existing parity fixture now crosses that imported cap instead of pinning
12. Recheck the affected mapper and integrated focused suite, then perform the
single focused final-review follow-up for this newly merged contract.

Integration verification passes: 133 focused checks including the application
normalizer, chat typecheck, affected-test ESLint/Biome and document formatting.
The second stale 12-source metadata expectation now also uses the imported cap.
No new test was added. The earlier synthetic application wire proof is reused:
its low-effort request and one-source MCP response are unchanged by the effort
condition or cap expansion. There is still no real-provider receipt or paid run.
Whole-branch substantive size is 2,859 lines excluding project artifacts before
this narrow integration; the continuation adds 334 substantive lines. This
remains the approved coherent evaluator defect package in the existing draft.

Completion record: initial integrated review and the single integration follow-up
pass, with zero findings and canonical schema validation. Reviewed source head
is `1a3bae5279284f6518b6c1072cc46722731f4799`; this closing note changes no
behavior. Final substantive size is 2,862 lines excluding project artifacts.
Credential heuristics flagged only test-owned synthetic assignments; inspected
staged content and gitleaks passed before the explicit false-positive override.
Equivalent focused container checks cover the host hook's missing dependencies.

The exact worktree `/Users/rschlae/Git/klicker/klicker-uzh/trees/chatbot-evaluator`,
workspace `enhance-chatbot-evaluator`, is stopped. Owning Devsy provider status
is `Stopped` and the fresh exact-route read-back is empty; data and volumes remain.
The approved delivery target is existing draft
[PR #6489](https://github.com/uzh-bf/klicker-uzh/pull/6489), including this closure
note and the refreshed whole-branch description. Required hosted checks remain
a separate exact-head gate. Real-provider qualification, paid evaluation, prompt
application, ready/merge and deployment remain outside this completed batch.

## Approved evaluation ownership follow-up

The user approved framework compatibility first, then evaluator relocation and
an exact framework pin through coordinated drafts. The private framework plan
is `project/2026-10-13-klicker-trajectory-compatibility-plan.md` in the evaluation
repository. Its optional receipt importer preserves every planned case/repeat,
including stopped and unsupported captures, and reports planned, selected and
assessed counts. Supplied corpus provenance is recorded; capture-time identity
remains caller-attested. Hash-only sources are diagnostic, not factual context.

After offline compatibility acceptance, move the trajectory runner, numeric
reference, budget and guard into `evaluation/`. Chat retains the actual target,
source mapper and persisted ancestry checks, plus the authored-corpus producer
validator. Update existing callers and synthetic tests, then pin the exact
pushed framework revision and rerun the portable loopback harness. Keep target
guard and ledger on the same host/filesystem. Judge cost accounting remains
post-completion and is not covered by the target-provider hard cap.

Main owns framework compatibility and pin/publication integration; a public
executor owns mechanical relocation after compatibility passes. The framework
draft must land first, followed by final merged-SHA pin reconciliation before
Klicker landing. This approval covers ordinary task-branch publication and
draft updates, not paid evaluation, live qualification, ready/merge or deployment.

Compatibility and relocation verification pass. Framework revision
`04cf82fc3097db1b6a473f02d35a1d76f8532ad7` is published in
[draft MR 54](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/54).
The private slice passed Astra simplification and trusted native risk review;
two duplicate-test reductions were accepted. Its 62 offline tests preserve
planned coverage through limits, conversion failures and late judge errors.
It adds 1,368 substantive lines, including 836 lines of regression tests.

The public executor relocated four files, with budget, guard and numeric logic
unchanged. Chat's 42 affected Node tests pass in an isolated network-disabled
container. An actual `runTrajectory` producer roundtrip with synthetic persisted
messages passed: six turns, three planned modes, two eligible conversations,
Quizzer retained, scenario and expected outcomes present, no invented retrieval
context. The existing portable launcher passed at the exact new framework pin
with synthetic loopback only. No application stack was started for relocation.
Prior application routing proof remains applicable to unchanged behavior.

Integrated full-range final review passes with no reportable findings. Main
verified a below-threshold identity concern by reproducing a checkpoint failure
with a valid leading-whitespace case ID. Framework correction
`fb386403e6a3479b65a8352a76e6b61246fb4b68` preserves exact capture IDs without
changing legacy normalization. The existing regression test now covers that
case; all 62 offline tests pass. The public pin, launcher harness and current
setup instructions follow this correction. Focused final-review follow-up and
exact-head publication close delivery. Framework-first landing and final merged-SHA
pin reconciliation remain subsequent human-controlled gates. No paid evaluation
has run. Before a paid comparative judge run, qualify whether selected metrics
serialize diagnostic metadata, so arm labels cannot bias assessment.

## Approved framework landing and pin reconciliation

The user authorized merging framework MR 54, then updating the pin and verifying
CI in PR 6489 while keeping it draft. The framework task branch integrated main
`b2611c33873505a4da421c77fe1508b1ae6b08f9` to resolve its upstream schema conflict.
Capture results follow upstream `success` and `cost_usd`, retaining planned,
selected, assessed and strict-coverage fields. All 395 framework tests passed
offline with frozen upstream dependencies and external network denied. Focused
integrated final review passed with no findings and canonical schema validation.

MR 54 merged as `e545dfcfa9979eddeae22197fd7c0f0b053049df`; exact-head pipeline
682951 and merged-main pipeline 682952 passed. GitLab forced source-branch cleanup
despite the keep-branch flag; the reviewed task branch was restored at
`d32fefd36df6156630625c258065d6070742eb0c` without a force push.

The public gitlink, launcher harness and setup instructions now use the merged
revision. The existing launcher check passed with one synthetic loopback artifact,
no external model traffic and no Infisical invocation. No application behavior
changed in this pin reconciliation. Hosted PR checks are the remaining exact-head
verification gate; the draft-only final AI review gate remains deferred. PR 6489
stays draft. No paid evaluation, production change or deployment is authorized.

## Approved review-comment follow-up

The user requested disposition of remaining comments and fresh exact-head CI in
[draft PR #6489](https://github.com/uzh-bf/klicker-uzh/pull/6489). Execution mode
remains standard. Main owns mapper diagnostics/fingerprint, independent citation
expectations, IPv6 loopback consistency, request depth and startup errors. One
executor owns runner output-close cleanup and synthetic guard fixture cleanup.
Acceptance uses the existing offline evaluator and cache-policy suites, scoped
format/lint/type checks, committed-range reviews, comment replies and exact-head
hosted CI. No new dependencies, modules, paid evaluation or readiness change.

The approved fail-closed contract governs interrupted initialization, stale
mutation locks and interrupted active turns. Automatic cleanup/reconciliation
could erase durable evidence or permit a second budget, so those suggestions
receive evidence-backed replies rather than recovery behavior. Source receipts
retain all application-recognized retrieval tools; the exact KB tool fields
describe the grounding canary. Tests remain repository-level integration checks
for Chat's adapter; root evaluation utilities need no new workspace package.

Fresh target `dcbec1ede200f6f7482d32b82bf7aff172e97b60` adds only independent CI
workflow updates. The PR is mergeable with no required-freshness blocker, so
no target integration is needed. Existing reviewed framework pin and synthetic
application routing proof remain applicable outside these changed seams.

Verification: 55 focused offline tests pass across trajectory, target, guard and
cache-policy suites, including independent citation expectations, rejected deep
input, occupied-port startup and preservation of mutation errors during cleanup
failure. Chat typechecking passes with all existing dependency volumes mounted;
an initial two-volume container lacked transitive workspace dependencies.
Scoped ESLint, Biome, Prettier and plain-Node launcher help pass. The continuation
adds 343 substantive changed lines before review, excluding project artifacts.
Committed-range reviews, thread dispositions and fresh hosted CI remain pending.

The subsequent hosted review added eleven inline comments and nine summary
suggestions. Main owns launcher guard prerequisites, consistent target labels,
scoped credential forwarding and diagnostic corrections. A bounded read-only
worker tested the import retry and sequential run leases on Node 24.21.0 with
network disabled; both reported defects were refuted. The existing guard test
now covers reacquiring the same run lease and preserving accumulated spend.
The wrapper's synthetic suite verifies preflight refusal before child startup,
matching target labels, credential isolation and cleanup on success or failure.
All 55 focused tests, wrapper checks, static checks, plain-Node help and the
synthetic development-runtime harness pass. Current source reviews and hosted
CI will be rerun for this correction; PR 6489 remains draft with no paid run.

The next hosted review was checked against producing code before changes.
IPv6 hostname claims were refuted on the pinned Node runtime. The alleged
result-envelope parity gap omitted the persistence adapter's safe-error mapping;
the existing parity test now exercises that mapping explicitly without weakening
the retrieval gate. Main owns missing retrieval-call identity refusal and empty
evaluation-marker startup refusal. One executor owns handling a reset lease
socket and retaining multiple fixture errors; it reproduced an unhandled
ECONNRESET before the fix and a normal exit afterward. The existing tests cover
these seams; no new module, dependency, refund, recovery or paid run is added.
