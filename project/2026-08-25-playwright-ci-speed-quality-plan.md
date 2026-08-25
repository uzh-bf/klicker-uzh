# Playwright CI speed, quality, and shard feedback package

## Goal

Reduce avoidable Playwright CI time and diagnostic cost while preserving the
current test intent, serial/shared-state execution model, and complete failure
evidence. Use PR #5446 as the observed failure case, and make shard timing a
reviewable automated feedback loop.

## Scope

- Repair the deterministic course-duplication test timeout caused by the test
  observer missing the GET form of the status query.
- Keep the existing CI artifact policy: compact JUnit results always upload;
  heavy diagnostics upload only for failed shards; CI video stays disabled.
- Make file-level shard packing deterministic and validate its timing input.
- Aggregate complete successful JUnit runs and open or update one human-reviewed
  timing pull request from a guarded `workflow_run` workflow.

The package does not change the test count, retries, timeout values, workers,
`fullyParallel`, shard count, worker behavior, database fixtures, or production
and staging services. Test-level sharding remains a later fixture-hermeticity
package because the suite deliberately shares seeded users, database rows,
Redis keys, and Hatchet workers.

## Fresh state and baseline

- Freshness was re-established on 2026-08-25 with `git fetch origin` in the
  matching worktree.
- The worktree is `/Volumes/HOME/Git/klicker/klicker-uzh/trees/fix-course-duplication-timeout`.
- Branch `fix/course-duplication-timeout` includes the current `origin/v3` base;
  the latest published head and commit count are recorded in the final
  Progress entry below.
- The current Playwright manifest is 886 tests in 31 active files. Five tests
  added by the current branch's latest-base integration are part of the
  baseline and must remain unchanged.
- The only pre-existing dirty paths are generated GraphQL files:
  `packages/graphql/src/ops.ts`,
  `packages/graphql/src/public/client.json`, and
  `packages/graphql/src/public/server.json`. They are excluded from every
  package commit.

## Evidence and root cause

PR #5446's shard 8 repeatedly spent about 57 minutes while the other shards
finished much earlier. Its duplication journeys waited 150 seconds each and
then retried. The CI trace showed `GetCourseDuplicationStatuses` responses
reaching `RUNNING` and then `COMPLETED` with a created course id, but the test
listener only recognized POST responses whose body contained the operation
name. The live request was a GET with the operation name in the URL query.

Therefore the failure is a deterministic false-observation timeout in
`playwright/tests/N-course.spec.ts`, not evidence that the worker failed to
deliver the job. The repair must observe both request shapes while retaining
response-success validation, job-ID correlation, the explicit `COMPLETED` or
`FAILED` assertion, and the existing 150-second bound.

One historical CI trace also contained a lecturer session token. It is not
copied into this repository or plan. If that token is still valid, it must be
expired or rotated.

## Sol validation

GPT-5.6 Sol returned `DONE_WITH_CONCERNS` on 2026-08-25 and found no missing
evidence for local execution. Sol's required constraints are:

- Match POST bodies as today and GET requests by exact URL
  `operationName=GetCourseDuplicationStatuses`; do not increase the timeout.
- Aggregate every JUnit testcase time, including repeated testcase entries from
  retries; do not deduplicate testcase names.
- Require eight valid JUnit artifacts, exactly-once coverage of all 31 active
  specs, and zero failures, errors, or skipped tests before writing timings.
- Use a standard-library XML parser, reject malformed or oversized XML without
  logging its content, and keep generated timing paths canonical.
- Keep file-level sharding, with duration-descending and path-ascending ties.
- Use a human-reviewed bot PR rather than a direct `v3` commit or an artifact-
  only update. A default `GITHUB_TOKEN` PR does not trigger its own required
  checks in this repository. The future workflow therefore requires a
  dedicated non-admin GitHub App or fine-grained bot credential, documented but
  not provisioned or exercised in this task.

## Decisions

### Duplication observer

Extend the existing response predicate to accept either the current POST body
operation name or the exact GET URL query operation name. Keep all existing
status parsing, correlation, terminal-state, and success-UI assertions.

### Timing schema and sharding

Use timing schema version 1:

```json
{
  "version": 1,
  "durations": [
    { "spec": "tests/N-course.spec.ts", "duration": 273.123 }
  ]
}
```

The updater emits lexically ordered canonical `tests/<file>.spec.ts` entries.
It sums all testcase `time` values for each suite, including retry attempts.
It requires every active spec exactly once and removes stale entries from the
generated file. The sharder accepts the existing unversioned file for
compatibility, validates version 1 when present, rejects duplicate or invalid
entries, warns about stale entries, and uses a 30-second fallback for active
specs without timing data.

File-level greedy packing remains the safe boundary. Stable duration-descending,
path-ascending ordering and lowest-index tie resolution make each allocation
reproducible. A later package may evaluate test-level distribution only after
fixture isolation and repeated parallel-run evidence exist.

### Automated feedback

Add a separate `.github/workflows/update-playwright-timings.yml` workflow that:

1. listens for a completed `test-playwright` workflow;
2. continues only for a successful direct push to `v3` from this repository;
3. downloads the triggering run's eight compact JUnit artifacts;
4. validates and aggregates them with the standard-library updater;
5. creates or updates one branch `automation/playwright-timings`; and
6. opens one non-draft human-reviewed PR into `v3` when the generated file
   changes, with no auto-merge and no PR for unchanged output.

