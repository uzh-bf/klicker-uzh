---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-07-13'
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

## Content hierarchy

- **`Element`** (`element.prisma`) — a question-bank item owned by a `User`; versioned via `version`/`originalId`; `type: ElementType`; options live in a typed `Json` field.
- **`ElementInstance`** — a _placement_ of an Element inside an activity. `type: ElementInstanceType` = `LIVE_QUIZ | PRACTICE_QUIZ | MICROLEARNING | GROUP_ACTIVITY`. It **snapshots** `elementData`/`options` at publication time and accumulates `results` — editing the source Element does not change published instances.
- Grouping differs by activity: **`ElementStack`** (ordered instance group) for PracticeQuiz/MicroLearning/GroupActivity; **`ElementBlock`** (with scheduling status) for LiveQuiz only.

`ElementType`: `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY, QR_SCAN`. Type-specific behavior is dispatched in `packages/graphql/src/services/stacks.ts` (correctness: `evaluateChoicesAnswerCorrectness`; per-type grading and response-format branches). Pure scoring math is in `packages/grading/src/index.ts`: `gradeQuestionSC`, `gradeQuestionMC` (hamming-distance partial credit), `gradeQuestionKPRIM` (0 wrong → full, 1 wrong → half, else 0), `gradeQuestionNumerical`.

`QR_SCAN` elements keep their 72-bit URL-safe opaque code in the nullable, unique `Element.qrScanCode` column. `packages/util/src/elements.ts:processElementData` intentionally omits that column when snapshotting participant-facing `ElementInstance.elementData`; participant GraphQL data therefore contains the prompt and content-free options, never the answer token. Creation and duplication generate independent codes, editing preserves the existing code, and `packages/graphql/src/services/elements.ts:getQrScanCode` returns it only to the exact owner. Element discriminators are immutable during edits, preventing a QR mutation from overwriting another element type's options.

The owner-only print contract (`packages/graphql/src/services/elements.ts:getQrScanPrintData`) creates up to 20 distinct decoys in memory for each request; decoys are never persisted or included in participant APIs. The manage print view randomizes real/decoy card order, gives every printed card a neutral station label, and keeps the answer legend screen-only.

QR Scan questions are restricted to Escape Room activities. Participants scan through the browser's native `BarcodeDetector`/camera APIs when available or enter the printed code manually; both paths require the canonical 12-character URL-safe format. PracticeQuiz, MicroLearning, and GroupActivity grading compare the submitted value with the private source-element code on the backend. LiveQuiz performs the same comparison in response-api before publishing the accepted response event. Well-formed decoys are ordinary incorrect answers and trigger the mode's normal lockout; malformed values fail before grading. The source code never enters participant-facing `elementData`, including locked-stack payloads.

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

## Escape Room Mode

Activities (PracticeQuiz, MicroLearning, GroupActivity) and LiveQuiz blocks (`ElementBlock`) can be configured as **Escape Rooms** via `EscapeRoomConfig`:

- **`EscapeRoomConfig`** (`quiz.prisma`) — Defines the time limit, penalty per used hint, lockout duration for incorrect answers, and introductory text. It links optionally to the respective activity or block.
- **`EscapeRoomAttempt`** (`quiz.prisma`) — Tracks a participant's or group's progress in an active Escape Room, containing their start/completion times, accumulated penalty seconds, used hints, lockout expiration, and status.
- **`EscapeRoomStatus`** — Lifecycle state of an attempt: `IN_PROGRESS`, `COMPLETED`, or `EXPIRED`.

Escape Room configuration is validated before persistence in every supported mode. The game time must be an integer from 1 through 86,400 seconds, and the per-hint penalty must be an integer from 0 through 3,600 seconds.

Attempts are scoped uniquely to a participant/group and activity/block to prevent multiple active attempts. Evaluation and penalty calculations are handled in the backend (`packages/graphql/src/services/`) and validated at response time.

GroupActivity Escape Rooms use one attempt shared by every member of the participant group and accept exactly one valid response for every supported answerable instance. The backend validates activity membership, response IDs/types/payloads, and gradability before any write, then commits aggregate results, decisions, lockout/expiry, and attempt completion in one serializable transaction. Incorrect answers keep the editable group response state for retry after the shared lockout. Content and flashcard instances are not answerable; an activity with no answerable instances fails closed.

