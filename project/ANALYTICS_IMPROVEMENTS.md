# Analytics Pipeline Improvements — Design Report

**Status:** Design proposal
**Scope:** `apps/analytics/`, `packages/hatchet/`, `packages/graphql/src/services/analyticsRecompute.ts`, analytics tables in `packages/prisma/src/prisma/schema/analytics.prisma`
**Last reviewed:** 2026-04-19

---

## 1. Executive Summary

The current learning-analytics pipeline is a single Hatchet task that sequentially shells out to 15 Python scripts, each of which either iterates DAILY/WEEKLY/MONTHLY/COURSE windows since 2022-10-23 or single-passes every course in the platform. The recently shipped incremental mode narrows window iteration and per-course scope, which already removes the largest cliff in cost. This report looks past the incremental work and proposes the next layer of improvements.

The biggest remaining weaknesses are architectural, not algorithmic. The pipeline is opaque inside Hatchet (one task = one opaque 15-step run), has no concurrency guard (two triggers can run concurrently against the same course), hides parallelism behind a serial Python loop, and mixes pandas-driven row iteration (scripts 0–7) with raw-SQL aggregation (scripts 8, 9, 11, 13, 14) inconsistently. Schema-level support is thin: the rollup tables have unique keys but no covering indexes, no partitioning on the event tables, no materialized views, and no generated columns.

The recommendations below are ordered by risk/reward. The first three (unify on raw SQL with UPSERT, add covering indexes, decompose the pipeline into a Hatchet DAG with concurrency groups) are low-risk, high-reward and compound with the already-shipped incremental mode. The remainder are optional — pg_ivm, native partitioning, and BERTopic incremental merging add capability but also add operational surface. dbt and TimescaleDB are discussed and declined for this scale.

---

## 2. Current State Snapshot

### 2.1 Script Inventory (by cost shape)

| Script | Compute shape | Iteration | Current implementation | Reads from | Writes to |
|---|---|---|---|---|---|
| 0 | Per-participant correctness rollup | DAILY/WEEKLY/MONTHLY/COURSE | pandas + Prisma upsert | QuestionResponse, QuestionResponseDetail | ParticipantAnalytics |
| 1 | Course-level aggregation of script 0 | DAILY/WEEKLY/MONTHLY/COURSE | pandas + Prisma upsert (N+1 per course) | ParticipantAnalytics, Course (nested) | AggregatedAnalytics |
| 2 | Weekday activity heatmap | Single pass × all courses | pandas | Course, Participation, QuestionResponse | AggregatedCourseAnalytics |
| 3 | Instance/activity error rates | Single pass × N courses × M activities | pandas (N+1 per activity) | PracticeQuiz, MicroLearning, QuestionResponse | InstancePerformance, ActivityPerformance |
| 4 | Participant performance (quantiles) | Single pass × all courses | pandas | QuestionResponse | ParticipantPerformance |
| 5 | Active-weeks, active-days-per-week | Single pass × all courses | pandas | QuestionResponse, Participation | ParticipantCourseAnalytics |
| 6 | Activity completion/started/repeat | Single pass × N courses × M activities | pandas | PracticeQuiz, MicroLearning, QuestionResponse | ActivityProgress |
| 7 | Participant × activity score | Single pass × all courses | pandas | QuestionResponse, PracticeQuiz, MicroLearning | ParticipantActivityPerformance |
| 8 | Participant chat rollup | DAILY/WEEKLY/MONTHLY/COURSE | Raw SQL + execute_raw | ChatMessage, ChatThread | ParticipantChatAnalytics |
| 9 | Chatbot adoption rollup | DAILY/WEEKLY/MONTHLY/COURSE | Raw SQL (weekly has its own file) | ChatMessage | AggregatedChatbotAnalytics |
| 10 | Topic clustering per chatbot | Single pass × all chatbots (COURSE only) | sentence-transformers + UMAP + HDBSCAN | ChatMessage | ChatTopicCluster |
| 11 | Chat × quiz correlation | Single pass (no windowing) | Raw SQL | ParticipantChatAnalytics, ParticipantPerformance | ParticipantChatOutcome, ParticipantCourseAnalytics |
| 13 | Platform semester totals | Single pass | Raw SQL | ChatMessage, QuestionResponse, LiveQuizResponse | PlatformSemesterAnalytics, AggregatedCourseAnalytics |
| 14 | Live quiz assessment stats | Single pass × all courses | Raw SQL | LiveQuizResponse, LiveQuiz | ParticipantLiveQuizAnalytics, AggregatedLiveQuizAnalytics |
| 99 | Flip validity flags | Single pass | Raw SQL | ParticipantAnalytics, ParticipantChatAnalytics | Course |

