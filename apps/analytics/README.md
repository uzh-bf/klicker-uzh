# KlickerUZH Analytics

This service computes learning analytics for KlickerUZH, providing insights into student learning patterns and performance metrics.

## Requirements

- Python 3.12.x (e.g., installed through `asdf`)
- Node.js 24.x.x
- [uv](https://docs.astral.sh/uv/) for Python dependency management

## Setup

- The project uses uv for dependency management. Run `uv sync` in this folder to create the virtual environment and install deps.
- The project uses PNPM to simplify the execution of scripts and to provide a watch mode for execution. Make sure that you have executed `pnpm install` in the repository before trying to run the commands below.
- Make sure that all `.prisma` files are available in `prisma/`. If this is not the case, run the `util/sync-schema.sh` script first. The mirror is for schema review; the analytics runtime uses SQLAlchemy models generated from a live development database.
- Make sure that a valid Python environment is used (3.12). If needed, set the Python binary explicitly with `uv python pin 3.12` before running `uv sync`.

## Available Commands

The following commands are available through PNPM:

- `pnpm generate` - Regenerate the SQLAlchemy models from the live development database
- `pnpm main` - Run the analytics service
- `pnpm analytics:dev` - Start the service in watch mode for development

## Pipeline scripts

The `src/scripts/` directory contains numbered scripts that form the analytics pipeline. Run them in order via `./_initialize_analytics.sh <target>` (target = `dev` | `qa` | `prd`; defaults to `dev`).

For per-table column-level documentation (purpose, grain, source data, computed columns) see [`ANALYTICS.md`](./ANALYTICS.md).

| #   | Script                                    | Writes to                                                                           |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| 0   | `0_initial_participant_analytics`         | `ParticipantAnalytics`                                                              |
| 1   | `1_initial_aggregated_analytics`          | `AggregatedAnalytics`                                                               |
| 2   | `2_initial_aggregated_course_analytics`   | `AggregatedCourseAnalytics`                                                         |
| 3   | `3_initial_instance_activity_performance` | `InstancePerformance`, `ActivityPerformance`                                        |
| 4   | `4_initial_participant_performance`       | `ParticipantPerformance`                                                            |
| 5   | `5_initial_participant_course_analytics`  | `ParticipantCourseAnalytics`                                                        |
| 6   | `6_initial_activity_progress`             | `ActivityProgress`                                                                  |
| 7   | `7_participant_activity_performance`      | `ParticipantActivityPerformance`                                                    |
| 8   | `8_initial_chat_analytics`                | `ParticipantChatAnalytics`                                                          |
| 9   | `9_initial_aggregated_chatbot_analytics`  | `AggregatedChatbotAnalytics`                                                        |
| 10  | `10_chat_topic_clustering`                | `ChatTopicCluster` (NLP-only, no LLM)                                               |
| 11  | `11_chat_quiz_correlation`                | `ParticipantChatOutcome` + `ParticipantCourseAnalytics.hasChatActivity`             |
| 13  | `13_platform_semester_analytics`          | `PlatformSemesterAnalytics` + `AggregatedCourseAnalytics` modality footprint        |
| 14  | `14_live_quiz_assessment_analytics`       | `Participant/AggregatedLiveQuizAnalytics` (assessment-mode only)                    |
| 99  | `99_mark_analytics_valid`                 | Flips `Course.areAnalyticsValid`, `analyticsLastComputedAt`, `chatAnalyticsValidAt` |

Script 12 (`CompetencyAnalytics` gap fill) is intentionally not present — the current schema has no `Element ↔ Competency` linkage, so there is nothing to aggregate. Adding it is an upstream schema decision.

## Dry-run inspection

The dry-run harness runs the full pipeline against a live Postgres database, captures every row each script would write, and emits the result as an `.xlsx` workbook — without persisting anything. Useful for inspecting prod outputs without touching prod data, or for sanity-checking an in-progress compute change.

```bash
pnpm --filter @klicker-uzh/analytics run dryrun:dev  -- --course-id <uuid>
pnpm --filter @klicker-uzh/analytics run dryrun:qa   -- --course-id <uuid>
pnpm --filter @klicker-uzh/analytics run dryrun:prod -- --course-id <uuid>
```

### Safety model

Four defences must all hold before a stray write can land in prod:

1. **Read-only Postgres role.** `DATABASE_URL_RO` (preferred) or `DATABASE_URL` for `dryrun:prod` / `dryrun:qa` must resolve to a role with SELECT-only grants (no INSERT/UPDATE/DELETE on any table). When `DATABASE_URL_RO` is set, the runner promotes it to `DATABASE_URL` at startup — so the RW connection string can coexist in the same Infisical env without leaking into the dry-run. This is the authoritative block — a write that slips past everything else is rejected by Postgres itself with `ERROR: permission denied for table "X"`.
2. **`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`**, attached to the SQLAlchemy engine as a `connect` listener so every new connection the pipeline opens is read-only from the first statement.
3. **Python interceptors.** `src/dryrun/interceptor.py` monkey-patches `db_helpers.bulk_upsert`, `Session.execute`, `Session.commit`, and `Session.flush`. `bulk_upsert` never reaches the DB — its rows are captured in memory. `Session.execute` rewrites `INSERT INTO <t> (<cols>) … ON CONFLICT …` to a bare `SELECT` (or `VALUES (…)`) that runs against the DB and yields the rows the INSERT would have written; `UPDATE` / `DELETE` are logged to a `_skipped_writes` sheet rather than executed.
4. **Infisical-injected env.** The pnpm scripts wrap `_run_with_infisical.sh --env <env>`, so `DATABASE_URL` arrives from the Infisical environment matching the target — no `.env` files, no ambient credentials.

Before running any script, the harness issues `SELECT has_table_privilege(current_user, '"Course"', 'INSERT')` and aborts if the role can write to `Course`. Use `--unsafe-allow-rw-role` to disable the probe for local dev runs against the seeded dev DB.

### Schema drift handling

Running against an environment whose migrations lag behind the current branch is a normal case (e.g. prd dryrun from a feature branch). The runner:

1. Probes `pg_tables` at startup for every analytics table introduced on recent branches (see `_SCRIPT_REQUIRED_TABLES` in `src/dryrun/runner.py`) and logs which are absent.
2. **Pre-skips** scripts whose required tables are missing — they never run, and the `_summary` sheet records `skipped: tables missing (…)`.
3. At runtime, any `UndefinedTable` / `UndefinedColumn` surfacing from a script (column-level drift we didn't model) is caught and converted to `skipped: …` instead of a hard failure. The rest of the pipeline continues.

Scope (`ANALYTICS_COURSE_IDS`) and window floor (`ANALYTICS_WINDOW_SINCE`, auto-set from the course's `startDate`) are applied before the first script runs — the pipeline doesn't iterate daily windows that pre-date the course.

### Known limitations

- The in-memory buffer feeds captured writes into the downstream readers used by scripts 1, 2, 5, and 11. Course-scoped dry runs omit platform-wide script 13 and validity-marker script 99.
- A buffered table replaces that reader's database result; it is not unioned with rows already present in the database. Incremental-window dry runs can therefore under-report downstream aggregates that need both historical rows and rows captured in the current run.

The workbook is a read-only inspection aid, not proof of exact downstream parity for those cases. Use a seeded writable database for end-to-end row comparisons.

### Creating the read-only role (one-time, per env)

Run as a DB admin (Azure: a user with `azure_pg_admin`):

```sql
CREATE ROLE klicker_readonly LOGIN PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE "<db-name>" TO klicker_readonly;
GRANT USAGE ON SCHEMA public TO klicker_readonly;
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO klicker_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO klicker_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES    TO klicker_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO klicker_readonly;
```

Then store the resulting connection string in Infisical as `DATABASE_URL_RO` in the `prd` (and/or `stg`) env — alongside the existing RW `DATABASE_URL`. The runner picks up `DATABASE_URL_RO` automatically.

### Output layout

| Sheet             | Contents                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `_metadata`       | `course_id`, `run_at`, `db_host`, `db_role`, `git_sha`, counts                           |
| `_summary`        | One row per script: `script`, `elapsed_s`, `rows_written`, `error`                       |
| `<TableName>`     | Rows captured for each write target (e.g. `ParticipantAnalytics`, `AggregatedAnalytics`) |
| `_skipped_writes` | Any `UPDATE` / `DELETE` statements the harness refused to execute (only when non-empty)  |

Sheet names are truncated to Excel's 31-character limit; collisions get `_1`, `_2`, … suffixes.

### CLI options

- `--course-id <uuid>` (required) — scopes the run via `ANALYTICS_COURSE_IDS`; `ANALYTICS_MODE=incremental` is forced.
- `--output <path>` — override the default `./analytics-dryrun-<courseId>-<YYYY-MM-DD>.xlsx`.
- `--scripts <csv>` — optional whitelist, e.g. `src.scripts.0_initial_participant_analytics,src.scripts.1_initial_aggregated_analytics`. Use for faster iteration on a specific stage.
- `--unsafe-allow-rw-role` — skip the read-only role probe. Local dev DBs only.

## Running from Hatchet

The pipeline is wired into Hatchet as native Python workflows defined in `src/hatchet_worker.py`. It fires:

- On cron: `0 2 * * 1` — Mondays at 02:00 UTC.
- On event: `course-ended` — emitted by the `scan-ended-courses` task (daily at 01:00 UTC) for courses whose `endDate` is more than `ANALYTICS_FINALIZE_GRACE_DAYS` (default 7) in the past and haven't been finalised yet.
- On event: `admin-recompute-analytics` — triggered by the `recomputeCourseAnalytics(courseId, mode)` GraphQL mutation (ADMIN on the course) for incremental and finalize runs.
- On event: `admin-recompute-analytics-full` — triggered by the same mutation for guarded full rebuilds.

The native worker entry point is `uv run python -m src.hatchet_worker` from this directory. It pins `hatchet-sdk[v0-sdk]==1.18.1`, uses the SDK-standard `HATCHET_CLIENT_*` environment variables, and starts with one worker slot.

The deployment image pins its Python and uv bases by digest and bundles the
pinned `intfloat/multilingual-e5-base` revision
`d128750597153bb5987e10b1c3493a34e5a4502a` for offline script-10 execution.
The bundle retains the upstream model card as `UPSTREAM_MODEL_CARD.md`; that
card declares the model's MIT license and contains its citation. Local runs
without the bundle download only the same immutable model revision.

It registers the non-mutating `learning-analytics-native-proof` task plus two copies of the 15-task analytics DAG:

- `recompute-learning-analytics` handles cron, incremental, and finalize runs. A newer run in the same course/global scope cancels the older run.
- `recompute-learning-analytics-full` handles only guarded full rebuilds. A running full rebuild is protected and a newer full request is canceled.

Both DAGs call the existing Python script entry points in-process with immutable per-run configuration and cooperative cancellation. `ANALYTICS_ALLOW_FULL=1` is required for the full DAG and remains unset by default. TypeScript retains only the GraphQL/manual event producers and the `scan-ended-courses` task. It does not register an analytics DAG or spawn Python.

Incremental chat stages keep the normal 14-day window for unaffected courses.
If current disclaimer consent changed, they purge now-ineligible participant
rows across retained history and rebuild only the affected courses from the
earliest affected message or aggregate window. The course chat watermark
is the durable handoff from the participant stage to its aggregate child,
preventing a completed aggregate task from swallowing a later consent cleanup.
The final marker uses Hatchet's immutable workflow-creation time, so consent
changes during a run remain visible to the next reconciliation.

Cutover and rollback are cold: stop the current owner before starting another worker image so exactly one analytics DAG consumes these events.

See the [Learning Analytics Operations](../../docs/learning-analytics-operations.md)
runbook for deployment prerequisites, triggers, status, retry, and rollback.

## Deploying analytics indexes

The analytics index migrations cover hot response/event tables:

- `20260420_analytics_covering_indexes`
- `20260723180000_analytics_live_quiz_submitted_at_index`

Prisma 6.16 applies migrations inside a transaction, while PostgreSQL requires `CREATE INDEX CONCURRENTLY` to run outside one. The repository deploy commands enforce the safe ordering:

```bash
pnpm --filter @klicker-uzh/prisma prisma:deploy:qa
pnpm --filter @klicker-uzh/prisma prisma:deploy:prod
```

`prisma:deploy:raw`, which those commands wrap, runs `scripts/prepareAnalyticsIndexes.mjs`. The wrapper acquires the repository migration advisory lock and holds it across the index prebuild, any migration baseline, and the normal Prisma deploy. On an initialized database it:

1. refuses partial analytics schemas, unfinished migrations, named invalid indexes, or a same-name index with the wrong table, access method, or ordered columns;
2. executes `create-analytics-indexes-concurrently.sql` one statement at a time outside a transaction;
3. validates that every index has the expected definition and is ready and valid;
4. baselines the unchanged historical `20260420_analytics_covering_indexes` migration if it is still pending; and
5. runs the remaining normal Prisma migration chain.

Only a database with none of the required analytics tables and no recorded migrations is treated as fresh. In that case the wrapper skips the prebuild and the normal migration chain creates the indexes while the tables are empty. An initialized or partially initialized database fails closed instead. Do not run bare `prisma migrate deploy` against an initialized shared environment because it bypasses this guard.

This follows [Prisma's PostgreSQL migration-safety guidance](https://www.prisma.io/docs/guides/integrations/pgfence), which recommends manually adding `CONCURRENTLY` and running that work outside a transaction.

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260420_analytics_covering_indexes',
  '20260723180000_analytics_live_quiz_submitted_at_index'
);
```

Run the deploy during a lower-traffic window. Concurrent builds preserve writes but still consume database I/O and CPU. Monitor active builds with:

```sql
SELECT relid::regclass AS table_name, index_relid::regclass AS index_name, phase,
       blocks_done, blocks_total
FROM pg_stat_progress_create_index;
```

If a prebuild is interrupted, the next deploy names the invalid index and stops. Inspect `pg_index.indisvalid`, drop only that exact index with `DROP INDEX CONCURRENTLY`, and rerun the repository deploy command. If Prisma itself records a failed migration, resolve that state explicitly before retrying; the wrapper refuses to guess.
