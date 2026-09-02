# Klicker FineCo evaluation follow-up roadmap

## Identity

- Date: 2026-09-01
- Audience: junior developer or agent picking this up without session
  context. Read `AGENTS.md`, `docs/testing.md`, `evaluation/README.md`, and
  the [parent execution plan](2026-09-01-klicker-live-target-evaluation-adapter-plan.md)
  before starting.
- Roadmap branch and worktree:
  `rs/klicker-live-target-evaluation` at
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/klicker-live-target-evaluation`.
- Parent package: [Klicker live target evaluation adapter plan](2026-09-01-klicker-live-target-evaluation-adapter-plan.md).
- Evaluation framework: private submodule `evaluation/framework` at
  `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b`.
- Audience contract: every work item below is independently checkable. The
  roadmap preserves the parent package's `delivery_pending` state until the
  FineCo binding and finite response bound are proven.

## How to work on this

The current adapter and wrapper are complete. Do not start a runtime or make
credentialed calls while the FineCo gate is unresolved.

Work from the exact worktree above. Use host Git, `gh`, and `glab`; use
`devrouter` for the application runtime; and run the evaluator through the
repository wrapper. Do not use a bare DevPod, raw Docker lifecycle, or a
second checkout. The evaluator submodule is private and must remain at the
recorded commit unless a separate evaluator change is approved.

When the binding gate is satisfied and a live run is separately authorized,
activate the VPN, then start the exact worktree with the developer Foundry
values mapped only through the restricted operator:

```bash
rs-infisical-operator --profile klicker-dev run \
  --map AZURE_OPENAI_API_KEY=UPSTREAM_OPENAI_API_KEY \
  --map AZURE_OPENAI_BASE_URL=UPSTREAM_OPENAI_BASE_URL -- \
  devrouter ensure /Users/rschlae/Git/klicker/klicker-uzh/trees/rs/klicker-live-target-evaluation \
  --profile chat,ai,mcp --json