### 2.2 Dependency Graph

Only four real intra-pipeline reads exist:

- Script 1 reads `ParticipantAnalytics` written by script 0.
- Script 11 reads `ParticipantChatAnalytics` (script 8) and `ParticipantPerformance` (script 4).
- Script 99 reads `ParticipantAnalytics` (script 0) and `ParticipantChatAnalytics` (script 8).
- Script 13 reads `AggregatedCourseAnalytics` (script 2) implicitly through its updates.

Everything else reads raw event tables. This means **scripts 2, 3, 4, 5, 6, 7, 10, 14 are fully independent** of each other and could run in parallel. Only 0→1, {4, 8}→11, and {0, 8}→99 are real sequencing constraints.

### 2.3 Hatchet Wiring Today

The handler in `packages/graphql/src/services/analyticsRecompute.ts:161-183` runs a hardcoded list of 15 module names in a serial `for…of` loop, spawning `uv run python -m <module>` per step. The entire pipeline is one Hatchet task with `retries: 0` (tasks.ts line 292), no `concurrencyGroup`, no per-step timeout inside Hatchet (only a Node-side 1-hour setTimeout), and therefore no visibility beyond "the 15-step blob ran or it didn't." The scanner task (`scan-ended-courses`, tasks.ts 311–352) fan-outs `course-ended` events in parallel, so the event flow is already in place to support per-course parallelism — but the handler collapses it back into a single sequential run.

### 2.4 Schema Coverage

Every analytics table has a unique or composite unique constraint matching its natural key. Beyond that, only a handful have additional `@@index` declarations (Competency nested-set indexes, three chat tables, live quiz tables). No materialized views, no generated columns, no partitioning, no BRIN indexes on `createdAt`. The QuestionResponse / QuestionResponseDetail / ChatMessage event tables are plain heaps with no covering index that matches the analytics access patterns (per-course × date-range scans).

---

## 3. Problems Ranked by Impact

### P1 — Parallelism is not exploited at any level

Scripts 2, 3, 4, 5, 6, 7, 10, 14 could all run concurrently. Within script 3, 6, 7 the per-course loop could fan out. Within scripts 0, 1, 8, 9 the per-window loop could fan out. Today everything runs serially. Even on incremental mode with a 14-day window, the walltime floor is set by the slowest single script rather than by the critical path through the dependency graph. A full-history backfill takes 30–90 minutes and keeps one worker pinned.

### P2 — Scripts 0–7 use pandas for work that belongs in SQL

Scripts 0–7 pull rows into DataFrames and iterate with `.iterrows()` or group-apply. For pure aggregation work — counts, sums, quantile percentile bands, per-weekday bucketing — this is 10–100× slower than a single SQL query with `GROUP BY` and window functions, and pays network round-trip cost for every row. Scripts 8, 9, 11, 13, 14 demonstrate the right pattern: one `db.execute_raw()` call with all aggregation inside Postgres. The inconsistency exists because the SQL-heavy scripts (8, 9, 11, 13, 14) were added more recently while scripts 0–7 predate the shift.

### P3 — No concurrency group on the recompute task

If the weekly cron (02:00 UTC Monday) overlaps with a `course-ended` finalize event or an admin manual trigger, two subprocess pipelines run against the same database simultaneously. Prisma upserts serialize at the DB level so there is no corruption, but both runs take full time and do redundant work. A `concurrencyGroup: { key: "input.courseId ?? 'global'", maxRuns: 1, strategy: GROUP_ROUND_ROBIN }` would collapse duplicates naturally.

