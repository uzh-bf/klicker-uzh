---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-08-22'
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

`Participation.isActive` is the **course-leaderboard opt-in**, not an enrollment flag. It defaults to `false`; joining the course leaderboard flips it to `true`, and leaving the leaderboard sets it back to `false` while keeping the row and collected points. Assessment course access and assessment report issuance are backed by the **accepted course invitation** plus an active participant account — never by `Participation.isActive` — so leaderboard-inactive students keep their assessment access.

## Content hierarchy

- **`Element`** (`element.prisma`) — a question-bank item owned by a `User`; versioned via `version`/`originalId`; `type: ElementType`; options live in a typed `Json` field.
- **`ElementInstance`** — a _placement_ of an Element inside an activity. `type: ElementInstanceType` = `LIVE_QUIZ | PRACTICE_QUIZ | MICROLEARNING | GROUP_ACTIVITY`. It **snapshots** `elementData`/`options` at publication time and accumulates `results` — editing the source Element does not change published instances.
- Grouping differs by activity: **`ElementStack`** (ordered instance group) for PracticeQuiz/MicroLearning/GroupActivity; **`ElementBlock`** (with scheduling status) for LiveQuiz only.

`ElementType`: `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY`. Type-specific behavior is dispatched in `packages/graphql/src/services/stacks.ts` (correctness: `evaluateChoicesAnswerCorrectness`; per-type grading and response-format branches). Pure scoring math is in `packages/grading/src/index.ts`: `gradeQuestionSC`, `gradeQuestionMC` (hamming-distance partial credit), `gradeQuestionKPRIM` (0 wrong → full, 1 wrong → half, else 0), `gradeQuestionNumerical`.

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

## Assessment point corrections

Assessment point corrections persist their audience as
`PointCorrectionType`
(`packages/prisma/src/prisma/schema/response.prisma:PointCorrectionType`). An
instance correction distinguishes two participation audiences:

- `PARTICIPATING` targets participants with a genuine response to the selected
  `ElementInstance`.
- `PARTICIPATING_QUIZ` targets participants with at least one genuine response
  in a current block execution of the parent `LiveQuiz`, while applying the
  correction only to the selected `ElementInstance`.

A response created solely by an earlier correction (`correctionOnly = true`)
does not establish quiz participation. Participants who qualify through another
question but did not answer the selected instance receive a correction-only
response for that instance. The shared audience selection is implemented by
`packages/graphql/src/services/courses.ts:getLiveQuizParticipantResponseMap`
and applied by
`packages/graphql/src/services/courses.ts:correctAssessmentPointsInstance`.
Whole-quiz corrections intentionally retain the four original audiences and
reject `PARTICIPATING_QUIZ`.

## Course duplication

**Copies share Elements with the source — only the instances are new.** `createCourse(id: …)` routes to `packages/graphql/src/services/courses.ts:duplicateCourse`, which runs the entire copy in **one interactive transaction** (120 s timeout): afterwards either the full copy exists or nothing does. Pre-checks that would otherwise produce a partial copy throw a `GraphQLError` with `extensions.code = COURSE_DUPLICATION_PARTIAL_FAILURE`, which the manage frontend maps to a dedicated toast (`apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx:getCourseDuplicationErrorType`).

- **Permission contract (fail-closed):** course-level ADMIN (checked, then re-checked after `recomputeDerivedPermissions`), ADMIN on every selected activity, and ADMIN/OWNER **derived** permission on the Element behind every selected instance (`courses.ts:assertCourseDuplicationActivityAccess`, `courses.ts:assertCourseDuplicationInstanceAccess`). Any missing permission aborts the whole duplication.
- **Copied:** selected activities, including live-quiz random selection and ElementStack titles and descriptions (through the existing `manipulate*` services with a transaction client — creation invariants are not re-implemented), direct permissions of the course and of each copied activity (minus the duplicator's own row), `competencyTreeId`, `authType`, gamification/assessment flags. Every copied permission writes an `AuditLogEntry`. If a non-owner ADMIN duplicates, the source owner is granted ADMIN on the copy (`courses.ts:grantDuplicatedCourseAccessToSourceOwner`); the duplicator becomes OWNER.
- **Not copied:** participants/participations, groups, results, leaderboards, responses. Copies land in DRAFT with zeroed `results`/`anonymousResults` and fresh `instanceStatistics` (`packages/util/src/elements.ts:getActivityInstanceConnectOrCreate`, duplication branch). Live-quiz PINs are regenerated, never reused; a SSO course's `pinCode` is nulled.
- **Shared elements:** duplicated instances connect to the **same `Element` rows** and keep the source instance's `elementData` snapshot (same item version the previous cohort saw, even if the Element moved on — `areInstancesOutdated` flags the drift). Element edits reach both courses only through the instance-update flow.
- **Date shifting:** MicroLearning/GroupActivity schedules shift by the local calendar-day delta between old and new course start while preserving the Europe/Zurich wall-clock time across DST changes (`courses.ts:getCourseStartDayDelta`, `courses.ts:applyCourseStartDelta`). The duplication dialog initially derives the group creation deadline from its original offset to the course start, then lets the lecturer override it before creating the copy (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:FormikNativeDateInput`).

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
