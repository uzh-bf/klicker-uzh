# Graph-assisted retrieval reliability and staging qualification

## Approval summary

The student graph and retrieval implementation is present on `v3-ai` and in staging's promoted source. The current `v3` source does not contain the retrieval wrapper; the October 5 report incorrectly treated ancestry as verified there. This follow-up targets `v3-ai` and preserves its native FalkorDB approach.

The user approved proceeding with the reviewed roadmap. The first deliverable is deterministic KB document-tool execution plus content-free expansion diagnostics, existing-framework preparation, and staging verification. Serialize raw SDK executions within each request-local document tool so overlapping MCP operations cannot produce the reported null sibling. Reject only top-level null/undefined at the raw execution boundary with a fixed content-free error, instead of persisting them as successful evidence. Preserve nested nulls, empty results and other envelopes. An absent optional expansion falls back to baseline. Preserve separate executions and scope validation; introduce no result cache or automatic retry.

Record expansion decisions, candidate/result passage counts and elapsed time without queries, graph labels, passages, identifiers or credentials. Use these diagnostics to distinguish enabled policy from actual additional retrieval. Existing fallback, evidence budgets, graph limits and citation semantics remain in place. No retrieval library, schema migration, new provider or richer graph algorithm is included.

Acceptance requires a synthetic concurrent regression at the MCP aggregation boundary, existing scope/graph/citation tests, applicable repository checks, and a draft PR. Read-only staging verification proceeds independently. Real-data model experiments require an identified controlled chatbot/corpus, approved provider and explicit fresh spend ceiling; historical budgets do not carry forward. Live activation, graph rebuilds, merging and deployment are separately gated.

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

Fresh staging API readiness passes through the user's existing tunnel. Argo application `app-klicker` is Synced/Healthy at `ee86f2e6c2c87ba0010000256ddaab44241b8354`; the ready Chat pod serves its matching image with digest `sha256:48dd186819b70bd954271712097379ec1004d499b268a5ef0f4fe19d267447be`. These observations are time-bound; the backend also has a ready matching-revision pod, and the matching migrator job succeeded with no pending migrations. Authenticated graph/provider proof remains outstanding.

Preserve the default-off GrowthBook/lecturer retrieval gate and independent map policy. Require actual expansion plus additional supporting passage evidence in the bridge case, declined expansion for the negative case, and persisted answer/citation integrity. Six turns establish mechanism only. Quality evaluation uses the existing private framework, separate family-based development/holdout, matched context budgets, metric denominators/errors/skips, latency and spend. Historical Finance results show no demonstrated uplift and are not tuning data.

### Six-turn mechanism protocol

Use three frozen questions with retrieval disabled, then the same questions with retrieval enabled on the same controlled chatbot and publication. Activation itself requires separately named authority. Keep model, effort, prompt, mode and provider fixed; each arm uses a fresh thread to avoid history effects.

| Question family | Evidence required |
| --- | --- |
| Direct factual lookup | Successful baseline retrieval and valid source locators; record whether expansion adds useful evidence or only repeats passages |
| Relationship or bridge question | An enabled-arm expansion event and a newly retrieved supporting passage with a usable provider locator; assess whether the answer uses that evidence |
| Out-of-scope or unsupported question | No invented graph evidence or citations; record no-hint/fallback behavior and the answer's handling of missing support |

Record run identifiers privately, publication/build, model/effort, mode, prompt version and flag state. For each turn retain the actual event outcome, passage/character counts, target latency, errors and observed spend. Capture the persisted answer and source envelopes through the existing target adapter; reload the thread and inspect answer/citation integrity separately. Use `query -> capture -> enrich -> eval`; missing contexts/locators produce unavailable metrics, never passes. Keep real materials and captures in existing ignored evaluation data paths.

A passing six-turn result qualifies the mechanism only. Before claiming quality, freeze a fresh question-family split with separate development and holdout sets, comparable context limits and a non-graph second-search control where available. Report paired differences, regressions, skipped/failed metric denominators, latency and spend. Judge approval is distinct from mechanism proof, and historical Finance cases are neither holdout nor tuning material.

### Review and documentation

Update the graph section of `docs/chat-platform.md` for request-local serialization, absent-result errors and diagnostics. Update `evaluation/README.md` only for diagnostic interpretation and equal-budget limitations. No ADR is needed: this fixes reliability and observability within the established adapter architecture. Broader indexing, semantic anchoring, provenance, distributed admission and cost accounting remain separate failure-driven milestones.

## Progress

Approved by user: October 7 proceed following October 5 Astra-reviewed roadmap. Astra approved the bounded contract after raw-provider queue lifetime, null-envelope handling, diagnostic limits and independent source delivery were clarified. Implemented in `cc91d74504100f51a4ea213e9c31db82a44f3b48`; [draft PR #6421](https://github.com/uzh-bf/klicker-uzh/pull/6421) targets `v3-ai`. No paid model experiment has run. Remote target was unchanged at the recorded base during source qualification.

Acceptance evidence: 112 focused Chat tests, 42 repository type/build-check tasks, seven lint tasks, all mandatory commit hooks, and full production build (27 tasks) passed. Existing target adapter, capture-enrichment and evaluation-wrapper checks passed. Pinned private framework `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b` passed 61 offline evidence/dataset/metrics/runner/reporting tests and the existing GraphRAG metric integration contract. Tests protect synthetic overlap, cancellation, queue recovery, null-envelope boundaries and unavailable diagnostics; existing suites were extended without a new test file, engine or dependency.

Simplification: done with no proposed reduction. Slice review: done, no findings at threshold. Reports live under ignored `project/_local/reviews/2026-10-07-graphrag-*`. Integrated final review passed with no findings at `8b0ea6ac6296d61d3aaf2429d6f2e455ed646b5e`; canonical JSON schema validation passed. The configured Claude route failed authentication and Gemini could not read through headless permissions; the independent GLM continuity reviewer completed the full contract. Hosted CI is still pending; this draft is not claimed merge-ready. The original live-provider null cause and persisted-message/citation behavior remain unverified.

Staging: Argo remains Synced/Healthy at `ee86f2e6c2c87ba0010000256ddaab44241b8354`; ready Chat digest matches the recorded image and migrator succeeded. This follow-up is not deployed. No flags, graph publications, infrastructure, staging content or production state were changed.

The task runtime was recovered through canonical stop/ensure after an interrupted lifecycle record and version-selection mismatch. It stops after required final metadata commit hooks; canonical shutdown and fresh devsy provider status/zero-route checks have passed, and repeat after this evidence-only update; runtime data/worktree deletion is not authorized. Primary unrelated work remains untouched.

Source deliverable: reviewed draft PR with all local checks passing. Exact-head hosted CI disposition remains pending; this evidence-only progress update reuses the final review because executable source and contracts are unchanged. Next live gate: an identified controlled staging chatbot/KB, approved provider and fresh total spend ceiling; user input is pending. With those and explicitly named activation authority, run the six-turn mechanism protocol, then a separately bounded family-based quality comparison. Six turns do not qualify broad rollout.
