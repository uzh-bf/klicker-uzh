# Mistral-backed OpenCodeReview upgrade

## Approval summary

Both automatic draft reviews and manually triggered individual and stack reviews
will use OpenCodeReview 1.13.0 with Mistral-hosted `zai-glm-5-3` at max reasoning.
The user approved this executable batch on 2026-10-13 and will provision the
existing repository's `MISTRAL_API_KEY` GitHub secret.

A runner-local adapter translates request fields and chunked responses. It
retains native assistant messages in bounded process memory and restores them
when OCR replays a conversation. The actual upstream key stays in adapter
startup and direct canary/topology calls. OCR receives only a short-lived
loopback capability. Existing trusted-base checkouts, review authorization,
coverage validation, token ceilings, status binding and cleanup gates remain.

Completion means focused source checks, adapter behavioral tests, released-binary
synthetic qualification where the runtime permits it, review disposition,
ordinary task-branch publication and a draft PR. Live model/tool/structured-output
proof remains pending the secret and trusted default-branch activation. This
batch authorizes source edits, commits, ordinary push and a draft PR. It does not
authorize merging, marking ready, deployment, billing changes or a paid replay.

## Execution details

### Contracts and working context

- Repository: `uzh-bf/klicker-uzh`; target: `v3`.
- Branch: `rs/ocr-mistral-upgrade`; worktree: `trees/rs/ocr-mistral-upgrade`.
- Baseline: `0a8d4652915c9ee6d86136050186bb97e054387d`.
- Git writes were initially blocked by the sandbox. After permission repair,
  `git fetch --prune` succeeded and `origin/v3` still matches the baseline.
  The task branch is zero commits ahead and behind; no integration is needed.
- Execution uses standard routing with committed-package review gates.
- Upstream endpoint: `https://api.mistral.ai/v1/chat/completions`.
- Model and reasoning are fixed to `zai-glm-5-3` / `reasoning_effort=max`.
- Adapter matches the complete normalized assistant turn and preceding history;
  unknown, missing or ambiguous native state fails closed. Cache bounds cover
  entries and bytes. Native chunks are preserved for turns with and without
  tool calls. No upstream secret or native history is written to disk.
- Listener binds only loopback, authenticates a random capability, bounds payloads
  and lifetimes, cancels disconnected requests and rejects streaming.
- Draft startup acknowledges readiness. Always-run stop proves listener closure
  before deleting its temporary state. The trusted adapter copy survives the
  composite action's checkout. Final OCR attempts use the synchronous wrapper.
- OCR's native session directory has no supported override. A released-binary
  probe must use an authorized disposable tool container if Docker is available;
  otherwise its session-write blocker remains visible in the draft.

### Delegation map and sequence

1. Adapter slice: executor owns `.github/scripts/ocr-mistral-adapter.cjs` and
   `.github/scripts/ocr-mistral-adapter.test.cjs`; main owns the contract and proof.
   Acceptance: loopback request/replay/auth/lifecycle fixtures.
2. Integration slice: main owns `.github/workflows/check-ocr-review.yml`,
   `.github/workflows/check-ocr-final-review.yml`, `.github/scripts/final-ai-review.js`,
   `.github/scripts/final-ai-review.test.js`, `.github/scripts/final-ai-stack-review.js`,
   `.github/scripts/final-ai-stack-review.test.js`, `docs/ci-and-deployment.md`,
   `docs/solutions/integration/opencodereview-tool-call-preflight.md`, and the
   affected provider wording in `AGENTS.md`. The existing `check.yml` job also
   runs the adapter and individual/stack helper suites. It depends on the adapter slice.
   Acceptance: existing review/stack validators and workflow gates plus exact
   OCR 1.13 synthetic full/grouped/partial-resume receipts when runnable.

### Verification portfolio

| Risk | Obligation | Primary seam |
| --- | --- | --- |
| Conversion and native replay | Add | Adapter fixtures including concurrency and cache misses |
| Credentials, redaction and lifecycle | Add | Adapter HTTP and child-process fixtures |
| Routing, cleanup/status gates and policy invalidation | Extend | Existing review/stack tests |
| Grouping, coverage and resume receipts | Reuse and extend | Existing strict result validators and released binary |
| Documentation wording | No content tests | Exact diff inspection |

