# OCR failure diagnostics

## Approval summary

The user approved clearer budget-exhaustion diagnostics and investigation of
incomplete draft coverage. Extend the existing sanitized upstream-error receipt
and job-log summary with fixed reasons derived from OpenRouter's documented
error envelope. Recognize a narrowly defined legacy key-limit message when the
structured metadata is absent. Preserve unknown classifications when evidence
does not identify a cause. Provider messages, arbitrary metadata, account
amounts, identifiers and reset timestamps remain private.

Investigate incomplete coverage using existing public run diagnostics and the
exact producer source. Correct only a demonstrated defect that fits the approved
constraints; report model or resource limitations without speculative fixes.
Preserve models, maximum reasoning, prompt/completion and aggregate budgets,
accounting, concurrency, deadlines, retry/resume behavior, selection and coverage
requirements. Add no upstream requests or paid replay.

Completion is focused offline regression proof, configured source reviews,
ordinary commits/push and one draft PR against `v3`. Live qualification uses the
next normal draft review. Merge, ready-marking, account settings, credentials,
manual resets, deployments and manual inference remain outside this package.
The user already approved this executable batch; internal review does not need
another generic approval.

## Execution details

Full path; execution mode standard because exact main-model identity is unknown.
One cohesive diagnostics package, no stack. Repository
`/Users/rschlae/Git/klicker/klicker-uzh`; worktree
`trees/ocr-failure-diagnostics`; branch `rs/ocr-failure-diagnostics`;
target/base `v3` at `d6eac932f336407de4b77d6ec31ae0e0d7c38219`.
Existing earlier OCR packages are merged; this package starts from current v3.
Primary checkout remains inspection-only. Artifacts root is existing `project/`.

### Binding contracts

- Parse only the existing bounded JSON error body. Classify OpenRouter HTTP
  402/403 using `error.metadata.limit_source`: `openrouter_key_limit` maps to
  `key_budget_exhausted`, `openrouter_guardrail_budget` to
  `guardrail_budget_exhausted`, `openrouter_in_flight_budget` to
  `in_flight_budget_exhausted`, and `openrouter_credits` to
  `credits_insufficient`. Legacy recognition requires HTTP 403, absent metadata
  or a plain metadata object without `limit_source`, and a string beginning
  `Key limit exceeded` followed by end, whitespace, period, colon or parenthesis.
  Present unknown/malformed structured evidence prevents the legacy fallback.
  Numeric status/code alone cannot prove budget exhaustion.
- Other providers, statuses, malformed, oversized or unreadable bodies remain
  unknown. Preserve early status capture, concurrent receipt independence and
  immutable diagnostic snapshots. Older valid receipts still summarize with
  an unknown reason; malformed reasons never reach logs.
- Keep client errors, transport, accounting/cost arithmetic, provider payloads,
  limits and workflow decisions unchanged. This is reporting only.
- Investigate public run
  [39366782212](https://github.com/uzh-bf/klicker-uzh/actions/runs/39366782212)
  and its existing diagnostics. A green workflow does not prove full coverage.
  Distinguish observed counters from causal attribution; document gaps explicitly.
- No private browser/account evidence enters source, public plans, tests, CI or
  PR descriptions. Tests use synthetic messages and values exclusively.

### Delegation and sequence

Main owns error-classification/privacy decisions, adapter/tests/docs, integration,
Git effects and delivery. Route main: these decisions cross the logging privacy
seam and are tightly coupled. Acceptance: synthetic rejection and summary tests,
unchanged policy/accounting comparison, staged data scan and exact diff review.

A read-only explore child owns the disjoint coverage investigation using filtered
public diagnostic lines and bounded public producer source. Acceptance: supported
failure categories, exact source references, limitations and any reproducible
in-scope defect. No private account evidence or external side effects are shared.

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Budget diagnosis | main | Approved planner pass | Adapter and summary regression tests; privacy review |
| Coverage investigation | explore, read-only | Existing public run | Fixed outcome artifact and source evidence |
| Coverage log correction | main | Reproduced reporting omission | Existing draft-runner regression and outcome/log agreement |
| Integration and draft delivery | main | Passing slices/reviews | Full-range review, focused checks, pushed draft |

1. Add fixed budget diagnosis in `.github/scripts/ocr-mistral-adapter.cjs`, extend
   its existing `.test.cjs` suite, and update the existing contract in
   `docs/ci-and-deployment.md`. Keep changes within those files plus this plan.
2. The existing public outcome artifact classifies the failed items, but the
   draft-runner coverage log omits those categories. Correct that reporting-only
   omission in `.github/scripts/ocr-draft-review.cjs` and
   `.github/scripts/ocr-draft-review.test.cjs`, using the existing sanitized
   diagnostic builder. Emit fixed category counts without raw reasons or paths.
   Update the matching CI guide paragraph. Deeper task-level root cause remains
   unproven; budget/resource-policy or retry changes require separate approval.
3. Review the integrated committed range, resolve accepted findings, push and
   open the draft. Keep CI/source verification distinct from live acceptance.

### Verification portfolio

- Budget-vs-ambiguous rejection: test obligation `extend existing`; cover
  structured/legacy cases, both providers, status bounds, malformed metadata,
  phrase-boundary negatives and conflicting structured/message evidence.
- Privacy: synthetic sentinel fields and forged diagnostic reasons must never
  reach client responses, receipts, stdout or the job summary. Extend the
  existing rejection/summary tests rather than add another harness. Test
  obligation `extend existing`.
- Compatibility: test obligation `extend existing`; exercise distinct diagnostic
  reasons in the concurrent/stalled-body and immutable-snapshot cases and old
  receipt summary cases. Preserve existing request and usage contracts.
- Coverage: test obligation `extend existing`, justified by the reproduced log
  omission; verify category counts and sentinel exclusion in the existing
  draft-runner fake-child integration test. No application/browser runtime is needed
  for dependency-free workflow scripts. Use pinned Node, native formatter and
  gitleaks; required hosted checks cover repository-wide build/type/lint gates.

### Review and delivery

Planner hardens this derived approved plan. Each substantive slice gets the
simplifier and privacy/correctness slice review; final trusted review covers the
integrated range after tests. Inspect every changed hunk and staged content for
scope, secrets, personal data and private account facts before each commit and
PR-body update. Preserve applicable verification when source is unchanged.

## Progress

- Remote refs refreshed; baseline adapter/draft suites pass. No source edit yet.
- Coverage investigation running; budget documentation retrieved from official
  OpenRouter sources through Context7. No paid requests or settings changes.
- Native planner approved round two after clarifying classification precedence,
  slice ownership and reason-field regression coverage. Opposing-provider
  advisory challenge is running. No product primitive or architecture change.
- Budget diagnosis implemented; adapter suite passes 97/97 on pinned Node
  24.21.0. An existing short-deadline transport test was transiently delayed;
  the unchanged test passes on the subsequent complete run. Test delta: one
  behavioral matrix added, existing summary/concurrency/stalled-body cases
  extended, no tests removed. Formatter and data/secret checks pass.
- Public outcome evidence confirms the category-log omission. Next: review
  slice one and add category counts to the draft log. PR not yet created.
