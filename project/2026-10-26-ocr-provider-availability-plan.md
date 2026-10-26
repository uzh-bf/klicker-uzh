# OCR provider availability

## Approval summary

An unavailable model provider must produce an explicit incomplete-review outcome. This package handles confirmed HTTP 402 payment rejections without dispatching subsequent model calls, including advisor calls. Requests already dispatched may finish so their usage and completed work remain observable. Draft workflow success means an unavailable advisory was handled, never that review coverage passed. Final reviews continue to block and cannot publish clean evidence when unavailable.

Approval mode: executable batch. The user approved implementation, verification, ordinary commits and pushes, and a draft PR against `v3`. This package adds the trusted repository variable interface `OCR_PROVIDER_PAUSED`, defaulting to enabled provider calls when unset or `false`. `true` pauses new runs; invalid values fail closed. It does not set that variable. Resume applies to the next eligible normal event without a backlog replay. Models, maximum reasoning, budgets, aggregate accounting, transient retries, concurrency and timeouts retain their configured values. Only confirmed HTTP 402 handling changes.

Source delivery ends with a reviewed draft PR. Merge, immutable caller-pin adoption, private activation, billing, credential or live setting changes, and extra provider calls remain separate. Actual provider acceptance needs an ordinary review after source adoption.

## Execution details

### Contract and ownership

The review outcome extends its existing unavailable semantics. Provider availability is shared within one draft invocation, distinct from coverage and cost evidence. The trusted pause interface composes with existing admission and activation rules. It grants no new review authority. GitHub's existing draft path cannot publish a literal neutral check; advisory handling uses warnings, job summaries and sanitized outcome receipts with existing permissions.

Execution mode: standard. Main owns runner, controller, action, workflow, documentation and integration. One executor owns only the adapter and existing adapter tests. The planner approved the resolved design after checking final shell failure propagation. No additional persistent state or module is needed.

1. Extend adapter dispatch with a shared invocation availability latch and fixed sanitized HTTP errors. Cover direct final preflight/topology calls and force a blocking wrapper exit after confirmed payment rejection.
2. Extend draft receipts, validation and publication admission. Preserve valid partial findings, reject malformed results, and handle unavailable runs with missing results without inventing coverage. Wire the trusted pause variable into the action and final execution jobs.
3. Refresh runtime asset hashes, document operational semantics, run existing stock and synthetic tests, simplify and review the integrated committed range, then deliver the draft.

### Test portfolio

| Risk | Obligation | Primary seam |
| --- | --- | --- |
| Model dispatch continues after 402 | Extend existing | Adapter tests: main/advisor shared latch, already dispatched completion, transient errors unaffected |
| Unavailable produces clean coverage or bypasses validation | Extend existing | Draft/controller tests: missing result, valid partial findings, malformed outcome/result, supersession |
| Pause or final stages bypass availability | Extend existing | Strict parsing, no dispatch when paused, actual stock CLI against 402, final wrapper exit overrides child success, workflow dependency admission |
| Immutable release or caller contract changes unexpectedly | Reuse/extend existing | Runtime verification and published caller/stock contracts |
| Prose or live provider billing | None | Documentation inspection; no live inference or content-pinning tests |

### Working context and verification

Repository: `uzh-bf/klicker-uzh`. Target `v3`, fetched baseline `712cb42d0d061564577be4852880b8714c88989e`. Existing task worktree `trees/rs/ocr-shared-runtime`, new branch `rs/ocr-provider-unavailable`. Previous caller branch was clean and source-equivalent to the merged baseline before switching.

Use host Git/gh. Run Node 24 tests and installed formatting tools in an isolated tool container with synthetic providers and the existing stock OCR fixture. No application runtime is required. Inspect staged content for secrets, personal and real-environment data before every commit and PR-body update. Retain detailed local evidence under ignored `project/_local/`.

## Progress

- Approved scope recovered and target fetched; planner resolved design approved.
- Implementation and verification pending. No provider or account changes performed.
