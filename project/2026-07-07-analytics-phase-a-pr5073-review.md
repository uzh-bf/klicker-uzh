# Review — PR #5073 "Phase A: analytics pipeline improvements"

**Reviewed commit:** `36323c485` (branch `analytics-phase-a`, diffed against base `chat-analytics`)
**Review date:** 2026-07-07
**Reviewer:** Claude (independent review pass over computations, architecture, quality, UX, didactics, and production readiness)
**Design doc:** [project/ANALYTICS_IMPROVEMENTS.md](./ANALYTICS_IMPROVEMENTS.md)

---

## 1. Verdict

Strong, design-doc-driven engineering. The Phase A items (indexes, rollup-upsert fix, Hatchet DAG) are implemented and in several places the branch goes beyond the plan (SQLAlchemy migration, dry-run harness, dedicated analytics worker, GraphQL status surface). The computations I spot-checked are correct.

**Not production-ready yet.** CI is red (trivial), the PR's own test plan is fully unexecuted (all checkboxes open, no walltime or EXPLAIN evidence), task cancellation does not propagate to the Python subprocess, three indexes from the design were silently dropped, and the manage-UI wiring for the new GraphQL surface does not exist. Section 4 is the ordered path to done.

---

## 2. What was verified as correct (with evidence)

| Area | Evidence |
| --- | --- |
| **A2 rollup-upsert fix is complete** | `apps/analytics/src/modules/participant_analytics/save_participant_analytics.py:68-75` and `apps/analytics/src/modules/aggregated_analytics/save_aggregated_analytics.py:93-101` — `update_cols` covers every non-key column except `createdAt` (compared field-by-field against the insert dicts). Late-arriving data now refreshes DAILY/WEEKLY/MONTHLY rows; P9 from the design doc is fixed. |
| **DAG matches the documented dependency graph** | `packages/hatchet/src/tasks.ts:350-441` — 12 parallel leaves, `s1 ← s0`, `s11 ← {s4, s8}`, `s99` full fan-in over all 14 tasks. Matches design §2.2/R2 (see one exception in finding F6). |
| **Error contract is right** | `handleRunAnalyticsScript` throws on subprocess failure (`packages/graphql/src/services/analyticsRecompute.ts:111-186`); workflow fns return `void` (`tasks.ts:337-345`), so `taskDefaults.retries: 2` actually fires and a failed leaf gates `s99`. Unit-tested in `packages/graphql/src/services/__tests__/analyticsRecompute.test.ts` (6 cases: exit 0, non-zero exit, full-mode guard both ways, missing CWD, finalize without courseId). |
| **Concurrency control** | CEL group `has(input.courseId) ? input.courseId : 'global'`, `maxRuns: 1`, `CANCEL_IN_PROGRESS` (`tasks.ts:315-323`). Collapses duplicate triggers as designed (P3 fixed) — but see finding F4 on subprocess lifetime. |
| **Guard rails** | `mode=full` refused without `ANALYTICS_ALLOW_FULL=1` (`analyticsRecompute.ts:132-136`), finalize without course IDs refused (`:138-142`), stale env vars scrubbed before spawn (`:151-159`), course IDs UUID-validated before raw-SQL interpolation (`apps/analytics/src/modules/utils.py:57-69`) — no injection path. |
| **Validity flag semantics** | `s99` only runs after every script succeeded (full fan-in); finalize mode stamps `analyticsFinalizedAt` only for scoped courses and bypasses the analytics-rows requirement so empty courses don't loop the scanner forever (`apps/analytics/src/modules/analytics_validity/mark_analytics_valid.py:20-37`). |
| **Auth on the new mutation** | `recomputeCourseAnalytics` = `asUserFullAccess` + `withPermission(..., PermissionLevel.ADMIN)` on the target course (`packages/graphql/src/schema/mutation.ts`, `+recomputeCourseAnalytics` block). Consistent with the repo's three-layer auth model. |
| **Schema ↔ migration consistency** | The 4 composite B-tree indexes in `20260420_analytics_covering_indexes/migration.sql` all have matching `@@index` declarations in the schema files; the 2 BRIN indexes are raw-SQL-only, which is correct (Prisma can't model BRIN). |
| **Repo conventions** | `turbo.json` `globalEnv` extended with `ANALYTICS_ALLOW_FULL` and `DATABASE_URL_RO` (required by the repo's Infisical/Turbo rule). `ANALYTICS_SCRIPTS` single-sourced in `packages/types/src/hatchet.ts`. |

---

## 3. Findings (severity-ordered)

### F1 — CI is red: syncpack format violation *(blocker, 5-minute fix)*

The `check` job fails on `apps/analytics/package.json` (reproduced locally with `pnpm dlx syncpack@13 lint` → `✘ apps/analytics/package.json` under "Formatting"; the `scripts` keys are not sorted — `dryrun:*` entries were appended after `script:*`).

**Fix (junior):**
```bash
pnpm dlx syncpack@13 format
pnpm run check:syncpack   # must exit 0
git add apps/analytics/package.json && git commit -m "chore(analytics): fix syncpack script ordering"
```

### F2 — Non-concurrent `CREATE INDEX` on hot production tables *(major, deploy risk)*

`20260420_analytics_covering_indexes/migration.sql` uses plain `CREATE INDEX` on `QuestionResponse`, `ChatMessage`, `ParticipantAnalytics`, `AggregatedAnalytics`, plus BRIN builds on `QuestionResponseDetail` and `LiveQuizResponse`. Plain `CREATE INDEX` takes a lock that blocks writes for the build duration. `QuestionResponse`/`QuestionResponseDetail` are the largest tables in the platform; students actively answering during the deploy would see response writes stall. (`CREATE INDEX CONCURRENTLY` cannot go in the migration — Prisma wraps migrations in a transaction.)

**Fix (junior):**
1. On staging, check sizes: `SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('QuestionResponse','QuestionResponseDetail','ChatMessage') ORDER BY n_live_tup DESC;`
2. Time the migration on a staging copy. If build time is seconds → just deploy in a quiet window and note it in the PR.
3. If it is minutes on prod-sized data: create the indexes manually on prod with `CREATE INDEX CONCURRENTLY ...` (same names as the migration), then mark the migration applied with `pnpm --filter @klicker-uzh/prisma exec prisma migrate resolve --applied 20260420_analytics_covering_indexes`.
4. Write the chosen procedure into the PR description before merge.

### F3 — Three of the eight designed indexes were dropped without documentation *(major, decide or add)*

Design §R4 lists 8 indexes; the migration ships 6. Missing:
- `QuestionResponseDetail (participantId, elementInstanceId, createdAt)` — design says this covers script 0's per-attempt walk.
- `LiveQuizResponse (liveQuizId, createdAt)` — design's script-14 access path (design doc calls the table `LiveQuizParticipantResponse`; the actual model is `LiveQuizResponse`, `packages/prisma/src/prisma/schema/response.prisma:113` — fix the doc name too).
- `ChatMessage BRIN (createdAt)` — **this one is fine**: a B-tree on `ChatMessage(createdAt)` already exists from the base branch (`20260417140000_chat_message_created_at_index`), making BRIN redundant.

**Fix (junior):** for each of the two genuinely missing indexes, run the real query shape against a seeded DB and look at the plan:
```bash
pnpm run prisma:setup && pnpm run seed:interactions
# then in psql, EXPLAIN ANALYZE the queries issued by
# apps/analytics/src/modules/participant_analytics/get_participant_responses.py (script 0)
# and apps/analytics/src/scripts/14_live_quiz_assessment_analytics.py
```
If you see sequential scans on the filtered path → add the index (schema `@@index` + migration). If the BRIN/composite already covers it → add one sentence to `ANALYTICS_IMPROVEMENTS.md` §R4 documenting the intentional omission. Silent divergence from the design doc is the actual bug here.

### F4 — Hatchet cancellation/timeout does not kill the Python subprocess *(major, correctness under retry)*

`runScript` (`analyticsRecompute.ts:23-77`) has no cancellation hook — the only kill path is the 65-minute Node watchdog. When Hatchet cancels a task (`CANCEL_IN_PROGRESS` on a superseding trigger) or hits the 30/60-min `executionTimeout` and retries, the old `uv run python -m <module>` keeps running. Result: a retried or superseding script instance runs **concurrently** with the zombie against the same tables for up to 65 minutes. Upserts serialize at the DB so data won't corrupt, but the delete-then-upsert transactions (drop-out cleanup in `save_participant_course_analytics` etc.) can deadlock/retry, and duplicate full-history work defeats the concurrency group's purpose.

**Fix (junior):** the Hatchet v1 task context exposes a cancellation signal (`ctx.abortController.signal` / `ctx.cancelled` in the TS SDK — check `@hatchet-dev/typescript-sdk` version in use). Thread it into `runScript` and call `child.kill('SIGTERM')` on abort; escalate to `SIGKILL` after ~10s. Add a unit test in `analyticsRecompute.test.ts` mirroring the existing spawn-mock pattern: abort mid-run → child killed → promise rejects.

### F5 — s13 races s2 on `AggregatedCourseAnalytics` *(medium)*

Design §2.2 states script 13 reads `AggregatedCourseAnalytics` "implicitly through its updates" (written by script 2), yet the DAG runs `s13` as a parallel leaf (`tasks.ts:397-400`) with no parent on `s2`. If the read is real, platform semester stats nondeterministically see pre- or post-update rows depending on scheduling.

**Fix (junior):** read `apps/analytics/src/scripts/13_platform_semester_analytics.py` + its SQL. If it touches `AggregatedCourseAnalytics` rows also written by s2 in the same run → add `parents: [taskS2]` to `s13` in `tasks.ts`. If not → correct §2.2 in the design doc. Either way the doc and DAG must agree.

### F6 — Scanner comment claims event dedup that doesn't exist *(low, misleading comment)*

`tasks.ts:473-477`: "a scanner retry inside the same UTC day reuses the key and Hatchet de-duplicates the emission". `additionalMetadata` is dashboard metadata only — Hatchet does **not** dedupe events on it. Actual protection is the workflow concurrency group. The design-doc addendum states this correctly ("identifiable in the Hatchet dashboard"); the code comment overclaims.

**Fix (junior):** reword the comment to match the addendum. Don't build dedup — `CANCEL_IN_PROGRESS` already handles it.

### F7 — `bulk_upsert` derives columns from the first row only *(low, latent foot-gun)*

`apps/analytics/src/db_helpers.py:41-44`: both the INSERT column list and the default `update_cols` come from `rows[0].keys()`. A future caller passing heterogeneous dicts gets either a SQLAlchemy compile error or silently un-updated columns.

**Fix (junior):** add a guard at the top of `bulk_upsert`: assert all rows share the same key set, raise `ValueError` naming the offending index otherwise. One unit test.

### F8 — Naive local `datetime.now()` in save modules *(low)*

`save_participant_analytics.py:34-35,60-61` and `save_aggregated_analytics.py` use `datetime.now()` (server-local, tz-naive) for `createdAt`/`updatedAt` while the SQL modules use `NOW()` (DB time). In containers this is UTC by accident, not by contract.

**Fix (junior):** `datetime.now(timezone.utc).replace(tzinfo=None)` or a small `utcnow()` helper in `db_helpers.py`; sweep the save modules.

### F9 — NUMERICAL elements remain unsupported in correctness computation *(medium, didactic data gap)*

`compute_correctness.py` does not handle one-sided `solutionRanges`, and the interactions seeder deliberately skips NUMERICAL elements because of it (documented in AGENTS.md learnings). Production data contains NUMERICAL responses: script 0 either mis-scores or fails on them, and any course relying on numerical questions is **invisible or wrong in the participant correctness analytics** — a real didactic distortion for lecturers reading the dashboards.

**Fix (junior):** implement one-sided range handling in `apps/analytics/src/modules/participant_analytics/compute_correctness.py` mirroring `packages/grading/src/index.ts` semantics exactly (that package is the product source of truth — same rule as the SELECTION/CASE_STUDY fixes already on this branch). Then: remove the NUMERICAL skip in `packages/prisma-data/src/data/interactions/`, reseed, rerun script 0, and row-diff the output. Finish with a dry-run export against a prod snapshot.

### F10 — Dry-run buffer has undocumented coverage gaps *(low, tooling only)*

The in-memory buffer bridge (`apps/analytics/src/dryrun/buffer_registry.py`) is wired into 5 read sites (s1, s2, s5 ×2, s11) but not s13 (which per design reads `AggregatedCourseAnalytics`) or s99. Additionally `get_table` **replaces** the DB read — buffered rows are not unioned with pre-existing DB rows, so incremental-window dry-runs under-report downstream aggregates. Fine for its purpose (read-only prod exports), but the next person will trip on it.

**Fix (junior):** add a "Known limitations" subsection to `apps/analytics/ANALYTICS.md` covering both points; verify whether s13's dry-run export needs the buffer and wire it if so.

### F11 — PR body is stale relative to the branch *(process)*

The scope table still lists A4 as "convert scripts 5, 2, 4 … (deferred — will discuss)", but the SQLAlchemy addendum supersedes A4 entirely (bulk_upsert instead of raw-SQL rewrite). None of the 7 test-plan checkboxes are checked, and the promised before/after walltime numbers were never recorded. Reviewers can't tell what's claimed vs. delivered.

**Fix (junior):** regenerate the description with `$df-mr-description-writer` against the full branch diff; execute the test plan (see §4) and check the boxes with evidence pasted in.

---

## 4. Remaining steps to production readiness (ordered, junior-executable)

1. **Make CI green** — F1 (syncpack). Push, confirm all checks pass.
2. **Resolve the stack** — this PR targets `chat-analytics`, not `v3`. Confirm `chat-analytics` is itself review-complete and merge it first, or retarget/rebase this branch onto `v3` if `chat-analytics` already landed. Do not squash-merge into the stacked base by accident.
3. **Execute the PR's own test plan** (each box maps to a command):
   - `pnpm run prisma:setup && pnpm run seed:interactions` then `pnpm run prisma:migrate` — migration applies cleanly.
   - EXPLAIN ANALYZE per F3 — paste plans into the PR.
   - Late-data test: insert a backdated `QuestionResponse` for a covered day, rerun incremental (`ANALYTICS_MODE=incremental`), confirm the DAILY `ParticipantAnalytics` row changed (A2 acceptance).
   - Trigger `recompute-learning-analytics` manually; screenshot the 15-task DAG in the Hatchet UI.
   - Trigger twice back-to-back; confirm the first run is cancelled (concurrency group).
   - Record full + incremental walltime before/after and put the numbers in the PR table.
4. **Fix F4 (subprocess cancellation)** — the one code change I'd insist on before prod, because `CANCEL_IN_PROGRESS` is actively configured and will produce zombie+successor pairs in normal operation.
5. **Decide F3 / F5** (index omissions, s13 ordering) — small diffs or doc sentences, but decide explicitly.
6. **Fix F9 (NUMERICAL)** — required before lecturers rely on the correctness analytics for courses using numerical questions.
7. **Wire the manage UI** — `MRecomputeCourseAnalytics.graphql` / `QCourseAnalyticsStatus.graphql` exist but nothing consumes them; the addendum's "manage UI can wire a button" is still open. Minimal slice: on the course overview in `apps/frontend-manage`, show `analyticsStatus` (valid flag + last-computed timestamp) and a "Recompute" button (INCREMENTAL; FINALIZE behind confirm) for course admins. **Verify with `npx agent-browser`** (delegated login, before/after screenshots) per repo policy.
8. **Deployment work** (this PR adds `apps/hatchet-worker-analytics` — a new deployable):
   - Container image must have `uv` on PATH and the `apps/analytics` tree at `ANALYTICS_CWD`.
   - Secrets/env: `DATABASE_URL`, `DATABASE_URL_RO`, Hatchet token, `ANALYTICS_CWD`; set `ANALYTICS_ALLOW_FULL=1` **only** on the designated full-recompute worker (default off).
   - Add the deployment to the k8s charts + ArgoCD; after first deploy, watch the Monday 02:00 UTC cron run end-to-end in the Hatchet dashboard and confirm `Course.areAnalyticsValid` flips.
   - Write a short runbook note: how to re-trigger a course, how to read the s0–s99 task logs, what the validity flag means.
9. **Refresh PR body (F11), mark ready for review.**

---

## 5. Didactics / UX / usefulness assessment

- **Usefulness: high.** This PR is infrastructure — it makes the lecturer-facing analytics *trustworthy* (validity flag only flips on complete runs; late-arriving student work is no longer silently dropped from DAILY/WEEKLY/MONTHLY rollups). Those are exactly the failure modes that erode lecturer confidence in dashboards.
- **Didactic correctness of metrics:** the correctness definitions now mirror product grading for SELECTION/CASE_STUDY (good — analytics must never disagree with what students were scored). The NUMERICAL gap (F9) is the one remaining place where the analytics silently diverge from the pedagogical reality of a course.
- **UX debt is deliberate but real:** all new capability (per-script visibility, per-course recompute, status) currently ends at the GraphQL layer. Until step 7 in §4 lands, lecturers gain nothing visible; only operators do. Fine for a phased PR — but the PR title says "improvements" and reviewers should know the UI slice is deferred.
- **When the chat–quiz correlation surfaces in a dashboard later:** label it as correlation, not causation, and gate on minimum cohort size — small-N course correlations will mislead lecturers. (Not in scope here; noting for the follow-up UI work.)

---

*Review method: manual code review of the full branch diff (109 files, ~10.9k insertions vs `chat-analytics`), design-doc cross-check, local syncpack reproduction, CI log analysis. Not run: the pipeline itself (no local Python env for `apps/analytics` in this review session) — which is precisely why §4.3 must be executed before merge.*
