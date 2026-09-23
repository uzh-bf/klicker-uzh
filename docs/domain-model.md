---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-09-07'
tags:
  - backend
  - prisma
---

# Domain Model

**The fact most likely to be guessed wrong: gamification runs on two separate tracks.** Points require an _active_ `Participation` in the course and land in `LeaderboardEntry.score`; XP accrues **unconditionally** and lands on `Participant.xp`. Both are computed in `packages/graphql/src/services/stacks.ts:computeAwardedPointsAndXP` — points throttled per instance via `options.resetTimeDays`, XP throttled by the `XP_AWARD_TIMEFRAME_DAYS` constant. A participant who left the leaderboard still earns XP.

Schema sources live in [packages/prisma/src/prisma/schema/](../packages/prisma/src/prisma/schema/) (split by area — see [Data & Migrations](./data-and-migrations.md)).

## Two user populations

|           | `User` (`user.prisma`)    | `Participant` (`participant.prisma`)               |
| --------- | ------------------------- | -------------------------------------------------- |
| Who       | Lecturers/admins          | Students                                           |
| App       | frontend-manage / control | frontend-pwa / chat                                |
| Login     | Edu-ID OIDC, delegated    | username/password, SSO, magic link, LTI, temporary |
| Role enum | `USER` / `ADMIN`          | `PARTICIPANT` / `TEMPORARY_PARTICIPANT`            |

They are unrelated models — never conflate them. A `Participant` joins a `Course` through **`Participation`** (`@@unique([courseId, participantId])`, carries `isActive`) — the domain word is _Participation_, not "Enrollment". Course names like "Testkurs" are seed data only (`packages/prisma-data/src/data/seedTEST.ts`).

`Participation.isActive` is the **course-leaderboard opt-in**, not an enrollment flag. It defaults to `false`; joining the course leaderboard flips it to `true`, and leaving the leaderboard sets it back to `false` while keeping the row and collected points. Participant access to a published chatbot is likewise authorized by the existence of the course `Participation`, regardless of `isActive` (`apps/chat/src/lib/server/apiGuards.ts:requireParticipation`). Assessment course access and assessment report issuance are backed by the **accepted course invitation** plus an active participant account — never by `Participation.isActive` — so leaderboard-inactive students keep their assessment access.

### Participant data-use choices

Research and learning-analytics choices are participant-global current state on
`Participant`, not course-scoped history. `researchConsent` and
`learningAnalyticsConsent` both default to `false`; their choice timestamps and
disclosure-version fields describe the current decision. Every completion and
choice change is also appended to `ParticipantDataUseEvent`, an audit row per
participant and revision; an immutability trigger blocks updates, deletes, and
truncation, and analytics withdrawal requests reference the revision that
recorded them.

`researchConsent = true` allows a future research export to include all stored
canonical data for that participant; `false` excludes all of it. Returning to
`true` makes all stored canonical data eligible for future exports again.
`learningAnalyticsConsent = true` allows eligible individual learning analytics
to include all stored activity history after a course has been recomputed
strictly after the current choice; `false` excludes individual learning
analytics. The privacy policy also makes Learning Analytics voluntary at course
level, but no course-level activation setting exists in this schema yet;
`Course.areAnalyticsValid` records only whether previously computed data are
still valid and must not be reused as that setting. The course-level choice is
owned by a later layer.

An analytics withdrawal request is created only on a true-to-false transition.
The migration initializes existing accounts with
`learningAnalyticsConsent = false` and records no choice, so legacy analytics
data for an account whose first recorded choice is false is not represented by
any withdrawal request. Consuming the queue is therefore not, by itself, a
legacy-data cleanup strategy. Before the consent release, the legacy Python
analytics package and all four GraphQL analytics reads are contained. Running
old collectors must be stopped, and any retained derived data requiring deletion
must be reconciled before users receive the updated policy promises. Full
consent-aware processing remains a later layer; `true` alone does not activate
it. Operational answers, points and assessment records are not LA derivatives.

`Participation` remains the course-membership row and keeps its existing
leaderboard meaning. It carries no research or learning-analytics choice or
history, and participants have no per-course data-use choice in this schema.

The public Prisma schema is the sole authority for these models. Catalyst must
pin the exact immutable public commit and digest it consumes; a moving branch,
dirty tree, or generated Analytics mirror is not provenance. The stored fields
alone do not enable export, computation, or workflow dispatch.

