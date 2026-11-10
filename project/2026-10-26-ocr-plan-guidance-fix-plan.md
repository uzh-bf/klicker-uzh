# OCR final plan guidance

## Approval summary

The stock draft reviewer can turn an unfinished reasoning-only response into a review plan. Its planning consumer calls a helper that falls back to reasoning when final text is absent, then reports planning completion. This package keeps that response from becoming guidance while retaining the stock CLI and its existing nonfatal no-plan behavior.

Approval mode: executable batch. The user accepted the proposed narrow fix after an offline reproduction. Authorized delivery includes implementation, synthetic verification, configured source reviews, ordinary commits and pushes, and a draft PR against `v3`. It ends at a reviewed draft with accurate CI evidence. Readiness, merge, caller-pin adoption, settings, credentials, private activation and provider replays remain separate.

Use a draft-only compatibility option in the existing adapter. Recognize the pinned stock CLI's planning task key rather than inspecting prompts. Forward only a completed final plan; return an empty plan for a truncated or final-text-empty response, keeping HTTP success, original finish reason and usage. Record fixed sanitized usable/unavailable counters. Unknown task identities and main-review responses retain their existing behavior.

Models, maximum reasoning, completion and aggregate budgets, cache affinity, aggregate accounting, retries, concurrency and timeouts remain unchanged. The change does not promise token savings or establish finding quality. Synthetic tests must prove that unusable plan content cannot reach main guidance and that the stock CLI makes no additional provider dispatch.

## Execution details

### Contract and ownership

Execution mode: standard. Full path applies because the correction crosses the adapter/stock-consumer seam. No new product primitive, provider, dependency or engine delivery path is introduced.

Main owns this coupled adapter, unit/stock tests, draft opt-in, documentation, manifest and integration. Execution-tier retention reason: critical-path coupling between response handling and the stock consumer acceptance fixture. The planner challenges the design read-only. The simplifier and risk reviewer inspect the same committed scope; Claude performs the integrated final source review.

1. Qualify the narrow planning-request identity against the pinned `SessionTaskKey` contract: exactly eight hexadecimal session-prefix characters, `-plan_task-`, and a sixteen-character hexadecimal scope digest, without advertised tools. Unknown forms retain existing behavior. A recognized planning response requires `stop` and nonempty final text. For unusable results clear partial text and reasoning in the OCR-facing message. Preserve the original native response in existing private replay storage and record returned usage before applying the projection. Do not introduce an HTTP error or a stock-client retry.
2. Enable the compatibility behavior only in `runDraftReview`. Expose fixed planning counters through the existing diagnostics and log/summary path, distinguishing response handling from useful plan availability. Existing CLI phase-completion progress remains a transport-phase event, not evidence of usable guidance.
3. Extend the existing adapter and actual stock fixtures. Refresh affected release hashes and the relevant CI guide. Commit, simplify, review, push and open the draft. Inspect current-head producing CI and ordinary feedback available during the session; retain pending states truthfully without creating a scheduled watcher.

### Test portfolio

| Risk | Observable acceptance | Existing seam |
| --- | --- | --- |
| Reasoning or partial text becomes plan guidance | Valid final plan reaches main input; reasoning-only length, partial-visible length, whitespace and empty final answers do not | Adapter tests and stock draft fixture |
| A no-plan fallback adds requests or loses usage | Same synthetic dispatch count; unchanged recorded and OCR-facing token accounting | Stock draft fixture and adapter tests |
| Main reasoning or unknown task handling changes | Main native replay, interrupted continuation and unknown affinity behavior remain intact | Existing adapter contracts plus focused cases |
| Diagnostics overstate success or expose payloads | Fixed unavailable categories, validated summary counters, no raw keys or response content | Existing adapter diagnostics/summary tests |
| Release or caller contracts drift | Asset hashes verify and current stock/controller/final contracts pass | Existing runtime verification and focused suite |

### Working context

Repository `uzh-bf/klicker-uzh`; target `v3` at `3d096cf8e38360bac4309ebc756d1a54cc586fbc`. Reuse `trees/rs/ocr-shared-runtime`, branch `fix/ocr-final-plan-guidance`, created cleanly from the target. The primary control checkout is untouched.

Use host Git/gh. Run Node 24 checks and installed formatters in the existing isolated tool image with synthetic providers and the stock OCR 1.13.0 binary. No application runtime or paid OCR replay is needed. Inspect staged content and PR text for secrets, personal data and real-environment facts. Detailed live diagnostics and financial analysis remain ignored local artifacts.

## Progress

- Scope approved by the user's agreement to the preceding narrow-fix proposal. Branch and target refreshed; planner approved after the anchored key matcher and partial-visible length response were made explicit.
- The existing offline fixture reproduces the stock consumer defect. It is evidence for the correction, not live qualification of changed source.
- Implementation is complete. All 303 focused OCR contracts pass on Node 24 with zero skips, including the real stock binary and pinned publisher. Five stock planning cases each preserve two synthetic provider dispatches and full returned usage.
- Draft-only opt-in, fixed planning diagnostics, documentation and affected runtime hashes are updated. No workflow, caller pin, model, budget, retry or engine-delivery change is included. Source review and hosted CI remain pending.