Hints are authorized against the participant's current unlocked stack. Unused hint text is never returned in participant queries; after a hint is charged, its instance ID is recorded on the attempt. PracticeQuiz and MicroLearning restore it only for that participant, while GroupActivity restores it for every member because the attempt and penalty budget are shared. Distinct concurrent group hint requests are charged atomically.

Raw authored hints are available only through the WRITE-authorized `escapeRoomHints` query used by the edit wizard. This lets collaborators edit a shared activity while keeping hints hidden from READ-only users. Hint edits use patch semantics: an omitted value preserves the stored hint, a blank or null value clears it, and a non-empty value is trimmed and stored. Duplicating an instance preserves its hint unless an explicit override is supplied.

Escape-room Microlearning navigation is server-progress-driven rather than single-submission-driven. The URL resumes at the first uncleared stack; an incorrect answer clears the local evaluation for a retry while retaining the stage through lockout, and only a correct result refetches and advances to the next stack. Completion remains authoritative on the server attempt.

Escape-room attempts are not a second source of per-instance response statistics. PracticeQuiz and Microlearning grading update statistics at submission time, LiveQuiz uses the response-event pipeline (including its actual try count), and GroupActivity keeps aggregate instance results without inventing participant-level metrics. The prune job atomically marks finished attempts as processed and applies retention only; hints and time penalties are never interpreted as response tries.

Participant countdowns start from the server-calculated `EscapeRoomAttempt.remainingSeconds` snapshot (time limit minus server elapsed time and penalties) and animate with the browser's monotonic clock. A separate `expiresInSeconds` snapshot includes the shared five-second network grace without displaying it as game time. Refetches after start, answers, hints, and lockout errors resynchronize these snapshots. Lockout errors likewise provide a server-calculated remaining duration, so changing the participant device clock cannot extend or shorten either timer; expiry remains enforced by the shared server contract.

LiveQuiz Escape Rooms are scoped to a non-assessment `ElementBlock` and accept only SC, MC, KPRIM, numerical, free-text, and QR Scan questions. Assessment LiveQuizzes reject Escape Room blocks because their correlated assessment response path has different identity and persistence semantics. The lecturer configures the mode, game time, hint penalty, intro text, and per-instance hints from the block settings dialog; WRITE-authorized hint readback restores those values during editing. Temporary participants are ineligible; a regular participant must explicitly start the attempt through GraphQL before response-api accepts an answer. The participant view restores the attempt and already-revealed hints after reload, applies hint penalties and lockouts to the game controls, and keys local progress to the attempt identity so a lecturer reset starts cleanly. The attempt remains in progress until every answerable instance in the block has been cleared.

LiveQuiz templates round-trip the complete Escape Room block configuration and per-instance hints. Raw template hints stay server-side, including for public catalog templates, and are copied into the new activity without being exposed through the template query. QR Scan template elements follow the normal existing-versus-new element choice: reusing an existing element keeps that source question, while creating a new element generates its own private QR answer code.

During a LiveQuiz Escape Room attempt, participant queries and activation subscriptions expose authored content only for the current uncleared stage. Answers and hints are rejected unless they belong to that stage, so a client cannot skip ahead by submitting a later instance directly. Refetches after attempt start and stage completion keep the participant view aligned with the server-owned order.

PracticeQuiz, Microlearning, GroupActivity, and LiveQuiz start, response, and reset paths share one stable owner-token lifecycle claim per activity target and participant or group. Response paths acquire it before grading and recheck lockout, expiry, and the current stage after acquisition; reset acquires it before reading or removing progress. This serializes concurrent starts, resets, and answer permutations without weakening ordinary idempotent retries.

While an Escape Room block is active, the LiveQuiz cockpit polls block-scoped progress. The progress contract binds the `liveQuizId` and `elementBlockId` pair before returning participant identities; completed attempts show the full supported-instance count. Reset controls are exposed only when the cockpit caller has WRITE permission, even though ordinary cockpit execution requires only EXECUTE.

The lecturer dashboard is roster-based for participant-scoped course activities: every enrolled participant is returned, with `NOT_STARTED` and zero progress when no attempt exists, while users outside the activity's course are absent. A participant's `isActive` flag affects leaderboard eligibility, not Escape Room roster membership. GroupActivity monitoring instead shows one shared row per group attempt on the live-capable grading page. Attempt-backed rows retain in-progress/completed/expired state; reset is shown only to lecturers with WRITE access and removes both the attempt and shared GroupActivity instance. Dashboards poll only while their relevant view is active.

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
