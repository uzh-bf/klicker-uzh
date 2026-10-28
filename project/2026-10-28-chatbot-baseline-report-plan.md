# Lecturer baseline report from response examples

## Approval summary

A lecturer should test the chatbot against the same examples they have reviewed.
They open the chatbot's Knowledge page, start a baseline test, and compare each
actual answer with their ideal answer and its sources. The test withholds all
response-example content from the chatbot. Normal chat continues to use approved
examples as a skill. Both target answers and advisory assessment use the existing
platform base model; assessment is a comparison aid for the lecturer.

Keep one current report per chatbot's example set. Show progress, actual and ideal
answers, sources, a short advisory result, and clear incomplete or stale states.
Reuse the current source eligibility, Markdown rendering, owner authorization,
Hatchet worker, and account BASE usage. There is no second GT dataset, report
history, locale field, new evaluation framework, or automatic candidate generation.

The user approved implementation on 28 October 2026 after
[capture PR #5764](https://github.com/uzh-bf/klicker-uzh/pull/5764) merged.
**Approval mode: executable batch.** Source, synthetic tests, configured reviews,
ordinary pushes and a draft report PR into `v3-ai` are authorized. The batch stops
at source readiness; merge, deployment, secret provisioning, paid model calls
and live proof remain separate. Costs and timing for a real run are not yet measured. The initial
implementation proves a single synthetic case before building the complete report.

## Execution details

### Current evidence and primitive impact

Execution baseline: `v3-ai@d786ffbe2b2e5750bdd5c5de7c9da871cbe80580`,
including merged [capture PR #5764](https://github.com/uzh-bf/klicker-uzh/pull/5764).
Foundation, lecturer review, runtime skill and preview capture are merged.
Browser capture tests use mocked transport; they do not establish live lineage.

| Product primitive | Disposition | Contract |
| --- | --- | --- |
| Response-example set and example | Reuse | One canonical mutable set; only currently approved, source-eligible examples become cases. |
| Runtime example skill | Compose | Included for ordinary chat; excluded for the target test without a set-content read. |
| Current baseline report | Create | Owner-only snapshot and latest results; replacement invalidates older workers, with no report history. |
| Account BASE usage | Extend | Add the missing participant-free admission and idempotent settlement operation; both target and judge consume the owner's allowance. |

The application already has an `excluded` projection in
`apps/chat/src/lib/server/responseExampleRuntime.ts`, but no production caller
uses it. Target request assembly remains inside the owner-preview route. There
is no shared execution kernel to call as the old umbrella plan assumed.

`apps/chat/src/services/accountUsage.ts` reads account availability, but its
claim/finalize functions require participant threads and messages. Preview checks
entitlement and deliberately writes no usage row. Neither is a reusable owner-only
reservation API. The report must add that operation rather than charge a synthetic
participant or treat a read-only budget check as a reservation.

The existing local `evaluation/` tooling owns capture adapters, private artifact
handoff, provider-spend guards and optional DeepEval assessment. Reuse its
structured contracts where applicable; do not invoke its CLI or private framework
from lecturer requests. It provides no current application report service.
The local dollar ledger is distinct from the application's BASE allowance.
Optional export and framework assessment stay outside this first report.

### Lecturer journey and report scope

1. Under the current chatbot's response examples, show eligible case count and a
   notice that the test uses the account's base-model allowance.
2. Starting snapshots approved eligible examples across supported saved modes.
   A case is one question and one ideal Markdown response with canonical evidence.
   Empty or unavailable mode/source configurations cannot dispatch a model call.
3. Run cases sequentially, using a fresh first exchange for each. The page can
   show progress while the existing Hatchet worker continues the bounded run.
4. Show actual answer beside the ideal answer, their source links, and advisory
   Pass / Needs attention plus one short explanation. Missing evidence or a
   target/judge failure produces an explicit unassessed case, never a pass.
5. Keep only the latest report. Confirm replacement of an active run, invalidate
   its remaining work, and show completed results and incomplete cases accurately.
   Changing examples or execution configuration marks the report stale.

Do not add multi-turn authoring, example revisions, custom scoring rubrics,
comparison dashboards, model selectors or automatic re-runs. Use the current
review-supported modes, with a visible count/reason for excluded cases. Authored
custom modes outside that contract remain previewable but do not enter this run.

### Target isolation and shared execution

Extract the smallest server-only execution seam from owner preview. Both target
and judge select the fixed platform BASE route server-side, independently of the
lecturer or participant model selection; unavailable BASE routing denies dispatch.
Preserve prompt compilation, mode configuration, MCP scope, canonical citations,
refusal handling, language behavior, timeouts and tool-step limits equivalent.
Preserve the normal preview request and its capture receipt behavior.

The baseline target receives the question and ordinary chatbot configuration.
Omit response-example summary, ideal answer, response approach, evidence refs,
set digest and any example-derived cache content. Keep the same example-search
tool schema bound to the existing empty `excluded` projection; it reads no examples.
A browser parameter must never disable examples in participant chat.

Only after the target answer and sources are complete may the judge access the
ideal answer. Give the judge bounded typed inputs and require validated structured
output using the existing AI SDK conventions. Invalid, truncated or timed-out
assessment remains unassessed. Do not substitute another model tier or provider.
Source markers and hash parity alone cannot prove that a claim is supported;
without authorized passage evidence, semantic source support stays unassessed.
Persist references and output Markdown, not source bodies, reasoning or tokens.

Hatchet's general worker imports GraphQL handlers and cannot directly import a
Next.js route as an execution kernel. Prefer retaining model execution in Chat:
a narrowly scoped internal job request identifies the current run/case, and Chat
loads the server-owned configuration. Bind worker authority to that run/case,
owner and expiry; validate current ownership, AI entitlement and run state again.
Never forward the lecturer's session to a background worker. Use the repository's
existing server-token patterns and fixed internal destination; no caller-supplied
URL, prompts, model or credentials. Any required signing configuration is source
contract only in this package; secret creation and live wiring require separate
approval. A worker request carries identifiers, not ideal answers or source bodies.
The first prototype must prove this seam before the schema and UI are expanded.

### Accounting, persistence and failure behavior

Add owner-only usage admission and settlement to the existing account-usage
implementation. Require configured BASE entitlement and sufficient remaining
allowance before each paid stage; reserve its bounded maximum atomically with
the operation claim. Account for every target tool/model step and the advisory
judge. Fix the base model, output ceiling, five-step bound and sequential case
execution. The first database proof must establish the route's enforced input/context
and output bounds, including accumulated tool results and judge input, and derive
the maximum reservation from existing credit factors. Output and step limits alone
do not bound input credits. If an enforceable bound is unavailable, deny dispatch
and return that accounting decision before introducing a new policy. Release unused reservation only after a known terminal outcome;
uncertain provider outcomes retain their reservation and cannot auto-retry.
This is application credit accounting, not a claim of a provider-dollar cap.

Use stable run/case/stage operation identity. Settlement is idempotent and remains
accountable after report replacement; do not delete billing operations with the
replaceable report. No ChatThread, ChatMessage, participant-credit or rating row
is created or mutated. Reuse existing account usage storage and factors; add only
the operation state necessary to enforce this new owner-only path. If that cannot
be done proportionately, return the exact design decision before expanding it.

Generate one schema-aware migration for the report and necessary accounting state.
Keep one report per set and bounded case snapshots keyed by example ID. Snapshot
question, ideal answer, mode, evidence and set digest. Capture effective execution
configuration and available serving identities; missing identities stay unknown.
Compare run identity on every task claim and result write. Replacement denies
new dispatch by older tasks; an already dispatched paid call may finish and settle
usage, but cannot overwrite the newer report. No report or example history.

Use the existing 200-example set ceiling, concurrency one, finite per-stage
request deadlines and no automatic paid retries. Stop remaining work on budget
exhaustion, revoked access, unavailable required retrieval or uncertain dispatch.
A failed enqueue marks the run failed rather than leaving permanent queued state.
A replaced/expired job exits cleanly; a lost terminal worker is surfaced as
incomplete on read using its deadline, without redispatching paid calls.

### Delivery sequence, owners and acceptance

Main owns isolation, accounting, cross-process authority,
integration and final proof. A bounded implementation worker may own the Manage
report after the API is fixed; a second owner may implement the settled persistence
subset. One writer per path set. No other KB/ingestion work is assigned here.

| Slice | Work and intended existing seams | First useful acceptance |
| --- | --- | --- |
| One-case transport/isolation prototype | Chat's preview request assembly, excluded projection and one scoped internal job endpoint/client, named explicitly before implementation | Test-double transport proves no expected/example content in target input, ordinary preview parity, worker-to-Chat authentication and failure cleanup. This establishes no durable accounting claim. |
| One-case durable report and worker | Prisma chat/account schema, GraphQL responseExamples service/schema/ops, accountUsage, existing Hatchet prepared-task map and general-worker selection | One generated migration includes minimal durable operation state before the one-case settlement proof. One owner-funded target/judge pair settles once without participant writes; current-run CAS, replacement, concurrent budget admission, replay, uncertain dispatch, enqueue failure and partial results pass database/transport tests. |
| Lecturer report | Existing ChatbotResponseExampleReview / ChatbotDetails, existing rich-text/Markdown/source components and EN/DE i18n | Start, progress, actual/ideal sources, incomplete, stale and replacement journeys pass browser checks; desktop/mobile synthetic screenshots reviewed. |
| Source finish | Applicable domain/ADR guidance and report package plan | Simplification, risk review, integrated final review and exact-head CI; draft PR into `v3-ai`; exact task runtime stopped. |

Extend this plan in place. The first coherent component uses these new paths:
`apps/chat/src/lib/server/ownerPreviewExecution.ts` for shared request assembly,
`apps/chat/src/lib/server/responseExampleBaseline.ts` for target-before-judge
execution, `packages/util/src/responseExampleBaseline.ts` for scoped worker-token
signing and verification, and
`apps/chat/src/app/api/internal/response-example-baseline/route.ts` for the internal
job boundary. Extend `packages/util/src/auth.ts` instead of creating a token module
if its export conventions support the shared contract. Name exact report,
accounting and UI paths after the one-case proof settles those contracts and before
editing them. The independent source-mapping owner investigates only accounting
bounds and reuse; main retains decisions, writes and verification.

The synthetic prototype lives under ignored `project/_local/prototypes/` and
observes the existing excluded skill and signed worker claims with fake model
transport. It creates no schema or durable service and makes no provider calls.
It must prove no example content is read, request/claim ownership and expiry are
checked, target completes before judge input is opened, and failure closes tools.
Promote only the evidence after this question is settled. Extend existing services and tests by default.
If proving the seam requires a new service, framework, participant persistence,
broad provider routing or a different accounting policy, stop at that decision.

### Verification and release boundaries

Primary tests cover actual target request capture and temporal target-before-judge
ordering; cross-owner and worker-token rejection; current-source snapshotting;
concurrent reservations and idempotent settlement; old-run denial; and persisted
report/browser states. Use minimal test-owned synthetic fixtures. Assert behavior
and structured contracts, never sample prose, translation strings or seed counts.

Run focused suites through the pinned container; host Git and forge actions remain
on the host. Reuse the current receipt/preview/review regressions when extracting
execution. Paid models are replaced by observing local transports for source
verification. Real-provider lineage, quality, latency/cost and activation need
separate authorized acceptance. Automatic candidate generation also requires
current synthetic active-serving evidence from the upstream KB owner; no graph
or provider activation work is included here.

Recover source with an ordinary revert; preserve recorded usage and uncertain
operations. No live data migration, account-budget change, new allowance, reset,
merge or deployment is authorized by this source batch.

## Progress

- Root outcome: lecturers compare base-model answers with their current approved
  examples while target execution cannot read those examples.
- Authorized terminal: tested and independently reviewed source in a draft PR
  into `v3-ai`, with the exact task runtime stopped. Real calls and activation are
  separate.
- Approval reference: the human's "approved" immediately after the proposal to
  implement the baseline report, tests, reviews and draft PR on 28 October 2026.
- Existing independent critique: native Sol approved the direction plan after
  clarifying fixed BASE routing, enforced input/output credit bounds and
  migration-before-durable-settlement proof. That unchanged design critique is
  reused. This planning approval is separate from the human execution approval.
- Task branch: `feat/chatbot-baseline-report`; worktree
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/chatbot-baseline-report`.
  Baseline `d786ffbe2b`; tracking `origin/v3-ai` until first task-branch publication.
- First useful acceptance: one synthetic target/judge execution observes isolation,
  signed worker authority, ordering and cleanup before schema/UI expansion.
- Current work: restore the approved plan to executable status, map enforceable
  accounting bounds and run the one-case prototype. No paid call or schema change.
- Consumer blockers: shared execution and participant-free reservation/settlement
  are unimplemented. If enforcing bounds needs a different accounting policy,
  deny dispatch and return that exact decision before expanding the design.
- Verification, implementation review, draft PR and source finish remain pending.