Run focused Node tests, syntax and YAML checks, repository formatting, staged
secret/data inspection, and required hooks. Reuse unaffected results. No app or
DevPod runtime is required. Finish with slice risk review, simplification and
integrated final review; human review and hosted CI remain distinct evidence.

## Progress

- Planner approved the revised contracts before integration.
- Both workflows and the individual/stack helpers now use Mistral `zai-glm-5-3`
  at max reasoning, with OCR/action 1.13.0. Runtime configuration omits `llm.url`
  because OCR's saved URL shadows its per-attempt loopback environment URL.
- Initial focused run: 174 tests passed, no failures. After consolidating two
  redundant tests, a focused run passed all 172 remaining tests. Final-review
  corrections passed all 168 tests after further consolidation. Syntax, YAML parsing,
  formatting, exact diff inspection and source secret scans passed. Full
  monorepo checks and hosted CI remain pending. The worktree has no dependency
  installation; existing hooks explicitly skip pnpm checks in this case and
  require hosted CI. A broader Biome check reports two pre-existing callback-return errors
  in untouched `validateOCRResult` and partial-result validation, plus warnings;
  the changed code introduces no lint errors.
- Released Linux arm64 binary checksum matches upstream:
  `2d66c71eeea08730e1394cc39884b9644d301288443d644a02c2adebb0425b93`.
  The probe uses the existing `node:20.16.0` tool container with networking
  disabled, synthetic source only, and the real secretless default OCR config.
  Its Git 2.39.2 emits a below-supported-version warning.
- Binary proof: single-file review and a native tool round pass; six-file
  semantic grouping completes with six covered files and 75 synthetic tokens.
  A controlled provider failure produces three completed and three failed
  items. A fresh adapter resumes the same session with three reused and three
  completed items. Strict producer and resume-merge validators accept the
  results; combined usage is 75 synthetic tokens. Native thinking is restored
  on real OCR tool replay. No real Mistral calls or charges occurred.
- Committed slice risk review: `PASS_WITH_LIMITATIONS` on the complete
  `e4c6f0d7a1..d9cb6f06d9` package. All 11 committed hashes match the reviewed
  snapshot. No open source findings remain. The report is saved under
  `project/_local/reviews/2026-10-13-ocr-mistral-slice-risk.md`.
- The pre-simplification immutable source manifest is
  `71cb6489958545405a2ca407e255c168a8738d1c56f4452bb2aac2c29639edbb`.
  Scratch evidence remains under `/private/tmp/ocr-mistral-prototype/` and
  `/private/tmp/ocr-review-snapshot-v2/`; these contain synthetic data only.
- Git writes are restored. The plan and both source slices are committed and
  published on the task branch. [Draft PR #6493](https://github.com/uzh-bf/klicker-uzh/pull/6493)
  targets `v3`; hosted CI is running. Simplification is complete and all three
  recommendations are applied: native `Response` fixtures, consolidated replay
  and direct-call coverage, and removal of unused upstream URL overrides.
  Production callers retain the same fixed endpoint. Integrated final review
  found two low-severity issues. Version checks now unset the upstream key in
  their subshells; existing extracted-workflow fixtures assert key absence for
  both jobs and key availability for the adapter. Overlapping tests are
  consolidated, preserving empty-message rejection and both unknown-history
  variants. One bounded final-review correction pass remains.
- Follow-up inspection found that PR CI did not execute the adapter and helper
  suites. They are now wired into the existing codebase check job. The existing
  solution page also records saved-URL precedence exposed by the binary probe.
- GitHub confirms the current account has repository `ADMIN` permission, and
  values-free secret listing confirms `MISTRAL_API_KEY` is not provisioned yet.
  Secret provisioning, key-specific entitlement, live tool/structured-output
  acceptance and trusted default-branch activation remain separate evidence.

## Resume

Complete the final-review correction pass, publish the final task head and update
[Draft PR #6493](https://github.com/uzh-bf/klicker-uzh/pull/6493) with final evidence.
Retain the already passing checks for unchanged code. Leave marking ready, merge, activation, and paid live
runs to their separately named authority; this batch grants none of them.
