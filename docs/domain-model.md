---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-08-20'
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

### Assessment participant invitations

`ParticipantInvitation` records the intention to admit one email address to one SSO course before a `Participation` necessarily exists (`packages/prisma/src/prisma/schema/participant.prisma:ParticipantInvitation`). Email and course are unique together; the optional `matriculationNumber` is administrative metadata. Its `InvitationStatus` lifecycle has two states: `PENDING` and `ACCEPTED`. An accepted row links a `Participant` and records `acceptedAt`; it is retained as the admission record.

Invitation creation normalizes emails and matriculation numbers, reports invalid rows without failing the rest of a batch, and immediately accepts an invitation only when exactly one active `Participant` is identified through verified **affiliation** `ParticipantAccount` records (`packages/graphql/src/services/participantInvitations.ts:createParticipantInvitations`). Assessment-course imports accept at most 200 rows per request; larger files must be split before submission. A duplicate email does not create a second row; a newly supplied matriculation number updates only a `PENDING` invitation, while accepted admission records remain immutable. Unexpected database failures surface through GraphQL instead of becoming row-level success data. Lecturer-side deletion is deliberately narrower than course deletion: only `PENDING` invitations can be removed (`packages/graphql/src/services/participantInvitations.ts:deletePendingAssessmentParticipantInvitation`).

## Content hierarchy

- **`Element`** (`element.prisma`) — a question-bank item owned by a `User`; versioned via `version`/`originalId`; `type: ElementType`; options live in a typed `Json` field.
- **`ElementInstance`** — a _placement_ of an Element inside an activity. `type: ElementInstanceType` = `LIVE_QUIZ | PRACTICE_QUIZ | MICROLEARNING | GROUP_ACTIVITY`. It **snapshots** `elementData`/`options` at publication time and accumulates `results` — editing the source Element does not change published instances.
- Grouping differs by activity: **`ElementStack`** (ordered instance group) for PracticeQuiz/MicroLearning/GroupActivity; **`ElementBlock`** (with scheduling status) for LiveQuiz only.

`ElementType`: `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY, QR_SCAN`. Type-specific behavior is dispatched in `packages/graphql/src/services/stacks.ts` (correctness: `evaluateChoicesAnswerCorrectness`; per-type grading and response-format branches). Pure scoring math is in `packages/grading/src/index.ts`: `gradeQuestionSC`, `gradeQuestionMC` (hamming-distance partial credit), `gradeQuestionKPRIM` (0 wrong → full, 1 wrong → half, else 0), `gradeQuestionNumerical`.

`QR_SCAN` elements keep their 72-bit URL-safe opaque code in the nullable, unique `Element.qrScanCode` column. `packages/util/src/elements.ts:processElementData` intentionally omits that column when snapshotting participant-facing `ElementInstance.elementData`; participant GraphQL data therefore contains the prompt and content-free options, never the answer token. Creation and duplication generate independent codes, editing preserves the existing code, and the owner-only `qrScanPrintData` query returns it only after both an `OWNER` permission check and an exact-owner service predicate. Element discriminators are immutable during edits, preventing a QR mutation from overwriting another element type's options.

The print contract (`packages/graphql/src/services/elements.ts:getQrScanPrintData`) creates up to 20 distinct decoys in memory for each request; decoys are never persisted or included in participant APIs. The manage print view randomizes real/decoy card order with the browser CSPRNG, gives every printed card a neutral station label, and keeps the answer legend screen-only.

QR Scan questions can be placed only in Escape Room Practice Quizzes, Microlearnings, and Group Activities. Participants scan through the browser's native `BarcodeDetector`/camera APIs when available or enter the printed code manually; both paths require the canonical 12-character URL-safe format. Grading compares the submitted value with the private source-element code on the backend. Well-formed decoys are ordinary incorrect answers and trigger the normal lockout; malformed values fail before grading. Live Quiz and live-quiz template inputs continue to reject QR placement until their runtime layer lands.

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

## Escape Room modes

Practice Quizzes and Microlearnings can be configured as Escape Rooms. `EscapeRoomConfig` stores the time limit, hint penalty, incorrect-answer lockout, and optional introduction. `EscapeRoomAttempt` stores server-owned participant progress, start and completion times, accumulated penalties, used hint instance IDs, lockout expiry, and the `IN_PROGRESS | COMPLETED | EXPIRED` status.

The Prisma model also contains a dormant Live Quiz block relation so its later stacked layer can reuse the same migration. Live Quiz Escape Rooms are not exposed by the GraphQL, authoring, or participant surfaces in this layer.

### Individual Practice Quiz and Microlearning

Participants must explicitly start one unique attempt per activity. The backend masks future stacks, validates that submissions target the current stage, claims concurrent submissions through Redis, grades exact response sets, applies lockouts, and completes the attempt only after every stack is cleared. Participant payloads never contain QR answer codes or unused hint text.

