# Analytics tables reference

What every table in `packages/prisma/src/prisma/schema/analytics.prisma` holds, how it's computed, and where it comes from. Use this as the companion to `README.md` (which focuses on running the pipeline) and the dry-run `.xlsx` output (which materialises one sheet per table listed here).

The pipeline is raw-SQL first: each module pairs a `compute_*.py` wrapper with a `.sql` file executed via `session.execute(text(...))`, and writes go through `bulk_upsert` (`INSERT … ON CONFLICT DO UPDATE`). Numeric scripts in `src/scripts/` orchestrate the modules and are run in prefix order by the Hatchet DAG (`packages/hatchet/src/tasks.ts`).

## Window types (`AnalyticsType`)

Every per-window table carries a `type` column with one of:

| Value | Meaning | Timestamp convention |
| --- | --- | --- |
| `DAILY` | Closed 24h window ending at midnight UTC | `timestamp` = that day's date |
| `WEEKLY` | Closed 7-day window ending Sunday UTC | `timestamp` = window end date |
| `MONTHLY` | Calendar month, end-of-month UTC | `timestamp` = last day of month |
| `COURSE` | Full course lifetime, one row per scope | `timestamp` = sentinel `1970-01-01` |

The `COURSE` sentinel (`1970-01-01`) is the convention used by every per-window rollup; it keeps the `(type, …, timestamp)` uniqueness stable regardless of when the COURSE row was computed. `ParticipantCourseAnalytics`, `AggregatedCourseAnalytics`, `ParticipantPerformance`, `InstancePerformance`, `ActivityPerformance`, `ParticipantActivityPerformance`, `ActivityProgress`, `ParticipantChatOutcome`, `ParticipantLiveQuizAnalytics`, `AggregatedLiveQuizAnalytics`, and `PlatformSemesterAnalytics` have no `type` column — their grain is inherently per-course (or per-semester) and a single row per key represents the full lifetime.

## Quiz & response analytics

Driven off `QuestionResponse` / `QuestionResponseDetail` (practice-quiz and microlearning responses). These tables have been in production for a long time and are the ones used by the lecturer dashboard.

### `ParticipantAnalytics` — script 0

Engagement and correctness for one participant, in one course, over one window.

- **Grain**: `(type, courseId, participantId, timestamp)` unique.
- **Source**: `QuestionResponse`, `QuestionResponseDetail`, `Participation`.
- **Engagement**: `trialsCount` (total attempts), `responseCount` (distinct questions touched), `totalScore` / `totalPoints` / `totalXp`.
- **Correctness means**: `meanCorrectCount`, `meanPartialCorrectCount`, `meanWrongCount` — per-question means summed across the participant's distinct questions; sum equals `responseCount`.
- **First/last correctness** (`COURSE` rows only): `firstCorrectCount`, `lastCorrectCount`, `firstWrongCount`, `lastWrongCount` — divide by `responseCount` for a rate.
- **Not computed today**: `competencyAnalytics` relation — blocked on the missing `Element ↔ Competency` linkage in the schema.

### `AggregatedAnalytics` — script 1

Course-wide rollup of `ParticipantAnalytics` per window.

- **Grain**: `(type, courseId, timestamp)` unique.
- **Columns**: `responseCount`, `participantCount`, `totalScore`, `totalPoints`, `totalXp`, `totalElementsAvailable` (count of practice-quiz + microlearning instances linked to the course at window end).
- **Reads from**: `ParticipantAnalytics` of the same type+window.

### `ParticipantCourseAnalytics` — script 5

How consistently a participant engaged with a course over its whole run.

- **Grain**: `(courseId, participantId)` unique.
- **Columns**:
  - `activeWeeks` — weeks with ≥1 response.
  - `activeDaysPerWeek` — mean distinct active days per active week.
  - `meanElementsPerDay` — mean responses per active day.
  - `activityLevel` — `LOW` / `MEDIUM` / `HIGH` (quantile bucket against all participants in the course).
  - `hasChatActivity` — set by script 11 when the participant also used chat in this course.

