# DeepSeek main reviews through Mistral

## Approval summary

Use Mistral-hosted `deepseek-v4-1-flash-1017` for normal OCR review work:
drafts, individual finals, stack code, topology and compatibility preflight.
Retain `zai-glm-5-3` at maximum reasoning as the focused advisor. This implements
the user's request to investigate Mistral's new support and adopt DeepSeek with
the existing GLM advisor. Continue in draft PR #6760, including its existing
final-workflow startup repair, rather than opening another overlapping PR.

Mistral's model card lists the 1017 checkpoint, function calling and structured
outputs. Its reference prices per million tokens are $0.30 input, $0.007 cached
input and $1.20 output. Cached input is cheaper than GLM Flash; uncached input and
output are more expensive. Overall cost and review quality require ordinary live
evidence. Model availability and maximum-effort acceptance for this account are
not established by documentation or synthetic checks.

The Responses API is a stateless public preview. It supports reasoning, function
calling and streaming, but still requires resending conversation history. Keep
the existing Chat Completions adapter for this package. Adopting Responses would
need separate history, lifecycle and usage translation and offers no automatic
context or token reduction. The existing adapter already preserves native
assistant turns and separates reasoning from review content.

Keep maximum reasoning, all token and request limits, accounting formulas,
retries, concurrency, deadlines, advisor allowance, source trust, publication
and credential isolation unchanged. Preserve the legacy provider profiles for
explicit historical receipt interpretation; never silently fall back to them.
The package ends with verified source, commits, an ordinary push and an updated
draft PR. Merge, readiness, settings, credentials, private activation and extra
paid reviews are outside this batch. Ordinary source revert is the recovery.

## Execution details

Approval mode: executable batch, authorized by the user's request to investigate
and use DeepSeek for normal review with GLM-5.3 max as advisor.
Boundary owner: self. Execution mode: standard, full path for the provider and
cross-controller model identity contract.

Authority: implement, verify, review, commit, push and update draft #6760 against
`v3`. No ready/merge, settings, credentials, private activation or manual replay.
Terminal: complete reviewed source and truthful available CI on the held head.
Pause: a required provider contract cannot preserve the requested maximum effort
or existing accounting; a required review cannot complete through its continuity
route; or an unanticipated authority or data boundary changes.

### Evidence and contracts