```

Set namespaced API and Chat origins plus seeded participant credentials in the
invoking shell only. Keep the approved judge proxy in `LITELLM_API_BASE`; the
developer Foundry values are for the local Chat target and must not enter the
evaluator child. Run `bash util/test-klicker-eval-wrapper.sh` before any
credentialed traffic. Stop the exact worktree with `devrouter stop` after the
run and verify that its provider is stopped and no route remains.

## Current state

| Item | State | Evidence |
| --- | --- | --- |
| Local Klicker target adapter | reviewed and committed | HEAD `4c11b8f17e118e1d04a7ba9ab62d5160d43b5e7e`; ten focused adapter tests pass. |
| Evaluation wrapper and FineCo assets | reviewed and committed | `evaluation/README.md`, `evaluation/data/tools/klicker_fineco.yaml`, 20 synthetic ground-truth cases, and the semantic-similarity metric are present. The tool config's expected name `EXPERT_df_fineco_expert` matches the verified runtime tool contract. |
| Developer Foundry through local LiteLLM | transport canary passed | The values-free canary receipt records direct `gpt-5.6-luna`, HTTP 200, a non-empty answer, and the synthetic `KB_doc_query` marker. |
| FineCo expert binding | desired-state config and source-verified bound; runtime eligibility unproven | `ai-infrastructure/deployment` `origin/main@08d82585` includes `df_fineco_expert` in the STG and PRD tool ConfigMaps and fixes reranked output to 20 documents. `ai-buddy` `dev@344a6800a` returns full chunk content with no character/token trim. The proven local runtime exposed only `KB_doc_query`. The per-result output ceiling is source-verified as finite (20 × 65,535 characters; tool inputs are harness-controlled); no runtime FineCo inventory is available, and the owner checklist below covers closing it. |
| FineCo 20-case quality run | parked | No 20-case query, structural result set, semantic judge run, or finite expert response bound exists. The canary is transport evidence only. |
| Repository verification | scoped checks passed; hook issue recorded | The documentation slice passes Prettier, diff checks, staged Gitleaks, and standalone `check:playwright-ci` (57/57). The pre-commit selector fixture inherits Git's hook environment and is unsafe in that invocation; no source files were changed. |
| Runtime cleanup | completed | The exact worktree was stopped; provider, LiteLLM, databases, managed processes, and the adapter were stopped, with zero exact routes in the cleanup proof. |
| Package Git baseline | documentation committed; integration pending | Branch `rs/klicker-live-target-evaluation` is at the verified local documentation head, nine commits ahead and two behind current `origin/v3` `f94e59d2fb`. The two roadmap documents are committed; no base integration was performed. |
| Lena branch | reconciled locally and user state restored | The isolated reconciliation ref `rs/chatbot-hitl-config-roadmap-upstream-reconciled` remains at `62cebcda7b`, whose tree exactly matches `origin/v3` `72096fafe5`. The primary `docs/chatbot-hitl-config-roadmap` checkout was restored to `ea673f8470` and the former dirty state was reapplied there; the safety stash `b8fb2568bef5e0d3bc53bbbd96464d3a86822fff` (`stash@{0}`) remains intact. |

## Non-negotiables

- Use synthetic FineCo ground truth only. Never place participant credentials,
  Azure values, judge keys, raw tool output, or real course data in the
  repository, logs, prompts, receipts, or evaluator child.
- The exact expected tool is `EXPERT_df_fineco_expert`. The seeded
  `KB_doc_query` canary cannot satisfy this gate and must never enter the
  FineCo query, QA, or metric output.
- A binding is eligible only when it exposes a verified finite per-result
  response ceiling; tool inputs are harness-controlled because the service
  imposes no input cap. Observed or average retrieval size is not a
  pre-call bound.
- Keep target and judge boundaries separate. The local Chat target uses the
  developer Azure Foundry through local LiteLLM; the semantic judge uses the
  separately approved judge proxy and restricted judge credential.
- Keep concurrency at one, target retries disabled through the pinned local
  LiteLLM deployment, and judge retries disabled. Do not weaken metrics,
  thresholds, or goldens to make a run pass.
- The combined target and judge reserve is capped at USD 1. Do not start a
  paid phase until its pessimistic reserve fits that cap.
- A remote FineCo MCP tunnel, port-forward, secret or permission change,
  deployment, cluster connection, push, merge, and PR/MR publication are
  separate authority layers. They are not granted by this roadmap.
- The 2026-09-01 ruling opens this follow-up roadmap only. It does not
  authorize the binding, tunnel, or 20-case run itself.
- The parent's three-round planning review deadlock remains disclosed. Its
  final correction is not an approved planner verdict and must not be relabeled
  as one.

## Known traps

| Symptom | Cause | Remedy |
| --- | --- | --- |
| The local canary succeeds but FineCo cases fail the expected-tool gate | The seeded local MCP server exposes `KB_doc_query`, not the FineCo expert | Inspect the runtime tool inventory first; park at the binding gate and do not substitute the canary. |
| LiteLLM appears healthy but calls use the wrong upstream | `devrouter ensure` does not replace environment values in an existing service container | Stop this exact worktree, then restart it through the restricted `klicker-dev` operator mapping. |
| The target or judge receives credentials it should not see | Target and evaluator processes inherit different environment boundaries | Inspect only presence/absence markers; keep developer Foundry values in the Chat container and the judge key in the wrapper's restricted child. |
| A query-eval run starts judging incomplete data | Structural query failures are not a quality result | Run `query` first, require exactly 20 structural records, then run `eval` against the captured QA file. |
| A cleanup check reports route-state drift | The route inspector can be unavailable even after the exact runtime stopped | Use the exact `devrouter stop` result, provider state, process state, and exact route count; do not restart the runtime merely to satisfy an unavailable inspector. |
| The preserved Lena changes look ready to reapply onto the reconciled tree | The stash was made against the old branch tree, not the current `origin/v3` tree | Keep the primary checkout on its restored old ref for that user-owned work; use the isolated reconciliation branch for current-state inspection, and do not drop the safety stash. |
| Deployment source config is mistaken for a usable FineCo binding | GitOps desired state does not prove the deployed tool inventory, authorization, or response-size contract | Treat `df_fineco_expert` in `ai-infrastructure/deployment` as a source lead only; obtain an authorized values-free runtime inventory and owner confirmation of the source-verified finite bound before W2 — twenty-case FineCo capture and semantic judge. |

## Work items

### W1 — FineCo expert-binding readiness

**Problem.** The adapter, ground truth, and judge contract are ready, but the
proven local runtime has no `EXPERT_df_fineco_expert` binding. The first work
item establishes the authorized synthetic binding and its finite response
bound; it does not run the 20-case quality phase.

**Do.**

1. Resolve [A1 — authorized FineCo binding and finite response bound](#a1--authorized-fineco-binding-and-finite-response-bound)
   before making any remote or runtime change.
2. In the owning runtime or configuration repository, or in the explicitly
   authorized synthetic environment, verify the values-free tool inventory for
   both `tutor` and `explainer`. The exact expected tool must appear as
   `EXPERT_df_fineco_expert` for `catalog_expert_v1`.
3. Verify one synthetic request against that binding and record the contract
   source, binding revision, tool name, mode, and finite per-result
   input/tool-output ceiling. Do not record payloads, credentials, or raw
   retrieval content.
4. If the binding requires source, permission, secret, deployment, or tunnel
   changes, stop at that authority boundary and return the evidence packet to
   its owner. Do not expand this item by modifying the Klicker adapter or the
   evaluator without a reproduced contract gap.

**Check.** A sanitized readiness receipt shows the exact expert tool in the
runtime inventory, one synthetic bounded probe, both required modes, the
binding revision, and a pessimistic cost reserve within the remaining USD 1.
If any element is missing, record `delivery_pending` with the exact external
dependency and do not start W2 — twenty-case capture and semantic judge.

**Working context.** Use the current Klicker worktree only for adapter and
documentation readback. The binding owner must name the mutable repository,
branch, environment, and single writer before source changes begin. Do not
create a new Klicker branch or worktree for a binding change by assumption.

**Authority and terminal.** Local readback and sanitized evidence are granted.
Secret writes, permission changes, tunnel setup, cluster access, deployment,
push, merge, and publication are withheld. Required delivery is `reviewed`
when the binding contract is proven, or explicitly `parked` when the external
dependency remains unavailable.

**Boundary owner.** Package owner in the main session; no active roadmap
orchestrator currently owns this package.

**Release-note impact.** None; this is internal evaluation infrastructure.

**Depends on / GATED on.** GATED on A1 — authorized FineCo binding and finite
response bound. Do not start before the ruling and the evidence packet.

**Priority.** P1 — this is the only prerequisite for the quality run.

### W2 — Twenty-case FineCo capture and semantic judge

**Problem.** Once W1 — FineCo expert-binding readiness proves the exact
binding and finite bound, run the existing 20 synthetic cases through the real
local Klicker Chat route and judge the captured answers with the unchanged
shared evaluator.

**Do.**

1. Re-run the offline wrapper and adapter checks. Confirm the evaluator
   submodule is at `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b` and the ground
   truth still contains exactly 20 FineCo cases.
2. Activate the VPN and start the exact worktree with the restricted
   `klicker-dev` mapping in [How to work on this](#how-to-work-on-this). Verify
   the local LiteLLM model path is direct developer Foundry and that the
   approved judge proxy is separate.
3. Run the synthetic transport canary once. Label it `source=canary` and keep
   it outside the FineCo query and evaluation artifacts.
4. After W1 — FineCo expert-binding readiness and its A1 evidence pass, run
   the sequential query phase:

   ```bash
   pnpm run eval:klicker -- \
     --local-target --mode query --limit 20 --concurrency 1 \
     --tool-profile catalog_expert_v1
   ```

   Keep the printed QA path outside the repository. Require exactly 20
   structural records, the expected mode for every case, the expected expert
   tool for every case, non-empty answers, and zero target transport errors.
5. Inspect the query receipt and calculate the pessimistic target plus judge
   reserve before judging. Preserve the parent plan's retry and token ceilings;
   do not start if the bound exceeds USD 1.
6. Run the judge as a separate phase against the captured QA file, using only
   the dedicated semantic-similarity metric:

   ```bash
   EVAL_METRICS_PATH="$PWD/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" \
   pnpm run eval:klicker -- \
     --mode eval --eval-mode ground-truth --limit 20 \
     --qa-file /absolute/path/to/the/captured-qa.json
   ```

   Require exactly 20 metric records. Report the distribution, per-case
   failures, target and judge request counts, available usage, reserved
   worst-case cost, and latency. Never infer unavailable target usage from
   judge usage.
7. Stop the exact worktree and verify provider, process, LiteLLM, adapter, and
   route cleanup. Keep QA, receipts, and evaluation output outside Git.

**Check.** The evidence packet contains the exact source HEAD, binding and
   finite-bound receipt, 20 structural QA records, 20 semantic-similarity
   records, zero judge transport errors, cost and retry accounting, and
   verified runtime cleanup. Metric failures remain quality findings; they are
   not fixed by changing this roadmap's metrics or goldens.

**Working context.** Reuse the current adapter worktree and the unchanged
   evaluator submodule. The target is local loopback to the adapter; the
   adapter reaches only the exact namespaced Klicker routes; local LiteLLM
   reaches developer Foundry; the judge uses its separately approved proxy.

**Authority and terminal.** A bounded synthetic local run and sanitized local
   receipts are granted after W1 — FineCo expert-binding readiness. A missing
   binding, missing finite bound, unavailable VPN/provider, or cost overrun
   returns `delivery_pending` before paid calls. Tunnel setup, deployment,
   cluster access, real data, push, merge, and publication remain withheld.
   Required delivery is `live_proven` for a complete local target-and-judge
   run, otherwise explicitly `parked`.

**Boundary owner.** Package owner in the main session; final evidence is
   reviewed against this item before roadmap progress is updated.

**Release-note impact.** None; evaluation results are internal evidence and
   do not claim a production-quality or deployed-state change.

**Depends on / GATED on.** Depends on W1 — FineCo expert-binding readiness;
   GATED on A1 — authorized FineCo binding and finite response bound. Do not
   start the query or judge phase before both are satisfied.

**Priority.** P1 — this is the requested evaluation outcome.

## Decision gates

### A1 — authorized FineCo binding and finite response bound

| Question | Options | Recommendation | Gates |
| --- | --- | --- | --- |
| Which synthetic environment may provide the real FineCo expert binding for this evaluation? | An existing developer-owned FineCo binding with an explicitly authorized read-only route; a newly provisioned local synthetic fixture that is transport-only; or no binding for this workstream. | Use an existing developer-owned synthetic FineCo binding only after its owner confirms the route and supplies a finite per-result bound. If that binding is unavailable, keep the quality phase parked; do not call the local `KB_doc_query` canary FineCo evidence. | W1 — FineCo expert-binding readiness and W2 — twenty-case FineCo capture and semantic judge |

Status: open. The 2026-09-01 ruling opened the follow-up roadmap but did not
grant tunnel, secret, permission, deployment, or cluster authority. Read-only
source inspection found the STG/PRD desired-state tool config, but it did not
prove runtime registration. The per-result output ceiling is source-verified
as finite (20 × 65,535 characters, with tool inputs harness-controlled); the
owner inventory checklist below covers the remaining runtime registration
proof.

## External dependencies to watch

- FineCo runtime owner: an authorized synthetic binding exposing
  `EXPERT_df_fineco_expert` in tutor and explainer. The per-result output
  ceiling is source-verified as finite (20 reranked documents × the
  collection's 65,535-character `content` cap), but owner confirmation of
  the runtime binding remains outstanding.

  ### Owner inventory checklist (values-free)

  The FineCo runtime owner can close A1 — authorized FineCo binding and
  finite response bound with three values-free checks that return only tool
  names, counts, and versions, never tool payloads:

  - Deployed doc-query: report the running image tag and confirm
    `df_fineco_expert` appears in the server's `tools/list` for the STG
    and PRD doc-query deployments.
  - Chatbot inventory: for the FineCo catalog chatbot
    `27c3f981-f4f6-4c03-9723-9cb495255bc1` (`catalog_expert_v1`), list
    the model-visible tool names in one tutor session and one explainer
    session; `EXPERT_df_fineco_expert` must appear in both.
  - Bound confirmation: confirm the live config matches desired state
    (`RETRIEVAL_RERANKER_TOP_K=20`, Cohere reranker) and that the tool
    reads Milvus collection `df_fineco_v1` or the shared
    `klicker_course_materials_v1`; both carry the verified
    65,535-character `content` cap, so either reading keeps the
    20 × 65,535-character ceiling finite.

- AI infrastructure deployment source: `origin/main@08d82585` contains the
  `df_fineco_expert` tool config and includes it in the STG and PRD tool
  ConfigMaps. Both base ConfigMaps set `RETRIEVAL_TOP_K=60`,
  `RETRIEVAL_RERANKER_TOP_K=20`, and `RERANKER_TYPE=cohere`. This is
  desired-state evidence, not live runtime proof.
- Doc-query source contract: `ai-buddy` `dev@344a6800a` passes the configured
  `top_k` to the Cohere reranker and returns full chunk content without a
  final character/token trim. This is one half of the source-verified finite
  per-result ceiling; combined with the collection schema's 65,535-character
  `content` cap, the bound is 20 × 65,535 characters.
- VPN and developer Azure Foundry: required for the local target's direct
  LiteLLM path; values remain operator-injected and never enter Git.
- Infisical profiles `klicker-dev` and the separately approved judge profile:
  the first feeds only the local Chat runtime, while the second feeds only the
  evaluator's judge credential.
- Evaluation framework submodule: remains at merged commit `2a75632`; any
  framework change is a separate package and review.
- Lena's original `docs/chatbot-hitl-config-roadmap` ref: not a dependency for
  the FineCo run. Its primary checkout was restored to the original
  `ea673f8470` ref, and the former dirty work is reapplied there. The verified
  current-state reconciliation remains isolated on
  `rs/chatbot-hitl-config-roadmap-upstream-reconciled` at `62cebcda7b`; the
  safety stash `b8fb2568bef5e0d3bc53bbbd96464d3a86822fff` remains available.
  Do not drop the stash, push the branch, or integrate `origin/dev` without a
  separate request.

## Review and evidence expectations

At the W1 — FineCo expert-binding readiness boundary, provide the sanitized
binding inventory, finite-bound proof, binding owner/revision, authority
status, and the exact reason for any parking.

At the W2 — twenty-case FineCo capture and semantic judge boundary, provide the
query and evaluation paths outside Git, structural and metric counts, cost and
retry accounting, exact source and submodule heads, target/judge separation
proof, cleanup proof, and the updated execution-plan Progress reference. The
package owner then performs a fresh evidence review against this roadmap. No
browser evidence is required unless a future change also touches the Chat UI,
auth flow, cookies, or other browser-only behavior.

## Out of scope

- Creating or repairing the FineCo service, changing permissions, or changing
  secret mappings.
- Establishing a remote MCP tunnel or port-forward from this roadmap.
- Changing the evaluator framework, ground truth, tool catalogue, metric
  threshold, retry policy, or model registry to improve the result.
- Fixing target-quality findings in the evaluation package. Findings become a
  separately planned follow-up after the evidence is reviewed.
- Deploying to staging or production, using real course/participant data, or
  claiming production readiness from a local run.
- Pushing the reconciled ref, publishing or merging a remote PR, dropping the
  safety stash, or deleting either Lena worktree.

## Progress

- 2026-09-01 — Roadmap opened after the user selected the FineCo follow-up.
  The parent package remains `delivery_pending`: the local direct-Foundry
  canary passed, but the expected expert binding and finite response bound are
  unverified. W1 — FineCo expert-binding readiness is gated on A1 — authorized
  FineCo binding and finite response bound; W2 — twenty-case FineCo capture and
  semantic judge has not started.
- 2026-09-02 — With explicit approval, the dirty primary state was scanned in
  a redacted scoped pass (`27` files, no leaks), saved to local stash
  `b8fb2568bef5e0d3bc53bbbd96464d3a86822fff`, and the current-state
  reconciliation was kept isolated at `62cebcda7b`. At the user's request,
  the primary checkout was restored to `ea673f8470` and the stash was applied
  there; the stash remains intact, and no push, merge, or remote PR action was
  performed.
- 2026-09-02 — The user selected the verified `origin/v3` basis and left the
  overlapping `origin/dev` drift unintegrated. After an exact runtime restart
  with the restricted Azure-to-LiteLLM mappings, the synthetic canary passed
  with HTTP 200, source `canary`, the marker, and `KB_doc_query`. The direct
  MCP inventory returned only `doc_query`; `EXPERT_df_fineco_expert` remains
  unavailable. The runtime was stopped and verified with exited providers and
  zero exact routes. The FineCo quality phase remains parked.
- 2026-09-02 — Read-only AI infrastructure source inspection found
  `df_fineco_expert` in the STG and PRD desired-state ConfigMaps at
  `ai-infrastructure/deployment` `origin/main@1188ff25`. The corresponding
  local doc-query source at `ai-buddy` `dev@41db6926` has no final output trim
  after source-priority rescue. No runtime inventory, finite response bound,
  cluster connection, or tunnel was established; A1 — authorized FineCo
  binding and finite response bound remains open, so W1 — FineCo expert-binding
  readiness and W2 — twenty-case FineCo capture and semantic judge remain
  `delivery_pending`.
- 2026-09-02 — The local documentation commit records this roadmap and the
  parent-plan Progress reconciliation while preserving the evaluator submodule at
  `2a75632a`. Prettier, diff checks, staged Gitleaks, and standalone
  `check:playwright-ci` passed. The commit hook's selector fixture inherited
  Git's hook environment and created an unintended local fixture commit; the
  evaluation worktree was repaired and amended without source changes. The
  primary checkout remains restored with safety stash
  `b8fb2568bef5e0d3bc53bbbd96464d3a86822fff` intact.
- 2026-09-02 — Refreshed read-only source inspection found the FineCo config
  in STG and PRD at deployment `origin/main@08d82585`, with both base
  ConfigMaps setting retrieval to 60 and reranked output to 20. At
  `ai-buddy` `dev@344a6800a`, the configured reranker is Cohere and documents
  mode serializes each reranked chunk's full content with no final trim. The
  Klicker client namespaces `EXPERT` + `df_fineco_expert` to the expected
  tool name, but no authorized runtime inventory or synthetic probe proves
  that binding is active in tutor and explainer. A1 — authorized FineCo
  binding and finite response bound remains open because the desired-state
  20-document count still lacks a runtime-backed per-result output byte/token
  ceiling; W1 — FineCo expert-binding readiness and W2 — twenty-case FineCo
  capture and semantic judge remain `delivery_pending`.
- 2026-09-02 — Inspected the prior activation artifacts read-only: the S4
  legacy schema capture contains an actual Milvus readback of `df_fineco_v1`
  with `content` as VARCHAR `max_length` 65535, and the shared
  `klicker_course_materials_v1` target shows the same cap. The PRD
  activation manifest additionally shows the `df_fineco_expert` tool wired
  as required with alias `doc_query` in both tutor and explainer, targeting
  the shared collection, while the deployed STG and PRD tool ConfigMaps at
  `origin/main@08d82585` still name `df_fineco_v1` directly; both
  collections carry the same content cap, so the ceiling conclusion holds on
  either path. The per-result serialization ceiling is source-verified as
  finite at 20 × 65,535 characters. The remaining A1 — authorized FineCo
  binding and finite response bound dependency is the runtime owner's
  authorized values-free tool inventory; W1 — FineCo expert-binding readiness
  and W2 — twenty-case FineCo capture and semantic judge remain
  `delivery_pending`.
- 2026-09-02 — Re-verified the deployment basis read-only: no commits touch
  `pipelines/` since `origin/main@08d82585`, so the STG and PRD tool
  configs still point `df_fineco_expert` at Milvus collection
  `df_fineco_v1` while the PRD activation targeted the shared collection.
  The activation receipts now prove both FineCo copies applied in full:
  `status: applied` with 459 source rows, 459 copied, and 0 skipped in both
  the STG sweep and the PRD activation. A targeted diff of the standalone
  doc-query service from the deployed v0.7.2 to `origin/main@748b5a2` found
  no output-limit or content-trim change; the only truncation-like hit is a
  32-hex fallback for generated chunk IDs. The finite per-result ceiling
  therefore remains 20 × 65,535 characters on both the deployed and current
  service source. The remaining A1 — authorized FineCo binding and finite
  response bound dependency is still the runtime owner's authorized
  values-free tool inventory; W1 — FineCo expert-binding readiness and W2 —
  twenty-case FineCo capture and semantic judge remain `delivery_pending`.
- 2026-09-02 — Verified the tool-input side from source: the doc-query
  contract exposes `question` as a bare string parameter with no pydantic
  length constraint, `run_query` passes it into the prompt template
  untouched (the only slice is a 100-character log line), and the Klicker
  MCP client adds no tool-argument length validation. The tool-input side is
  therefore not finitely capped at either layer; the finite per-result bound
  remains the verified output ceiling of 20 × 65,535 characters, with
  evaluation inputs controlled by the W2 — twenty-case FineCo capture and
  semantic judge harness and live-chat inputs bounded only by the calling
  model's output-token configuration. A1 — authorized FineCo binding and
  finite response bound still awaits the runtime owner's authorized
  values-free tool inventory; W1 — FineCo expert-binding readiness and W2 —
  twenty-case FineCo capture and semantic judge remain `delivery_pending`.