Chatbot and live-quiz analytics rows reference their owning `Chatbot` or
`LiveQuiz` instead of storing a second, independently writable `courseId`.
Course-scoped analytics joins through that owner, which keeps course ownership
consistent by construction. Participant live-quiz point totals retain the
canonical fractional `REAL` values.

### Private Study streaks

Each active `Participation` also carries a **private Study streak**, visible only to its student (`studyStreakCurrent`, `studyStreakLongest`, `studyStreakFreezeBalance`, daily progress, plus bookkeeping columns; see ADR 0009). Every streak field resolves to null for lecturers and other participants, including when a `Participation` is reached through a leaderboard entry. A qualified day means five or more eligible responses (PracticeQuiz or MicroLearning) on one Europe/Zurich weekday within course bounds. Content views do not count. Weekends are neutral; holidays follow the ordinary weekday rule. The first missed active weekday in a gap may consume one available freeze; a second consecutive missed weekday resets the current streak without consuming another freeze. The balance starts at two, is capped at three, and one freeze is earned after each seven qualified days. Reaching seven days while already capped resets the earning cycle without banking a later refill. Reconciliation runs fail-open after each response batch commits in a serializable Prisma transaction and groups existing `QuestionResponseDetail` rows by Zurich date, so a streak failure never affects grading or XP. Joining the leaderboard starts tracking; the background rollout and repair migrations initialize already-active leaderboard participations in enabled, non-assessment courses without backfilling earlier responses. The development `Testkurs` seed applies the same timestamp to new and existing active seeded participations. Course overview and participation reads reconcile the private state before returning it. Leaving resets current/progress but preserves longest and balance; rejoining restarts from zero with no backfill.

On the PWA home screen, the fire/current-streak indicator and contextual status are shown only for gamified participations with `isActive`; this presentation reuses the existing read-side fields and adds no streak state.

### Assessment participant invitations

`ParticipantInvitation` records the intention to admit one email address to one SSO course before a `Participation` necessarily exists (`packages/prisma/src/prisma/schema/participant.prisma:ParticipantInvitation`). Email and course are unique together; the optional `matriculationNumber` is administrative metadata. Its `InvitationStatus` lifecycle has two states: `PENDING` and `ACCEPTED`. An accepted row links a `Participant` and records `acceptedAt`; it is retained as the admission record.

Invitation creation normalizes emails and matriculation numbers, reports invalid rows without failing the rest of a batch, and immediately accepts an invitation only when exactly one active `Participant` is identified through verified **affiliation** `ParticipantAccount` records (`packages/graphql/src/services/participantInvitations.ts:createParticipantInvitations`). Assessment-course imports accept at most 200 rows per request; larger files must be split before submission. A duplicate email does not create a second row; a newly supplied matriculation number updates only a `PENDING` invitation, while accepted admission records remain immutable. Unexpected database failures surface through GraphQL instead of becoming row-level success data. Lecturer-side deletion is deliberately narrower than course deletion: only `PENDING` invitations can be removed (`packages/graphql/src/services/participantInvitations.ts:deletePendingAssessmentParticipantInvitation`).

## Content hierarchy

- **`Element`** (`element.prisma`) — a question-bank item owned by a `User`; versioned via `version`/`originalId`; `type: ElementType`; options live in a typed `Json` field.
- **`ElementInstance`** — a _placement_ of an Element inside an activity. `type: ElementInstanceType` = `LIVE_QUIZ | PRACTICE_QUIZ | MICROLEARNING | GROUP_ACTIVITY`. It **snapshots** `elementData`/`options` at publication time and accumulates `results` — editing the source Element does not change published instances.
- Grouping differs by activity: **`ElementStack`** (ordered instance group) for PracticeQuiz/MicroLearning/GroupActivity; **`ElementBlock`** (with scheduling status) for LiveQuiz only.

`ElementType`: `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY`. Type-specific behavior is dispatched in `packages/graphql/src/services/stacks.ts` (correctness: `evaluateChoicesAnswerCorrectness`; per-type grading and response-format branches). Pure scoring math is in `packages/grading/src/index.ts`: `gradeQuestionSC`, `gradeQuestionMC` (hamming-distance partial credit), `gradeQuestionKPRIM` (0 wrong → full, 1 wrong → half, else 0), `gradeQuestionNumerical`.

## Course chatbots

`Chatbot` belongs to one owning `User` and one `Course`. Its lifecycle is
`DRAFT`, `PENDING_APPROVAL`, `REJECTED`, `PUBLISHED`, or `PAUSED`; participants
can access only a published chatbot when a `Participation` exists for the
owning course. Publication approval is separate from account-level AI usage
authorization.

