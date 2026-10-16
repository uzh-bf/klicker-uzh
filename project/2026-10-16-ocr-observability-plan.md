# OCR progress and complete cost reporting

## Approval summary

OCR logs should explain quiet periods, show when the review process ends, and
account for every existing model stage. Cost reports should identify missing or
invalid accounting evidence without exposing provider content.

The user approved all three improvements and delivery through local commits,
ordinary pushes, and one draft pull request against `v3`. This is an executable
batch; no further generic approval is needed. Keep model selection, reasoning,
token allowances, deadlines, concurrency, cache routing, retries, review scope,
and the number of provider requests unchanged. Implement reporting locally using
responses from the calls already made.

Add best-effort, content-free heartbeat and process-exit events. Extend the
existing diagnostics with stage-tagged receipts for the manual compatibility
probe and stack topology request. Summaries show stage estimates and a combined
estimate only when receipts match independent invocation counts. Missing evidence
produces fixed reason codes and safe coverage counters, never a zero-cost claim.

Completion requires synthetic contract tests, focused formatting and scanning,
committed-range review, a pushed task branch, and a verified draft PR targeting
`v3` with automatic CI and actionable feedback settled. Merge, readiness changes,
deployment, and additional paid manual OCR runs remain outside this delivery.

## Execution details

- Repository: KlickerUZH; branch `rs/ocr-observability`; target `v3`.
- Baseline: `64f02c4e85d62e39d42a023836e1829fb528cd0f`.
- Worktree: `trees/ocr-observability`; artifact root: existing `project/`.
- Package: one coherent workflow observability improvement, full path.
- Execution mode: standard; main owns shared reporting, integration, external
  actions, and final proof. No product primitive or ADR change is required.
- Skills: sliced development, model routing, writing for agents, PR description
  writing, and PR CI monitoring. No application runtime or browser is needed.
- Main pause conditions: a required review route cannot complete, or a proposed
  correction would change review settings, provider calls, or the data boundary.

### Binding contracts

Existing adapter schema-1 receipts remain readable and represent the `adapter`
stage when no explicit stage is present. Additional stage names are a fixed
allowlist: `preflight` and `topology`. Only safe numeric usage and coverage
counters enter receipts; no prompts, source, arguments, reasoning, errors from
the provider, keys, URLs, or file paths are reflected into reports.

The existing `callMistral` accepts an optional `diagnosticsStage` selected by its
trusted caller. It records one content-free receipt for that invocation when
`OCR_ADAPTER_DIAGNOSTICS_PATH` is configured.
Recording errors preserve existing call behavior. Complete provider usage stays
countable when later canary/topology validation rejects an answer: billing
evidence and answer validity are separate. Caller errors and return values stay
unchanged. HTTP failures or unreadable provider responses leave accounting
incomplete; missing/invalid usage or cache reports also block an estimate.

The summary command accepts expected stage counts after its receipt-path argument:
`summary <path> [adapter=N|preflight=N|topology=N ...]`. Default is `adapter=1`.
Before each manual OCR launch, persist the incremented lifetime count to the
existing step-output file. This count includes resumes and incremental layers;
the final summary reads it independently of diagnostics. Preflight/topology
expect one receipt when their step runs, or zero when skipped. Individual jobs
expect preflight and adapter stages; stack jobs additionally expect topology.
Draft jobs retain one adapter lifetime. A count mismatch blocks that stage and
the combined estimate, including two invocations with only one surviving receipt.
An explicitly skipped stage with zero expected/observed invocations is not run
and incurs no requests. Each complete stage remains independently visible when
another is unavailable. Aggregate each lifetime once; never sum nested counters.

Add the same existing job-specific diagnostics path to preflight, OCR, and
topology steps. Add preflight step IDs for outcome-based expectations and pass
all expected counts to the final summary. Workflow-contract tests cover this
wiring, unchanged settings, and failed preflight followed by skipped stages.