- [DeepSeek model card](https://docs.mistral.ai/models/deepseek-v4-flash-1017): exact
  model identifier and capabilities.
- [Mistral pricing](https://docs.mistral.ai/inference/pricing): model-specific
  reference rates; estimates remain distinct from bills and account allowances.
- [Responses guide](https://docs.mistral.ai/studio/conversations/responses) and
  [reference](https://docs.mistral.ai/api/endpoint/responses): stateless history,
  output items, tool results and explicit incomplete/failed terminal states.
- [Reasoning guide](https://docs.mistral.ai/studio/conversations/reasoning): preserve
  native assistant reasoning in multi-turn history. The DeepSeek-specific maximum
  effort contract remains a live qualification boundary, with no downgrade.

Use a distinct fixed provider profile `mistral-deepseek`, the existing Mistral
endpoint and `MISTRAL_API_KEY`. Validate the exact selected model on both request
and response, reject other identities and non-max main effort, and preserve
allowlisted request fields and cache affinity. Do not add endpoint configuration
or a new secret. Native string/chunk content and reasoning remain separate.

Change main model identity consistently across draft execution, preflight,
final/stack evidence, topology, status text, usage receipts and estimates. Old
clean evidence must not attest a different model. Full GLM advisor construction,
selected excerpts, shared eight-attempt limit, tools and accounting remain intact.

### Ownership and slices

Main owns integration, provider semantics, manifest, source review and delivery.
An independent explorer maps affected public source. A planner challenges this
plan. The bounded executor owns identity propagation in `final-ai-review.js`,
`final-ai-stack-review.js` and their two test files, with no other writes.
Main owns all other paths, integration and both slice commits. The executor
cannot commit or perform forge actions. Slice 2 depends on the complete verified
runtime commit from slice 1; independent reviewers own no implementation paths.

1. Add the fixed Mistral DeepSeek profile and propagate main-review identities.
   Extend existing behavioral tests, update the runtime manifest and relevant
   engineering guides. Commit the complete runtime before changing its caller.
   Apply simplification and risk review on the committed integrated source.
2. Pin the draft caller to the complete runtime commit in this same PR. Prove
   exact-SHA retrieval and final manifest/asset parity. Verify the complete
   package, perform final review, push and update the existing draft description.

Extend existing files by default: `ocr-mistral-adapter.cjs`, `ocr-draft-review.cjs`,
`ocr-controller.cjs`, their tests, `final-ai-review.js`, `final-ai-stack-review.js`,
their tests, `ocr-self-update-guard.test.cjs`, the existing composite action,
runtime manifest, both OCR workflows and `docs/ci-and-deployment.md` plus
`docs/ocr-runtime.md`. The portable skill is model-neutral and needs no wording
change. No new runtime module, dependency or policy override is required.

### Test portfolio

| Risk | Test obligation and primary seam | Acceptance |
| --- | --- | --- |
| Wrong model, effort or endpoint | Extend existing adapter mock-provider contracts | Exact Mistral URL/DeepSeek ID/max effort; reject mismatches and lower effort; preserve cache key, output cap and native reasoning across tool continuation |
| Main/advisor confusion or false cost | Extend existing combined receipt and cost tests | DeepSeek rates including $0.007 precision; advisor retains full GLM; reject missing/mismatched receipts without changing aggregate arithmetic |
| Inconsistent final identity or evidence | Extend existing individual/stack preflight, topology, validation and lineage tests | All main passes use DeepSeek; old-model clean evidence rejected; no change to budgets, retry or publication admission |
| Published caller runs old source | Existing controller/self-update/stock qualification | Actual OCR 1.13.0 uses new model with synthetic provider, frozen identity and credential isolation; exact pin retrieval and final asset parity pass |
| Startup repair regresses | Reuse/extend existing setup-shell regression | Runner paths are evaluated in step context and exported identically for individual and stack setup |

Run focused Node24 tests in an isolated tools container. Set `OCR_TEST_BINARY`,
`OCR_TEST_PUBLISHER` and `OCR_REQUIRE_STOCK_BINARY=1`; require the actual stock
version/publisher checks and synthetic DeepSeek tool conversation with the
unchanged GLM advisor to pass without skips. Missing fixtures block completed
verification, while an explicitly incomplete draft update remains possible. Use existing
formatters, staged secret/data checks and diff inspection. No application runtime
or screenshots are needed for these workflow changes. Reuse unaffected passing
checks. Report skips, CI startup failures and unqualified live behavior explicitly.

### Progress

Root outcome: DeepSeek main review with a focused full-GLM advisor, as requested
by the user. Required delivery is source in the existing draft PR. First useful
acceptance is an actual stock OCR tool conversation against a synthetic Mistral
DeepSeek endpoint while the advisor retains its existing identity and bounds.
Documentation verifies the model and Responses preview; no account inference has
been made. Current source is #6760 head `7053ac1592f79fe3d48fb0de5d14386cd946b4e6`,
target `v3` at `cc5bdd23c673870e579785839459576e87bdb174`.
Planner approved the corrected plan. Source mapping and the bounded final/stack executor completed; both children are closed. The fixed DeepSeek profile, all main identities, model-bound evidence, pricing and guides are implemented. All 312 integrated adapter/draft/broker/final/stack checks pass under Node24 with zero skips, including actual stock OCR tool/advisor qualification. Parsed workflow comparison proves only the intended provider bindings changed; advisor assets, engine provenance and profile limits remain identical. Runtime commit, slice reviews, caller pin, published-release contracts and integrated final review remain pending. Account acceptance of the selected model at maximum effort remains unqualified until an ordinary authorized live event.
