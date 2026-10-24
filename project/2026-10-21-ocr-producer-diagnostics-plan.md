# OCR producer failure diagnostics

## Approval summary

OCR coverage can classify a model-reported task failure as a provider failure.
Successful adapter requests therefore do not explain incomplete review coverage.
Add content-free observations that distinguish model-reported failure from an
observed producer error, while retaining uncertainty when evidence is incomplete.

The adapter will count accepted main responses containing task_done FAILED. The
shared progress reporter will classify existing subtask-error lines using fixed
categories. Draft and manual job diagnostics will retain these observations, and
filtered logs will make the producer categories readable through gh.

Model observations do not prove tool execution or identify failed files. Producer
group counts are independent of coverage-item counts. Diagnostics never change
response acceptance, reasoning, budgets, token/cost accounting, retry/resume
behavior, partial publication, exit codes, credentials or provider routes.

The user approved this executable batch in chat. Authority covers implementation,
offline synthetic verification, configured reviews, ordinary task-branch commits
and pushes, and one draft PR against v3. Completion means a reviewed, verified
draft PR with an accurate description. Merge, readiness, paid OCR replays and live
settings changes are outside this batch. Observe the next normal substantive run
after a separately authorized merge.

## Execution details

### Context and contracts

- Repository: uzh-bf/klicker-uzh; target: v3.
- Starting target: 8ab99bd5fe2ec651856d9087b79a3126f6b8d49e.
- Task branch: rs/ocr-producer-diagnostics; worktree: trees/ocr-producer-diagnostics.
- Execution mode: standard; full-path package for bounded diagnostic parsing and
  its privacy contract. Existing project/ remains the artifact root.
- Existing counter records and coverage classifications remain backward compatible.
- New public fields contain only booleans, bounded counters and fixed enum values.
- Raw CLI text, group names, paths, model arguments and reasoning remain private.
- Missing or truncated producer evidence reports incomplete/unknown observations.
- An accepted FAILED response remains an accepted response, not an adapter error.
- No attempt to correlate response counts to groups or files without evidence.

### Ownership and sequence

One coherent implementation slice, followed by integrated delivery:

1. Planner challenges this frozen plan; main dispositions any findings. Existing
   user approval covers this internal planning step without another go-ahead.
2. Executor owns `.github/scripts/ocr-mistral-adapter.cjs` and its existing test
   file. Add accepted-response observations, allowlisted subtask failure parsing,
   reporter snapshots and manual receipt persistence. Preserve all existing paths.
3. Main owns `.github/scripts/ocr-draft-review.cjs`, its existing test file, this
   plan and `docs/ci-and-deployment.md`. Wire producer diagnostics into the existing
   draft outcome artifact and summary, extend the native synthetic CLI test, and
   explain the difference between model, group and coverage-item observations.
4. Integrate and run focused checks. Inspect staged changes for scope, secrets and
   personal or environment-derived data before each commit.
5. Commit the implementation; run simplification and a privacy/correctness slice
   review, then the integrated final review under the configured routes. Resolve
   actionable findings and rerun only affected checks.
6. Push the ordinary task branch, open one draft PR against v3, read back its body
   and inspect available ordinary feedback. Record pending CI accurately.

Only one writer owns each path. The executor receives public code and synthetic
fixtures only. Main owns final integration, external effects and evidence.

Delegation Map: the single integrated slice belongs to main. Its settled adapter
support task belongs to native executor, exclusively owning
`.github/scripts/ocr-mistral-adapter.cjs` and
`.github/scripts/ocr-mistral-adapter.test.cjs`. Main exclusively owns
`.github/scripts/ocr-draft-review.cjs`, `.github/scripts/ocr-draft-review.test.cjs`,
the plan and the existing guide. The executor's reporter API is the handoff seam;
main verifies the integrated native fixture. No new modules or implementation
files are required.

### Diagnostic shape

- Adapter: `task_done_failed_responses`, scoped to accepted main responses. Count
  once per response containing strict JSON arguments with exactly `state=FAILED`,
  including multiple matching calls. The pinned producer uses exact case and does
  not trim states; malformed, lowercase and padded states are not counted.
- Progress reporter: `producer()` returns a versioned snapshot with `complete`
  and `subtask_errors` counters. Categories: `task_reported_failed`,
  `llm_client_error`, `timeout`, `cancelled`, `panic`, `unknown`.
