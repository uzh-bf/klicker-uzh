# PR 5315 production-readiness evidence

Date: 2026-08-26

## Scope

PR 5315 exposes per-element received and processed response counts in the
live-quiz cockpit. This report covers the branch after merging current `v3` and
closing the resulting correctness, mixed-version rollout, retention, Redis
safety, and maintainability findings. No merge, deployment, production-data
access, or production-state change was performed.

## Readiness properties

- Regular and assessment aggregation share one typed executor and one atomic
  Lua contract. The script preflights the complete command batch, claims a
  replay identifier, applies the batch, and increments processed only after
  every aggregation command succeeds.
- Allowed command targets cover only the current instance and the current
  quiz's block/quiz leaderboard and XP families. Regular, temporary, and
  gamified assessment paths are covered by focused tests and the real-Redis
  contract.
- Malformed choice payloads are rejected unless they enumerate every
  configured choice exactly once with in-range integer indices. Selection and
  case-study payloads must match cached instance shapes. Authoring caps choices
  and case-study response entries at 1,000 and selection inputs at 100. Worker
  validation applies the same bounds to legacy data, and Lua validates exact
  arity, namespaces, key types, values, and a 2,048-command execution budget
  before mutation. Real-Redis coverage includes a valid 600-command batch and
  oversized-batch rejection.
- Preflight and first-command failures release the replay claim for retry. A
  later failure stores claim-specific applied-command/error metadata in a
  reconciliation hash and keeps the Hatchet task failed without repeating the
  applied prefix, including after the completed-claim horizon. Authenticated
  duplicate detection checks that state and infrastructure lookup failures
  throw so Hatchet retries. If the reconciliation hash cannot be written, its
  negative replay marker remains persistent until cleanup begins retention.
- The cockpit preserves received and reports only processed as unavailable
  while reconciliation remains.
- New ingress atomically dual-writes a deduplicated received claim and numeric
  cardinality. New workers count the successfully processed overlap with that
  ingress cohort. The cockpit forms an exact union with
  `results.participants`. The Helm chart enforces worker-first deployment with
  both response processors in ArgoCD wave `0` and both response APIs in wave
  `1`; ArgoCD waits for the workers to be healthy before updating ingress.
- Replay claims retain the full 24-hour replay horizon. Block and quiz cleanup
  use `EXPIRE ... LT`, so a retry establishes or shortens retention but cannot
  extend participant/correlation metadata indefinitely. `endLiveQuiz` persists
  `ENDED` before retention and does not repeat end side effects on retry.
- A response-count Redis failure degrades counts to nullable fields without
  failing the authorized cockpit query. Scheduled elements remain count-free.
- The persisted-operation manifest retains the previous `GetCockpitQuiz` hash
  while old Manage bundles drain. The new fields are additive and nullable.
- The lecturer UI uses a compact two-column card: element links occupy the
  flexible left column and icon-only received-to-processed pills align in the
  right column. Cards size to content rather than filling the timeline.

## Exact working-tree evidence

| Check | Result |
| --- | --- |
| Response-processor unit tests | 17 passed across regular, assessment, and payload-shape validation paths, including choice/selection/case-study limits, leaderboard/XP commands, persistent reconciliation retries, replay-lookup failure propagation, and replays |
| Response-processor typecheck | Passed |
| Utility unit tests | 53 passed; the opt-in Redis test is skipped in the ordinary unit run |
| Real Redis contract | 1 passed against an isolated Redis process, covering concurrent replay, durable fallback reconciliation, deduplicated ingress, conditional first-response timestamps, allowed/forbidden namespaces, malformed payloads, exact arity, a 600-command valid batch, and oversized-batch rejection |
| Response API tests | 6 passed |
| GraphQL authoring-limit tests | 3 passed at and above the choice, selection, and case-study boundaries |
| GraphQL, utility, response API, Playwright checks | Passed |
| Lecturer frontend check | Passed |
| Repository `check:all` | Passed: 25 check targets, 7 lint targets, formatting, Syncpack, Prisma sync, documentation-path checks, and AGENTS checks |
| Production build | Every build target passed. The sandboxed root run completed all non-Turbopack targets; Chat and Auth then passed targeted unsandboxed production builds because their sandboxed Turbopack workers stalled on local process/port operations |
| Diff whitespace check | Passed |

The exact-head GraphQL integration suite was prepared with added coverage for
mixed-version participant fallback, reconciliation nullability, and
non-extending retention. It could not run locally because Postgres and the
repository stack remain stopped; the user had explicitly requested all
Devrouter containers be stopped, so this audit did not restart them. That suite
must pass in current-head CI before the PR is handed off as green.

## Visual evidence

The checked-in English and German screenshots show the real lecturer cockpit's
compact per-element icon pills and two-column alignment:

- `project/2026-08-05-live-quiz-response-counts/live-quiz-response-counts-en.png`
- `project/2026-08-05-live-quiz-response-counts/live-quiz-response-counts-de.png`

The final sizing correction restores the compact content-width card represented
by those captures. An exact-head browser rerun was not performed because it
would require restarting the stopped local application stack. CI's Playwright
live-quiz flow remains the current-head behavioral browser gate.

## Remaining delivery gates

- Current-head CI, including the GraphQL integration and live-quiz Playwright
  jobs, must pass.
- Review comments remain review context; this task does not remotely resolve or
  dismiss them without explicit authorization.
- Normal deployment observation remains required after merge. This task does
  not authorize merge or deployment.

## Verdict

The branch is locally production-ready subject to current-head CI and normal
review/deployment gates. All identified code-level blockers have direct fixes
and focused verification; the only unavailable local checks require the
intentionally stopped application stack and are delegated to CI before final
handoff.