### P4 — 1-hour timeout is per script, not per course

Today's timeout is "each of the 15 scripts gets 1 hour." That means a pathological full pipeline can run for 15 hours without Hatchet noticing anything is wrong, because Hatchet only sees the outer task. An individual script is unlikely to hit the 1-hour ceiling except under a DB outage, at which point a 1-hour retry window is already too slow. The right shape is a per-step Hatchet timeout with retry, not a Node-level setTimeout.

### P5 — Missing indexes on hot event tables

The analytics pipeline queries `QuestionResponse`, `QuestionResponseDetail`, `ChatMessage`, and `LiveQuizResponse` through different access paths. Course-window tables benefit from composite keys; append-mostly date scans benefit from BRIN; script 14 reaches responses through `ElementInstance` and orders by `submittedAt`. Indexes must match those concrete predicates and joins rather than applying one `(courseId, createdAt)` shape everywhere.

### P6 — No incremental path for topic clustering (script 10)

Script 10 recomputes TF-IDF + UMAP + HDBSCAN from scratch for every chatbot on every run. Embedding and clustering tens of thousands of chat messages from scratch per weekly cron burns CPU disproportionate to the information gain — weekly topic shifts are small. The incremental-mode spec correctly called this out and deferred it.

### P7 — No materialized views / rollup views

Several queries in the pipeline could be expressed as views or materialized views and reused across scripts. For instance, "responses per course per day" is computed independently in scripts 0, 1, 5, and implicit in 7. A single `course_daily_response_rollup` view or matview would eliminate the redundancy.

### P8 — Python pipeline has no Hatchet SDK integration

All orchestration lives in Node; Python scripts are blind subprocesses. If Python had a Hatchet worker, each script could be its own task natively, with Python-side observability and retries. This is a bigger refactor than P1–P5 combined and is justified only once the DAG decomposition in P1 has proven its value.

### P9 — Idempotency is partially broken

`save_participant_analytics.py` upserts with `update: {}` for DAILY/WEEKLY/MONTHLY rows, so stale daily rows are *not* refreshed on re-run. If a day's data arrives late (e.g. a late-submitting participant), the already-written DAILY row keeps its stale values forever. COURSE rows update correctly. This is a bug masquerading as an optimization and should be fixed.

### P10 — Partition readiness

Event tables (`QuestionResponse`, `QuestionResponseDetail`, `ChatMessage`, `LiveQuizResponse`) will grow monotonically. At current scale (millions of rows) they do not need partitioning yet, but the migration is easier to do while still small. Deferring beyond 50M rows increases the migration cost to a full dual-write + backfill rollout.

---

## 4. Recommendations

### R1 — Convert scripts 0–7 to raw SQL with UPSERT

**Impact:** very high. **Risk:** moderate — requires rewriting the busiest 7 scripts. **Effort:** 4–6 dev-days.

Each pandas-driven script replaces its `.iterrows()` loop with a single parameterized SQL statement of shape `INSERT INTO <rollup> SELECT … FROM <events> GROUP BY … ON CONFLICT (unique_key) DO UPDATE SET …`. The `EXCLUDED` pseudo-table carries proposed values, so the UPDATE clause can either overwrite (`SET count = EXCLUDED.count`) for full replacement or accumulate (`SET count = rollup.count + EXCLUDED.count`) for additive semantics. Postgres `INSERT … ON CONFLICT` is deterministic and atomic under concurrency. This fixes P2 and P9 in the same stroke: re-running a DAILY window overwrites the stale row rather than silently keeping it.

This work should happen one script at a time behind a feature flag / env switch so the pandas version remains the fallback while each SQL rewrite is validated against real data. The SQL files live alongside the module, matching the pattern already used by modules 8, 9, 11, 13, 14. A lightweight verification step compares row-by-row output of the old pandas path vs the new SQL path on the seeded fixture dataset (see `packages/prisma-data/src/data/interactions/`) before the SQL version replaces the pandas one.

