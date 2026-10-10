# Graph-assisted retrieval reliability and staging qualification

October 10: canonical input source packages are now drafted in
[ingestion !229](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/229),
[KG !36](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/36)
and [Klicker #6460](https://github.com/uzh-bf/klicker-uzh/pull/6460).
The [source plan](2026-10-09-graphrag-source-artifact-plan.md) records the reviewed
source repair. Failed and pending replacements preserve the desired blob's size
and MIME, and retry dispatch retains the matching tuple. Trusted independent
integrated qualification passes at Klicker source `21c49968a7`; mandatory local
checks and the full production build pass. Ingestion and KG exact-head CI pass.
Klicker hosted checks are available on [PR #6460](https://github.com/uzh-bf/klicker-uzh/pull/6460/checks);
source review does not replace the final-head CI requirement. The user waived
the OpenRouter review, whose separate forge gate remains unresolved.

The source packages remain drafts. Reader provisioning, migration application,
physical cleanup convergence, reader-first deployment and a finite refresh/build
batch follow source qualification under separate authority. Live GraphRAG quality
and student-map acceptance remain separate receipts. Full local application
readiness is unqualified because the unrelated LTI route returned HTTP 502.

## Current state and next decision

October 9 planning checkpoint: [PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421)
is merged into `v3-ai` at `b6b580585e78500afa11e7a1db28bcabc273abe8`.
The October 7 failure table below is historical. The next identified acceptance
blocker is source fidelity: KG re-downloads mutable URLs instead of consuming
the version ingested for document retrieval. A scoped staging investigation
confirmed changed bytes, per-request variation and a provider download rejection.
The [canonical-input implementation plan](2026-10-09-graphrag-source-artifact-plan.md)
owns the approved source repair across ingestion, KG generation and Klicker.
Astra approved its revised source and verification contract on October 9.
Its source delivery precedes a separately authorized refresh/build of the
controlled KB and student-map acceptance. Existing immutable-input fixtures can
still qualify map interaction independently. No fresh deployment or retrieval-
quality claim is made by this planning checkpoint.

### Historical October 7 review

October 7 review, observed at 19:45 Europe/Zurich. This revision reconciles the existing package and refines its remaining roadmap; it does not activate features or execute a new experiment. Source repair stays within the previously approved reliability scope. Merge, ready status, deployment, activation, rebuilds and new spend retain their separate authority boundaries.

| Boundary | Verified state | Consequence |
| --- | --- | --- |
| Source | Draft [PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421), `4dad75b11c9efb2b578b1d828f033317fa06827a`, base `v3-ai`; mergeable but blocked | Not merge-ready |
| Hosted qualification | [Unit run](https://github.com/uzh-bf/klicker-uzh/actions/runs/37613222215) fails three Chat tests in existing real-HTTP transport/compatibility suites; build and hosted Playwright pass | The queue reads `options.abortSignal` when callers omit options. Installation precedes the retrieval gate, so flag-off does not bypass this compatibility defect |
| Review | OpenCodeReview timed out on two of three files despite its green job; `final-ai-review` remains pending with actual review jobs skipped | Prior independent source review passed its range but missed this caller contract; neither workflow status substitutes for complete qualification |
| Staging | Argo Synced/Healthy at `80fd916da072095845186c4d7834fa77e50d37b9`; ready matching Chat/backends; matching migration job succeeded. Chat digest `sha256:deed5c6fe0d62d963f7ae06254193b3dbd03f1a0df6bbe8d80c2781857385aba` | The earlier graph feature serves; PR #6421's serialization/diagnostics follow-up is absent |
| Evidence | Local focused checks passed; original live null cause, authenticated persistence, fleet disablement and real-data uplift remain unproved | Qualification proceeds through separate mechanism, operational and quality receipts |

At review start the task branch was clean and synchronized; this review changes only the two roadmap documents locally. Current `v3-ai` is `510ca5501d954c268daf34a5767cf25532adaec4`; its drift from the package base touches four Playwright/documentation files. Drift alone does not require integration. Re-evaluate target interactions at readiness instead of repeatedly refreshing the branch. The temporary verification runtime is stopped with zero exact routes.

## Remaining roadmap

Each milestone ends with a disposition and evidence, rather than an automatic tuning or rollout loop. Main owns integration and operational decisions. Assign separable harness work one owner when its contract is settled; no additional tasks or source changes are launched by this roadmap review.

| Milestone | Dependency and owner | Acceptance and stop condition |
| --- | --- | --- |
| 1. Restore document-tool compatibility | Chat maintainer; merged [PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421) | Source repair delivered. Retain omitted/supplied options, raw-provider lifetime, cancellation, null handling and queue regression checks. Serving and persisted-message proof remain separate acceptance receipts |
| 1a. Share a canonical ingestion input | Ingestion, KG and Klicker owners; [source-artifact plan](2026-10-09-graphrag-source-artifact-plan.md), source repair approved and Astra plan review passed | Normal retrieval and KG preparation use one active resource version. Prove origin drift, digest/version enforcement, scoped access, deletion and legacy compatibility with synthetic fixtures. Source delivery ends at reviewed draft changes and CI; merge/deployment and live refresh/build remain gated |
| 2. Verify deployed boundaries and student map | Main/operator; qualified source and serving proof; milestone 1a for the identified mutable-URL KB; controlled actor and current published graph | Record exact revision/digest/migration proof and a separate map scorecard: map/retrieval policy combinations, direct-route enforcement, autocomplete/exploration, sidebar/fullscreen, ask-about-this prefill without automatic send, thread preservation, mobile/keyboard behavior and publication replacement/staleness. Reuse existing browser harness and synthetic fixtures. A map failure blocks map rollout; a retrieval failure does not by itself invalidate independent map availability |
| 3. Prove retrieval mechanism, persistence and disablement | Main; deployed qualified follow-up and milestone 1a contract; controlled chatbot/KB with a current canonical-input graph; approved provider/data boundary, fresh total spend ceiling and named activation/disablement authority | Run the six-turn probe below, then synthetic failure/withdrawal checks. Require actual provider dispatch, useful new bridge evidence, correct persisted citations after reload and verified safe disablement. Stop activation on scope leakage, invalid citations, bounded-termination failure or unusable evidence receipts. Six turns qualify mechanism only |
| 4. Measure incremental graph value | Evaluation owner; milestone 3, private artifact paths, frozen reviewed cases and accepted decision criteria | One frozen, paired comparison using the existing framework and the three arms below. Report family-level uncertainty, errors/skips, coverage, latency and cost. End with adopt for named query classes, retain disabled, or inconclusive. Unmatched controls permit an operational comparison only; they do not qualify graph-specific uplift |
| 5. Decide a bounded pilot and later improvements | Main/product owner; independent map results and retrieval evidence; separately named activation authority | Define the cohort, operator, support route, observation window and stop triggers before widening. Preserve [ADR 0014](../docs/adr/0014-beta-learns-before-quality-thresholds.md)'s distinction between initial beta and quality claims/widening. Choose follow-on work from observed failures, with a new bounded contract when scope changes |

Milestone 1a introduces the explicitly versioned artifact, scoped read and
retention contracts described in its implementation plan. The original retrieval
reliability package introduced no new schema or retrieval library. Failure-driven
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

| Risk | Obligation and primary seam | Existing protection and distinct failure |
| --- | --- | --- |
| Concurrent document calls persist a null sibling | Extend existing MCP aggregation suite | Transport scope tests exist; synthetic server returns null on overlap, exposing this regression without a paid model |
| Queue failure or cancellation blocks later calls or sends cancelled work | Extend the same aggregation suite | Existing transport error tests; ensure queue recovery, cancellation before dispatch and error propagation |
| Diagnostics misrepresent expansion or leak content | Extend existing graph wrapper suite | Concurrent augmentation, fallback and revocation tests exist; verify counts/decision outcomes and no content in event contract |
| Retrieval/citation and scope regressions | Reuse existing graph, scope and source suites | No new duplicate coverage |
| Framework captures and comparison budgets | Reuse enrichment, target and framework contract checks | Keep missing-context metrics distinct from passes; record actual budgets without modifying production retrieval solely for evaluation |

### Delegation Map

| Slice | Owner | Dependencies and acceptance |
| --- | --- | --- |
| Staging verification | main | Independent; readiness, Argo, migration hook, digests and values-free configuration |
| Document execution reliability | main | Approved contract; existing aggregation regression and scope tests |
| Expansion diagnostics and experiment preparation | main | Reliability contract; existing graph suite and framework contracts |
| Draft delivery | main | Source checks and simplification/risk/final review; live experiments may remain blocked |

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

| Question family | Evidence required |
| --- | --- |
| Direct factual lookup | Successful baseline retrieval and valid source locators; record whether expansion adds useful evidence or only repeats passages |
| Relationship or bridge question | Confirmed expanded provider dispatch and a newly retrieved supporting passage with a usable provider locator; assess whether the answer uses that evidence. `expansionAttempted` records wrapper intent before queued dispatch and `fused` records compatible reconstruction; neither alone passes this gate |
| Controlled no-matching-concept question | No expanded dispatch, no invented graph evidence or citations, and appropriate handling of missing support. General unanswerable questions may legitimately produce hints; test their abstention separately in the frozen quality set |

Record run identifiers privately, publication/build, model/effort, mode, prompt version and flag state. For each turn retain event intent/outcome, confirmed provider request counts, passage/character counts, target latency, errors and observed spend. The existing target adapter captures persisted passage text without source metadata; inspect authorized persisted source envelopes separately. Reload the thread and check locator and citation-to-claim integrity, including repeated titles, distinct pages and conflicting passages. Use `query -> capture -> enrich -> eval`; missing contexts/locators produce unavailable metrics, never passes. Keep real materials and captures outside public Git.

A passing six-turn result qualifies the mechanism only. The frozen quality comparison and its controls are defined above. Judge approval is distinct from mechanism proof.

### Review and documentation

Update the graph section of `docs/chat-platform.md` for request-local serialization, absent-result errors and diagnostics. Update `evaluation/README.md` only for diagnostic interpretation and equal-budget limitations. No ADR is needed: this fixes reliability and observability within the established adapter architecture. Broader indexing, semantic anchoring, provenance, distributed admission and cost accounting remain separate failure-driven milestones.

## Progress

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