The nullable `Chatbot.standardModeConfig` JSON value stores the constrained
Tutor, Explainer, and Quizzer configuration: three explicit mode flags plus
course name, subject domain, language of instruction, and an optional scope
note. The owner-only `updateChatbotStandardModeConfig` mutation accepts full
replacements in `DRAFT`, `REJECTED`, and `PUBLISHED`, requires Tutor or
Explainer to remain enabled, and uses a status compare-and-set so a concurrent
lifecycle transition cannot be overwritten. Tutor and Explainer do not require
a knowledge base; Quizzer remains independently configurable but is filtered by
the safe course-material capability gate. Missing or malformed persisted values
derive all three flags from legacy mode opt-outs/defaults, while valid legacy
two-flag values derive Quizzer from its legacy opt-out/default. The owner-only
Manage projection exposes the combined effective settings, never raw
`systemPrompts`. Participant GraphQL projections expose only the resolved mode
options, never this owner configuration or raw system prompts. The chat compiler
keeps the platform scaffolding authoritative. New chatbots have a fixed `auto`
model policy with no reasoning entries. The strict owner-only
`updateChatbotModelPolicy` mutation enforces fixed versus participant-choice
cardinality and model-specific reasoning invariants; the previous model
settings mutation remains available for rolling clients. Legacy fixed rows
resolve through the `CHAT_PRIMARY_MODEL_ID`-aware runtime semantics, and
retired-only lists use Luna without a migration. Manage exposes one optional
Chatbot framing field with a 200-character UI limit. The persisted parser
accepts up to 1000 characters so an existing longer framing note survives a
mode-only save, while Quizzer compilation receives only that scope note.

## Activities

Four activity models in `quiz.prisma`: `LiveQuiz` (formerly "session" — `originalId` and old code names survive), `PracticeQuiz`, `MicroLearning`, `GroupActivity` (plus `GroupActivityInstance`, parameters/clues). The Prisma **view** `UserActivities` unifies all four for listing.

Lifecycle enums:

| Enum                 | Values                                               | Applies to           |
| -------------------- | ---------------------------------------------------- | -------------------- |
| `PublicationStatus`  | DRAFT, SCHEDULED, PUBLISHED, ENDED, GRADED, TEMPLATE | all four activities  |
| `ElementStatus`      | DRAFT, REVIEW, READY                                 | Element              |
| `ReviewStatus`       | INCOMPLETE, REVIEWED, MODIFIED_AFTER_REVIEW          | activity review flow |
| `ElementBlockStatus` | SCHEDULED, ACTIVE, EXECUTED                          | LiveQuiz blocks      |
| `AccessMode`         | PUBLIC, RESTRICTED                                   | LiveQuiz             |

`ElementStatus` is manually controlled advisory metadata on an Element. `DRAFT`
means unfinished, `REVIEW` means review requested, and `READY` means considered
reusable. New Elements default to `READY`. The value does not gate activity use,
auto-transition, reset after an edit, or imply reviewer assignment or approval;
users with at least read access retain the deliberate permission to change it.
This is separate from activity `PublicationStatus` and the activity
`ReviewStatus` flow.

Scheduled publication/ending is executed by the Hatchet general worker — without it, SCHEDULED activities never go live (see [Async & Workers](./async-and-workers.md)).

## Course deletion

**Deleting a non-assessment course does not normally delete its live quizzes.**
The required `PracticeQuiz`, `MicroLearning`, and `GroupActivity` relations are
hard-deleted through the course cascade, while `LiveQuiz.courseId` uses
`SetNull`, so linked live quizzes are disconnected and remain in the activity
list. The optional `deleteDraftActivities` argument on
`packages/graphql/src/services/courses.ts:deleteCourse` additionally
hard-deletes linked live quizzes in `PublicationStatus.DRAFT`; live quizzes in
every other status are still disconnected. The lecturer UI keeps this option
off by default and describes it in activity-level terms: the asynchronous
activities already cascade with the course, while opting in additionally
removes linked draft live quizzes
(`apps/frontend-manage/src/components/courses/modals/CourseDeletionModal.tsx:CourseDeletionModal`).

`requestCourseDeletion` accepts the deletion request by setting
`Course.deletionRequestedAt` and handing the requester id and draft-live-quiz
option to the `process-course-deletion` Hatchet event. The marker immediately
excludes the course and all of its activities from user-facing reads; it is not
a user-visible progress state. Retained live quizzes reappear as unassigned
activities once the worker has completed the permanent deletion. Published live
quizzes block acceptance, and the worker clears the marker instead of deleting
if a live quiz was published, the course switched to assessment mode, or the
requester lost ADMIN/OWNER permission in the meantime.