- Subtask events emit `event=subtask_error reason=<category>`. Only exact known
  error markers establish a category; other subtask errors remain unknown. An
  oversized/truncated candidate invalidates completeness without retaining text.
- Parse only an anchored Subtask error/panic line with a quoted, escaped group
  label and an error field. Panic comes from the line type; otherwise exact
  `task failed: task_done reported FAILED`, exact context deadline/cancellation,
  and an anchored `LLM completion error:` prefix establish their respective
  categories. Marker-like group labels or text elsewhere never establish one.
- `complete` describes observation capture, never review success or coverage.
  Both wrappers explicitly pass stderr drain status. Missing capture, spawn
  failure, drain timeout and a truncated producer line are incomplete.
- Draft outcome artifact and main adapter receipt include `producer`;
  job log/summary prints a fixed counter summary. Manual adapter receipts include
  the same producer snapshot.
- Diagnostics are informational, tolerate missing evidence and failing sinks,
  and preserve private stderr, process results and cleanup behavior.

### Verification portfolio

| Observable risk | Obligation | Primary seam | Acceptance |
| --- | --- | --- | --- |
| Misclassifying model output as transport failure | Extend existing adapter test | Injected HTTP200 responses | FAILED counted once only on accepted main responses; original response and accounting unchanged |
| Leaking untrusted producer content | Extend existing filter/reporter tests | Synthetic chunked stderr | Fixed categories only, no sentinels; misleading labels, conflicting markers, malformed, overlong and truncated input remains unknown/incomplete |
| Lost receipt or altered process result | Extend existing wrapper/draft tests | Synthetic child plus existing native binary fixture | Logs/artifacts persist counters; original stderr and exit code preserved |
| Historical coverage ambiguity | Extend native draft fixture | Released OCR1.13.0 plus deterministic mock | DONE control complete; FAILED group partial; zero adapter failures; no live provider calls |

Run focused Node tests for adapter and draft runner, native fixture with the pinned
local OCR1.13.0 binary, syntax checks and installed formatting tools. These are
dependency-free host tooling checks; no application, database or container runtime
is needed. Repository hooks and required CI retain their existing enforcement.

### Pause and terminal conditions

Pause only for a material scope/data/cost/authority change, a required review route
that cannot complete under continuity, or an unresolved correctness/privacy defect.
No new paid replay or provider fallback is implied by offline test failure.

## Progress

- Planning: approved by native planner after one focused correction. Executable
  user approval already granted. Private report: `_local/reviews/2026-10-21-ocr-producer-diagnostics-planner.md`.
- Implementation: complete in the existing adapter, runner, tests and guide.
  Captured valid unknown errors remain complete observations; malformed framing
  and truncated capture remain incomplete. No model or coverage result is inferred.
- Verification: adapter 101 tests pass; draft 8 tests pass with released OCR1.13.0
  and deterministic HTTP200 mocks; final/stack/policy 131 tests and script
  invocation 2 tests pass. No paid calls or app runtime. Installed formatter and
  scoped Opengrep checks run; hook wrappers defer dependency-based checks/build
  to required CI because this worktree has no dependency install.
- Simplification and privacy/correctness slice review: complete. Removed two
  unnecessary aggregation flags. Both slice and final reviewers identified the
  same raw-versus-normalized counter mismatch; the correction now counts the
  forwarded normalized call and extends its existing HTTP-boundary regression.
  The same slice reviewer accepted the focused correction. Claude's schema-
  validated integrated final review and focused correction report no remaining
  findings at implementation head `4a25cd7c03672bd2e2ac315b9a1d8bc3ed451c3d`.
- Integrated adapter/draft verification: 109 passing tests after the correction;
  earlier unaffected 131 policy/final/stack and 2 invocation checks remain valid.
  No live application runtime or provider call was required.
- Delivery: draft [PR6661](https://github.com/uzh-bf/klicker-uzh/pull/6661) against v3.
  Implementation and review are complete; the draft records remaining hosted CI.
  This does not establish merge readiness or live behavior.
- Substantive implementation size: 893 added/deleted lines across five existing
  files, excluding the plan. Test delta: 2 draft and 4 adapter cases added, with
  existing cases extended for diagnostics, privacy, accounting and exits.
