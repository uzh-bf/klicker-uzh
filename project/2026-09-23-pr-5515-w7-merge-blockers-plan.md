# PR #5515 W7 — close the repository-owned merge blockers

## Approval summary

**Why and what changes?** The 2026-09-09 readiness audit found PR #5515
`not-ready`. Four blockers can be closed in the repository. First, the branch
is 227 commits behind `v3`, with nine conflicts. Second, the obvious conflict
resolution silently drops the study-streak rollout, which initializes streak
tracking for active participations. Third, the streak migration can block
every later deployment after one interrupted index build. Fourth, the PR
description states a startup order that the merge reverses. W7 merges `v3`
with a written hand-merge, registers the rollout once in `v3`'s migration
runner, and adds a test that the production registry contains it. It then
splits the migration so each index build has its own single-statement file, adds a
recovery runbook, fixes the docs, and rewrites the PR description.

**What stays unchanged?** Streak, leaderboard and achievement behavior. `v3`'s
runner semantics and its blocking pre-`listen` startup. The receipt
migrations. The 24 open major findings, which remain named conditions.

**What could change the decision?** The two index builds must still fit inside
the migration hook's 600-second deadline. W7 cannot measure that without
production data. It makes an overrun recoverable through a short runbook instead
of destructive. Merge-time conflicts beyond the nine mapped ones stop the slice
for a ruling.

**How will we know it is done?** Package-owned CI is green at the pushed head.
A disposable-Postgres drill proves clean application, interrupted-build
recovery and schema equivalence. `/final-review` is posted and its result is
dispositioned.

**What does approval authorize?** The user approved W7 on 2026-09-23. This
covers the `v3` merge commit, local commits and non-force pushes to
`rs/gamification-achievement-receipts`, the PR body rewrite with screenshots,
and the `/final-review` comment. It withholds merging, force-pushing, the
GitGuardian dashboard, the operator Secret digest check, ClickUp, reviewer
requests, and any staging or production action.

## Execution details

### Evidence and binding contracts

- Scope identity: PR #5515, head `a5644ae16b`, base `v3` at `bd5cc8a186`
  (fetched 2026-09-23), merge base `f0659e1301`. The branch is 67 ahead and
  227 behind. The audit report is
  [2026-09-09-pr5515-production-readiness.md](2026-09-09-pr5515-production-readiness.md).
- Execution mode: `standard` (main model Opus 5.5 is not on the solo
  allowlist). Approval mode: executable batch.
- `v3`'s runner (`apps/backend-docker/src/migration.ts`) is authoritative. It
  keeps the advisory-lock transactional branch, the wider transient-error set,
  the recursive `error.cause` walk and the `migrate(prisma, { registry })`
  signature. Its registry comment says entries are removed after every
  environment has applied them. The new registry test is removed with the
  entry.
- `v3`'s `index.ts` awaits `migrate(prisma)` before `listen` inside a
  degraded-start `try`/`catch`. The PR's `startRuntimeMigrations` disappears.
