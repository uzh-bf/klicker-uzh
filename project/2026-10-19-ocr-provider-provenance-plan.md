# OCR provider diagnostics and clean-review provenance

## Approval summary

The approved follow-up fixes two gaps exposed during OCR qualification. Provider
failures currently retain only a broad rejection count. Add the HTTP status and
a closed set of error codes to sanitized receipts and job summaries, so an
operator can distinguish authentication, credits, request and availability
failures without exposing response text. The clean-review freshness verifier
also rejects genuine GitHub Actions checks because their returned details URL
names the check rather than the workflow. Accept that exact repository/check
URL alongside the existing workflow URL, while retaining all provenance checks.

Deliver one reviewed draft PR against `v3`, with focused synthetic regressions,
ordinary commits and a non-force push. Preserve model, reasoning, request and
token budgets, accounting, retry behavior, credentials and workflow policy.
The draft stops before readiness, merge or another live canary run. Public
provider errors are untrusted: arbitrary messages, codes, metadata and bodies
must never reach diagnostics. No application runtime or new dependency is needed.

## Execution details

Approval mode: executable batch, approved by the user's “agreed”. Execution mode:
standard; runtime exact model identity unavailable. Full path because the fixes
cross the existing provider diagnostics and review evidence validation seams.
One cohesive ordinary PR repairs workflow diagnosis; no independent stack layer.
Repository worktree `trees/ocr-context7`, branch
`rs/ocr-provider-errors-and-review-provenance`, baseline
`1191269e3dca533b4c40bf84dcd71b21366ad0ef`, target `v3`. Artifacts root `project/`.

### Contracts

- Adapter receipts add `last_upstream_error: null | { http_status, code }`.
  Capture integer HTTP status 100–599 or null before body consumption. Only
  top-level JSON `error.code` numeric integers from the public OpenRouter set
  400, 401, 402, 403, 408, 429, 502 and 503 are retained; every other value is
  `unknown`. Parse only when the already bounded body is at most 16 KiB.
  Retain no raw errors, messages, metadata, headers, source, identifiers or
  credential values. The most recently observed rejection wins in each adapter;
  a late body cannot overwrite a later rejection. Across receipt rows, report
  the final non-null rejection in receipt order. This is not causal priority.
  `callMistral` preflight/topology remains outside this adapter-only addition;
  its existing sanitized status errors and receipt/accounting stay unchanged.
- Keep error consumption bounded by the current response/deadline policy and
  keep the existing client-facing error/status and first-failure counters.
  Parse only a small bounded JSON envelope and never reflect arbitrary strings.
  Cost formulas, usage counters, retries, request payloads and timeouts stay intact.
- Print the sanitized rejection through the existing adapter summary, validating
  receipt fields again before rendering. Print one `OCR upstream_error` line;
  older/missing diagnostics report unavailable, a known null means none, and
  malformed fields report unknown. Cost availability remains its existing rule.
- Share the URL predicate in existing `final-ai-review-shared.js`, used by both
  individual and stack verification. Permit the canonical workflow URL or exact
  `${serverUrl}/${owner}/${repo}/runs/${check.id}` only for a positive safe integer
  check ID. Safe-ID validation applies only to the new check-URL branch; the
  existing workflow-URL branch remains compatible. Check IDs and workflow run
  IDs must differ in fixtures. Preserve app identity, exact head, successful check/run, external run
  ID, workflow path/event/repository/default branch, metadata/digests, policy,
  context and reviewed path checks. Foreign URLs, wrong IDs, suffixes, query
  strings, malformed checks and altered provenance remain rejected.
- Existing final-review policy digest includes the touched helpers; historical
  review evidence is tested through synthetic fixtures rather than relabelled
  as current after policy changes. No server check/status is rewritten.

### Delegation Map and sequence