### `AggregatedCourseAnalytics` — scripts 2 + 13

Per-course overview plus modality footprint.

- **Grain**: `courseId` unique.
- **Engagement**: `courseParticipantCount`, plus seven weekday columns `activityMonday`…`activitySunday` (mean active participants per weekday).
- **Modality footprint (script 13)**: `chatbotCount`, `practiceQuizCount`, `microLearningCount`, `liveQuizCount` (catalog counts), `chatParticipantCount`, `quizParticipantCount`, `bothChatAndQuizCount` (distinct-participant counts).

### `ParticipantPerformance` — script 4

Per-participant error rates and quantile-bucketed performance level.

- **Grain**: `(participantId, courseId)` unique.
- **Rates** (fraction of wrong responses):
  - `firstErrorRate` — across first attempts per distinct question.
  - `lastErrorRate` — across last attempts per distinct question.
  - `totalErrorRate` — across all attempts.
- **Levels**: `firstPerformance`, `lastPerformance`, `totalPerformance` (`LOW` / `MEDIUM` / `HIGH`) bucketed against the distribution of all participants in the course.

### `InstancePerformance` — script 3

Per-`ElementInstance` aggregate — how did this specific question item perform in this course.

- **Grain**: `instanceId` unique per course.
- **Engagement**: `responseCount`, `averageTimeSpent` (seconds).
- **Rates** across three phases (first / last / total attempts):
  - `*ErrorRate`, `*PartialRate`, `*CorrectRate`.
  - `first*` and `last*` are `null` for non-practice-quiz instances (microlearning doesn't distinguish attempts the same way).

### `ActivityPerformance` — script 3

Same rate shape as `InstancePerformance`, aggregated over all instances in a single `PracticeQuiz` or `MicroLearning`.

- **Grain**: one row per `practiceQuizId` _or_ `microLearningId` (mutually exclusive).

### `ParticipantActivityPerformance` — script 7

A participant's per-activity progress.

- **Grain**: `(participantId, practiceQuizId)` or `(participantId, microLearningId)` unique.
- **Columns**: `totalScore` (sum of instance scores earned by the participant), `completion` (fraction of instances answered at least once).

### `ActivityProgress` — script 6

Course-level completion funnel per activity.

- **Grain**: one row per `practiceQuizId` or `microLearningId`.
- **Columns**:
  - `totalCourseParticipants` — denominator.
  - `startedCount` — ≥1 response to any instance.
  - `completedCount` — answered every instance.
  - `repeatedCount` — practice-quiz only; participants who re-attempted after completing.

### `CompetencyAnalytics` / `AggregatedCompetencyAnalytics` / `CompetencyTree` / `Competency`

Defined in the schema, **not computed by the current pipeline.** Would require a per-element competency linkage that doesn't exist yet. No script produces rows here — script 12 (`CompetencyAnalytics` gap fill) is intentionally absent.

## Chat analytics

Added on the chat-analytics branch. Sourced from `ChatMessage`, `ChatThread`, `Chatbot`, `ChatUsageCredits`, `ChatAttachment`. Only participants with an accepted disclaimer (`ChatUsageCredits.acceptedDisclaimerId IS NOT NULL`) appear in these tables — the disclaimer gate is enforced in the SQL, not at read time.

### `ParticipantChatAnalytics` — script 8

Per-participant × per-chatbot engagement + cost rollup for one window.

- **Grain**: `(type, participantId, chatbotId, timestamp)` unique.
- **Engagement**: `userMessages`, `assistantMessages`, `threads`, `distinctDays` (days with ≥1 user msg), `firstMessageAt` / `lastMessageAt`.
- **User-message length distribution**: `msgLenMedian`, `msgLenP90`, `msgLenP99` (character counts).
- **Thread structure**: `messagesPerThreadP50`, `messagesPerThreadP90`.
- **Behavioural mix**: `chatModeCounts` (JSON `{mode: count}`), `reasoningEffortCounts` (JSON `{effort: count}`), `attachmentCount`, `toolCallCount`.
- **Cost**: `totalCreditsUsed` (`Decimal(18,6)`), `creditsExhausted` (hit balance=0 ≥ once during window).

### `AggregatedChatbotAnalytics` — script 9

Per-chatbot rollup for one window.

- **Grain**: `(type, chatbotId, timestamp)` unique.
- **Adoption**: `activeParticipants`, `newParticipants` (first user msg in window — meaningful mostly for `WEEKLY`), `returningParticipants`, `threads`, `userMessages`, `assistantMessages`.
- **Cost / compliance**: `totalCreditsUsed`, `creditExhaustionRate` (share of users who hit 0), `disclaimerAcceptedCount`, `disclaimerDeclinedCount`.
- **Distributions (all Json, bounded size)**:
  - `hourOfDayDistribution`: `{"1": [24 ints], …, "7": [24 ints]}` — ISO weekday × UTC hour.
  - `modelDistribution`: `{modelId: count}`.
  - `modeDistribution`: `{chatMode: count}`.
  - `reasoningEffortDistribution`: `{effort: count}`.

### `ChatTopicCluster` — script 10

NLP-derived topic clusters over user-authored chat text. No LLM involved — sentence-transformers → UMAP → HDBSCAN → TF-IDF labels. Privacy guard (§3.9): clusters with <5 distinct participants collapse into an `Other` bucket.

- **Grain**: `(type, chatbotId, timestamp, clusterIndex)` unique. `type` is `COURSE` today; `WEEKLY` possible later.
- **Columns**: `clusterLabel` (short TF-IDF-derived label), `messageCount`, `participantCount` (≥5 enforced), `representativeParaphrase` (nullable — reserved for a future paraphrase stage; never verbatim), `embeddingCentroid` (nullable bytes — reserved for future similarity queries).

### `ParticipantChatOutcome` — script 11

Correlates chat dose with quiz outcome per participant-course. Drives the "do chat users perform differently?" dashboard.

- **Grain**: `(participantId, courseId)` unique.
- **Columns**:
  - `chatMessagesInCourse` — user messages sent by this participant in this course.
  - `chatDoseBucket` — `NONE` / `LOW` / `MED` / `HIGH` bucketed against the per-course distribution.
  - `firstErrorRate`, `lastErrorRate`, `errorRateDelta` — mirrored from `ParticipantPerformance`.
  - `hasBothModalities` — true when the participant appears in both `ParticipantChatAnalytics` and `ParticipantPerformance` for this course.
- **Reads from**: `ParticipantChatAnalytics` + `ParticipantPerformance` + `Participation`. (This is the one script gated behind earlier analytics output — the dry-run pre-skips it when the DB it's pointed at doesn't have `ParticipantChatAnalytics` yet.)
- **Side effect**: flips `ParticipantCourseAnalytics.hasChatActivity` for rows with chat activity.

## Live-quiz analytics (assessment mode only)

Only live quizzes run in assessment mode produce these. Regular live-quiz sessions are excluded in the SQL.

### `ParticipantLiveQuizAnalytics` — script 14

Per-participant per-live-quiz stats.

- **Grain**: `(participantId, liveQuizId)` unique.
- **Columns**: `totalResponses`, `firstCorrectCount`, `lastCorrectCount`, `averageTimeSpent` (seconds), `totalBasePoints`, `totalCorrectnessPoints`, `totalBonusPoints`.

### `AggregatedLiveQuizAnalytics` — script 14

Per-live-quiz rollup.

- **Grain**: `liveQuizId` unique.
- **Columns**: `participantCount`, `responseCount`, `meanFirstCorrectness`, `meanLastCorrectness`, `lateSubmitterRate`.

## Platform-level rollup

### `PlatformSemesterAnalytics` — script 13

One row per semester (label format `HS25`, `FS26`, …). Summarises the entire platform.

- **Grain**: `semesterLabel` unique.
- **Response volumes**: `quizResponseRows`, `quizTrials`, `quizDistinctParticipants`, `liveQuizResponses`, `liveQuizDistinctParticipants`, `chatMessages`, `chatDistinctParticipants`.
- **Course counts**: `activeCourses`, `coursesWithChatbot`, `coursesWithLiveQuiz`, `coursesWithQuizActivity`.
- **Semester boundaries**: `semesterStart` / `semesterEnd` are derived by the SQL from min-response-date fallbacks; see `src/modules/platform_analytics/platform_semester_analytics.sql`.

## Validity markers — script 99

Not a table on its own, but script 99 flips three columns on `Course`:

- `areAnalyticsValid` — set `true` once the pipeline finishes without a fatal error.
- `analyticsLastComputedAt` — timestamp of that run.
- `chatAnalyticsValidAt` — timestamp of the last successful chat-analytics pass (scripts 8–11).
- `analyticsFinalizedAt` — set during the `finalize` mode pass (invoked once after a course ends, by the `scan-ended-courses` Hatchet task).

Scripts that short-circuit due to missing upstream data do not prevent script 99 from running.

## Source data summary

| Analytics table | Source tables |
| --- | --- |
| `ParticipantAnalytics` | `QuestionResponse`, `QuestionResponseDetail`, `Participation` |
| `AggregatedAnalytics` | `ParticipantAnalytics` (same window) |
| `ParticipantCourseAnalytics` | `QuestionResponse`, `Participation` |
| `AggregatedCourseAnalytics` | `ParticipantCourseAnalytics`, plus modality counts from `Chatbot` / `PracticeQuiz` / `MicroLearning` / `LiveQuiz` / `ChatUsageCredits` (script 13) |
| `ParticipantPerformance` | `QuestionResponse`, `QuestionResponseDetail` |
| `InstancePerformance` | `QuestionResponse`, `QuestionResponseDetail`, `ElementInstance` |
| `ActivityPerformance` | `InstancePerformance`, `PracticeQuiz` / `MicroLearning` |
| `ParticipantActivityPerformance` | `QuestionResponse`, `ElementInstance`, `PracticeQuiz` / `MicroLearning` |
| `ActivityProgress` | `Participation`, `QuestionResponse`, `ElementInstance` |
| `ParticipantChatAnalytics` | `ChatMessage`, `ChatThread`, `Chatbot`, `ChatUsageCredits`, `ChatAttachment` |
| `AggregatedChatbotAnalytics` | `ChatMessage`, `ChatThread`, `Chatbot`, `ChatUsageCredits` |
| `ChatTopicCluster` | `ChatMessage`, `ChatThread` |
| `ParticipantChatOutcome` | `ParticipantChatAnalytics`, `ParticipantPerformance`, `Participation` |
| `ParticipantLiveQuizAnalytics` | `LiveQuiz`, `ElementBlock`, `ElementInstance`, `LiveQuizResponse` |
| `AggregatedLiveQuizAnalytics` | `ParticipantLiveQuizAnalytics` |
| `PlatformSemesterAnalytics` | `QuestionResponse`, `LiveQuizResponse`, `ChatMessage`, `ChatThread`, `Chatbot`, `LiveQuiz`, `Participation`, `Course` |

## Related references

- `packages/prisma/src/prisma/schema/analytics.prisma` — authoritative column definitions + constraints.
- `apps/analytics/README.md` — how to run the pipeline + dry-run harness.
- `packages/types/src/hatchet.ts` — canonical script module list shared with the Hatchet task graph.
- Module SQL files under `apps/analytics/src/modules/<table>/` — the aggregation semantics live here, not in the Python wrappers.