The required status job uploads a small filter-decision marker so a successful
path-filtered run with skipped Playwright tests becomes a no-op rather than a
false partial-artifact failure. The updater reads that marker as data and never
executes artifact content. It also skips a source run whose commit subject or
single-commit diff is timing-only, which prevents a timing PR merge from
creating an automatic feedback loop.

The writer requires `PLAYWRIGHT_TIMINGS_BOT_TOKEN` with only the repository
contents and pull-request permissions needed for this branch/PR workflow. The
default `GITHUB_TOKEN` is not an acceptable substitute because its PR does not
start the required checks. Secret provisioning, workflow activation, timing PR
creation, merge, and any live run remain outside this task. The later user
request to make PR #5446 ready authorizes publishing this branch and updating
that existing PR, but not merging it.

## Acceptance checks

| Area | Acceptance |
| --- | --- |
| Duplication observation | Existing POST and traced GET forms are accepted; terminal and success assertions remain; no timeout/retry/test-count change |
| Timing input | Malformed JSON, unsupported version, duplicate paths, non-positive/non-finite durations, and invalid shard arguments fail clearly |
| Timing aggregation | Standard-library XML parsing rejects malformed/oversized/partial input; eight artifacts, zero failures/errors/skips, and all 31 specs are required; retries are summed |
| Shard allocation | All 886 tests remain listed; every active file is assigned exactly once across eight deterministic outputs; tie ordering is stable |
| Workflow guard | Only successful direct `v3` pushes can write; PR runs, failed/partial runs, filter-skipped runs, timing-only loops, and unchanged output do not create a timing PR |
| Repository safety | Generated GraphQL changes remain unstaged; no secret or real personal data is committed; merge, deployment, and live-service actions remain out of scope |

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S0 — reviewed plan amendment | main | Sol challenge complete | Root cause, timing design, credential boundary, and current baseline are recorded |
| S1 — duplication observer repair | main | S0 | Focused checks and existing duplication journey validate GET/POST observation |
| S2 — timing schema and tooling | main | S1 | Script fixtures cover retries, malformed/partial input, stale entries, ties, and exact assignment |
| S3 — guarded workflow | main | S2 | YAML/format checks pass; no workflow or PR is executed |
| S4 — integrated verification | main | S3 | Manifest parity, exact diff accounting, simplifier, final review, and progress are complete |

All slices stay with the main session because the shared worktree is dirty and
the test, timing, workflow, and plan changes need exact-path integration.

## Authority

Authorized: local plan amendment, in-scope edits, repository-native checks,
read-only review, local conventional commits, publishing this branch to the
existing PR, and updating that PR to ready for review.

Withheld: merge, branch/worktree deletion, secret provisioning, workflow
activation, deployment, cluster changes, production access, and live-service
changes.

## Terminal

The local package reached its implementation terminal after the reviewed plan
amendment, observer repair, timing tooling, guarded workflow, focused checks,
deterministic fixture validation, exact diff inspection, final review, and local
commits. The publication terminal is the existing PR branch pushed, its body
updated, and its review-ready state read back. It does not claim a green PR or
active timing automation without credential provisioning, a workflow run,
timing PR, merge, and fresh CI evidence.

## Boundary owner

`self`

## Pause

Pause before merge, secret provisioning, workflow activation, live-service
access, or change to the course-duplication worker.

## Progress

- 2026-08-25: Freshness gate completed; the matching PR worktree is reused and
  the primary checkout remains untouched.
- 2026-08-25: Sol planner challenge completed with `DONE_WITH_CONCERNS`.
- 2026-08-25: Current baseline refreshed to 886 tests in 31 files after the
  latest-base integration; earlier 881-test notes are stale.
- 2026-08-25: S0 plan amendment committed as `d20f1d8d4`.
- 2026-08-25: S1 duplication observer repair committed as `e1a5704f2`.
- 2026-08-25: S2 timing schema, deterministic sharder, and standard-library
  JUnit aggregator committed as `559239ec3`.
- 2026-08-25: S3 guarded workflow and documentation committed as `83cf09132`;
  `b092bdb01` adds the explicit bot credential setup required for its future
  branch push. The prior artifact-policy commits remain `f5f7c7b07`,
  `4c59e6883`, and `da473b1f8`.
- 2026-08-25: Focused checks pass at Node 24: Prettier, Playwright TypeScript,
  YAML parsing, JavaScript/Python syntax, GET operation-name parsing, exact-once
  deterministic eight-shard allocation, retry-inclusive JUnit aggregation, and
  malformed/partial timing fixture rejection. The manifest remains 886 tests
  in 31 files.
- 2026-08-25: No exact runtime for this worktree was available, so the browser
  duplication journey was not started. Fresh CI proof is pending on the
  published PR; timing-workflow activation remains withheld pending the
  dedicated credential and future live run.
- 2026-08-25: The branch was synced with current `origin/v3` as `e5f2cc0cb`;
  the package.json conflict preserved both the course-duplication stress seed
  and the upstream demo-participant seed. The generated GraphQL paths remain
  dirty and unstaged.
- 2026-08-25: Published the branch to PR #5446 and replaced the stale body
  with branch-wide coverage, exact verification categories, and follow-ups.
  GitHub read-back confirms the PR is open, non-draft, mergeable, and currently
  blocked while required checks run; the final publication commit is this
  progress record.
- 2026-08-25: The native simplifier and slice-reviewer routes returned provider
  `402` credit errors. A lightweight GPT-5.6 Sol fallback reviewed the exact
  package and found no material implementation risk after this progress update;
  the native specialist review limitation remains disclosed rather than treated
  as a green CI result.
