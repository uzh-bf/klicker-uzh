# Graph-assisted retrieval reliability and staging qualification

## October 16: offline evaluation preparation — approved

The six-answer development comparison is complete. It does not establish a
GraphRAG quality advantage: the references mixed facts with instructions, context
sizes differed, and identical negative contexts received different recall scores.
Earlier dated operational sections below are historical. The current request
prepares a larger comparison without paid runs or live changes.

**Goal and boundary.** Use the existing DeepEval framework for LLM quality.
Retain original references, captures, reports, ledger history and every prior
spend/hold. The combined reservation remains CHF 19.83223885 of CHF 20; this
preparation authorizes zero additional spend. Ingestion remains independent of KG.
No new evaluation engine, dependencies, secret reads, connectivity, graph build,
activation, deployment, ready or merge action is included. Delivery updates draft
[Klicker #6478](https://github.com/uzh-bf/klicker-uzh/pull/6478), targeting `v3-ai`.
Execution mode: standard; native trusted reviews preserve the private boundary.

**Owners and sequence.**

1. Main owns prospective reference copies and the 24-case protocol in ignored
   `project/_local/evaluation-preparation-20261016/`. References contain source
   facts only. Original scored artifacts remain byte-for-byte unchanged. The
   two old cases are development seeds; 16 answerable and eight unsupported
   held-out cases still require source review and freeze before 72 new answers.
2. Main owns `evaluation/data/metrics/klicker_graph_retrieval.yaml`, new
   `klicker_graph_answerable.yaml` and `klicker_graph_abstention.yaml` beside it,
   and the new `evaluation/scripts/prepare-graph-comparison.py`. Answerable
   correctness runs even with empty retrieval; abstention scoring runs with empty
   or irrelevant retrieval. Select the profile by reviewed case class and analysis
   purpose, never by observed retrieval emptiness. DeepEval retains all scoring.
3. A native trusted executor owns legacy quality-call guards in
   `evaluation/routing/src/routing_eval/{bench,pairwise}.py`, their existing tests,
   routing README and routing evaluation skill. Answer capture and historical
   statistics remain usable; new custom judge calls stop before credentials or
   provider access. This work runs independently of step 2.
4. Main integrates the DeepEval-only policy in `evaluation/README.md` and its root
   `AGENTS.md` pointer, runs the offline checks, then commits, reviews and updates
   the existing draft PR. No paid quality result is claimed from fake judges.

**Matched-input contract.** The helper accepts only question and three ordered
retrieval arms before generation. It renders compact UTF-8 JSON with keys
`question` and `retrieval_context`, including any source labels within passage
text. `o200k_base` counts the complete rendered input, including JSON and question
overhead. Common quota is the smaller of 4,096 and the three available input
sizes. Each actual input must be between quota minus eight tokens and quota.
Only literal Unicode prefixes are retained; no padding or passage reordering.
All-empty contexts are valid; mixed empty/nonempty arms are unmatched and rejected.
Reject oversized fixed overhead, missing offline tokenizer cache, post-generation
QA/golden fields, overwrite attempts or unsatisfied matching. Future generation
must consume the saved `rendered_input` unchanged with the same system prompt,
model, effort and output cap. Token preparation does not prove provider billing
or the complete native chatbot path. Captured generation evidence is never
shortened after the answer has been produced.

**Test portfolio.** Extend `evaluation/tests/test_graph_metric_contract.py` for
native factory selection, false-abstention failure and unsupported-claim failure
using fake judges with network blocked. Extend existing routing tests to prove
legacy quality entry points fail before provider access. Add
`evaluation/tests/test_prepare_graph_comparison.py` for Unicode prefix integrity,
whole-input quota enforcement, empty/mixed contexts, leakage and overwrite guards.
Reference wording and documentation need no tests. No runtime is needed.

**Stops and terminal condition.** A changed historical hash, attempted provider
access or missing dependency blocks dependent preparation until resolved. Existing
locked packages may be materialized locally; dependency definitions stay unchanged. Unmatched
inputs stop their comparison rather than being reported as matched. Finish with
reviewed source, offline evidence, prospective private references and a concrete
24-case protocol pending reviewed holdout freeze, future pricing and budget
approval. All prior holds remain. No paid dispatch is available in this package.

**Progress.** Source preparation is implemented. Target `v3-ai` at `618e94fb12`
was merged once for its current spending/capture contracts and framework pin;
both login-test and documentation conflict intents were preserved. The pinned
DeepEval 4.2.5 and tiktoken 0.14.0 pass three metric contracts and six input
preparation tests. Twelve routing and 31 participant-adapter tests, nine evidence
enrichment checks, launcher contracts, source formatting and staged secret scans
pass. Full application builds and live browser/provider checks are outside this
offline preparation; no application runtime was started. Generic Git hooks that
require that runtime were replaced by the applicable focused checks. The data
hygiene hook's documented false-positive override was used only for verified
synthetic credentials in the integration tests; gitleaks remained clean.

The two prospective references and development input preparations are private.
All 269 original artifacts retain their hashes. Each development case matches
all three arms exactly (2,733 and 3,843 rendered user-input tokens). This proves
preparation only: no previous answer is rescored with shortened context. The
24-case protocol covers six single-document, six multi-document, four calculation
or assumption cases and eight unsupported cases, across three arms. Reviewed
held-out goldens remain unfrozen. Native review reports stay in ignored
`project/_local/reviews/`; the single delivery remains draft
[Klicker #6478](https://github.com/uzh-bf/klicker-uzh/pull/6478). Next: review and
freeze source-grounded holdout families, qualify exact future input consumption,
and price the full comparison before requesting any paid dispatch. No new spend
or release of an earlier hold is authorized.

October 11 scope revision: the user approved keeping ingestion and KG
independently operated, with no database changes. The configured Astra review
identified runtime, parser and lifecycle coupling in the canonical-reader design.
The revised [source plan](2026-10-09-graphrag-source-artifact-plan.md) removes that
adapter from draft [Klicker #6460](https://github.com/uzh-bf/klicker-uzh/pull/6460),
[ingestion !229](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/229)
and [KG !36](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/36),
retaining useful independent correctness fixes and regression protection.

KG consumes source references and expected raw hashes through its existing
contract. It requires no live ingestion reader or operation lookup. Dynamic URLs
can still fail digest validation; this revision does not guarantee availability
of earlier bytes or identical parsed text. Producer-owned immutable raw snapshots
are a conditional follow-up, with retention and deletion decisions before work.
Automatic parser-only freshness remains deferred. Earlier canonical checks do
not qualify the revised source. Merge, deployment, live refresh/build, activation
and paid evaluation remain separate gates; OpenRouter review remains waived.

## Current state and next decision

### October 13 provider rollout and single-build comparison — approved

**Goal.** Deliver the qualified classifier correction to the STG provider, build
one graph from the frozen teaching sources, and complete the three-arm evaluation.
Strict validation and independently operated ingestion remain required. The user approved this batch; deployment, publication and retrieval acceptance
still require their evidence gates.

**Authority and terminal condition.** Main owns secrets, live effects, accounting,
test activation and restoration. The user approved the named batch:
 marking provider !42 ready and merging it into `main`, its
configured image publication, marking ready and merging one STG image-reference
MR into GitOps `main`, the resulting STG worker rollout, one fresh graph build,
test-only activation, remaining paid evaluation and temporary connectivity.
The batch also names a temporary pause/restoration of the three STG KG provider
workflows during rollout, with queued work preserved and no cancellation.
Stop at a verified report with restored test settings and closed owned ports, or
at the first failed admission, CI, rollout, publication, accounting or spend gate.
No failed model request or graph build is automatically replayed. A timeout stops
new dispatch; it does not authorize cancellation or a replacement run. Named
human review requirements remain blocking; agents do not request reviewers.

**October 13 execution status — STG blocked at the capability gate.** The
private guards pass their offline checks and independent admission review. The
billing suite rejects 41 invalid cases; the actual relay also verifies serialized
billing, duplicate rejection, queued-call rejection after a billing failure and
halting after a disconnected client. Dispatch requires the dated admission and
hash-bound review receipt. Generation and billing use elapsed-time deadlines.
Historical captures, accounting holds and the evaluation protocol remain pinned.

Provider [MR !42](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/42)
was marked ready and merged at `dbf5e572c1c3c8e73d104079126fc01f494d749d`.
The merged tree equals the reviewed `7a09d426` tree. All required MR checks passed;
the existing legacy quality audit remains an allowed failure. Main
[pipeline 682353](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/pipelines/682353)
passed and its exact image job 2184888 published
`sha256:590f33aa1d82fcaf08f1def3c14823a0fd102047af8d692627062ab3137d58c5`.
A network-disabled, read-only container verifies six source/dependency-file hashes,
LightRAG 1.5.7, imports, the 180-second embedding default and all three pipeline
initialization bindings. Kustomize rendering and independent final review confirm
that the prepared GitOps change affects only the named STG worker image.
[GitOps MR !146](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/146)
is published as draft at `891bb8d`; readiness, merge and deployment stay blocked.
Its exact-head [pipeline 682377](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/pipelines/682377)
passes the configured secret-detection job; rendered scope is verified separately.

The installed STG Hatchet server is **v0.98.9**. Its
[workflow-update handler](https://github.com/hatchet-dev/hatchet/blob/v0.98.9/api/v1/server/handlers/workflows/update.go)
executes `panic("deprecated")`. The generated SDK's `isPaused` field does not prove
a working server control. The official changelog introduces supported workflow
pausing in **v0.105.2**. No pause call was attempted. Therefore the approved
GitOps merge, worker rollout, fresh graph build, test activation and remaining
paid evaluation cannot proceed. An alternative admission mechanism or Hatchet
upgrade needs a separately reviewed plan and named authority. Do not substitute a
worker-local pause or release work without preserving the queue admission boundary.

The terminal read confirms unchanged frozen resources, digest, publication, build
pointers and original test-chatbot settings. No new paid call or graph build ran.
The accepted ledger still counts **CHF 6.99894925**, including all prior holds,
with **CHF 13.00105075 remaining**. Owned loopback ports 14000 and 14001 are closed;
the user's cluster API tunnel remains untouched. The full comparison is blocked,
and provider source delivery alone establishes no retrieval-quality improvement.

**Fresh preparation evidence.** Provider draft !42 is at
`7a09d4263ac7713bc08ed3264d979b4fe4378080`, with successful pipeline 682099.
The source correction `40ff610` retains 93 passing offline tests, Ruff and
completed independent risk, simplification and integrated final reviews. Both
small live classifier probes passed strict raw contracts and now have matching
billing records. This does not prove that the next whole graph will pass.

The STG worker has one ready replica, zero restarts, and serves
`sha256:75bd8dc45365f9ac0ccd50acf424bffe63fe0da4918f05dc148c30dd8edaeeb0`.
Argo `argo/app-kg-content-generation-stg` tracks GitOps `main`; the observed source
revision is `e20be146e64cabfba65c347ffbce07f9a38c1c38`. Its destination is
`stg-kg-content-generation`, deployment
`kg-content-generation-hatchet-worker`. The frozen resource inventory, raw hashes,
content digest, publication/build pointers and original test-chatbot settings
still match the restoration snapshot. The six baseline/control captures and
seven generation ledgers remain saved. No new live effect ran during preparation.

**Budget admission.** All amounts are conservative CHF ceilings, not forecasts.

| Component                                       |     Maximum CHF | Basis                                                                                                                                 |
| ----------------------------------------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| Prior accounting including uncertain-cost holds |      6.99894925 | Accepted private ledger; older unknown-cost and failed-build holds retained                                                           |
| One new graph                                   |            2.50 | Previously approved application-charge basis; balanced charge currently CHF 1; underlying provider token spend remains unattributable |
| Three GraphRAG answers                          |       0.4718592 | Existing fixed low-effort model, four upstream attempts reserved per answer, CHF 2/USD                                                |
| Twenty-seven judge calls                        |       4.0697856 | Existing fixed high-effort judge, four upstream attempts reserved per call, CHF 2/USD                                                 |
| Additional retrieval / native Auto generation   |               0 | At most six searches covered by the existing retrieval hold; no paid native Auto turn admitted                                        |
| Combined ceiling                                | **14.04059405** | Within CHF 20; **5.95940595** remains unallocated                                                                                     |

Before each paid phase, recompute this envelope from the latest accepted ledger,
current model prices and installed retry/fallback semantics. Use finite, complete
usage and exact correlation receipts. Any unsupported bound or unknown cost
retains its entire phase reservation and blocks subsequent paid dispatch. The
unallocated headroom authorizes no extra calls, builds or substitutions.

**Execution sequence and acceptance checks.**

1. **Pin admission and qualify the existing private guards.** Continue in the
   evaluation task worktree and existing framework; preserve protocol hash
   `22bdb92634f6dc707ec98bc54ac242538b932a5e82e0a78188229a688cb038ac`,
   frozen cases, goldens, metrics, prompts and six accepted baseline/control
   answers. The current `generate.py` and `budgeted-eval.py` still hard-code the
   older recovery budget. Update only these private harness helpers and
   `recovery-cost-reconcile.py`, reusing the already-qualified
   `classifier-billing-identity-query.py` for exact billing correlation. Extend
   the existing `--selftest` cases in the two guards and add offline fixture mode
   to the existing reconciliation helper. Use a new dated admission addendum: prior
   CHF 6.99894925, graph 2.50, targets 0.4718592, judges 4.0697856, native 0.
   Keep historical admissions, raw responses, holds and receipts unchanged.
   Bind the new addendum to the exact helper/source hashes, historical snapshot,
   restored test scope and user approval. Paid continuation stays disabled until
   offline guard checks and a read-only independent admission review pass.
   Reject altered totals, nonfinite values, weaker caps, changed historical files,
   missing/surplus billing matches and duplicate dispatch claims. Preserve the
   exclusive process lock and global caps: 10 target attempts, 81 judge calls,
   15 searches including previous usage. The three remaining answers allow at
   most six new searches and 27 judges. Retain the explicit already-approved
   failed baseline/replacement accounting; admit no new replacements.

   Accounting must resolve `metadata.litellm_call_id` to the stored upstream
   Responses request ID, then verify the exact API record against identity,
   model/status, token counters and cost. Each new dispatch ledger must retain
   the gateway call ID, returned response ID and dispatch timestamp before billing
   observation. Missing identity keeps the hold and blocks dependent dispatch.
   Preserve historical reconciled receipts without rewriting old captures.
   A public transformed Chat ID or response
   charge header alone is insufficient. Use only identified call IDs and bounded
   time windows. A single blocking observer may await asynchronous persistence for
   at most 300 seconds, with bounded backoff, 20-second API deadlines and a 45-second
   scoped database-read deadline. It issues no model request; expiry preserves
   the full hold and stops.
   Reopen only `127.0.0.1:14000 -> stg-litellm/litellm:4000` through existing
   `aks-stg-apps-admin` access, with local guard relay 14001 if needed. Use the
   existing restricted `ai-generic-stg` operator credentials at runtime only.
   Current cluster API connectivity must exist; do not establish another route.

2. **Deliver provider and stage its exact image.** Re-fetch provider !42, verify
   exact-head required CI, resolved discussions and any required human approval.
   If substantive source or dependencies changed, stop and requalify that range
   before merging. Mark ready and merge !42 into provider `main`; verify the
   actual merged tree and main pipeline. The configured
   `build_lightrag_latest_arm` publishes `:latest`; derive and record its immutable
   registry digest from that exact main job, rather than treating the mutable tag
   as source proof. Require the candidate image's source/qualified function hashes,
   LightRAG 1.5.7, imports and both 180-second embedding initializers to match.
   CI/publication failure stops before GitOps delivery. Existing PRD GitOps pins
   a separate commit tag; this batch changes only STG.

   Create task worktree `helm-charts/trees/rs/kg-classifier-stg`, branch
   `rs/kg-classifier-stg`, from fresh GitOps `main` in the existing
   `uzh-bf/cloud/helm-charts` repository. Create one draft MR changing only the
   image digest in `kg-content-generation/stg/kustomization.yaml`. Inspect the
   rendered diff, required CI and an applicable independent final review. Preserve
   PRD/base manifests and existing resource requests/limits. Before ready/merge,
   qualify the installed Hatchet workflow pause semantics before mutation. The
   current SDK 1.33.13 exposes `workflow_update` with `isPaused`; read-only STG
   metadata exposes pause state on the exact named workflows. Current docs
   distinguish workflow-global pause from worker-local pause. This is API/source
   evidence, not a live pause test. Verify the deployed server preserves queued
   and scheduled work and existing retries, and maintains pause across replacement
   workers and workflow registration. If that cannot be established, stop before
   GitOps merge; do not upgrade Hatchet or substitute a worker-only pause.

   Snapshot pause state and IDs for exact-name `course-kg-ingestion`,
   `course-kg-correction-preview` and `course-kg-correction-materialization` only,
   in the existing STG content-provider tenant. Prefix/name-substring matches
   (including smoke workflows) are excluded. Confirm these three workflows cover
   all actions served by the named content-profile worker; extra coverage or
   another owner blocks rollout. Temporarily pause only these workflows through
   the existing supported REST control, preserving all queued work and original
   paused states. Only these KG workflow IDs are selected; independently operated data ingestion
   workflows are outside this pause scope. No cancellation, eviction, queue deletion or TTL changes.
   New STG KG build/correction requests may be delayed during this rollout window.
   The supported rollout observer has a 15-minute overall window from first pause.
   Expiry stops new effects and records current pause/queue/worker state; it does
   not authorize unpausing, cancellation or rollback.

   Require zero existing running/retry-pending/durable-active work and all worker
   slots idle after pause, with no active application builds; use one bounded
   observer for existing work settlement. Queued new requests remain preserved,
   explicitly recorded, and cannot start while pause is held. Reverify exclusive
   admission just before merge, throughout rollout and after registration. A lost
   pause or unexpected task stops rollout acceptance. Keep the pause through
   source/image verification, then compare-before-write and restore original
   pause states only after safe serving capacity is verified; prove restoration
   and queued-work preservation before admitting the test build.
   If unrelated work prevents settlement before deployment changes, restore
   pause state using compare-before-write and stop without interrupting it. Verify
   the existing one-replica Deployment is the replica owner (no HPA/KEDA owner),
   and capacity for its one-pod surge at 250m CPU/1Gi request and 1 CPU/1Gi limit.
   No namespace ResourceQuota is currently present; absence is not capacity proof.
   If unrelated work or capacity blocks this gate, pause without interruption or
   quota/resource changes. Mark the STG-only MR ready and merge into GitOps `main`.
   Allow Argo to update only the named STG worker. Require Synced/Healthy,
   observed generation, the exact new registry digest, one ready worker, no old
   active worker, pinned source hashes and LightRAG version before any build.
   Snapshot the previous digest. On failed rollout, stop and report that exact
   revert target; this proposal does not authorize an automatic rollback mutation.

3. **Submit one fresh graph from the frozen sources.** Recheck all six identified
   course-content resources, active raw hashes/versions, content digest and
   independently operated ingestion status. Dynamic bytes must satisfy expected
   hashes; do not refresh sources or bypass validation. Require available build
   quota, no active/duplicate build and unchanged original publication. Submit
   exactly one balanced build for the identified test teaching KB through the
   existing application workflow. Record new build and external operation IDs
   in a private addendum; preserve every prior failed build and response.
   Use one supported blocking watcher for that run. Require strict cleaning,
   allowed categories, nonempty persisted graph, complete frozen source provenance
   and committed fresh FalkorDB publication with matching build ID and digest.
   Inspect this exact run's `cleaning_report.json`, classifier batch/count logs,
   normalization candidate/selected/cap-excluded/accepted/relabelled/unmapped
   counts, preserved/rejected outcomes, noise-pass attempted/executed/failed
   counts, persisted-write checks and final/pre-export validation evidence.
   Require completed strict cleaning without restored-pre-clean defaults and no
   rejected classifier batch hidden by preservation fallback. Legitimate
   conservative retention is separate from failed classifier preservation; if
   available logs/reports cannot distinguish them, record the evidence gap and
   stop recovery acceptance without another build or validator relaxation.
   A zero-candidate category pass is valid but does not prove live repair; retain
   the narrow probe evidence and describe the distinction.
   Reuse the existing publication verifier with the new exact IDs. Failure or
   watcher expiry preserves the build/hold and blocks activation/evaluation.
   Do not reuse a stale publication as successful recovery evidence.

4. **Evaluate only the existing test chatbot.** After publication, capture fresh
   original-state metadata and verify it still matches the restoration snapshot.
   Temporarily bind only the identified STG E2E test chatbot to this teaching KB
   and enable its KG display/GraphRAG within the existing test-only GrowthBook
   targeting and lecturer policy. Preserve all other chatbot/cohort settings.
   If existing targeting cannot isolate this bot, stop before activation rather
   than widening the feature. Use the already-qualified participant adapter with
   runtime-only restricted credentials or issued token; verify authenticated bot
   access without a paid message before collection.

   Use framework `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b`, production retrieval
   functions and frozen fusion/context limits. Collect three GraphRAG selections,
   at most six document searches, three fixed-model answers and 27 judges. Target
   request content stays within 65,536 UTF-8 bytes/73,728 reserved input tokens,
   output 4,096; judge content within 40,960 bytes/45,056 reserved input tokens,
   output 8,192. Revalidate complete routes, prices, reasoning efforts, disabled
   fallback/client retries and the conservative four-attempt gateway bound before
   dispatch. Inputs beyond caps stop; do not silently truncate the test cases.
   Require receipts proving the fresh build used by actual retrieval. For each
   of the two frozen bridge cases, require useful attributable graph expansion
   and source evidence; absent contributions are mechanism failure even when
   baseline evidence yields a fluent answer. For the frozen unsupported-topic
   case, accept appropriately declined expansion and an evidence-grounded
   unsupported response. Do not require invented graph contributions there.
   Reconcile each paid request
   before admitting the next paid phase. Do not alter frozen expected answers or
   regenerate baseline/control results.

   On student UI, check sidebar, autocomplete/navigation, fullscreen and node/
   relation “ask about this” prefill without sending. Record real interaction
   evidence and private screenshots. These checks establish map interaction;
   harness answer quality and native persisted-chat acceptance remain separate.
   Paid Auto-mode/persisted-message E2E requires later cost qualification.

5. **Close out and restore on every terminal branch.** Report all nine accepted
   answers by case/arm with semantic/context/faithfulness metrics, citation/source
   retention, graph contributions, latency and reconciled costs. State incomplete
   arms and failures explicitly; three cases do not establish statistical uplift.
   Verify retained baseline/control hashes and report goldens' existing rubric
   limitations. Restore exact original test bindings and both feature settings,
   preserving unrelated operator changes through a fresh compare-before-write;
   a conflicting edit blocks restoration of that field and is reported for the
   operator. Verify source/build/publication state expected from this one build.
   Keep a successful graph publication; do not delete/revert data. Restore changed
   workflow pause states using compare-before-write before deployment changes,
   or after verifying safe serving capacity. Otherwise retain the pause, record
   each workflow’s known/unknown state and preserved queued-work evidence, and
   report the operator blocker without claiming restored closure. The 15-minute
   observation deadline authorizes neither unsafe unpausing nor rollback. Close only
   owned loopback forwarding and guard relay processes, prove ports 14000/14001
   closed and preserve the user's API tunnel. Preserve all unknown-cost holds.

**Delegation Map.** Main owns each effect-bearing step; privacy, secrets, shared
worker coordination and cumulative accounting make these steps coupled. Review
roles are read-only and own no operational writes.

| Step / owner | Dependency                                            | Acceptance                                                                                |
| ------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1 / main     | Reviewed plan and named batch approval                | Immutable admission, offline guards and independent admission reviewer pass               |
| 2 / main     | Accepted classifier probes and step 1                 | Exact main image, reviewed STG digest MR, exclusive pause and healthy serving proof       |
| 3 / main     | Step 2 and restored provider admission                | One fresh strictly validated, provenance-complete publication                             |
| 4 / main     | Step 3, authenticated isolated bot and admitted costs | Three frozen GraphRAG cases, 27 judges and private map interaction evidence               |
| 5 / main     | Success or any terminal failure                       | Honest complete/incomplete report, retained holds, restored states and closed owned ports |

Astra is the plan challenger. An independent admission reviewer covers the new
private guard/accounting changes and an independent GitOps final reviewer covers
the one image-reference change. Reuse source reviews on unchanged provider code;
new source changes require their applicable review and qualification.

**Feature-wide test portfolio.** Extend existing guard self-tests for cumulative
accounting, duplicate dispatch, historical file/cap tampering and nonfinite input.
Reuse and extend the existing billing fixtures for transformed response IDs,
asynchronous zero-then-one persistence, ambiguous/missing records, mismatched
usage/status/model and deadlines. Verify six accepted selection hashes and seven
historical generation ledgers unchanged. No new provider tests for unchanged
qualified behavior; existing 93-test evidence is reused. Check only the rendered
STG image diff and workflow pause contract for delivery; no new app/runtime or
production-source changes solely for tests. UI checks use the existing browser
and scoped authenticated test actor.

**Private artifact contract.** All files below live in the existing private
`/private/tmp/graphrag-teaching-stg-20261012` directory. New files use exclusive
creation; historical files remain immutable. The new batch uses
`rollout-budget-admission-20261013.json`,
`rollout-admission-review-20261013.json` and
`rollout-guard-offline-20261013.json` for admission;
`rollout-workflow-pause-snapshot-20261013.json` and
`rollout-serving-proof-20261013.json` for rollout;
`rollout-build-receipt-20261013.json` and
`rollout-publication-receipt-20261013.json` for the new exact run; and
`rollout-cost-receipt-20261013.json`, `rollout-comparison-20261013.json` and
`rollout-cleanup-receipt-20261013.json` for closeout. Update only `recovery-publication.mjs` and
`recovery-comparison-summary.py` receipt inputs to these explicit names, preserving
their verification behavior. Existing case selection, answer, generation, graph
judge/guard filenames remain exclusive and are created only if absent.
`continuation-state.json` records links and admission status; it never replaces
raw receipts or authorizes a stopped paid request. No new evaluation framework.

**Progress / next action.** The user approved the complete bounded batch.
Main starts with fresh guard qualification and preserves each conditional gate. The existing native goal remains blocked
until its supported resume control is available; do not replace it or mark the
full comparison complete. Provider !42 and Klicker #6478 remain draft. Main owns
admission and operational execution; Astra challenges this plan, and independent
admission/GitOps reviews cover their named new scopes before effects. Strict
validators, taxonomy, ingestion interfaces and database schema remain unchanged.
Raw teaching material, tokens, classifier bodies, private IDs and cost receipts
stay under `/private/tmp/graphrag-teaching-stg-20261012`, outside public Git.

### October 13 billing resolved and remaining category probe qualified

The user approved diagnosing accounting and running the unused category call once
its prerequisite reconciled. Scoped, read-only queries found the noise record by
its exact saved gateway call ID in `metadata.litellm_call_id`. LiteLLM 1.96.0 logs
the upstream Responses response ID; its Responses-to-Chat transformation returns
a different generated Chat ID. Treating either the public Chat ID or gateway call
ID as the billing primary key explains the previous empty lookups. An exact API
lookup using the discovered stored ID returned the same record, matching all three
token counters, successful status, model group and cost. The noise cost reconciles
at USD 0.0001438, conservatively CHF 0.0002876.

The category-only continuation preserves the frozen source/input pins, accepted
noise evidence and all earlier uncertain-cost holds. Its exclusive claim prevents
noise replay and a second category request. Five offline response variants and
15 billing rejection variants pass. The independent admission review accepted
corrections binding accounting to the maximum validated charge and imposing an
overall billing-read deadline. Fresh gateway identity, prices and retry/fallback
controls match prior qualification; the category reservation is CHF 0.2784.

Exactly one category call ran on the retained synthetic concept. Its raw response
contains the complete expected allowed category, stop finish and no refusal. It
reports 219 input and 47 output tokens, zero retries/fallbacks, and
USD 0.000045400000000000006. The immediate billing query found no row, so the
online guard withheld acceptance; the provider function recorded a malformed
outcome after that guard exception. A single terminal exact lookup found the
persisted record. Its identity, usage and cost match both the database and API.
The unchanged production parser accepts the saved response offline. This separates
raw semantic success and parser qualification from the initial accounting race;
no second model call was made.

Both narrow probe phases are now semantically accepted and reconciled. The unused
probe hold is released. Conservative total accounting, rounded upward and retaining
all older uncertain-cost holds, is **CHF 6.99894925**, with **CHF 13.00105075**
remaining. These results qualify the two classifier contracts on this small
sample; they do not prove fresh whole-graph publication or retrieval quality.
Future graph/answer/judge reservations would yield a planning ceiling of
CHF 14.04059405, leaving CHF 5.95940595 unallocated. Those effects remain gated.

Original test bindings/settings, source inventory/hashes, content digest, build
pointer and graph publication match the restoration snapshot. The owned tunnel
stopped and ports 14000/14001 are closed; the user API tunnel is preserved. No
provider or gateway configuration, ingestion workflow, database schema, strict
validator or feature activation changed. No merge, deployment, graph build,
answer generation or judge call ran. Provider MR !42 and Klicker PR #6478 remain
draft; exact provider pipeline 682099 still passes at `7a09d42`.

Next, prepare a new conditional delivery and single-build comparison plan using
this accepted probe evidence, with named approval before its live effects. Preserve
the frozen sources, three
GraphRAG cases, 27 remaining judge calls, baseline and extra-search control.
Future accounting should resolve the stored request ID through the exact gateway
correlation metadata and tolerate asynchronous persistence through a bounded
observer; never substitute response-header cost for complete reconciliation.
Native Auto-mode cost qualification remains a separate gate.

### October 13 context probe: noise decisions accepted; billing blocks continuation

After the user restored the existing STG API tunnel, the approved CHF 0.50 probe
passed fresh admission. The installed gateway is LiteLLM 1.96.0; effective model
prices, retry/fallback controls and installed routing semantics establish the
conservative 24-attempt envelope within CHF 0.4416. Exact provider head
`7a09d4263ac7713bc08ed3264d979b4fe4378080` retains successful pipeline 682099.
Frozen source and input hashes matched before dispatch.

One context-aware noise call returned HTTP 200, stop finish, no refusal, and the
complete expected four-item map: all three frozen incidental examples were noise,
and the synthetic concept was retained. The raw result passed unique-key and
complete-map validation. This is narrow live evidence for the descriptions-based
noise correction; it does not establish survivor category repair, whole-graph
publication or retrieval quality. The gateway reported 993 input and 89 output
tokens, zero retries/fallbacks, and USD 0.0001438.

The harness's exact billing lookup returned zero rows. A terminal read by both
response ID and gateway call ID also returned zero rows. Consequently spend is
unreconciled, the category request was not dispatched, and the conditional
sequence stopped. No replacement request, merge, deployment, graph build,
activation, answer generation or judge call followed. Preserve the exclusive
noise claim and private raw response; do not replay the accepted request.

Retain the full new CHF 0.50 hold and every previous uncertain-cost hold.
Conservative accounting is **CHF 7.49857084**, leaving **CHF 12.50142916** of
CHF 20. The gateway's small response charge is reported metadata, not reconciled
actual spend. The future graph/answer/judge planning ceiling remains
CHF 14.54021564; those effects have not been admitted by this probe.

Original test-chatbot bindings/settings, source inventory and hashes, content
digest, active-build pointer and publication match the restoration snapshot.
No restoration mutation was needed. The owned loopback tunnel stopped and ports
14000 and 14001 are closed; the user's STG API tunnel was preserved. Receipts and
real teaching evidence remain outside the public repository. Provider MR !42 and
Klicker PR #6478 remain draft; source qualification is separate from delivery.

Next, diagnose why exact gateway spend records are absent using the saved request
identifiers and scoped gateway accounting evidence. Establish a reconciled cost
receipt before admitting the unused conditional category call; do not repeat the
noise call. Only successful category qualification can support a new reviewed
conditional merge, STG rollout, single-build and remaining-evaluation plan.
Strict validation and ingestion independence remain required throughout.

### October 13 approved context probe: connectivity blocked before dispatch

The user approved the bounded CHF 0.50 context probe within the original CHF 20
budget. Exact provider draft head `7a09d4263ac7713bc08ed3264d979b4fe4378080`
now has successful pipeline **682099**. Source remains unchanged and prior
93-test, Ruff and independent review evidence remains applicable. All eight
private harness guard variants passed again; source and frozen input pins match.
The billing lookup uses the actual dispatch date, including the next UTC day.

The existing `aks-stg-apps-admin` Kubernetes endpoint is `localhost:6443`, which
refuses connections. The user-provided STG API tunnel is unavailable. Consequently
current gateway retry semantics, prices and prior billing cannot be refreshed,
so admission stopped before any live claim or paid request. No replacement cluster
route was established. Loopback ports 6443, 14000 and 14001 are closed.

No new spend or hold was consumed: conservative accounting remains
**CHF 6.99857084**, with **CHF 13.00142916** remaining. CHF 0.50 is approved for
this next probe, but not counted as spent before dispatch. The last verified original
test-chatbot/source/publication state is the October 12 terminal receipt; live
reverification is unavailable through the disconnected cluster. No state mutation,
merge, deployment or graph build occurred in this step.

Resume the same approved probe after the existing STG API tunnel is restored.
Refresh gateway-version/configuration-bound cost qualification and exact billing,
then perform the guarded noise call and conditional category call. Existing user
approval persists; restoring capability does not require another probe approval.
The prior failed calls remain non-replayable and all uncertain billing holds remain.

### October 12 names-only diagnosis and next context probe (prepared)

Saved evidence confirms the raw noise response kept two of three residual examples.
The classifier received names without descriptions. The production GraphML reader
also discards descriptions before noise planning, and generic preservation guidance
competes with the course policy's evidence-dependent exclusions. These are verified
source gaps; the causal explanation of the model's decisions remains a hypothesis.

Provider MR !42 now reads bounded descriptions from the existing local GraphML,
wires them through the existing pipeline and standalone cleaner, and supplies
indexed JSON evidence. It clarifies course-policy precedence for incidental examples.
Descriptions over 1,000 characters are preserved in code. Rejected, partial,
duplicate-key, refused or non-stop responses preserve the whole batch. Complete
request content exceeding 64,000 UTF-8 bytes including the protocol allowance
is preserved without dispatch or splitting. Graph read errors abort before calls
or plan writes; diagnostics omit provider exception bodies. Pattern-based noise
behavior remains an existing limitation. Strict category, persisted-write and
final/pre-export validation remain in place; ingestion remains independently
operated, with no database, dependency, taxonomy or global routing changes.

Offline source qualification: 93 tests and Ruff pass under LightRAG 1.5.7.
Source commit `40ff610` has passing independent risk and integrated final reviews;
simplification found no useful reduction. Provider draft head is `7a09d42`. The
private v3 harness uses exact source functions and the frozen residual descriptions
plus a synthetic retained concept. It accepts the synthetic complete result and
rejects missing/wrong noise labels, empty category output, refusal and truncation.
Measured input bounds are 1,555 noise and 746 category tokens. These are fabricated
response checks, not live semantic acceptance. Its live path remains disabled.

**Proposed next bounded probe.** Main owns admission, effects and cleanup. Approval
would cover reopening only `127.0.0.1:14000 -> stg-litellm/litellm:4000` using
existing STG access and the existing restricted `ai-generic-stg` gateway credential,
then at most two sequential calls. Recheck the complete effective Azure route,
model prices, retry/fallback controls and previous exact-request billing before
admitting the unchanged exact Luna alias. Stop if a conservative bound cannot
fit the CHF 0.50 reservation. No new secret permissions or broad traffic discovery.

1. Call the exact noise classifier once on the three frozen names **and their
   descriptions**, plus the synthetic anchor. Require one complete raw map with
   unique identities/keys, stop finish, no refusal, three noise labels and one
   retained concept. Do not infer acceptance from production preservation defaults.
2. Only after accepted noise decisions and reconciled new-call spend, call the
   existing category classifier once on the same meaningful synthetic anchor.
   Require its expected allowed category and the complete strict response contract.
   Unresolved spend or any rejected result stops the dependent branch. No automatic
   repeats, substitutions or replacement calls; exclusive v3 claims preserve all
   prior failed evidence.
3. Each request has at most 5,000 input tokens, measured as the larger
   cl100k_base/o200k_base count across all message content plus 512 protocol tokens.
   Noise output 2,000, category output 4,000; 120-second deadline, one client attempt.
   The proposed envelope is 24 upstream attempts per request: six possible route
   selections times four attempts, based on max_fallbacks five and num_retries three.
   At the recorded worst route rates and CHF 2/USD, both requests total CHF 0.4416.
   The installed gateway version and retry semantics must establish this envelope
   before admission; unsupported or more expensive controls stop dispatch.
4. On success, rejection, timeout, interruption or post-connectivity preflight failure,
   main retains private responses/cost receipts and verifies original
   test chatbot/source/publication state, and closes the exact recorded forwarding process, proving its ports closed.
   Unresolved billing or cleanup retains holds and blocks continuation without replay. This probe
   creates no graph build or activation and does not qualify whole-graph recovery.
   Conditional delivery and evaluation remain stopped until a reviewed successful
   admission is available.

Conservative current accounting **CHF 6.99857084**, remaining **CHF 13.00142916**.
With the proposed CHF 0.50 probe hold: **CHF 7.49857084**, leaving **CHF 12.50142916**.
The later graph/answer/judge reservations would bring the combined planning ceiling
to **CHF 14.54021564**, leaving CHF 5.45978436 unallocated; they are not admitted
by this source/probe-preparation step. Existing failed-build and unresolved probe
holds remain. Graph accounting still uses the approved application-charge basis.
No new paid call or cluster connectivity ran while qualifying this correction.

The private source manifest pins the actual loaded bytes of pipeline, cleaner,
constants, domain-policy renderer, frozen candidates/policy and evaluation protocol.
The harness requires fresh admission evidence before each live dispatch, aged zero
to five minutes, plus gateway-version/configuration-bound qualification of the
24-attempt ceiling and confirmation that every prior billing hold remains counted.
Missing or mismatched evidence blocks an exclusive claim before dispatch. Billing
requires each reported charge to be finite/nonnegative and an exact token-matched
row; any gateway retry/fallback blocks category dispatch until every charge can be
reconciled. All raw responses and billing evidence remain private. Live execution
remains guarded until the user approves the corrected probe scope.

### October 12 latest execution: noise classification blocks recovery

The user approved the two-probe batch and conditional delivery sequence below.
Provider MR !42 exact-head pipeline **682060 passed** at
`1d84e768301ff9e9cad3498e989070ca21a1e174`. Existing source reviews and
86-test qualification remain valid. Live qualification failed before delivery.

One noise-classifier call ran through the approved Azure gateway with the exact
source, frozen policy, three residual names and synthetic retained concept.
It returned HTTP 200, stop finish, no refusal, and all four decisions. It retained
two residual examples as theory, removed one as noise, and retained the synthetic
concept. This fails the required three-noise/one-theory result. The outcome comes
from the raw response, not preservation defaults. Strict validation remains intact.
The category probe was not dispatched; no merge, deployment, graph build,
activation, answer generation or judge call followed.

Gateway response metadata reports 726 input and 162 output tokens, zero retries
or fallbacks, and USD 0.0001536. Exact billing lookups by both the response ID and
gateway call ID returned no rows. Retain the full CHF 0.20 reservation, plus the
prior CHF 0.10 hold. Conservative accounting including holds is now
**CHF 6.99857084**, leaving **CHF 13.00142916** of the original CHF 20 ceiling.
This is reserved accounting, not a claim of reconciled actual spend.

The test chatbot's original bindings/settings, KB resource inventory and hashes,
content digest, active-build pointer and graph publication were verified unchanged.
No restoration mutation was needed. The owned tunnel closed; ports 14000 and
14001 were verified closed. Private response, admission, cost and cleanup receipts
remain in the existing private protocol directory. Both source and evaluation
requests remain draft; the conditional merge/build sequence is stopped.

The next investigation should test why the names-only noise prompt retains these
examples, using the saved response and source evidence before another paid call.
Moving noise removal earlier fixes ordering but does not establish semantic
recovery. Evaluate whether descriptions and relation context let the existing
policy distinguish examples from reusable concepts. Preserve uncertain nodes and
strict category validation; do not force deletion or assign fallback categories
just to pass this dataset. Any changed classifier needs offline qualification and
a revised bounded live admission. The three-arm retrieval comparison remains
incomplete, so no new retrieval-quality conclusion is supported.

### October 12 correction and bounded probe (approved; acceptance failed)

The empty result exposed a responsibility conflict: strict category repair required
labels for policy-excluded concrete examples before noise removal could inspect
them. Cleaning exclusion/merge guidance also entered the category prompt. This is
a source-level conflict; one response cannot establish the model's causal reasoning.

[Provider MR !42](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/42)
now removes policy noise before strict category repair and removes deletion guidance
from classification. It retains canonical definitions, candidate evidence, category
caps, complete-batch rejection, persisted-write checks and final/pre-export strict
validation. Invalid category policies fail before noise runs. Legacy ordering is
unchanged. The existing preservation defaults still apply to uncertain noise calls;
invalid categories alone never authorize deletion. Ingestion remains independent,
with no database changes. Offline qualification: 86 tests and Ruff pass under
LightRAG 1.5.7; source `1d84e768301ff9e9cad3498e989070ca21a1e174`.

**Approved batch specification.** Main owns admission, effects and cleanup. Reopen only
`127.0.0.1:14000 -> stg-litellm/litellm:4000` through existing STG access, inject the
existing restricted gateway credential, recheck prices/retry/fallback controls and
reconcile the prior probe when its billing row exists. Preserve its CHF 0.10 hold
until then. No broad traffic discovery or new secret permissions.

1. Run at most two sequential probe calls using the exact corrected source.
   First use the existing noise classifier on the three frozen residual names and
   one synthetic retained concept. Require a raw complete response identifying
   those three as noise and the anchor as theory: stop finish, no refusal,
   truncation, missing identities or unexpected decisions. Do not infer success
   from preservation defaults. On success only, call category repair once on the
   frozen synthetic concept with meaningful evidence and require its allowed
   category. This second call proves the request contract, not real-survivor
   semantics or whole-graph recovery. No fallback labels or automatic repeat.
2. Each request has at most 5,000 input tokens, a 120-second deadline and one
   client attempt. Noise uses the unchanged resolved route: exact Azure Luna alias,
   no explicit effort, temperature zero, 2,000 output tokens. Category uses the same
   alias, medium effort, no temperature, 4,000 output tokens. The previous route
   configuration bound both at CHF 0.1472, including gateway retries/fallbacks and
   CHF 2/USD. Recheck every assumption; admit only within CHF 0.20. Preserve raw
   evidence privately and reconcile every call; unresolved new spend blocks further
   dispatch. A failed condition stops the dependent sequence.
3. Only after probe acceptance, required reviews and exact-head CI: mark provider
   MR !42 ready, merge to main, verify the published immutable image; create one
   GitOps MR against main updating only `kg-content-generation/stg/kustomization.yaml`,
   require render review and checks, mark ready/merge, then deploy the STG KG worker
   through Argo after proving worker slots idle and no active builds. Verify exact
   digest, source, LightRAG version and serving health. No unapproved rollback.
4. Submit exactly one new graph build for the frozen six-resource TEST Finance I
   inventory and unchanged course-content source digest. Require successful strict
   cleaning, expected source selection and fresh committed publication. Only then
   bind the existing test chatbot, run the remaining three GraphRAG answers and at
   most six searches, score 27 judges in the frozen evaluation framework, and check
   graph navigation/prefill without a paid native Auto turn. Retain the existing
   ordinary-RAG and extra-search-control results and all global call caps.
5. On every terminal branch restore the exact original test bindings/settings,
   verify unchanged broader scope, close owned tunnel/relay, retain all failed
   evidence and report actual quality separately from synthetic mechanism proof.
   No retries, replacement calls or replacement builds.

Budget including existing holds: CHF 6.79857084. New reservations: probe CHF 0.20,
new graph CHF 2.50, three answers CHF 0.4718592, 27 judges CHF 4.0697856.
Total conservative ceiling **CHF 14.04021564 of CHF 20**, leaving CHF 5.95978436
unallocated. Existing retrieval hold covers remaining searches; both failed graph
holds remain. Graph accounting still uses the approved application-charge basis.

The existing private `classifier-probe.py` harness now validates both source call
shapes offline, rejects missing/wrong noise decisions and empty category output,
and refuses live execution until admission is separately approved and completed.
Measured dry-run input bounds: 1,273 noise / 746 category tokens. Prior receipts
are preserved. Live qualification must also validate raw refusal/finish conditions,
exclusive per-call claims, source/policy hashes, current retry/pricing assumptions,
and exact-request billing before dispatch proceeds. No new paid calls occurred
while preparing this correction. Do not mistake offline fabricated responses for
model acceptance.

### October 12 approved batch: classifier gate failed

The user approved the bounded probe, conditional merges and STG deployment,
one graph build and evaluation within CHF 20. The exact provider head
`da665ef3e9c15df904c6dbc23bbf6d27494b085e` passed pipeline 682010;
required GitLab approvals were satisfied. The previously reviewed source is
unchanged. No provider or GitOps merge occurred.

The single live Azure classifier probe returned HTTP 200 with stop finish and
no refusal, but an empty classifications array for three requested identities.
Strict validation rejected it with `incomplete`, accepted zero. The request used
the exact source classifier and rendered domain policy, medium reasoning,
4,000 output tokens, one client attempt and a 120-second timeout. The measured
input bound was 1,266 tokens against the approved 5,000. Gateway headers report
zero retries and fallbacks, 783 total tokens and USD 0.0001219 response cost.
This proves the request is accepted by the route, not successful classification.
The historical whole-build cause remains unproved.

The failed qualification blocks all dependent merges, deployment, graph build,
activation and evaluation. No replacement request is authorized. The original
test-chatbot bindings and settings, source digest, active-build pointer and
published graph were verified unchanged. Keep the full CHF 0.10 probe hold
until exact-request billing reconciliation succeeds: conservative accounting
including holds is CHF 6.79857084, leaving CHF 13.20142916. No new graph,
answer or judge call ran. The owned tunnel is closed; ports 14000 and 14001
were verified closed.
Private receipts remain under the existing protocol root.

Next scope: diagnose why the classifier returned no labels, using the retained
private response and exact prompt. Qualify any correction offline while preserving
strict completeness checks and independent ingestion. A further paid probe/build
needs a revised bounded admission; do not silently repeat this failed batch.

### October 12 classifier qualification and approved batch specification

**Approval summary.** Source diagnosis and qualification were authorized. The
provider fix is in [draft MR !42](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/42),
source `91acaa7d4d7ae0cb16429f6c4beb589c9ca5de07`, based on merged `main`
`f2fc09c30b3d696e7bd1cf4dcc2ecae5941bf8d4`. Sixty focused tests pass offline
with LightRAG 1.5.7. The exact Azure gateway alias now receives classifier
reasoning configuration without changing its transmitted model or request budget.
Incomplete/refused/non-stop classifications fail closed. Safe batch reasons and
repair counters survive the strict-validation failure. Ingestion remains
independent; no database, dependency or global routing changes are included.

The historic cause remains unconfirmed. Three residual invalid nodes cannot
exclude an initial candidate set over the repair cap. The old report lost those
counts, and no classifier response receipt exists. This section supersedes any
interpretation below that the residual count ruled out cap exhaustion. The patch
qualifies request and failure behavior; it does not prove that the next graph will
pass. Keep strict validation, the 256-node cap and verified persisted writes.

**Approved executable batch — stopped at the failed classifier gate above.** First qualify the exact
classifier request through the existing STG Azure gateway, then conditionally
mark ready and merge provider MR !42 into `main`, publish its immutable worker
image, create/mark-ready/merge the STG-only image-reference MR in
`uzh-bf/cloud/helm-charts` against `main`, and allow Argo to update only the STG
KG worker. Run one new build on the same frozen source hashes. Only a fresh,
validated publication admits the remaining three GraphRAG answers, 27 judge calls
and student KG navigation checks. Restore the original test chatbot scope and
close temporary connectivity on every terminal branch. No automatic retries or
replacement builds; a failed condition blocks its dependent branch.

The proposed total conservative ceiling is **CHF 13.84021564 of CHF 20**, leaving
CHF 6.15978436 unallocated. This includes the current CHF 6.69857084 and both
failed-build holds. New reservations are CHF 0.10 for the classifier probe,
CHF 2.50 for one build, CHF 0.4718592 for three fixed-model answers and
CHF 4.0697856 for 27 judges. The existing retrieval reservation covers at most six
remaining searches. The graph uses the previously approved application-charge
basis; underlying provider spend remains unattributable. Native Auto generation
is excluded from admission until its full routing/retry cost is bounded. The
student graph checks can run without sending a message.

**Execution details and gates.** Main owns operational admission, private data,
spend, activation, integration and cleanup. The existing framework and guards own
capture/scoring; no new ingestion adapter or evaluation framework is introduced.

1. **Preflight and classifier probe.** Verify required source checks and completed
   reviews on MR !42's exact head. Reopen only the temporary loopback mapping
   `127.0.0.1:14000 -> stg-litellm/litellm:4000` through the existing
   `aks-stg-apps-admin` access. Use the restricted `ai-generic-stg` operator profile
   for runtime-only gateway authentication. Inspect current pricing, retry and
   fallback configuration with values suppressed. Qualify one request from the
   exact source classifier, using bounded evidence from the three retained failed
   graph candidates and their existing policy, through
   `klickeruzh/azure/gpt-6-luna`. Limit total input to 5,000 tokens, output to 4,000,
   timeout to 120 seconds, client attempts to one. Admit only if all gateway retry
   and fallback attempts remain within CHF 0.10; otherwise stop before dispatch.
   Preserve the historical graph unchanged. Require stop finish, complete unique
   allowed labels, no refusal, safe diagnostic counts, and cost reconciliation.
   Keep source evidence and response labels private. This verifies classification
   of the residue, not the historic initial candidate count or full graph quality.
2. **Conditional provider delivery.** After successful probe and required CI and
   human review, mark MR !42 ready and merge into provider `main`. Require the
   merged-main checks and image-publication job to pass; verify commit-to-registry
   digest. Create one GitOps MR changing only
   `kg-content-generation/stg/kustomization.yaml`; no PRD manifest or shared
   infrastructure edits. Require structural render review, required checks and
   any human approval before marking ready and merging. Before rollout, verify no
   active graph builds and all worker slots idle. Verify Argo Synced/Healthy,
   ready worker, source hash, exact image digest and LightRAG 1.5.7. On failure,
   stop dependent work and report; no unapproved rollback or broader mutation.
3. **One new graph.** Revalidate the six-resource TEST Finance I inventory,
   source hashes and course-content selection against the private frozen protocol.
   Require unchanged digest, no ingestion in progress, available quota and no
   duplicate active build. Submit exactly one new build for that KB through the
   existing application workflow. Bind the returned build/run IDs in a new private
   addendum; never overwrite prior failed receipts. Observe the same run with one
   supported blocking watcher. An observer timeout does not grant cancellation,
   resubmission or another build. Require successful strict cleaning, nonempty
   graph, matching source provenance, and committed fresh FalkorDB publication.
   Preserve any failure and hold its cost; stop before activation/evaluation.
4. **Test-only comparison and UI.** Only bind the fresh teaching publication to
   the existing STG E2E test chatbot, preserving existing GrowthBook targeting and
   all other chatbots. The private restoration snapshot remains authoritative.
   Reuse framework `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b`, frozen questions,
   goldens, baseline/control receipts, identical prompt/model/effort and production
   fusion limits. Execute three GraphRAG cases and at most six searches, then
   27 judges through the guarded framework. Global caps remain 15 searches,
   10 target attempts and 81 judge calls including prior usage. Any unresolved
   cost or invalid provenance blocks further dispatch; never replay silently.
   Check student sidebar, search, fullscreen and ask-about-this prefill without
   sending. Report harness quality, map interaction and native chat acceptance
   separately; native paid Auto acceptance remains open.
5. **Terminal accounting and restoration.** Compare all nine accepted answers
   with their original evidence; report per-case results, source retention,
   citations, latency and cost limitations. Do not claim statistical uplift from
   this three-case pilot or change frozen goldens. Restore exact original KB
   bindings and feature settings on success or failure and verify them. Close
   the owned loopback tunnel and any local judge relay; verify their ports are
   closed. Preserve source/runtime identities and failed evidence. Stop at complete
   report/cleanup, or the first failed qualification, publication or budget gate.

The private protocol, original restoration snapshot, source pins and cost guards
remain under `/private/tmp/graphrag-teaching-stg-20261012`; no teaching material,
credentials, classifier bodies or raw captures enter public Git. The user-approved
source terminal was a reviewed draft; the user subsequently approved this batch.
Its failed qualification branch is recorded above.

October 11: the canonical-reader design is superseded by independent workflows.
Source fidelity remains a qualification requirement. Use stable, digest-verified
inputs for staging mechanism and quality comparisons. If a mutable corpus cannot
supply its expected bytes, stop that build and scope producer-owned raw snapshots;
do not silently refresh or bypass the hash guard. Student-map interaction can be
qualified on existing immutable synthetic input. The document-tool repair in
[PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421) is merged; serving and
persisted-message acceptance remain separate evidence. No fresh deployment or
retrieval-quality claim is made by this checkpoint.

### Historical October 7 review

October 7 review, observed at 19:45 Europe/Zurich. This revision reconciles the existing package and refines its remaining roadmap; it does not activate features or execute a new experiment. Source repair stays within the previously approved reliability scope. Merge, ready status, deployment, activation, rebuilds and new spend retain their separate authority boundaries.

| Boundary             | Verified state                                                                                                                                                                                                           | Consequence                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source               | Draft [PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421), `4dad75b11c9efb2b578b1d828f033317fa06827a`, base `v3-ai`; mergeable but blocked                                                                       | Not merge-ready                                                                                                                                                  |
| Hosted qualification | [Unit run](https://github.com/uzh-bf/klicker-uzh/actions/runs/37613222215) fails three Chat tests in existing real-HTTP transport/compatibility suites; build and hosted Playwright pass                                 | The queue reads `options.abortSignal` when callers omit options. Installation precedes the retrieval gate, so flag-off does not bypass this compatibility defect |
| Review               | OpenCodeReview timed out on two of three files despite its green job; `final-ai-review` remains pending with actual review jobs skipped                                                                                  | Prior independent source review passed its range but missed this caller contract; neither workflow status substitutes for complete qualification                 |
| Staging              | Argo Synced/Healthy at `80fd916da072095845186c4d7834fa77e50d37b9`; ready matching Chat/backends; matching migration job succeeded. Chat digest `sha256:deed5c6fe0d62d963f7ae06254193b3dbd03f1a0df6bbe8d80c2781857385aba` | The earlier graph feature serves; PR #6421's serialization/diagnostics follow-up is absent                                                                       |
| Evidence             | Local focused checks passed; original live null cause, authenticated persistence, fleet disablement and real-data uplift remain unproved                                                                                 | Qualification proceeds through separate mechanism, operational and quality receipts                                                                              |

At review start the task branch was clean and synchronized; this review changes only the two roadmap documents locally. Current `v3-ai` is `510ca5501d954c268daf34a5767cf25532adaec4`; its drift from the package base touches four Playwright/documentation files. Drift alone does not require integration. Re-evaluate target interactions at readiness instead of repeatedly refreshing the branch. The temporary verification runtime is stopped with zero exact routes.

## Remaining roadmap

Each milestone ends with a disposition and evidence, rather than an automatic tuning or rollout loop. Main owns integration and operational decisions. Assign separable harness work one owner when its contract is settled; no additional tasks or source changes are launched by this roadmap review.

| Milestone                                                 | Dependency and owner                                                                                                                                                                                                                              | Acceptance and stop condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Restore document-tool compatibility                    | Chat maintainer; merged [PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421)                                                                                                                                                               | Source repair delivered. Retain omitted/supplied options, raw-provider lifetime, cancellation, null handling and queue regression checks. Serving and persisted-message proof remain separate acceptance receipts                                                                                                                                                                                                                                                                                 |
| 1a. Qualify independent workflows and source guards       | Ingestion, KG and Klicker owners; [source plan](2026-10-09-graphrag-source-artifact-plan.md), approved independent-workflow revision                                                                                                              | Remove ingestion-reader and shared-flag dependencies without DB changes; retain accounting and publication fixes. Prove KG independence, raw digest rejection, replacement/deletion and ordinary contracts. Dynamic-URL reproducibility and parser-only freshness remain deferred. Delivery ends at reviewed drafts and exact-head CI                                                                                                                                                             |
| 2. Verify deployed boundaries and student map             | Main/operator; qualified source and serving proof; stable digest-verified inputs or separately qualified raw snapshots for the identified mutable-URL KB; controlled actor and current published graph                                            | Record exact revision/digest/migration proof and a separate map scorecard: map/retrieval policy combinations, direct-route enforcement, autocomplete/exploration, sidebar/fullscreen, ask-about-this prefill without automatic send, thread preservation, mobile/keyboard behavior and publication replacement/staleness. Reuse existing browser harness and synthetic fixtures. A map failure blocks map rollout; a retrieval failure does not by itself invalidate independent map availability |
| 3. Prove retrieval mechanism, persistence and disablement | Main; deployed qualified follow-up and milestone 1a contract; controlled chatbot/KB with a current graph built from digest-verified inputs; approved provider/data boundary, fresh total spend ceiling and named activation/disablement authority | Run the six-turn probe below, then synthetic failure/withdrawal checks. Require actual provider dispatch, useful new bridge evidence, correct persisted citations after reload and verified safe disablement. Stop activation on scope leakage, invalid citations, bounded-termination failure or unusable evidence receipts. Six turns qualify mechanism only                                                                                                                                    |
| 4. Measure incremental graph value                        | Evaluation owner; milestone 3, private artifact paths, frozen reviewed cases and accepted decision criteria                                                                                                                                       | One frozen, paired comparison using the existing framework and the three arms below. Report family-level uncertainty, errors/skips, coverage, latency and cost. End with adopt for named query classes, retain disabled, or inconclusive. Unmatched controls permit an operational comparison only; they do not qualify graph-specific uplift                                                                                                                                                     |
| 5. Decide a bounded pilot and later improvements          | Main/product owner; independent map results and retrieval evidence; separately named activation authority                                                                                                                                         | Define the cohort, operator, support route, observation window and stop triggers before widening. Preserve [ADR 0014](../docs/adr/0014-beta-learns-before-quality-thresholds.md)'s distinction between initial beta and quality claims/widening. Choose follow-on work from observed failures, with a new bounded contract when scope changes                                                                                                                                                     |

Milestone 1a removes the proposed ingestion-reader and v2 contracts and qualifies
independently operated workflows through the existing raw-source contract. The
original retrieval reliability package introduced no new schema or retrieval library. Failure-driven
candidates remain alias/inflection/bilingual anchoring, indexed search for
demonstrated scan/coverage limits, graph-to-passage provenance/reranking for
evidence-selection failures, and distributed admission for observed multi-replica
pressure. Multi-KB graphs, community summaries and adaptive multi-hop search
remain later contract decisions. Current exact-label, one-hop, single-graph
expansion and overflow fallback are limits to measure.

### Operational acceptance

Before activation name the operator, cohort and authorized stop action. Exercise GrowthBook-off and lecturer-policy-off independently, including map-on/retrieval-off. Subsequent tool checkpoints must suppress augmentation while retaining authorized baseline evidence. The 30-second refresh and 120-second payload-age limit describe cache behavior, not a demonstrated fleet-wide rollback SLA. Record observed convergence across the serving replicas.

Publication replacement/staleness must discard augmentation or refresh/reject map reads as appropriate. Revoked course access or changed KB bindings must reject both document results because the issued transport scope is immutable. Already dispatched provider work can continue; previously displayed content cannot be recalled. Keep policy disablement distinct from source-access withdrawal.

Use a synthetic slow provider to check outward cancellation, retained queue slots and client shutdown through underlying settlement. Do not promise a three-second end-to-end bound, or release slots early to meet one. If required bounded termination cannot be demonstrated, stop activation qualification and propose a focused lifecycle correction. Keep existing timeout/scope regression protection; add tests only for a missing consequential behavior, not another copy of the same implementation.

### Quality comparison and decision contract

Predeclare ordinary document retrieval, graph-guided second search, and a non-graph second search using a frozen graph-free query policy. Apply the same fusion policy and evidence limits to the two-search arms and match generation context budgets across arms in an authorized provider/evaluation harness. Record actual provider requests, passages, characters, tokens where available, elapsed time and total target/judge cost. Keep one fixed model/effort, prompt, mode, corpus/publication and fresh-thread history; test Auto separately as an operational routing question. Do not modify production retrieval solely to make tests comparable.

Freeze development and holdout by shared concepts, supporting documents and evidence relationships before tuning. Keep paraphrases/translations together. Include direct facts, bridges, aliases/inflections, bilingual terminology, irrelevant hubs, conflicting evidence and unanswerable cases. Review expected evidence and counterexamples before candidate answers; graph labels or adjacency alone must not define correctness. Historical Finance cases remain exploratory evidence, not holdout or tuning material.

Use the existing `query -> capture -> enrich -> eval` pipeline and metric configuration. Target and capture must not receive expected answers. The configured semantic threshold is 0.5; precision/recall/faithfulness thresholds are 0.7 diagnostics. These settings are not accepted rollout criteria, and the framework aggregate gate also expects tool correctness. Report individual outcomes and denominators rather than treating the graph profile's aggregate as acceptance.

Before candidate evaluation, accept the smallest useful improvement, tolerated per-family regressions and p95 latency/cost limits. Report paired effects and uncertainty at independent-family level, target failures, judge errors, skipped metrics, ineligible cases and fallback across all attempted runs, plus conditional expansion results. Calibrate judges against blinded subject review; uncertain or missing evidence yields an inconclusive result. A critical scope/citation regression blocks adoption regardless of the average score. No new numerical guarantee or automatic five-round tuning loop is authorized here.

Keep goldens, captures, run manifests and source-envelope receipts in exact approved private paths outside public Git. The manifest freezes source/build, question split, model/effort, prompt/mode, effective policy, framework/judge version, arm/control policy, budgets and decision rules. Existing capture exports passage text without source metadata: inspect authorized persisted source envelopes and browser behavior separately for locator and citation-to-claim integrity. Do not expand telemetry/capture retention implicitly. Anonymous diagnostics cannot reliably attribute interleaved production turns; use an isolated controlled run and provider receipts, or stop the mechanism verdict as inconclusive.

## Approval summary

The student graph and retrieval implementation is present on `v3-ai` and in staging's promoted source. The current `v3` source does not contain the retrieval wrapper; the October 5 report incorrectly treated ancestry as verified there. This follow-up targets `v3-ai` and preserves its native FalkorDB approach.

The user approved proceeding with the reviewed roadmap. The first deliverable is deterministic KB document-tool execution plus content-free expansion diagnostics, existing-framework preparation, and staging verification. Serialize raw SDK executions within each request-local document tool so overlapping MCP operations cannot produce the reported null sibling. Reject only top-level null/undefined at the raw execution boundary with a fixed content-free error, instead of persisting them as successful evidence. Preserve nested nulls, empty results and other envelopes. An absent optional expansion falls back to baseline. Preserve separate executions and scope validation; introduce no result cache or automatic retry.

Record expansion decisions, candidate/result passage counts and elapsed time without queries, graph labels, passages, identifiers or credentials. Use these diagnostics to distinguish enabled policy from actual additional retrieval. Existing fallback, evidence budgets, graph limits and citation semantics remain in place. No retrieval library, schema migration, new provider or richer graph algorithm is included.

Acceptance requires a synthetic concurrent regression at the MCP aggregation boundary, existing scope/graph/citation tests, applicable repository checks, and a draft PR. Read-only staging verification proceeds independently. Real-data model experiments require an identified controlled chatbot/corpus, approved provider and explicit fresh spend ceiling; historical budgets do not carry forward. Live activation, graph rebuilds, merging and deployment are separately gated.

Before widening adoption, preserve printed page labels through graph citation
extraction and display. Canonical input keeps both physical pages and printed
labels; current question citation readers keep physical pages only. Physical
PDF navigation remains correct. Add a synthetic Roman-label citation check
when extending that consumer contract, and verify source navigation separately.

## Execution details

Authority: executable batch; source changes, local commits, ordinary task-branch push and draft PR delivery, scoped read-only staging metadata. No flag changes, cluster writes, data discovery, release or production activation.

Terminal: reviewed source and evaluation preparation delivered as a draft PR, with independently available deployment proof and explicit unmet authenticated/evaluation gates; or a concrete capability blocker after independent work finishes.

Pause: changed data/provider boundary, unknown evaluation target, missing spend ceiling, or unavailable mandatory verification capability. Main owns the complete package. Execution mode: standard because the runtime does not expose an allowlisted main-model identity.

### Baseline and intended files

Repository: KlickerUZH. Worktree: `trees/rs/graphrag-adoption`. Branch: `rs/graphrag-adoption`, base `origin/v3-ai` at `570af489d117a0b1605092a920bbd6dc37712e53`. Reuse the September plan as history only. Existing Astra review of the roadmap is retained; a bounded planner validates this implementation contract.

Touch existing `apps/chat/src/services/docQueryResult.ts`, `mcpClients.ts`, `graphAssistedDocQuery.ts`, `apps/chat/test/mcp-clients-scope-token.test.ts`, `graph-assisted-doc-query.test.ts`, `docs/chat-platform.md` and `evaluation/README.md` only as needed for their declared contracts. The plan is the only new file. No visible UI change is planned; browser checks apply to live persistence acceptance, not layout screenshots.

### Test portfolio

| Risk                                                                     | Obligation and primary seam                            | Existing protection and distinct failure                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent document calls persist a null sibling                         | Extend existing MCP aggregation suite                  | Transport scope tests exist; synthetic server returns null on overlap, exposing this regression without a paid model                  |
| Queue failure or cancellation blocks later calls or sends cancelled work | Extend the same aggregation suite                      | Existing transport error tests; ensure queue recovery, cancellation before dispatch and error propagation                             |
| Diagnostics misrepresent expansion or leak content                       | Extend existing graph wrapper suite                    | Concurrent augmentation, fallback and revocation tests exist; verify counts/decision outcomes and no content in event contract        |
| Retrieval/citation and scope regressions                                 | Reuse existing graph, scope and source suites          | No new duplicate coverage                                                                                                             |
| Framework captures and comparison budgets                                | Reuse enrichment, target and framework contract checks | Keep missing-context metrics distinct from passes; record actual budgets without modifying production retrieval solely for evaluation |

### Delegation Map

| Slice                                            | Owner | Dependencies and acceptance                                                             |
| ------------------------------------------------ | ----- | --------------------------------------------------------------------------------------- |
| Staging verification                             | main  | Independent; readiness, Argo, migration hook, digests and values-free configuration     |
| Document execution reliability                   | main  | Approved contract; existing aggregation regression and scope tests                      |
| Expansion diagnostics and experiment preparation | main  | Reliability contract; existing graph suite and framework contracts                      |
| Draft delivery                                   | main  | Source checks and simplification/risk/final review; live experiments may remain blocked |

Main retains implementation because execution/cancellation and graph timeout behavior are critically coupled. No new test obligations outside the declared portfolio.

### Sequence and ownership

1. Main verifies staging Argo revision, pod digests, migration hook status, values-free configuration and credential presence. No database discovery or secret values are printed.
2. Main implements request-local serialization and absent-result rejection. Serialization wraps the raw SDK execute before graph augmentation. Its slot remains held until the actual provider promise settles, even if the graph timeout returns baseline evidence earlier. The existing graph wrapper retains scope/build revalidation for every call. Distinct calls also serialize; this trades concurrency for deterministic execution on the same client. No sharing across users, threads, clients or requests.
3. Main adds a narrow observer seam to the graph wrapper and emits one content-free event for each completed decision. The allowlisted event records fixed decision codes, whether expansion was attempted, numeric hints/passages/characters and total wrapper duration in milliseconds; unavailable/unparseable passage counts are null. No arbitrary spreads, raw errors or abort reasons. Logging failure must not alter retrieval or suppress authorization errors. Counts describe passage occurrences, not independent sources or correctness. Successful fusion and fallback have different budget behavior; diagnostics must expose actual counts/characters rather than claiming matched arms.
4. Main prepares a six-turn mechanism protocol using existing `query -> capture -> enrich -> eval` components. Freeze model/effort, prompt, mode, publication and questions; inspect citations and reload separately from text metrics. A fresh family-separated quality comparison and non-graph second-search control follow only after mechanism proof and an explicit experiment budget.
5. Simplify and review the integrated immutable scope, run applicable checks, inspect staged privacy, commit/push and open a draft PR. Report unmet live gates separately.

### Staging and evaluation acceptance

The earlier staging check verified revision `ee86f2e6c2c87ba0010000256ddaab44241b8354`, matching ready images and successful migrations through the user's existing tunnel. It is superseded by the current-state receipt above. Authenticated graph/provider proof remains outstanding.

Preserve the default-off GrowthBook/lecturer retrieval gate and independent map policy. Require actual provider dispatch plus additional supporting passage evidence in the bridge case, declined expansion for a controlled no-matching-concept case, and persisted answer/citation integrity. Six turns establish mechanism only. Operational and quality acceptance live in the remaining-roadmap sections above.

### Six-turn mechanism protocol

Use three frozen questions with retrieval disabled, then the same questions with retrieval enabled on the same controlled chatbot and publication. Activation itself requires separately named authority. Keep model, effort, prompt, mode and provider fixed; each arm uses a fresh thread to avoid history effects.

| Question family                         | Evidence required                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Direct factual lookup                   | Successful baseline retrieval and valid source locators; record whether expansion adds useful evidence or only repeats passages                                                                                                                                                                              |
| Relationship or bridge question         | Confirmed expanded provider dispatch and a newly retrieved supporting passage with a usable provider locator; assess whether the answer uses that evidence. `expansionAttempted` records wrapper intent before queued dispatch and `fused` records compatible reconstruction; neither alone passes this gate |
| Controlled no-matching-concept question | No expanded dispatch, no invented graph evidence or citations, and appropriate handling of missing support. General unanswerable questions may legitimately produce hints; test their abstention separately in the frozen quality set                                                                        |

Record run identifiers privately, publication/build, model/effort, mode, prompt version and flag state. For each turn retain event intent/outcome, confirmed provider request counts, passage/character counts, target latency, errors and observed spend. The existing target adapter captures persisted passage text without source metadata; inspect authorized persisted source envelopes separately. Reload the thread and check locator and citation-to-claim integrity, including repeated titles, distinct pages and conflicting passages. Use `query -> capture -> enrich -> eval`; missing contexts/locators produce unavailable metrics, never passes. Keep real materials and captures outside public Git.

A passing six-turn result qualifies the mechanism only. The frozen quality comparison and its controls are defined above. Judge approval is distinct from mechanism proof.

### Review and documentation

Update the graph section of `docs/chat-platform.md` for request-local serialization, absent-result errors and diagnostics. Update `evaluation/README.md` only for diagnostic interpretation and equal-budget limitations. No ADR is needed: this fixes reliability and observability within the established adapter architecture. Broader indexing, semantic anchoring, provenance, distributed admission and cost accounting remain separate failure-driven milestones.

## Progress

### October 12: teaching-data comparison continuation

User approved fixing the evaluation adapter login and comparing actual STG
teaching data, including a graph-free extra-search control, within the remaining
CHF 20 total ceiling. Astra approved the bounded exploratory protocol on October
12. Prior conservatively accounted spend is CHF 1.07826744. The combined prior
spend and new reservations total CHF 17.61048824; unknown costs retain their full
reservation. Graph cost uses the separately approved application charge basis.

Main owns STG scope, source-version and publication checks, paid-call admission,
cost reconciliation and final acceptance. A worker owns the existing adapter
login repair and focused regression checks; a separate offline assignment owns
the private harness's import of the unchanged production fusion code. Main
verifies both. Deliver the adapter fix through an ordinary draft PR to `v3-ai`;
marking ready, merging and deploying remain separate decisions.

Freeze three source-grounded cases before target execution: two questions joining
distinct teaching documents and one unsupported-topic question. Compare a
single full-question search, graph-assisted expansion of that search, and a second
search using the question's second clause without graph inputs. Missing or empty
clauses are ineligible. Preliminary first-clause searches are excluded from the
final comparison. Reuse the same baseline receipt across arms, record actual
dispatch counts and no-hint fallback, and interpret this as a mechanism pilot.
Retrieval covers the frozen KB inventory; graph generation covers only its
teaching resources. Verify that distinction explicitly.

All harness answers use the existing Azure `gpt-5.6-luna-low` deployment, identical
prompt and effort, no history, and no fallback. Apply a common ceiling of 12
passages and 16,000 content characters before generation. Use production graph
hints, its query augmentation format and its fusion function. The provider client
uses the deployed scoped route, with `expand: false`; it receives neither expected
answers nor a graph-generated answer. Reserve every target, retrieval and judge
request before dispatch and stop on uncertain completion rather than replaying.
One labelled replacement capture was reserved after the first upstream completion
and cost were reconciled: the local guard expected the provider model name, while
LiteLLM returns the requested deployment alias. The replacement reused the cached
response. Preserve both receipts and exclude its cache latency from fresh-model
latency claims. The target limit is ten requests for nine comparison answers.

Score the nine harness answers using the existing pinned evaluation framework
and four configured metrics, with at most 81 judge calls. Record complete case and
metric counters, errors, family-level differences, source locators, evidence added
by expansion, latency and conservative spend. Keep native adapter login,
persisted-capture and browser acceptance separate from the harness comparison;
the native chatbot's current model default differs. Three cases cannot establish
production retrieval quality or authorize broader activation.

Private protocol, materials, goldens, raw provider receipts, ledgers and reports
live at `/private/tmp/graphrag-teaching-stg-20261012`, outside public Git. Named
harness files are `provider-query.mjs`, `control-harness.mjs` and
`budgeted-eval.py`. Keep activation scoped to the existing test chatbot, preserve
other chatbot settings, and restore its original binding on scope or publication
failure. Close the approved loopback LiteLLM tunnel and evaluation relay after
the final checks. No ingestion coupling, database changes or test-only production
endpoint is introduced.

Source verification: persisted login and cookie issuance pass against STG without
a preload. The 29 adapter tests and 50 adapter/trajectory seam tests pass on pinned
Vitest 3.2.4 and Node 24.21.0. Focused ESLint, source formatting, plan formatting,
host Git identity/hook contracts and launcher checks pass. Independent native
source review found no P0-P2 issues. Full repository checks were attempted and
remain unavailable because the disposable container cannot run host Git/devrouter
contract tests, and its network-disabled analytics lint could not fetch tooling.
Keep full qualification pending; these focused receipts do not clear it.

October 12 outcome: the adapter logs into STG through the registered operation,
receives a participant cookie, and reads the restored test graph with HTTP 200.
A regression check compares its login hash with the generated operation registry.
The deployed unknown-hash rejection is HTTP 200 with `PersistedQueryNotFound`.
Hosted build, check, unit and Playwright checks pass at the original source head;
the optional OpenRouter review remains skipped as requested. Subsequent commits
require their own exact-head CI receipt.

The baseline and graph-free extra-search arms completed six answers and 24 metric
results through the existing framework, with 54 judge calls and no errors or skips.
Mean semantic scores were 0.9333 and 0.7000; context recall was 0.8778 and 0.6333.
Faithfulness was 1.0 for all six answers. The extra-search arm lost an
answer-bearing passage on a bridge case; extracted mathematical text was also
unreadable. These are diagnostic pilot results. The frozen expected answers mix
factual expectations and citation requirements, which limits recall calibration;
one judge explanation overstated source coverage. Native agent acceptance counters
are zero. Review evidence and citations separately before any quality claim.

The fresh build failed during category normalization: a LightRAG entity edit timed
out while flushing graph updates. `DOMAIN_CATEGORY_VALIDATION_FAILED` is the
terminal application code, not proof of invalid source categories. No fresh graph
was published, so GraphRAG scoring and teaching-data browser acceptance remain
blocked. The test chatbot's original binding and feature settings were restored.
No provider replay, rebuild, category-policy relaxation or broader activation was
performed.

Next, diagnose and repair the provider edit/flush timeout independently of data
ingestion. Harden the private admission guard's exclusive reservations, protocol
hash checks, strict schema/token validation and complete case/metric identity
checks before more paid calls. Reconcile the failed graph's application charge
before releasing its reservation. Resume the frozen GraphRAG arm only after a
fresh publication and bounded admission. Preserve answer-bearing baseline evidence
when evaluating fusion changes; verify document coverage and citations. Qualify
formula extraction independently, then use a larger clean holdout with factual
answers separated from citation constraints. Native persisted-chat and graph UI
acceptance remain separate rollout gates.

### Approved recovery batch: cleaning timeout and remaining teaching-data comparison

Approval mode: executable batch, approved on October 12. The adapter fix is
already delivered in draft PR #6478. The fresh teaching graph failed while an
entity edit flushed vector embeddings. Scoped reads of the surviving STG worker
show LightRAG 1.5.7, a 30-second library embedding timeout, and a configured
180-second provider timeout. Build initialization passes that setting; cleaning
and strict validation initialization omit it. The same omission exists at the
fetched provider `origin/main` baseline. The timeout can terminate the embedding
worker after twice the library timeout. Exact failed-worker assignment and the
underlying embedding latency remain unproven.

The recommended source correction passes the resolved embedding timeout to both
existing initializers. Preserve category validation and failure behavior; add no
embedding retry, ingestion dependency, database change or timeout increase. The
provider worker currently installs floating LightRAG requirements while its lock
records another version. Before deploying a candidate, qualify the relevant tests
against the deployed 1.5.7 dependency and require a reproducible candidate with that
exact version. The worker requirements now pin LightRAG 1.5.7; the development
lock remains unchanged. Focused tests pass against both 1.5.7 and the locked 1.5.1.
Stop on required unrelated dependency changes.

The approved authority extends to the provider repository
`uzh-bf/tc/kg-content-generation`, an ordinary task-branch MR targeting `main`,
marking that MR ready and merging only after required checks and human reviews,
and deploying its exact verified worker image through the configured STG GitOps
path: `uzh-bf/cloud/helm-charts`, target `main`,
`kg-content-generation/stg`, Argo application
`argo/app-kg-content-generation-stg`. The deployment affects the shared STG graph
worker. Record the previous image, verify no conflicting active build before
rollout, and restore the prior image through GitOps if worker health fails.
Production deployment, broad flag changes, replay of the failed run, data deletion
and category-policy relaxation
are excluded. GitOps changes are limited to the STG provider image reference. Ask
again if qualification requires unrelated infrastructure ownership or changes.

After serving proof, submit the approved new build for the same frozen sources.
Preserve the failed build and original protocol. A separate recovery addendum must
bind the new publication ID to the unchanged corpus hashes, questions, goldens,
models, metrics, evidence limits and already-scored baseline/control answers.
Rebind only the identified test chatbot; admit paid calls only after guard review,
source digest checks and fresh publication checks. Run three GraphRAG harness
answers, at most six remaining searches and 27 remaining judge calls. Reopen only
the previously approved loopback LiteLLM tunnel while needed. Separately qualify
one bounded native chatbot turn and persisted citations, KG sidebar, full-screen,
search and ask-about-this interactions. Restore the original test binding and
settings and close evaluation connectivity at the end or on failure.

Retain CHF 4.19857084 already counted including the failed-build hold. Additional
maximum reservations are CHF 2.50 for one new graph build, CHF 0.4718592 for three
harness answers, CHF 4.0697856 for 27 judge calls, and CHF 2.00 for one native turn.
The existing CHF 0.25 retrieval reservation covers the remaining search cap.
The combined approved maximum is CHF 13.24021564 against the original CHF 20
ceiling. Admit the native turn only after route pricing and execution limits prove
its CHF 2 bound; otherwise stop before sending. Preserve the approved graph
application-charge accounting basis and all unknown-cost holds. No automatic
replacement call or further graph build is authorized.

October 12 recovery delivery: provider [MR !41](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/41)
merged at `f2fc09c30b3d696e7bd1cf4dcc2ecae5941bf8d4`. Its required workflow,
persistence and image-publication checks passed; the legacy quality audit remains
an allowed failure. STG-only GitOps [MR !141](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/141)
passed source review, structural rendering and exact-head CI, then merged at
`33241ffeaf01bc3e2dfcc6efa4a78c3719f2faeb`. Argo is Synced/Healthy at that
revision. The new ready worker serves digest
`sha256:75bd8dc45365f9ac0ccd50acf424bffe63fe0da4918f05dc148c30dd8edaeeb0`,
LightRAG 1.5.7 and the verified timeout pass-through in both initializers. All
worker slots were available and no active graph build existed before rollout.
No PRD manifest, ingestion workflow or database schema changed.

The single approved new build ran on the unchanged frozen source hashes and failed
in strict category validation. No fresh graph was exported or published. The private
recovery addendum retains the failed build, original protocol and scored
baseline/control receipts. The reviewed recovery guards pass their offline
checks. Persisted participant login and authenticated synthetic graph overview
pass against the current serving application.

The test chatbot uses Auto, whose live routing includes a classifier, semantic
embedding, routed models and fallback paths. Named component prices are now
known, but several routes lack token limits and the native input/retry bound is
unqualified. Hold the native paid turn before dispatch under the approved CHF 2
condition. This gate is separate from the bounded fixed-model framework arms.

October 12 recovery outcome: the provider completed extraction and category edits,
then failed during the first cleaning pass. The new exception reports categories
outside the selected policy; no timeout exception appears in the failure chain.
The failed working graph contains 2,219 nodes and 2,982 edges. Three nodes remain
noncanonical across two category values, below the 256-node repair cap. All three
have descriptions and relations. These counts do not establish why the classifier
left them unmapped. The cleaning report records the failed pass with zero attempt
counters because validation precedes recording the repair outcome. The runtime
cleaning role was Azure GPT-6 Luna with no explicit reasoning effort.

The approved failure branch has been executed. The provider run and application
build are terminal failures, the application reservation is released, and the
previous publication remains unchanged. No GraphRAG searches, target answers or
judge calls were admitted. The original test chatbot bindings and feature settings
match the restoration snapshot exactly; source hashes and all historical evidence
pins remain unchanged. The authenticated student view opens and exposes the KG
button, but fresh teaching-graph interactions remain unverified. Both temporary
loopback listeners are closed. Retaining both failed-build holds gives a
conservative CHF 6.69857084 counted against CHF 20, with CHF 13.30142916 remaining.

The next gate is to diagnose the category classifier's model/request/response
contract and retain safe repair counters before strict validation. Use the saved
failed artifact and synthetic fixtures to qualify the correction before another
paid build. Preserve the policy validator, repair cap, source boundary and
independence from ingestion. Another provider change, deployment and paid build
require a new bounded approval; the one-build recovery authority is exhausted.
The three GraphRAG cases, 27 judge calls and fresh student KG acceptance remain
blocked on publication. Native Auto-mode cost qualification remains a separate
gate. Draft PR #6478 carries the adapter fix and this evidence checkpoint; it is
not merge or rollout acceptance.

Terminal: source and serving receipts, a complete three-arm framework report,
separate native/UI evidence, reconciled costs and restored test scope; or stop at
the first failed qualification, rollout, publication or cost condition with the
failed identity preserved. The existing native goal remains unfinished. Guard
review, exact-head CI, serving proof and fresh publication are concrete
dependencies.

October 9: approved source-artifact repair is planned in the linked implementation
plan and added as milestone 1a. Historical source and review receipts below remain
dated evidence. The new package has no PR/MR or implementation yet. Astra approved
the revised plan in round 2; scoped Markdown, new-link, secret and diff checks
pass. The planning checkpoint is complete; source and live acceptance remain open.

Approved by user: October 7 proceed following October 5 Astra-reviewed roadmap. Astra approved the bounded contract after raw-provider queue lifetime, null-envelope handling, diagnostic limits and independent source delivery were clarified. Implemented in `cc91d74504100f51a4ea213e9c31db82a44f3b48`; [draft PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421) targets `v3-ai`. No paid model experiment has run. Remote target was unchanged at the recorded base during source qualification.

Acceptance evidence: 112 focused Chat tests, 42 repository type/build-check tasks, seven lint tasks, all mandatory commit hooks, and full production build (27 tasks) passed. Existing target adapter, capture-enrichment and evaluation-wrapper checks passed. Pinned private framework `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b` passed 61 offline evidence/dataset/metrics/runner/reporting tests and the existing GraphRAG metric integration contract. Tests protect synthetic overlap, cancellation, queue recovery, null-envelope boundaries and unavailable diagnostics; existing suites were extended without a new test file, engine or dependency.

Simplification: done with no proposed reduction. Slice review: done, no findings at threshold. Reports live under ignored `project/_local/reviews/2026-10-07-graphrag-*`. Integrated final review passed with no findings at `8b0ea6ac6296d61d3aaf2429d6f2e455ed646b5e`; canonical JSON schema validation passed. The configured Claude route failed authentication and Gemini could not read through headless permissions; the independent GLM continuity reviewer completed the full contract. Subsequent full hosted tests exposed the omitted-options regression recorded above; focused checks and prior review do not override it. The draft is not merge-ready. The original live-provider null cause and persisted-message/citation behavior remain unverified.

Staging has advanced to the current-state revision above; this follow-up is not deployed. No flags, graph publications, infrastructure, staging content or production state were changed.

The task runtime was recovered through canonical stop/ensure after an interrupted lifecycle record and version-selection mismatch. It stops after required final metadata commit hooks; canonical shutdown and fresh devsy provider status/zero-route checks have passed, and repeat after this evidence-only update; runtime data/worktree deletion is not authorized. Primary unrelated work remains untouched.

Source deliverable: reviewed draft PR with recorded local checks passing, now blocked by confirmed hosted compatibility failures. Next source step is milestone 1; executable source is unchanged by this roadmap review. The controlled staging chatbot/KB, provider and fresh total spend ceiling are still unresolved. Astra's new roadmap challenge is dispositioned in the remaining-roadmap sections: incomplete CI/review evidence, provider-dispatch attribution, separate citation/map proof, operational disablement, matched causal controls and finite adoption decisions.

Roadmap review: Astra medium `01a11774-c93e-7bf2-a0bc-b1c74fc4499e` inspected the bounded code/contracts, returned five priorities, and approved the revised October plan and September W9 section. Parent verified its findings against source and live receipts. Report: ignored `project/_local/reviews/2026-10-07-graphrag-roadmap-refresh.md`. Markdown formatting and diff checks pass; newly added local links resolve. Existing September links to unavailable ignored historical reports remain unchanged. The optional Jev advisory was unavailable because the operator profile is missing; no setup or external advisory call occurred. This is planning approval, not merge/deployment authority or proof that retrieval quality passes.

Goal execution: user approved working through this roadmap with a native goal on October 7. Milestone 1 is active on the existing task branch. Main owns the three-line compatibility repair and container verification because reproduction is the immediate dependency; an independent explorer owns only existing evaluation-harness feasibility, not source writes. No new file/module, test engine or test-only production hook is introduced. Existing real-HTTP transport and compatibility tests already protect omitted execution options; queue/cancellation/null suites protect supplied options and lifetime. No new test mirrors the optional-chain implementation. The first focused pass runs four existing files with 78 passing tests; full Chat and PostgreSQL CI-equivalent qualification follow before source delivery. The controlled staging target/provider/fresh total budget question is pending while independent source work continues. Execution mode remains standard.