Main owns decisions, shared URL verification and both callers, tests, guidance,
integration and delivery. One executor owns only `ocr-mistral-adapter.cjs` and
`ocr-mistral-adapter.test.cjs`; main works on provenance in parallel. The planner
hardens this contract before implementation. Simplifier and slice reviewer
inspect the complete committed implementation; final reviewer inspects the
integrated branch after focused verification.

1. Commit the approved, hardened plan first. Implement provider diagnostics in
   `.github/scripts/ocr-mistral-adapter.cjs` and
   `.github/scripts/ocr-mistral-adapter.test.cjs`, in parallel
   with the shared URL predicate, `.github/scripts/final-ai-review.js`,
   `.github/scripts/final-ai-stack-review.js`,
   `.github/scripts/final-ai-review.test.js` and
   `.github/scripts/final-ai-stack-review.test.js`.
   Extend `docs/ci-and-deployment.md` only for the durable diagnostics and URL
   contract. No new module/test framework is planned.
2. Integrate one coherent implementation commit after focused checks, formatting,
   exact diff and staged secret/data review. Run the simplifier/risk reviewer,
   resolve valid findings, then integrated final review and delivery.
3. Push ordinary task branch, create/update a draft against `v3`, inspect feedback
   and CI. Keep it draft; final AI command needs readiness and is a later gate.

### Verification portfolio

Baseline Node 24: 158 adapter/individual tests pass, zero skipped. Extend these
existing suites, plus stack tests, with synthetic behavior cases:

| Risk | Existing seam and acceptance |
| --- | --- |
| Untrusted provider content leaks | Adapter synthetic HTTP failures and summary subprocess: recognized codes/status only, malicious body/message/code absent, malformed/oversized/empty bodies and missing fields safe |
| Error handling changes | Same response/status, attempts, usage and first-failure counters; no added retry or altered timeout; successful path unchanged |
| False stale review | Individual and stack end-to-end evidence fixtures accept canonical check URLs and existing workflow URLs |
| False valid review | Reject wrong/unsafe IDs, foreign repo/host, added URL components, wrong external ID/app/head/workflow/digests and tampered paths |

Each risk row is **extend existing**; unaffected models, accounting and retries
need **none** beyond existing regression checks. No owner adds another framework
or parallel test seam. Failure-body tests include stalled, mid-stream failed,
oversized, malformed, missing and cancelled bodies, preserving existing client
errors, first-failure categories, one upstream attempt and bounded cleanup.
Mutate each provenance dimension separately, including safe check identity,
external workflow ID, canonical status/metadata workflow URLs, app, head,
workflow success/path/event/repository, digest and reviewed paths.

The executor stops after its two-file patch and focused adapter suite; main
accepts it by diff inspection and integrated checks. Main owns integration,
reviews and delivery in sequence, each ending only when its listed acceptance
passes or a concrete authority/capability boundary blocks it.

Run Node 24 `--test` with `.github/scripts/ocr-mistral-adapter.test.cjs`,
`.github/scripts/final-ai-review.test.js`,
`.github/scripts/final-ai-stack-review.test.js`,
`.github/scripts/ocr-draft-review.test.cjs`,
`.github/scripts/ocr-review-tools.test.cjs` and
`.github/scripts/ocr-self-update-guard.test.cjs`.
Set `OCR_TEST_BINARY` to the existing checksum-verified 1.13.0 binary when native
qualification is available, otherwise state the exact skipped native check. Use installed
formatters and Gitleaks; focused Opengrep on changed scripts. Whole-app hook
behavior is recorded separately if the checkout lacks host dependencies. No
application/browser runtime is justified for these non-rendered CI helpers.

## Progress

- Status: planner approved frozen v2; implementation next. No source edits yet.
- Ownership: main plus bounded adapter executor. Planner APPROVED after one
  focused correction; report in `project/_local/reviews/` (local only).
- Verification: baseline 158 tests pass, zero skipped, Node 24.21.0.
- Authority: source changes, reviews, commits, push and draft PR. No ready, merge,
  secret/account changes, provider substitution or extra live run.
- Packaging: two related workflow defects; substantive size recorded after diff.