Order of conversion (easiest first): 5 (single GROUP BY), 2 (single GROUP BY with date_trunc on weekday), 4 (percentile_cont window function), 7 (join), 3 (nested GROUP BY), 6 (window functions), 1 (the hardest — aggregates an already-aggregated table with COURSE nesting), 0 (per-participant rollup over event + detail tables).

### R2 — Decompose the pipeline into a Hatchet DAG

**Impact:** very high. **Risk:** low — Hatchet already supports multi-task workflows, we just aren't using them. **Effort:** 2–3 dev-days.

Replace the single `recompute-learning-analytics` task with a Hatchet workflow containing one task per script. Declare dependencies that match the real dependency graph from §2.2:

| Task | Depends on |
|---|---|
| 0_participant | — |
| 2_course_heatmap | — |
| 3_instance_activity | — |
| 4_participant_perf | — |
| 5_course_active_weeks | — |
| 6_activity_progress | — |
| 7_participant_activity | — |
| 8_chat | — |
| 9_chatbot | — |
| 10_clustering | — |
| 13_platform | — |
| 14_live_quiz | — |
| 1_aggregated | 0_participant |
| 11_chat_quiz | 4_participant_perf, 8_chat |
| 99_validity | 0_participant, 8_chat, 1_aggregated, 11_chat_quiz |

Twelve of fifteen tasks fan out in parallel at the top of the DAG. Each task is its own subprocess spawn so per-script failures are visible and retryable independently. Hatchet's durable execution means a mid-pipeline failure retries from the failed step, not from the start. This fixes P1, P3, P4 in one go.

Concurrency group on the workflow level: `key: input.courseId ?? 'global'`, `maxRuns: 1`, strategy `GROUP_ROUND_ROBIN` for the global weekly run and `CANCEL_IN_PROGRESS` for per-course finalize events (a newer finalize supersedes an older one — freshness-first).

Per-task retries: `retries: 2` is appropriate for SQL-only tasks (transient DB issues); keep `retries: 0` for script 10 (clustering is expensive and usually deterministically fails if it fails).

### R3 — Fan out per-course child tasks inside the heavy scripts

**Impact:** moderate. **Risk:** low. **Effort:** 1–2 dev-days per script.

For scripts 3, 6, 7 — which today loop per course in Python — emit one child task per course via `ctx.bulkRunChildren([])` and run the per-course SQL in parallel across workers. This is only worth it once R1 has moved the scripts to raw SQL; Python pandas per-course work is too short-lived to amortize Hatchet task overhead (~10–50ms scheduling latency per task).

Concurrency group per child: `key: input.courseId`, `maxRuns: 1`. This is the same primitive as R2's workflow-level group — the only difference is the scope.

### R4 — Add covering indexes on event tables

**Impact:** high for query latency. **Risk:** very low. **Effort:** half a day.

The following indexes should be added to `packages/prisma/src/prisma/schema/` and rolled out via migration:

| Table | Index | Rationale |
|---|---|---|
| QuestionResponse | `(courseId, createdAt)` | Scripts 0, 3, 4, 5, 6, 7 all filter by these two columns |
| QuestionResponseDetail | BRIN on `createdAt` | Script 0 pushes each window into SQL; append order makes BRIN effective at low storage cost |
| ChatMessage | `(threadId, createdAt)` | Scripts 8, 9, 10 |
| ChatMessage | existing B-tree on `createdAt` | The base branch already supplies the time index; a second BRIN index is intentionally omitted |
| LiveQuizResponse | `(instanceId, submittedAt)` | Script 14 reaches responses through `ElementInstance` and reads the first submission in time order |
| LiveQuizResponse | BRIN on `createdAt` | Append-mostly date scans in platform analytics |
| ParticipantAnalytics | `(courseId, type, timestamp)` | Script 1, 99 read participant rows per course-window |
| AggregatedAnalytics | `(courseId, type, timestamp)` | API reads by these three keys |

`EXPLAIN ANALYZE` on a 252k-row synthetic detail table showed that the originally proposed `(participantId, elementInstanceId, createdAt)` index still fetched every row because script 0 supplied every participant ID. Pushing the one-day predicate into SQL let the existing BRIN path complete in 0.44 ms, versus about 27 ms for the warm full-table path, so the unused composite is intentionally omitted.