Hints are authorized against the current unlocked stack. The first reveal records the instance ID and charges the configured penalty atomically; repeated or concurrent requests are idempotent. Only the owning participant receives the restored `revealedHint` after reload. Lecturer hint editing uses patch semantics: omission preserves, blank or null clears, and non-empty values are trimmed.

Countdowns start from server-calculated `remainingSeconds` and `expiresInSeconds` snapshots and animate with the browser monotonic clock. Refetches after start, answers, hints, and lockout errors resynchronize those snapshots, while the server remains authoritative for expiry.

The lecturer progress dashboard is roster-based: every enrolled participant appears, including a `NOT_STARTED` row when no attempt exists. Reset requires WRITE access and is rejected while a response lifecycle claim is active. The prune job marks finished attempts before applying retention; response and instance statistics remain owned by the normal submission path.

### Group Activity

A Group Activity Escape Room has one shared attempt per `(groupId, groupActivityId)`, not one attempt per participant. Start and hint requests carry the group ID from the routed participant page; the server verifies that the activity belongs to the same course and that the authenticated participant belongs to that exact group before using it as the lifecycle actor. This remains deterministic when one participant belongs to multiple groups in a course, while concurrent starts by members of the same routed group converge on one attempt (`packages/graphql/src/services/escapeRooms.ts:startEscapeRoomAttempt`).

Group submission is an all-or-nothing answer gate. `packages/graphql/src/services/groupEscapeRoomSubmissions.ts:submitEscapeRoomGroupActivityDecisions` requires the exact set of answerable instances, validates every response shape and sample solution, grades and updates aggregate results in one serializable transaction, and persists completion or the shared lockout atomically. Content and flashcards may be displayed but are excluded from that answer set. QR values are graded against the private source code and cleared before decisions are persisted.

Hints and penalties are shared across every member and restored after reload. Lecturer progress is group-roster based, including `NOT_STARTED` groups; resetting deletes both the shared attempt and its `GroupActivityInstance` so the group can restart cleanly.

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

## Course duplication

**Copies share Elements with the source — only the instances are new.** The manage frontend starts duplication through `startCourseDuplication`, which stores a Redis-backed job status, emits the `process-course-duplication` Hatchet event, and returns the job id immediately. The frontend persists that id in `localStorage`, polls `courseDuplicationStatuses`, and shows a success notification with an explicit action to open the copied course when the job reaches `COMPLETED`; it never navigates automatically. Failed, missing, or stale jobs are removed from the active notification UI. The worker still calls `packages/graphql/src/services/courseDuplication.ts:duplicateCourse`, which runs the actual copy in **one interactive transaction** (10 min timeout): afterwards either the full copy exists or nothing does. The legacy `createCourse(sourceCourseId: …)` path still routes directly to `duplicateCourse` for compatibility. Pre-checks that would otherwise produce a partial copy throw a `GraphQLError` with `extensions.code = COURSE_DUPLICATION_PARTIAL_FAILURE`, which the manage frontend maps to a dedicated toast (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:getCourseDuplicationErrorMessage`).

- **Permission contract (fail-closed):** course-level ADMIN (checked, then re-checked after `recomputeDerivedPermissions`), ADMIN on every selected activity, and ADMIN/OWNER **derived** permission on the Element behind every selected instance (`courseDuplication.ts:assertCourseDuplicationActivityAccess`, `courseDuplication.ts:assertCourseDuplicationInstanceAccess`). Any missing permission aborts the whole duplication.
- **Copied:** selected activities, including live-quiz random selection and ElementStack titles and descriptions (through the existing `manipulate*` services with a transaction client — creation invariants are not re-implemented), direct permissions of the course and of each copied activity (minus the duplicator's own row), `competencyTreeId`, `authType`, gamification/assessment flags. Every copied permission writes an `AuditLogEntry`. If a non-owner ADMIN duplicates, the source owner is granted ADMIN on the copy (`courseDuplication.ts:grantDuplicatedCourseAccessToSourceOwner`); the duplicator becomes OWNER.
- **Not copied:** participants/participations, groups, results, leaderboards, responses. Copies land in DRAFT with zeroed `results`/`anonymousResults` and fresh `instanceStatistics` (`packages/util/src/elements.ts:getActivityInstanceConnectOrCreate`, duplication branch). Live-quiz PINs are regenerated, never reused; a SSO course's `pinCode` is nulled.
- **Shared elements:** duplicated instances connect to the **same `Element` rows** and keep the source instance's `elementData` snapshot (same item version the previous cohort saw, even if the Element moved on — `areInstancesOutdated` flags the drift). Element edits reach both courses only through the instance-update flow.
- **Date shifting:** The duplication dialog requires a new start date; the end date is derived from the original course duration and cannot be edited in the dialog. MicroLearning/GroupActivity schedules shift by the local calendar-day delta between old and new course start while preserving the Europe/Zurich wall-clock time across DST changes (`courseDuplication.ts:getCourseStartDayDelta`, `courseDuplication.ts:applyCourseStartDelta`). The dialog initially derives the group creation deadline from its original offset to the course start, then lets the lecturer override it before creating the copy (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:FormikNativeDateInput`).

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