Reason codes cover missing/empty/malformed receipts, unsupported schema or stage,
invalid counters, missing stage, incomplete usage/cache reports, unfinished
requests, and inconsistent counters. Expose only allowlisted counters and codes.
Retain the same pinned prices, rounding, stdout and GitHub-summary parity, and
best-effort sink behavior.

For manual adapter `run` invocations with progress enabled, emit an elapsed-time
heartbeat at most once per minute while the process is quiet and an explicit
process-exit record on normal completion, failure, spawn failure, or signal.
Use the existing dedicated progress descriptor; preserve JSON stdout and private
stderr. Clear/unref timers and preserve listener shutdown and bounded pipe drain.
The terminal record describes process exit, not publication or final-review
success. Draft composite-action progress remains owned by its pinned upstream.

### Delegation map

| Slice | Owner | Dependency and acceptance |
| --- | --- | --- |
| Stage cost coverage and failure explanations | main; executor owns subordinate direct-caller integration | Shared diagnosticsStage option defined first; mocked caller, receipt arithmetic and workflow contracts pass |
| Progress lifecycle | main | First slice accepted; controlled-clock and subprocess lifecycle contracts pass |

The executor owns only the two direct-caller modules and their existing tests.
Main retains shared files and all integration/external actions. No other writer
may edit those caller files until that executor returns or is explicitly stopped.

### Slices

1. **Account for existing model stages and explain incomplete estimates.** Main
   owns `ocr-mistral-adapter.cjs`, its test, `check-ocr-final-review.yml`, and the
   matching CI guide. One executor owns the two direct callers
   `final-ai-review.js`, `final-ai-stack-review.js`, and their existing tests,
   after the shared diagnostics option is defined. Shared files have one writer.
   Commit as `enhance(ci): report OCR cost by provider stage`. Review arithmetic,
   missing-stage handling, privacy, and unchanged request settings.
2. **Make progress lifecycle explicit.** Main owns the adapter and its test plus
   the matching CI guide. Test quiet heartbeats, terminal outcomes, sink failures,
   timer cleanup, signals, and unchanged child streams. Commit as
   `enhance(ci): report OCR heartbeat and process completion`.

No new runtime module, dependency, service, or workflow is needed. The only new
tracked file is this plan. Use existing script modules and existing test suites.

### Verification portfolio

| Observable contract | Test obligation | Stable seam and acceptance |
| --- | --- | --- |
| Cost totals and savings | extend existing | Complete multi-stage receipts, independent arithmetic, no double counting |
| Incomplete accounting | extend existing | Missing lifetime/stage, malformed data, absent/invalid cache counts and failed attempts block a complete total |
| Provider behavior | extend existing | Mocked direct calls retain request bodies/deadlines/results, including valid usage when caller validation rejects an answer |
| Progress and lifecycle | extend existing | Controlled clocks and subprocess fixtures verify heartbeat timing, exits, signal cleanup and isolated stdout |
| Privacy and best effort | extend existing | Sentinels/workflow commands remain absent; broken sinks preserve results |
| Workflow wiring | extend existing | Shared paths, independent counts, skipped-stage expectations and unchanged settings |

Slices do not expand this test portfolio. Integration runs the existing adapter,
individual/stack review and self-update suites, plus syntax, formatting, scoped
Opengrep and staged Gitleaks.

Run the fastest relevant baseline before edits. Use repository-installed Biome
and Prettier. Preserve normal hook behavior and report missing local dependency
installation; required CI remains authoritative for full checks. Review the
committed package once integrated and address valid automatic OCR feedback.
Live proof of trusted workflow changes follows merge and separate authorization.

## Progress

- Status: approved executable batch; implementation not started.
- Planning review: APPROVED after two rounds; accepted independent invocation
  reconciliation, separation of answer validity from usage completeness, explicit
  workflow wiring, and ownership/test-portfolio clarification.
- Completed: remote-state refresh, worktree creation, source-boundary inspection.
- Baseline: all 182 existing focused tests passed.
- Remaining: both slices and their checks/reviews; final review;
  push, draft PR, and automatic CI/feedback.
- Delivery: source work authorized; no PR created yet.
- Next action: commit the reviewed plan, then implement stage reporting.