The original live-quiz proposal named a `liveQuizId` column that does not exist on `LiveQuizResponse` and used `createdAt` despite the query ordering by `submittedAt`. On a 2.0M-row synthetic fixture, `(instanceId, submittedAt)` replaced a bitmap scan plus sort with an ordered index lookup (about 2 ms to 0.05 ms, excluding one-time JIT setup).

BRIN indexes are near-free in size and rebuild cost; they pay off as soon as the table grows past a few hundred thousand rows. Prisma does not model BRIN natively, so these are declared via migration SQL. Shared environments prebuild all hot-table indexes with the checked-in concurrent SQL script, outside Prisma's migration transaction; the retry-safe Prisma migrations then no-op.

### R5 — Fix the DAILY/WEEKLY/MONTHLY upsert-no-op bug

**Impact:** correctness. **Risk:** very low. **Effort:** 1 hour.

In `save_participant_analytics.py` and `save_aggregated_analytics.py`, the `update: {}` branch is wrong for anything that could have late-arriving data. Change DAILY/WEEKLY/MONTHLY upserts to populate the full update clause (same fields as create). Incremental mode already limits the blast radius to the last 14 days, so the risk of overwriting historical data accidentally is zero — only windows that incremental mode is already scanning get refreshed.

### R6 — Introduce rollup views for cross-script reuse

**Impact:** moderate. **Risk:** low. **Effort:** 1–2 dev-days.

Candidates for materialized views (refreshed once at the start of every pipeline run):

| View | Source | Consumers |
|---|---|---|
| `course_daily_response_rollup_mv` | QuestionResponse × QuestionResponseDetail grouped by (courseId, date) | Scripts 0, 1, 5 |
| `chatbot_daily_message_rollup_mv` | ChatMessage grouped by (chatbotId, date) | Scripts 8, 9 |
| `course_participant_activity_mv` | QuestionResponse grouped by (courseId, participantId, activityId) | Scripts 3, 6, 7 |

Refresh with `REFRESH MATERIALIZED VIEW CONCURRENTLY`. The `CONCURRENTLY` variant requires a unique index on the view and avoids read locks, at the cost of still scanning the full source table. At today's scale this is acceptable; if the events tables outgrow the refresh budget, swap to pg_ivm (see R10) or to a hand-maintained rollup table.

Views vs matviews: prefer **views** (no storage, always fresh) for rollups consumed by one script and read once per run. Prefer **matviews** (stored, explicit refresh) for rollups consumed by three or more scripts in the same run.

### R7 — Semi-periodic incremental topic clustering

**Impact:** high for CPU savings on large chatbots. **Risk:** moderate — changes cluster stability. **Effort:** 3–4 dev-days.

Replace script 10's "recluster from scratch weekly" with BERTopic's `.merge_models()` pattern: on each run, train a fresh BERTopic on the last 14 days' messages, then merge into the prior run's persisted model using c-TF-IDF cosine similarity (threshold ~0.7) to deduplicate and grow the topic space. This preserves the full UMAP + HDBSCAN quality on each batch and avoids the major quality regression of the `.partial_fit()` path (which requires IncrementalPCA + MiniBatchKMeans).

Semester boundaries trigger a full recluster. Persist the serialized BERTopic model to object storage or to a new `ChatbotTopicModel` table with a blob column and a `semesterLabel` key.

Defer this until after R1 + R2 ship — it is the highest-risk change in the list and only worth doing if clustering CPU becomes measurable in the overall pipeline budget.

### R8 — Add a Python Hatchet worker (optional, deferred)

**Impact:** moderate — unlocks native per-script observability. **Risk:** moderate — new deployment artifact. **Effort:** 3–5 dev-days.

Once R2 has decomposed the pipeline into Node-side child tasks, the next logical step is to let each Python script be its own Hatchet task picked up by a Python worker. This removes the Node shim, gives Python-side retries, and allows richer input/output payloads than environment variables. The deployment cost is real — a new Kubernetes deployment, new secret wiring, new worker image.

Defer this until R1 + R2 have been in production for a quarter. If the Node shim proves limiting, revisit.