## Course duplication

**Copies share Elements with the source — only the instances are new.** The manage frontend starts duplication through `startCourseDuplication`, which stores a Redis-backed job status, emits the `process-course-duplication` Hatchet event, and returns the job id immediately. The frontend persists that id in `localStorage`, polls `courseDuplicationStatuses`, and shows a success notification with an explicit action to open the copied course when the job reaches `COMPLETED`; it never navigates automatically. Failed, missing, or stale jobs are removed from the active notification UI. The worker still calls `packages/graphql/src/services/courseDuplication.ts:duplicateCourse`, which runs the actual copy in **one interactive transaction** (10 min timeout): afterwards either the full copy exists or nothing does. The legacy `createCourse(sourceCourseId: …)` path still routes directly to `duplicateCourse` for compatibility. Pre-checks that would otherwise produce a partial copy throw a `GraphQLError` with `extensions.code = COURSE_DUPLICATION_PARTIAL_FAILURE`, which the manage frontend maps to a dedicated toast (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:getCourseDuplicationErrorMessage`).

- **Permission contract (fail-closed):** course-level ADMIN (checked, then re-checked after `recomputeDerivedPermissions`), ADMIN on every selected activity, and ADMIN/OWNER **derived** permission on the Element behind every selected instance (`courseDuplication.ts:assertCourseDuplicationActivityAccess`, `courseDuplication.ts:assertCourseDuplicationInstanceAccess`). Any missing permission aborts the whole duplication.
- **Copied:** selected activities, including live-quiz random selection and ElementStack titles and descriptions (through the existing `manipulate*` services with a transaction client — creation invariants are not re-implemented), direct permissions of the course and of each copied activity (minus the duplicator's own row), `competencyTreeId`, `authType`, gamification/assessment flags. Every copied permission writes an `AuditLogEntry`. Ownership lives in each object's owner column rather than a permission row, so the duplicator becomes OWNER of the copy and any other source owner (course and each activity) is granted direct ADMIN on the copy when they differ from the duplicator (`courseDuplication.ts:grantDuplicatedAccessToSourceOwner`).
- **Not copied:** participants/participations, groups, results, leaderboards, responses. Copies land in DRAFT with zeroed `results`/`anonymousResults` and fresh `instanceStatistics` (`packages/util/src/elements.ts:getActivityInstanceConnectOrCreate`, duplication branch). Live-quiz PINs are regenerated, never reused; a SSO course's `pinCode` is nulled.
- **Shared elements:** duplicated instances connect to the **same `Element` rows** and keep the source instance's `elementData` snapshot (same item version the previous cohort saw, even if the Element moved on — `areInstancesOutdated` flags the drift). Element edits reach both courses only through the instance-update flow.
- **Date shifting:** The duplication dialog requires a new start date; the end date is derived from the original course duration and cannot be edited in the dialog. MicroLearning/GroupActivity schedules shift by the local calendar-day delta between old and new course start while preserving the Europe/Zurich wall-clock time across DST changes (`courseDuplication.ts:getCourseStartDayDelta`, `courseDuplication.ts:applyCourseStartDelta`). The dialog initially derives the group creation deadline from its original offset to the course start, then lets the lecturer override it before creating the copy (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:FormikNativeDateInput`).

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
  The current seeded achievement IDs are explicitly allowlisted as discoverable because staff has manually distributed every entry at least once. Coded award paths exist for live quiz podium places (Champion, Vice-Champion, Vice-Vice-Champion in `liveQuizzes.ts`) and group activity awards (Dream Team and Team Spirit in `groups.ts`); the rest are granted manually by staff. The database default and seed fallback remain `isDiscoverable=false`, so adding a new seed entry does not publish it accidentally.
- When a student receives a discoverable achievement, the instance starts with `receiptAcknowledgedAt=null`. The receipt-boundary migration backfills that field for existing instances, so only awards created after rollout can appear as new receipts. The student sees a "New achievement unlocked!" badge until the PWA makes a non-blocking call to `acknowledgeAchievementReceipt`, which sets the timestamp idempotently; a failed call leaves the badge visible for a later retry. The receipt field is available only on the authenticated participant's own achievement data and is omitted from public participant profiles.
- **Unmapped (verify in code before relying on it):** the LiveQuiz bonus-point formula (time-decay multipliers).