- Migration contract (superseded by the drill; see Progress): Prisma 7.8.0 `migrate deploy` splits a file into
  statements, so a guard statement and a `CREATE INDEX CONCURRENTLY` can share
  one file. The audit drilled this. An interrupted concurrent build leaves an
  invalid index with the final name and a failed `_prisma_migrations` row.
  Every later run then stops with `P3009` until `prisma migrate resolve`.
  Guard with `DROP INDEX CONCURRENTLY IF EXISTS`, never
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS`: an invalid leftover index
  satisfies the name test, so PostgreSQL would skip the build and report
  success.
- The streak migrations have not reached a shared database. Staging builds
  from `v3-audit`, which does not contain this branch. S2 confirms this with
  `git branch -r --contains` before it rewrites the migration checksum. A
  developer database that applied the old file needs a local reset.

### Conflict resolution (S1)

| File | Resolution |
| --- | --- |
| `apps/backend-docker/package.json` | Take `v3`. Its `test:run` glob covers `migration.test.ts`; drop the PR's duplicate `test` script. |
| `apps/backend-docker/src/index.ts` | Take `v3` wholesale. |
| `apps/backend-docker/src/migration.ts` | Take `v3` verbatim. Add the PR's `COURSE_TIMEZONE`, `zurichDayStart` and `initializeActiveStudyStreaks`. Replace the empty registry with one entry, `20260824_initialize_active_study_streaks`, `isIdempotent: true`. Drop `20260824_repair_active_study_streaks` and `startRuntimeMigrations`. Keep `v3`'s registry comment accurate for a non-empty list. |
| `apps/backend-docker/src/migration.test.ts` | Take `v3`. S1b adds the registry assertion. |
| `apps/frontend-pwa/src/components/practiceQuiz/ElementStack.tsx` | The PR's study-streak `useQuery` auto-merges. Take `v3`'s `useCallback` refactor for the conflicting hunks, then re-apply the PR's derived streak const, and the `refetchStudyStreak()` call inside `handleSubmit` behind its `!previewOnly && withParticipant` guard. Add `refetchStudyStreak` and `withParticipant` to `v3`'s `handleSubmit` dependency array. Place `StudyStreakProgress` as the first child of `v3`'s `!focusedPresentation` wrapper, before the header, as on the PR side. Focused presentation then hides it with the rest of the stack chrome. |
| `packages/graphql/src/schema/participant.ts` | Keep both import sets and both sides' field changes: `v3`'s consent layer and the PR's self-only streak guards. |
| `packages/graphql/src/services/participants.ts` | Keep both import sets. Keep the `reconcileStudyStreak` call before `v3`'s `findFirst`. |
| `docs/domain-model.md`, `docs/graphql-api-layer.md` | The only conflicting hunks at `a5644ae16b` are frontmatter timestamps; take the later date. `v3`'s chatbot-authorization sentence in the participation paragraph auto-merges; confirm it survives. |

The merge commit contains these resolutions and the outputs they force. Those
outputs are the regenerated tracked SDL
(`packages/graphql/src/public/schema.graphql`, which `check:schema` compares),
the mirrored `apps/analytics` Prisma models if `prisma:sync` changes them, and
a `pnpm-lock.yaml` refresh if `--frozen-lockfile` rejects the auto-merged
lockfile. An unmapped conflict, or a failing check whose fix is not a direct
consequence of the table, stops S1 for a ruling.

Four documents auto-merge but become inaccurate after the merge, because they
describe the PR's post-`listen` start or the dropped repair entry:

- `docs/data-and-migrations.md`, the runtime-runner bullet;
- `.agents/skills/klicker-data-model/SKILL.md`, the runner paragraph;
- `docs/domain-model.md:32`, "background rollout and repair migrations";
- `docs/solutions/integration/streak-seed-initialization-order.md`, its
  Solution and Prevention sections.

S3 fixes all four, so the merge commit stays mechanical.

### Delegation map

| Workstream | Slices | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Integration and registry guard | S1 | main | plan commit | merge commit plus test commit; checks below |
| Migration split and recovery | S2 | `executor` | S1 merge commit | one uncommitted change set returned to main; drill evidence |
| Docs, PR description, delivery | S3, Finish | main | S1, S2 | docs commit, PR body read-back, CI, `/final-review` |

Slices run in order: S1a, S1b, S2, S3. S2 overlaps only S1's review pass,
which is read-only. Serializing keeps one writer in the shared worktree, so no
commit can sweep in half-finished S2 files. Main makes every commit. If the
executor cannot reach Docker for the drill, it returns the file changes and
main runs the drill.

Before S1, the plan commit also updates
[the roadmap](2026-08-23-student-gamification-roadmap.md). It adds a W7
section modeled on W6, points the merge-blocker status at this plan, and
records a 2026-09-23 progress entry replacing "awaits approval".

### Test portfolio

| Risk | Obligation | Seam | Existing protection | Distinct failure |
| --- | --- | --- | --- | --- |
| The production registry loses the streak rollout in a merge or refactor | add new | `migrate(prisma)` with the default registry and `v3`'s fake client in `migration.test.ts` | none; the audit found the silent drop by hand | Existing active participations never start tracking |
| Runner locking, retry and idempotent races | none | `v3`'s `migration.test.ts` suite | six `v3` tests | — rerun only |
| Streak and receipt business logic | none | existing graphql and backend tests | PR suites | — rerun only |
| Split migrations apply, recover and match the schema | none in repo | one-off disposable-Postgres drill, recorded in Progress | audit drill of the old file | — no migration harness exists; a repo test would mirror SQL |
| Practice-quiz streak progress after the `ElementStack` re-application | none | browser check in the DevPod | no streak e2e spec | — one interaction check; the spec covers receipts only |

The registry test calls `migrate(prisma)` directly, without `setup()`, which
always injects a registry. It extends `v3`'s test-local `createFakePrisma`
with a recording `participation.updateMany`. It asserts the recorded
migration id and one `updateMany` call, not the where-clause text. It exports
nothing from `migration.ts`.

### Slices

**S1 — Integrate `v3` and guard the registry.** Route: main. Execution-tier
skip reason: critical-path coupling; every later slice depends on this
resolution.

1. S1a: `git merge --no-commit origin/v3` and resolve per the table.
2. With the merge still uncommitted, start the DevPod runtime per
   `$rs-local-runtime-lifecycle`. Use the smallest profile that serves the
   PWA, API and auth. In the DevPod, run `pnpm install --frozen-lockfile`,
   graphql `generate`, and `pnpm run prisma:sync`. Stage the outputs named
   above.
3. Commit S1a as a normal merge commit that records the integrated `v3` SHA.
4. S1b: add the registry test; commit.

Acceptance: in the DevPod, `pnpm run check` passes, including
`check:schema`. The backend-docker `test:run` and the graphql and prisma-data
tests pass. `prisma:sync` leaves no diff after the merge commit. The host pre-commit
`check:all` passes. A browser pass logs in as a seeded student and answers a
practice-quiz question. The streak progress then updates without a reload.
Review: `simplifier` and `slice-reviewer` in parallel. They get the merge SHA
with `git show --remerge-diff`, `git diff origin/v3 <merge>` for the nine
files, and the S1b commit.

**S2 — Split the streak migration and add recovery.** Route: executor.

1. Keep only the `ALTER TABLE` in `20260823120000_add_study_streak_state`.
2. (Superseded by the drill; see Progress: each file holds only the `CREATE`
   statement, without a guard.) Add `20260823120001_add_question_response_streak_index` and
   `20260823120002_add_question_response_detail_streak_index`. Each holds a
   comment saying that the guard removes an invalid index left by an
   interrupted build, so a rolled-back migration can simply re-run. Do not copy
   the one-statement precedent comment, because it would be false here. Then
   `DROP INDEX CONCURRENTLY IF EXISTS "<name>";`, then the original `CREATE`
   statement copied verbatim.
3. Add an "Interrupted concurrent index build" subsection under "Recovering a
   failed migration hook" in `docs/data-and-migrations.md`. It covers:
   - read-only diagnosis of `_prisma_migrations` and `pg_index.indisvalid`;
   - for an index migration, `prisma:resolve:prod --rolled-back <name>` and
     re-sync, relying on the guard (superseded: the runbook branches on build
     state and drops an invalid index itself);
   - for the atomic `ALTER TABLE` migration, `--applied` when the columns
     exist and `--rolled-back` when they do not.
   Point generic step 3 at it. Rewrite the PR-side bullet on concurrent
   indexes so it describes the three files.
4. Drill with `prisma@7.8.0` against a disposable Docker Postgres:
   - Apply all migrations to an empty database; both indexes are valid.
   - On a second database, apply everything. Then drop the two new indexes
     and delete their two `_prisma_migrations` rows, so bookkeeping sits at
     `20260823120000` without trimming the migrations folder. Hold an open write
     transaction on `QuestionResponse` so the concurrent build blocks in its
     wait phase. Start `migrate deploy`, SIGKILL the Prisma process, then
     terminate the waiting backend with `pg_terminate_backend`. This mirrors
     a killed hook pod whose connection is later detected. Assert that
     `pg_index.indisvalid` is false and `_prisma_migrations.finished_at` is
     null. A further deploy stops with `P3009`.
   - Release the transaction, run `resolve --rolled-back
     20260823120001_add_question_response_streak_index`, and redeploy. The
     guard drops the invalid index and the rebuild is valid.
   - Run `prisma migrate diff` from the migrated database to the schema
     folder; the diff is empty.
   Use synthetic rows only.

Acceptance: the drill transcript, sanitized, with exit codes; `git diff`
limited to the three migration folders and the one docs subsection. Review:
`slice-reviewer` (data integrity, irreversible deploy behavior) and
`simplifier` in parallel on the S2 commit.

**S3 — Docs, skill and PR description.** Route: main. Skip reason: external
effect (PR body) and overhead greater than work for the docs lines.

1. Fix the four documents listed under the conflict table:
   - Describe `v3`'s blocking, degraded-start ordering and the single streak
     entry in the runner bullet, the skill paragraph and `domain-model.md:32`.
     Replace the claims that contradict the merged runner: no raw SQL or
     advisory locks, the narrow transient-code list, and never delaying
     `listen`. Keep the eligibility and seed facts.
   - Rewrite the solution doc so the seed update alone covers the
     seed-after-startup ordering.
2. Capture the screenshot gallery with `$rs-build-screenshot-gallery` from the
   S1 runtime: home card, course streak, practice progress, nearby
   leaderboard and receipt. Use seeded synthetic accounts only.
3. Rewrite the PR body with `$rs-mr-description-writer`. It states the
   pre-`listen` ordering, the migration split and recovery path, the remaining
   external blockers and the open majors. It keeps the CodeRabbit block.

Acceptance: Prettier on changed Markdown; PR body read back; each screenshot
URL resolves.

### Finish

1. One `final-reviewer` on the integrated W7 outcome: the merge's remerge diff
   plus `<merge>..HEAD`.
2. Stop the DevPod runtime and verify that it stopped.
3. Non-force push. Wait for exact-head CI with one blocking watcher.
4. Once package-owned checks are green, post `/final-review`. GitGuardian stays
   red until the user dispositions incident 1509424. Collect the result, then
   run one correction round for W7-scope blockers and report the rest.

Terminal condition: the head is pushed, package-owned CI is green,
`/final-review` has completed and its findings are dispositioned. Merge stays
withheld.

### Working context

- Worktree `trees/pr5515-readiness`, branch
  `rs/gamification-achievement-receipts`, tracking origin.
- Commit with `git commit -F <scratchpad file>` unsandboxed. The pre-commit
  hook runs `check:all` and the pre-push hook runs `pnpm run build`, both on
  the host, against the worktree's shared `node_modules`. After the merge,
  `pnpm install --frozen-lockfile` runs in the DevPod only. If a host hook
  then fails for platform or environment reasons, run the equivalent command
  in the DevPod and the `gitleaks` scan on the host. Then commit or push with
  `--no-verify` and report the split. A real check failure is fixed, never
  bypassed.
- Run Playwright only through CI. The host runner purges container
  `node_modules`.
- devrouter CLI 0.1.3 is installed. If `ensure` reports
  `MANAGED_REPAIR_BASELINE_MISMATCH`, move the stale record aside, as the
  memory note on baseline drift describes.

## Progress

- 2026-09-23 — Plan drafted after the user approved W7. Remote `v3`
  re-fetched: unchanged at `bd5cc8a186`.
- 2026-09-23 — Plan hardening: the planner returned REVISE in round 1 and
  APPROVED in round 2. Six findings were accepted and one was rejected with
  merge-tree evidence. The optional AGY cross-provider pass produced no output,
  because headless mode denied a tool permission. The transcript is
  `project/_local/reviews/2026-09-23-pr5515-w7-plan-hardening.md`
  (gitignored).
- 2026-09-23/25 — S1 merged `origin/v3` at `b4f9db90c0` (`6ac3401b31`): `v3`'s
  runner kept, streak rollout registered once, `student-gamification.spec.ts`
  added to the `manage,pwa` Playwright group. `987f4419ca` adds the registry
  test. `0a104dcd16` splits the streak migration into three files and adds the
  recovery runbook; `da89e92f4b` aligns docs and the data-model skill.
- Deviation from the migration contract above: the drill showed Prisma 7.8.0
  sends a multi-statement file as one transaction, so a `DROP INDEX
  CONCURRENTLY` guard beside the build fails with `25001`. Each index file
  therefore holds one statement, and the runbook owns the invalid-index drop.
  The drill passed clean apply, `v3`-first order, interrupted-build (`P3009`)
  recovery and a no-drift check.
- 2026-10-01 — Checks at `da89e92f4b`: `check:all` pass, backend tests 12/12,
  host Playwright tooling 50/50; one GraphQL Redis test fails only in the
  DevPod (`packages/graphql/test/helpers.ts:138` hardcodes `127.0.0.1`).
  Browser pass with eight screenshots: the practice counter went from 5 to 1 left
  without a reload, the goal was reached, the 1-day streak showed, and receipt
  acknowledgement persisted. Two copy issues were found and recorded in the PR
  body. The simplifier found no merge leftovers; it suggested three optional doc
  trims, which were declined.
- 2026-10-01 — Slice review (Opus 5.5) of the merge resolution and
  `6ac3401b31..da89e92f4b`: all contracts hold. One accepted major: the runbook
  dropped the index even when the interrupted build had finished. It now
  branches on an active build and `indisvalid`, and covers a deadline overrun
  with an out-of-band build. Two accepted minors: the implicit-transaction
  wording and the `prisma:resolve:qa` staging script.
- 2026-10-01 — Final review (Claude CLI Opus 5.5) of `9996e0a24e..176da15bcd`:
  no blockers; merge and migration contracts hold. Three accepted findings:
  stale guard wording in this plan and the roadmap (amended); the runbook now
  gives the `pg_stat_activity` query and a branch for a missing index; focused
  practice-quiz embeds no longer query or refetch the hidden streak card.
  The pre-push build first failed on duplicate `.next/dev` type declarations
  from the running dev server, then passed 23/23 once the dev servers were stopped.
- 2026-10-06 — Terminal condition held open on purpose: CI passes at
  `ef51300754`, but the `/final-review` waits for the roadmap's Before merge
  decision so one review covers the final head. The roadmap reconciliation
  (`e93bf4ff1d`) records the W7 result and the Prisma statement-splitting
  contradiction between the readiness report and the drill.