### R9 — Partition QuestionResponseDetail and ChatMessage (when ready)

**Impact:** high once the tables grow past ~10M rows. **Risk:** high — requires schema migration + dual-write + backfill. **Effort:** 5–8 dev-days.

Monthly `PARTITION BY RANGE (createdAt)` on QuestionResponseDetail and ChatMessage. The primary key must include `createdAt` (Postgres requirement for partitioned tables), which forces a Prisma schema change and a migration through `migrations/*.sql`. Use `pg_partman` for automatic future-partition creation.

Not needed yet. At current data volumes a well-chosen `(courseId, createdAt)` composite index + BRIN on `createdAt` delivers 90% of the partition benefit without the schema churn. Reassess when QuestionResponseDetail crosses 50M rows.

### R10 — pg_ivm for one or two very-slow aggregates (optional)

**Impact:** low-to-moderate. **Risk:** moderate — new extension dependency. **Effort:** 2–3 dev-days.

pg_ivm (Incremental View Maintenance) uses AFTER triggers to incrementally update an IMMV as base rows change, so refresh cost scales with the delta, not the total table size. Subset of SQL supported (inner joins, built-in aggregates only, no window functions, no OUTER JOIN). For the handful of rollups that are pure `COUNT/SUM/AVG/MIN/MAX GROUP BY` over a single table, pg_ivm collapses refresh from O(table) to O(delta).

Tradeoffs: write overhead on every INSERT/UPDATE/DELETE on the base table (trigger-based, synchronous); the extension must be available on the managed Postgres (check with DigitalOcean / Azure / self-hosted provider); and the SQL subset rules out most of the analytics queries in this codebase (which use window functions and joins).

Not a default recommendation. Only worth pursuing if a specific rollup proves too slow even after R1–R6.

### R11 — Do not introduce dbt-core or TimescaleDB

**Verdict:** both declined at this scale.

