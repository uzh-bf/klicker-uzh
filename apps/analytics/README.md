# KlickerUZH Analytics

This service computes learning analytics for KlickerUZH, providing insights into student learning patterns and performance metrics.

## Requirements

- Python 3.12.x (e.g., installed through `asdf`)
- Node.js 24.x.x
- [uv](https://docs.astral.sh/uv/) for Python dependency management

## Setup

- The project uses uv for dependency management. Run `uv sync` in this folder to create the virtual environment and install dependencies.
- The project uses PNPM to simplify the execution of scripts and to provide a watch mode for execution. Make sure that you have executed `pnpm install` in the repository before trying to run the commands below.
- Make sure that all `.prisma` files are available in `prisma/`. If this is not the case, run the `util/sync-schema.sh` script first.
- `prisma/schema/py.prisma` enables `enable_experimental_decimal = "true"` for the Prisma Python generator; this is required for the `ChatUsageCredits` / `ChatMessage` / chat-analytics Decimal columns.

## Available Commands

The following commands are available through PNPM:

- `pnpm generate` - Generate the Prisma client for database access in Python
- `pnpm main` - Run the analytics service
- `pnpm analytics:dev` - Start the service in watch mode for development

## Pipeline scripts

The `src/scripts/` directory contains numbered scripts that form the analytics pipeline. Run them in order via `./_initialize_analytics.sh <target>` (target = `dev` | `qa` | `prd`; defaults to `dev`).

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

## Running from Hatchet

The pipeline is wired into Hatchet as the `recompute-learning-analytics` task (defined in `packages/hatchet/src/tasks.ts`). It fires:

- On cron: `0 2 * * 1` — Mondays at 02:00 UTC.
- On event: `course-ended` — emitted by the daily `scan-ended-courses` task after a course passes its configurable post-end grace period.
- On event: `admin-recompute-analytics` — dispatchable from the Hatchet dashboard today; an admin UI button is pending.

The handler lives in `packages/graphql/src/services/analyticsRecompute.ts` and shells out to this app's scripts one at a time via `child_process.spawn`. For it to work, the Hatchet worker running the handler must have access to:

- The `apps/analytics/` directory (scripts, modules, `pyproject.toml`, `uv.lock`).
- A `uv` binary in `PATH` (or a compatible runner configured via the env vars below).
- The same `DATABASE_URL` the analytics app expects.

Configure with these env vars (all registered in root `turbo.json`):

| Env var                 | Purpose                                                       | Default                            |
| ----------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `ANALYTICS_CWD`         | Absolute path to `apps/analytics` inside the worker container | required — handler aborts if unset |
| `ANALYTICS_RUNNER_CMD`  | Command used to invoke Python modules                         | `uv`                               |
| `ANALYTICS_RUNNER_ARGS` | Space-separated args prepended to `-m <module>`               | `run python`                       |

Together they produce an invocation like `uv run python -m src.scripts.8_initial_chat_analytics` executed with cwd `ANALYTICS_CWD`.
