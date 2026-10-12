# Graph-assisted retrieval reliability and staging qualification

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

### October 12 correction and next bounded probe (awaiting approval)

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

**Proposed next batch.** Main owns admission, effects and cleanup. Reopen only
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
