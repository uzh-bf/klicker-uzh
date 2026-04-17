# KlickerUZH Analytics

This service computes learning analytics for KlickerUZH, providing insights into student learning patterns and performance metrics.

## Requirements

- Python 3.12.x (e.g., installed through `asdf`)
- Node.js 24.x.x
- uv

## Setup

- The project uses uv for dependency management and environment isolation. Make sure you have uv installed before proceeding. Then run `uv sync` in this folder to prepare the virtual environment.
- The project uses PNPM to simplify the execution of scripts and to provide a watch mode for execution. Make sure that you have executed `pnpm install` in the repository before trying to run the commands below.
- Make sure that all `.prisma` files are available in `prisma/`. If this is not the case, run the `util/sync-schema.sh` script first.
- Make sure that a valid Python environment is used (3.12). If needed, set the Python binary explicitly with `uv python pin 3.12` before running `uv sync`.

## Available Commands

The following commands are available through PNPM:

- `pnpm generate` - Generate the Prisma client for database access in Python
- `pnpm main` - Run the analytics service
- `pnpm dev` - Start the service in watch mode for development

## Pipeline scripts

The `src/scripts/` directory contains numbered scripts that form the analytics pipeline. Run them in order via the environment-specific initialization scripts.

| #   | Script                                      | Writes to                                                                 |
| --- | ------------------------------------------- | ------------------------------------------------------------------------- |
| 0   | `0_initial_participant_analytics`           | `ParticipantAnalytics`                                                    |
| 1   | `1_initial_aggregated_analytics`            | `AggregatedAnalytics`                                                     |
| 2   | `2_initial_aggregated_course_analytics`     | `AggregatedCourseAnalytics`                                               |
| 3   | `3_initial_instance_activity_performance`   | `InstancePerformance`, `ActivityPerformance`                              |
| 4   | `4_initial_participant_performance`         | `ParticipantPerformance`                                                  |
| 5   | `5_initial_participant_course_analytics`    | `ParticipantCourseAnalytics`                                              |
| 6   | `6_initial_activity_progress`               | `ActivityProgress`                                                        |
| 7   | `7_participant_activity_performance`        | `ParticipantActivityPerformance`                                          |
| 8   | `8_initial_chat_analytics`                  | `ParticipantChatAnalytics`                                                |
| 9   | `9_initial_aggregated_chatbot_analytics`    | `AggregatedChatbotAnalytics`                                               |
| 10  | `10_chat_topic_clustering`                  | `ChatTopicCluster` (NLP-only, no LLM)                                     |
| 11  | `11_chat_quiz_correlation`                  | `ParticipantChatOutcome`, `ParticipantCourseAnalytics.hasChatActivity`    |
| 13  | `13_platform_semester_analytics`            | `PlatformSemesterAnalytics`, `AggregatedCourseAnalytics` modality footprint |
| 14  | `14_live_quiz_assessment_analytics`         | `ParticipantLiveQuizAnalytics`, `AggregatedLiveQuizAnalytics`             |
| 99  | `99_mark_analytics_valid`                   | `Course` analytics-validity timestamps                                    |

Script 12 (`CompetencyAnalytics`) is intentionally absent because the current
schema has no `Element` to `Competency` linkage.

## Running from Hatchet

The pipeline is wired into Hatchet as `recompute-learning-analytics`. It can be
triggered by the weekly schedule, `course-ended`, or
`admin-recompute-analytics`.

The TypeScript handler in
`packages/graphql/src/services/analyticsRecompute.ts` runs the numbered Python
modules sequentially. Its worker needs the Analytics source tree, `uv` in
`PATH`, and the Analytics database connection.

| Environment variable      | Purpose                                               | Default          |
| ------------------------- | ----------------------------------------------------- | ---------------- |
| `ANALYTICS_CWD`           | Analytics app path inside the worker                  | Required         |
| `ANALYTICS_RUNNER_CMD`    | Python-module runner                                  | `uv`             |
| `ANALYTICS_RUNNER_ARGS`   | Arguments before `-m <module>`                        | `run python`     |