**dbt-core** would give us SQL model lineage, `dbt test` for data quality, and built-in incremental materializations that implement the same UPSERT pattern R1 proposes manually. But dbt cannot orchestrate Python ML steps (scripts 10's embedding + clustering), cannot emit or listen to Hatchet events, and cannot express per-course concurrency. Adopting dbt forces a two-orchestrator split (dbt for SQL, Hatchet for Python), which is more complexity than the current single-orchestrator model. Reasonable to revisit if the SQL transformation layer doubles in size.

**TimescaleDB** would give us chunk-aware continuous aggregates for time-bucketed rollups, plus compression and retention policies. Every continuous aggregate needs a `time_bucket()` on a hypertable column — it works well for time-series but not for per-participant or per-element rollups, which are most of what this pipeline produces. Adding TimescaleDB to an existing managed Postgres stack is a non-trivial dependency, and the feature overlap with R6's materialized views is high. Decline for now.

---

## 5. Proposed Roadmap

### Phase A — Low-risk compounding wins (2–3 weeks)

| Step | Deliverable | Verifies |
|---|---|---|
| A1 | R4 — covering indexes + BRIN on event tables | Query latency drops observable in EXPLAIN ANALYZE |
| A2 | R5 — fix DAILY/WEEKLY/MONTHLY upsert-no-op bug | Late-arriving data correctly updates rollup rows |
| A3 | R2 — decompose into Hatchet DAG with concurrency group + per-task retries | Per-script visibility in Hatchet UI; concurrent triggers collapse |
| A4 | R1 applied to scripts 5, 2, 4 (the three easiest conversions) | Pipeline walltime drops ≥30% on full-history run; output matches pandas baseline on seeded fixture |

Phase A is strictly additive: each step can ship independently and leaves the pipeline in a working state.

### Phase B — Raw SQL conversion + view layer (3–4 weeks)

| Step | Deliverable |
|---|---|
| B1 | R1 applied to scripts 7, 3, 6 |
| B2 | R1 applied to scripts 1, 0 (hardest last) |
| B3 | R6 — materialized views for the three cross-script rollups; refreshed at pipeline start |
| B4 | R3 — per-course fan-out in scripts 3, 6, 7 (only after R1 SQL conversion) |

### Phase C — Deferred optional work

| Step | Deliverable | Trigger |
|---|---|---|
| C1 | R7 — incremental topic clustering with `.merge_models()` | If script 10 CPU becomes >20% of total pipeline time |
| C2 | R8 — Python Hatchet worker | If Node shim proves limiting after a quarter in production |
| C3 | R9 — partition event tables | When QuestionResponseDetail > 50M rows |
| C4 | R10 — pg_ivm on specific hot rollup | Only if a specific view proves too slow after R6 |

### Expected cumulative impact

| Metric | Today (post-incremental) | After Phase A | After Phase B |
|---|---|---|---|
| Full-history pipeline walltime | 30–90 min | 15–40 min | 5–15 min |
| Incremental weekly walltime | 5–15 min | 3–8 min | 1–4 min |
| Per-course finalize walltime | 2–5 min | 1–2 min | 20–40 sec |
| Pipeline steps visible in Hatchet UI | 1 | 15 | 15 + per-course fan-out |
| Maximum parallel tasks during a run | 1 | 12 | 12 + N courses |
| Per-script retry granularity | no | yes | yes |
| Concurrent trigger protection | no | yes | yes |

Numbers are rough order-of-magnitude estimates based on the research findings (pandas → SQL 10–100× speedup for aggregation work; Hatchet task scheduling overhead ~10–50ms) and will vary with dataset size and DB instance specs.

---

## 6. Open Questions / Needs Input

1. **Are we OK adding BRIN indexes?** They are standard Postgres functionality (not an extension) but are declared via raw migration SQL rather than Prisma schema. Confirms Prisma's migration workflow accepts this.
2. **Is the Python Hatchet SDK an acceptable new dependency?** Affects R8 viability. If no, R2 stays at the Node-shim level permanently (still a win, just not as clean as native Python tasks).
3. **pg_ivm availability on the managed Postgres target.** Needs confirmation with the deployment team before R10 is considered. On self-hosted it's trivial; on hosted it may not be available.
4. **Retention policy for rollup tables.** At current growth rate, rollup tables will accumulate indefinitely — should DAILY rows beyond N months be purged? Affects index strategy. Current behavior is keep-everything, which is fine at present scale but worth defining explicitly before it becomes a problem.
5. **Semester boundary detection for R7.** Script 10's full-recluster trigger needs to know what a semester boundary is. Today's `PlatformSemesterAnalytics` table already tracks semesterLabel; reusing that is the natural approach.

---

## 7. References

Per-topic research links (filed for future reference; not load-bearing on the recommendations above):

- Postgres `INSERT … ON CONFLICT DO UPDATE` semantics — [Postgres docs](https://www.postgresql.org/docs/current/sql-insert.html)
- pg_ivm extension — [pg_ivm 1.12 release notes](https://www.postgresql.org/about/news/pg_ivm-112-released-3131/)
- TimescaleDB continuous aggregates — [maddevs benchmark](https://goldlapel.com/blog/timescaledb-vs-materialized-views)
- Hatchet DAGs + durable execution — [Hatchet docs: DAGs](https://docs.hatchet.run/v1/directed-acyclic-graphs)
- Hatchet child spawning + bulk-run — [Hatchet docs: child spawning](https://docs.hatchet.run/v1/child-spawning)
- Hatchet concurrency controls — [Hatchet docs: concurrency](https://docs.hatchet.run/v1/concurrency)
- Postgres partitioning at scale — [Red Gate article](https://www.red-gate.com/simple-talk/databases/postgresql/postgresql-partitioning-the-most-useful-feature-you-may-never-have-used/)
- BERTopic incremental / merge — [BERTopic online docs](https://maartengr.github.io/BERTopic/getting_started/online/online.html), [MergeBERT paper (arXiv 2025)](https://arxiv.org/html/2504.07711v1)
- dbt incremental models — [dbt docs](https://docs.getdbt.com/docs/build/incremental-models)

---

## Addendum — SQLAlchemy migration (2026-04-20)

`prisma-client-py` was archived upstream on 2025-04-15 and has received no
releases since. The analytics app now runs on **SQLAlchemy 2.x + psycopg3**
(sync); the previous per-row `db.<model>.upsert(...)` loops become single
`INSERT ... ON CONFLICT DO UPDATE` statements via the shared `bulk_upsert`
helper in `apps/analytics/src/db_helpers.py`.

This supersedes the "unify on raw SQL with UPSERT" recommendation in §5.1 —
the pandas scripts (0–7) now use the ORM for reads and `bulk_upsert` for
writes instead of being rewritten as raw SQL. The `.sql` files for scripts
8/9/11/13/14 are unchanged and still wrapped with `session.execute(text(...))`.

Model definitions live in `apps/analytics/src/models.py` and are regenerated
from the live dev DB via `sqlacodegen`:

```bash
pnpm run prisma:setup
pnpm --filter @klicker-uzh/analytics run generate
```

Drop-out cleanup (the "A4 discussion" item) now lives inline in the
`save_participant_course_analytics`, `save_participant_performance`, and
`save_participant_activity_performance` modules — they `DELETE` stale
`(course, participant)` pairs before the bulk upsert, wrapped in the same
session transaction so an interruption leaves the table at its pre-run state.

---

## Addendum — Phase B.0 landed (2026-04-20)

Hardened the Hatchet DAG and added the minimum GraphQL surface the manage
UI needs to trigger and inspect analytics runs:

- **Real retries.** `handleRunAnalyticsScript` throws on failure; the DAG fn
  returns `void`. `taskDefaults.retries: 2` now actually fires. Leaves that
  fail (which previously returned `{success: false}` and were seen as
  successes by Hatchet) correctly gate downstream tasks.
- **Full fan-in to `s99`.** Every one of the 15 analytics tasks is now a
  parent of `s99-mark-analytics-valid`. "Analytics valid" means "every
  script ran" — a partial run never flips the flag.
- **Single `ANALYTICS_SCRIPTS` home.** Moved to `packages/types/src/hatchet.ts`;
  the GraphQL handler and the Hatchet workflow both import from there.
- **Full-mode guard.** Handler rejects `mode=full` unless the worker has
  `ANALYTICS_ALLOW_FULL=1`. `adminRecomputeAnalytics` now dispatches with an
  explicit mode — no silent default to `full`.
- **Watchdog timeout.** Node-side `DEFAULT_SCRIPT_TIMEOUT_MS` is 65 min,
  strictly greater than any Hatchet per-task `executionTimeout`. The Hatchet
  fence fires first on normal timeouts; the Node watchdog only fires on
  total Hatchet silence.
- **Scanner day-bucket marker.** `scan-ended-courses` emits each
  `courseEnded` event with `additionalMetadata.idempotencyKey` =
  `finalize-<courseId>-<YYYY-MM-DD>`, so a retry inside the same UTC day is
  identifiable in the Hatchet dashboard (the workflow's `CANCEL_IN_PROGRESS`
  concurrency still handles the in-flight case).
- **Structured telemetry.** New `apps/analytics/src/log.py` emits
  `{phase, script, mode, scope_size, window_since, elapsed_s, rows_written}`
  JSON lines to stdout at entry and exit of every script. No new SDK — the
  Hatchet worker captures stdout verbatim.
- **GraphQL surface.** New `recomputeCourseAnalytics(courseId, mode)`
  mutation (ADMIN on course) and `Course.analyticsStatus` object field
  exposing `areAnalyticsValid / analyticsLastComputedAt /
  analyticsFinalizedAt / chatAnalyticsValidAt`. The manage UI can wire a
  button + refetch — no subscription this iteration.

**Still open:**

- Phase B.1 — convert scripts 3, 6, 7 to raw SQL.
- Phase B.2 — SQL conversion of scripts 0, 1.
- Phase B.3 — materialized views for cross-script rollups.
- Phase B.4 — per-course child workflow fan-out.
- Phase C — pg_ivm, partitioning, incremental topic clustering, Python
  Hatchet SDK worker.
- OTel / Langfuse / Sentry exporters — structured stdout is the interim
  observability surface; external exporters are a separate decision.
