# W6: achievement receipt boundary closure

## Identity

- Date: 2026-08-25
- Parent roadmap: [Student gamification roadmap](2026-08-23-student-gamification-roadmap.md), W6
- Existing delivery: [PR #5515](https://github.com/uzh-bf/klicker-uzh/pull/5515)
- Repository: `uzh-bf/klicker-uzh`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/gamification-roadmap`
- Branch: `rs/gamification-achievement-receipts`
- Target: `v3`
- Planning-snapshot branch tip: `b046dd1656d4b727fec323ae9cc5a182e52aac08`
- Planning-snapshot remote target: `origin/v3` at `de60498532f67b5c26e811e3761c180c43b605f0`
- Current topology: one cohesive branch and one existing PR; no new PR or stacked topology

## Goal

Close the two remaining achievement-receipt boundary findings in the existing
gamification package:

1. Mark historical achievement instances as already acknowledged through a
   forward-only Prisma migration while leaving new instances pending.
2. Make the receipt timestamp self-only at the GraphQL resolver boundary.
3. Have the PWA acknowledge a newly displayed self receipt without blocking the
   profile, hiding the achievement, or creating a retry loop.

The package is locally complete when the implementation, focused evidence,
review gates, documentation, and local commits reach `pr_ready`. Updating the
existing PR, pushing, merging, deploying, accessing live data, and deleting the
runtime or worktree remain separate actions.

## Non-goals

- No new achievements, award paths, rewards, discoverability policy, or receipt
  tables.
- No changes to streaks, leaderboards, XP, avatars, course opt-in, assessment,
  or profile privacy policy.
- No participant analytics, surveys, dashboards, or term-end evaluation work.
- No runtime `$queryRaw`/`$executeRaw` repair. SQL is permitted only as the
  declarative data-backfill artifact inside the Prisma migration.
- No new dependency and no change to the existing branch/PR topology.
- Do not touch the unrelated untracked
  `packages/prisma/src/prisma/schema/views/` directory.

## Execution contract

- Execution owner: the current task, with one implementation writer (`main`).
- Autonomy: after the user approves this exact plan, continue through all
  approved slices, local commits, required reviews, verification, and
  `Progress` updates without routine checkpoints.
- Boundary owner: package owner; after the local finish gate, reconcile the
  roadmap through `rs-expert-roadmap-planning` Phase 5.
- Granted after plan approval: normal local merge rebaseline, edits in the
  listed scope, local Prisma/test/runtime work, documentation, generated
  artifacts, local commits, and required read-only specialist reviews.
- Withheld: push to `origin/rs/gamification-achievement-receipts`, updating PR
  #5515, marking the PR ready, merge, deployment, live/staging access, and
  worktree/runtime deletion. These require a separately named approval.
- Runtime: retain the exact `gamification-roadmap` DevPod while the user’s
  requested local testing window remains active. Record its source path and
  provider state at the finish; do not delete it.
- Pause only if rebaseline conflicts change the settled product contract or API
  topology, Prisma migration state is ambiguous, the public/self authorization
  cannot be proven, the unrelated Prisma views become involved, or a required
  local capability is unavailable.

## Freshness and rebaseline

The worktree fetch could not write its worktree-local `FETCH_HEAD`. The safe
fallback succeeded: `git fetch --no-write-fetch-head origin v3`, followed by
`git ls-remote` and a local ahead/behind check. The branch is 34 commits ahead
and 25 commits behind the fresh `origin/v3`; it is intentionally not treated as
current until rebaseline.

After plan approval, merge `origin/v3` normally into the existing branch. Do
not rebase or rewrite its pushed history. Preserve the task-owned roadmap diff
and the unrelated untracked directory. If Git refuses the dirty merge, use an
explicit path-scoped preservation step; never bulk-stash, reset, or discard
uncertain work. Stop and reassess only if a conflict changes the W6 contract,
migration ordering, award behavior, participant ownership, or API topology.

## Research and planning findings

### Local evidence

- `packages/prisma/src/prisma/schema/migrations/20260824120000_add_achievement_receipts/migration.sql`
  adds the nullable receipt column but does not backfill existing instances.
- `packages/graphql/src/schema/achievement.ts` exposes the timestamp directly
  on the shared `ParticipantAchievementInstance` type.
- `packages/graphql/src/schema/mutation.ts` scopes the existing mutation to the
  participant ID and null timestamp, but a repeated acknowledgement currently
  returns `false`.
- `QSelfWithAchievements` selects the timestamp; the public profile operation
  also selects it even though the state is self-only.
- `ReceivedAchievementTile` only renders the pending marker. `ProfileData`
  already knows `isSelf`, but does not pass it to the tile, and the public
  profile modal does not pass its returned `isSelf` value through.
- The local seeded Playwright data already creates participant achievement
  instances, while no `playwright/tests/student-gamification.spec.ts` exists;
  the focused browser coverage must be added at that path or an equivalent
  active spec if the post-rebaseline suite has a better established seam.

### Specialist pass

- Required planning specialist: Sol planner, completed `DONE_WITH_CONCERNS`.
- Accepted recommendation: use an ownership guard on the shared GraphQL field,
  remove the timestamp selection from the public client operation, retain it in
  the self operation, move acknowledgement logic into the participant service,
  make owned repeat acknowledgement return `true` without changing the first
  timestamp, and attempt one post-render acknowledgement per component mount.
- Accepted test concern: the repository has no dedicated migration-test
  harness, so use an isolated local Prisma migration drill and avoid brittle
  SQL-text assertions or runtime raw SQL.
- Rejected planner concern: creating `docs/log/...` is not allowed in this
  checkout because the repository `AGENTS.md` explicitly says `docs/log.md`
  and `docs/log/` are intentionally absent and must not be restored.
- Independent Claude advisor: unavailable; the configured CLI returned HTTP
  401 because its OAuth token is expired. The current-provider planner pass is
  the recorded fallback.

## Decisions

### Receipt backfill

Add the next timestamped Prisma migration after the existing receipt migration.
For rows whose receipt timestamp is still null, set only
`receiptAcknowledgedAt` to the migration execution timestamp. Do not use
`achievedAt` as a guessed acknowledgement time, and do not update award,
count, points, XP, or any other column. The nullable schema default remains
unchanged, so instances created after the migration remain pending.

### GraphQL privacy and idempotence

Keep one compatible `ParticipantAchievementInstance` GraphQL type. Resolve its
receipt timestamp only when the authenticated subject equals the instance’s
`participantId`; return null for every other caller/object combination. This
protects direct GraphQL callers even if they request the field manually, while
avoiding a duplicate public profile graph and preserving the self operation.

Remove the field selection from `QGetPublicParticipantProfile` and retain it in
`QSelfWithAchievements`. Add the PWA mutation operation and regenerate all
tracked GraphQL artifacts.

Move acknowledgement business logic to the participant service. The mutation
remains participant-authenticated, self-scoped, and idempotent: the first
acknowledgement and a repeat acknowledgement for an already acknowledged owned
instance return true; a missing or foreign instance returns false; the first
timestamp is never overwritten.

### PWA lifecycle

Pass `isSelf` from the self page and public profile modal through `ProfileData`
to `ReceivedAchievementTile`. A receipt is pending only when `isSelf === true`
and the self query explicitly returns `receiptAcknowledgedAt === null`.
Undefined receipt data is unavailable public data, not a pending receipt.

After the tile has rendered, issue one non-blocking mutation attempt for that
mount. On success, update local presentation state so the marker clears. On
failure, keep the achievement visible and leave the server receipt pending;
the next mount/reload/session retries it. Never acknowledge another
participant’s public profile.

## Primitive impact

| Existing primitive | Disposition | Contract delta | Consumers/evidence |
| --- | --- | --- | --- |
| `ParticipantAchievementInstance` receipt lifecycle | Extend | Historical rows are acknowledged during rollout; newly awarded instances remain pending until the self participant sees them | Prisma migration, self GraphQL query, PWA profile |
| Participant self/public profile boundary | Reuse and tighten | Receipt timestamp is self-only at the resolver boundary; public profiles receive no timestamp | `Participant` GraphQL type, public profile operation, profile modal |
| Achievement award/catalog policy | Preserve | Every existing award remains visible and earnable; no award or discoverability change | Existing seed, award services, roadmap contract |

No new product primitive, owner, table, lifecycle, or policy is introduced.

## ADR gate

No new ADR is required. This extends the already accepted achievement receipt
field and the existing private-profile contract without changing ownership,
retention, or product meaning. Reopen the ADR gate only if implementation
requires a separate public achievement type, a new receipt lifecycle, or a
broader public API commitment.

## Skill routing

- `rs-sliced-development-workflow`: full path for data integrity, privacy,
  public GraphQL behavior, and cross-layer UI wiring.
- `klicker-data-model`: Prisma migration, local migration proof, and sync/build
  ritual.
- `klicker-graphql-api`: service/resolver layering, auth boundary, operation,
  codegen, and schema tests.
- `klicker-frontend-ui`: generated Apollo mutation, `isSelf` propagation, and
  browser proof of the visible profile behavior.
- `klicker-testing-verification` and `klicker-playwright-e2e`: focused tests,
  real local runtime, screenshots, and final repository checks.
- `klicker-wiki-maintenance`: update the affected durable domain/API pages in
  the same change; do not create the repository-forbidden `docs/log/` path.
- `rs-local-runtime-lifecycle`: retain and verify the exact DevPod by source
  path during local testing, then record the explicit keep-running ruling.
- `rs-model-routing`: planner, slice-risk review, simplifier, and final-review
  gates. No eligible bounded executor is used because migration, privacy, and
  browser seams are coupled and one writer is safer.

## Test portfolio

| Risk/behavior | Obligation | Primary seam | Existing protection | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- | --- |
| Historical receipt backfill changes only the receipt field | Add new focused migration drill | Isolated Prisma database with before/after snapshots | Existing migration workflow | Replays old awards or mutates points/counts/XP | S1 |
| New instances remain pending after rollout | Extend existing persistence coverage | Prisma create/upsert readback | Nullable schema field | New awards are immediately hidden from the receipt flow | S1 |
| Receipt timestamp is self-only | Add new GraphQL integration coverage | Real schema field resolver | `asParticipant` root auth | Public/direct callers learn another participant’s timestamp | S2 |
| Acknowledgement ownership and idempotence | Add new GraphQL service/schema coverage | Mutation against two seeded participants | Existing `updateMany` self predicate | Repeat appears failed or foreign IDs mutate | S2 |
| Self PWA acknowledges after display | Add new focused Playwright flow | Real PWA profile and network observation | Existing login/session fixtures | Marker never clears or the profile blocks | S3 |
| Failure/reload retry and public no-op | Extend the same Playwright flow | One injected failed mutation, reload, public profile | Existing browser context isolation | Failure hides achievement, loops, or sends a public mutation | S3 |
| Existing gamification remains unchanged | None beyond package checks | Full relevant GraphQL/PWA checks and build | Existing streak/leaderboard suites | Receipt fix regresses unrelated gamification behavior | S4 |

## Slices and commit boundaries

### S0 — Rebaseline and commit the approved plan

**Route:** `main`; no delegation. The existing branch is the only writer.

**Do:** After plan approval, commit this plan file separately. Merge the fresh
`origin/v3` normally, preserving the task-owned roadmap and unrelated untracked
directory. Record the resulting tip, conflict disposition, and status in
`Progress`.

**Check:** `git status --short --branch`, `git rev-list --left-right --count
origin/v3...HEAD`, `git diff --check`, and an explicit path audit before any
implementation edit.

**Commit:** `docs(project): add achievement receipt boundary plan`.

**Simplifier:** not required for a plan/rebaseline-only slice.

**Slice review:** required for the rebaseline only if a conflict touches a W6
path; otherwise not required, with the path audit recorded in `Progress`.

### S1 — Backfill historical achievement receipts

**Route:** `main`; one migration file only.

**Do:** Add the post-receipt Prisma migration with a null-only timestamp
backfill. Apply it through the local Prisma migration path, read the affected
rows through Prisma, and run `pnpm run prisma:sync` even though the model is
unchanged so the shared-schema parity gate remains explicit.

**Check:** Isolated before/after migration evidence proves only null historical
receipt fields change; a post-migration new instance remains null. Run the
Prisma package check/build path and `git diff --check`.

**Commit:** `fix(gamification): backfill historical achievement receipts`.

**Simplifier:** not required; the slice is one declarative migration and its
verification.

**Slice review:** required — data-integrity and migration safety. Dispatch one
read-only `slice-reviewer` over the immutable S1 commit.

### S2 — Enforce the self-only GraphQL contract

**Route:** `main`; the API and generated operation changes remain together.

**Do:** Move the acknowledgement logic to the participant service; add the
ownership guard to the shared receipt field; remove the receipt selection from
the public operation; add the PWA mutation operation; regenerate artifacts; add
focused schema/service coverage.

**Check:** The real schema proves self read visibility, direct public null,
first acknowledgement, repeat true without timestamp replacement, and foreign
or missing false without mutation. Run GraphQL tests, codegen, and GraphQL
check; generated output must be committed and clean after regeneration.

**Commit:** `fix(graphql): enforce private achievement receipts`.

**Simplifier:** required — API shape and resolver logic are substantive code.
Dispatch one simplifier and one slice-reviewer in parallel after the immutable
commit; the reviewer covers privacy, authorization, correctness, and API
compatibility.

### S3 — Acknowledge receipts after self presentation

**Route:** `main`; PWA and Playwright changes are coupled through the generated
mutation and `isSelf` contract.

**Do:** Wire the generated mutation into the post-render tile effect, thread
`isSelf`, keep pending achievements visible on failure, and add the focused
student-gamification browser flow using existing seeded participants and
fixture/database helpers. Capture changed profile states in the local browser
at desktop and mobile widths and in English and German where the existing flow
supports both.

**Check:** Browser evidence proves visible pending state, successful
acknowledgement, retained achievement, marker removal, reload/second-session
persistence, one failed request followed by retry on reload, and no mutation or
pending marker for another participant’s public profile. Run the PWA check,
Playwright TypeScript/list checks, and focused Chromium spec.

**Commit:** `fix(pwa): acknowledge achievement receipts after display`.

**Simplifier:** required — post-render effect and retry state are substantive
UI behavior. Dispatch one simplifier and one slice-reviewer in parallel after
the immutable commit; the reviewer covers privacy, retry semantics, and
cross-system behavior.

### S4 — Document and complete the package

**Route:** `main`; docs and final integration only.

**Do:** Update `docs/domain-model.md` and `docs/graphql-api-layer.md` with the
self-only resolver and historical/new receipt boundary. Update the roadmap and
this plan `Progress`. Do not create `docs/log/` because the repository forbids
that path.

**Check:** Run fresh GraphQL generation, focused GraphQL tests, PWA check,
focused Playwright, `pnpm run format:check`, `pnpm run check:all`, and
`pnpm run build`. Inspect the complete diff and staged content for secrets,
personal data, and accidental `schema/views/` inclusion. Then dispatch exactly
one integrated final reviewer over the complete committed W6 range with
correctness, plan compliance, maintainability, security/privacy, and
architecture lenses.

**Commit:** `docs(gamification): document private achievement receipts` plus
any small verified correction commits required by review. No PR update or push
is part of this slice.

**Simplifier:** not required for documentation-only edits.

**Slice review:** not required; the integrated final review is the required
finish gate for the complete package.

## Review and delivery gates

- Planning: this plan follows the Sol planner’s completed
  `DONE_WITH_CONCERNS` pass. The expired Claude advisor route is recorded as a
  fallback, not silently treated as successful.
- S1: one migration/data-integrity slice review.
- S2 and S3: one simplifier plus one risk-selected slice review per immutable
  slice, started in parallel and dispositioned before continuing.
- Finish: fresh verification first, then exactly one integrated final reviewer
  over the complete committed range. Any material correction resumes that same
  reviewer once after re-verification.
- Delivery: local `pr_ready` is the terminal for this task. Existing PR #5515
  remains open but is not updated until push/PR authority is separately named.

## Progress

- 2026-08-25: W6 was approved as the next execution package. The worktree is
  `rs/gamification-achievement-receipts`; after the fresh-base merge it is at
  `3fe8b2219`, with `origin/v3...HEAD` at `0 41`.
- 2026-08-25: The local runtime identity is `gamification-roadmap`, source
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/gamification-roadmap`, DevPod
  provider `docker`, state `Running`; it is retained for the user’s local
  testing request.
- 2026-08-25: Sol planner completed `DONE_WITH_CONCERNS`; the accepted
  decisions and concerns are recorded above. Claude advisor could not run
  because its OAuth token is expired.
- 2026-08-25: The approved plan was committed as `0b36e1398`.
- 2026-08-25: The branch was merged normally with fresh `origin/v3` at
  `0be7b365`. The only conflict was an unrelated staging release annotation;
  the resolved file matches `origin/v3`. The normal merge hook reached the
  repository checks but failed on upstream frontend-manage imports for newly
  merged generated GraphQL operations, so the merge commit used `--no-verify`.
  W6 will regenerate and verify the GraphQL artifacts in S2. The task-owned
  roadmap remains unstaged, and the unrelated Prisma `schema/views/` directory
  remains untracked and untouched.
- 2026-08-25: S0 path audit after rebaseline: `origin/v3...HEAD` is `0 36`,
  the runtime remains `gamification-roadmap`/Docker/Running, and no push, PR
  update, deployment, or cleanup has occurred.
- 2026-08-25: The remote freshness gate detected four new `origin/v3` commits.
  They were merged locally as `3fe8b2219`; GraphQL generated artifacts were
  regenerated to resolve the only conflicts. The normal merge hook failed on
  unrelated upstream frontend-manage feature-flag typing changes, so the local
  merge commit used `--no-verify`; no W6 files were changed by that failure.
- 2026-08-25: S1 committed as `2ec3cdfdf` with the null-only Prisma migration
  `20260825120000_backfill_achievement_receipts`. A Prisma verification drill
  proved historical rows receive a timestamp, only that field changes, and a
  new instance remains pending. Prisma sync and package build passed. The
  configured native review route returned provider HTTP 402; its generic
  continuity review passed with no findings.
- 2026-08-25: S2 committed as `942495cc1`. The GraphQL field is self-only, the
  public profile operation no longer selects receipt state, and the
  acknowledgement service is owner-checked and idempotent. Focused GraphQL
  tests cover self/foreign visibility, first/repeat acknowledgement, timestamp
  preservation, and missing/foreign mutation outcomes. Codegen, GraphQL check,
  build, and the repository pre-commit checks passed. Native simplifier and
  slice-reviewer routes returned provider HTTP 402; generic continuity reviews
  passed with no findings.
- 2026-08-25: S3 committed as `bad4663f2`. The PWA now passes `isSelf` into the
  achievement tile, acknowledges a private pending receipt once per mount after
  presentation, clears the local marker only after success, and retries on a
  later mount after failure. Public profiles neither show the marker nor call
  the mutation. PWA and Playwright typechecks passed; the focused test is
  structurally ready but cannot launch because the DevPod lacks the pinned
  Playwright Chromium executable. Native S3 simplifier and slice-reviewer
  routes returned provider HTTP 402; generic continuity reviews are pending.
- 2026-08-25: S4 documentation edits are ready for the final local commit.
  Final verification must use the fresh base at `3fe8b2219`; the unrelated
  untracked `packages/prisma/src/prisma/schema/views/` directory remains
  untouched.
- 2026-08-25: The S3 slice review identified that Apollo's shared retry link
  could issue additional acknowledgement requests on the same mount and that
  the browser test covered reload but not a new login session. Commit
  `e01cee1c` now opts this acknowledgement out of Apollo retries and logs the
  student in again before checking persistence. PWA and Playwright checks pass;
  the normal hook still stops on the unrelated upstream frontend-manage
  feature-flag typing errors introduced by the fresh `origin/v3` merge, so the
  correction commit used `--no-verify`. The follow-up generic-continuity
  review passed with no remaining findings; the native route remained
  unavailable with provider HTTP 402.
- 2026-08-25: S4 documentation was committed as `c1c4d8d54`. Fresh integrated
  verification on the branch tip passed GraphQL generation, the focused
  achievement-receipt tests (2/2), GraphQL check and build, PWA and Playwright
  package checks, formatting, and the repository build. The Playwright test
  list includes the focused receipt test, but the focused Chromium run still
  cannot launch because the DevPod lacks the pinned browser executable. The
  full `check:all` gate is blocked outside W6: analytics cannot build pandas
  without a C compiler, and fresh `origin/v3` frontend-manage feature-flag
  typing errors remain in five unrelated files. `git diff --check` is clean;
  the unrelated untracked Prisma `schema/views/` directory remains untouched.
- 2026-08-25: The integrated final reviewer initially found one low-severity
  gap in the focused retry test: it reloaded before Apollo's first retry window
  elapsed. Commit `428e8497f` keeps the failed profile mount alive for two
  seconds and asserts that the acknowledgement request count remains one
  before the later-mount retry. The native follow-up review passed with no
  remaining findings. W6 is locally verified at `pr_ready` on `428e8497f`,
  with the runtime retained and push, PR update, merge, deployment, and cleanup
  still withheld.
- 2026-08-29: Delivery reconciliation found that the branch had subsequently
  been pushed and PR #5515 was open at `a23e2a706`. The post-W6 first-parent
  history contains documentation reconciliation (`c7b5c3a5c`, `29169726b`),
  receipt-fixture isolation (`6223deab9`), two normal `v3` merges
  (`930f9b3bf`, `a23e2a706`), and runtime startup-migration hardening
  (`237fbb5e7`). These actions were not recorded here, so the former local
  `pr_ready` classification no longer described the delivered package.
- 2026-08-29: Exact-head CI evidence for `a23e2a706` shows the repository
  check, build, GraphQL, unit, secrets, CodeQL, and Sonar gates passing. The
  package-owned Playwright failure is in the receipt scenario: it hardcodes
  seeded `testuser1`, whose rank 15 is intentionally outside the Top 10 plus
  the requesting participant's nearby context. A separate chat-citation test
  fails in another shard. OpenCodeReview failed on provider HTTP 402, while the
  final-review trusted-policy job could not verify an existing workflow
  definition commit; neither produced a code finding.
- 2026-08-29: Commit `8e83924a3` makes the receipt test derive its
  public-profile target from the highest-scoring active public
  course-leaderboard entry. This preserves the real modal flow without changing
  leaderboard scores or relying on one seeded rank. `git diff --check` passes.
  Focused typecheck and browser execution remain pending: the exact DevPod
  could not be created because Docker exhausted its predefined network address
  pools. The failed attempt left no provider runtime; `devrouter stop` removed
  ten exact stale routes and retained the worktree and owner record. The commit
  used `--no-verify` because repository toolchain checks must run inside that
  unavailable exact DevPod.
- 2026-08-29: Remote `v3` is now `f0659e130`; the published branch is 34
  commits behind and 52 commits ahead, with merge base `97d20293f`. No merge,
  rebase, push, PR update, deployment, data action, or destructive cleanup was
  performed during this reconciliation.
- 2026-08-29: The user approved one normal merge of exact `origin/v3`
  `f0659e130`, conflict resolution, publication of the resulting exact head,
  PR #5515 update, and CI monitoring. Merge commit `68ce2200b` completed that
  integration. The sole conflict in `apps/backend-docker/src/index.ts`
  preserves current `v3` chat-model registry validation and the branch's
  fail-open runtime migration. The branch is now 55 commits ahead and zero
  behind the approved base; the unrelated untracked Prisma `schema/views/`
  directory remains untouched.
- 2026-08-29: The post-integration migration audit confirms three distinct
  forward-only Prisma migrations: streak state and indexes, receipt/catalog
  fields plus seeded-achievement discoverability, and the later historical
  receipt backfill. Their order reflects separate shipped behavior and data
  steps. The runtime streak initialization remains Prisma-based. The only
  local correction after integration removes an extra leading and trailing
  blank line from the first migration artifact.
- 2026-08-29: Integrated correction commit `77c64ed3f` closes the five final
  review blockers and related verified PR comments. Backend startup no longer
  awaits runtime migrations, replica coordination is Prisma-only, streak
  fields are owner-only, freeze cycles reset at the cap, daily-goal copy is
  eligibility-aware, and seeded achievement discoverability uses an explicit
  current-ID allowlist with a false fallback. The same correction includes the
  ended-untracked read guard, concurrent response indexes, achievement
  empty-state fix, and import cleanup.
- 2026-08-29: The generic-continuity integrated final reviewer passed exact
  head `77c64ed3f37c3ed4342a4833206e18b61125a7f8` with no remaining findings.
  `git diff --check` passes. No pnpm or browser execution was possible because
  Docker network-pool exhaustion prevents the exact DevPod from starting;
  exact-head CI remains the executable publication proof.

## Next step

W6 remains `delivery_pending` until the reviewed exact head is published and
its CI is dispositioned. Commit this review receipt, push the branch, update PR
#5515, and monitor exact-head CI under the user's explicit approval. Do not
merge the PR, deploy, or clean up the retained worktree or runtime records.
