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

QR Scan questions can be placed only in Escape Room activities, including Live Quiz Escape Room blocks. Participants scan through the browser's native `BarcodeDetector`/camera APIs when available or enter the printed code manually; both paths require the canonical 12-character URL-safe format. Stack and Group Activity modes grade against the private source-element code in GraphQL services; Live Quiz performs the same comparison synchronously in the response API before publishing an accepted response event. Well-formed decoys are ordinary incorrect answers and trigger the normal lockout; malformed values fail before grading.

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

## Escape Room modes

Practice Quizzes, Microlearnings, Group Activities, and individual Live Quiz blocks can be configured as Escape Rooms. `EscapeRoomConfig` stores the time limit, hint penalty, incorrect-answer lockout, optional introduction, and the scoring rules described below. `EscapeRoomAttempt` stores server-owned participant or group progress, start and completion times, accumulated penalties, used hint keys, per-stage outcomes, lockout expiry, and the `IN_PROGRESS | COMPLETED | EXPIRED` status.

### Scoring rules

`packages/grading/src/escapeRoomRules.ts` owns the rules for every Escape Room mode, so the same answer sequence costs the same time in each. A Live Quiz block reads them from its own `EscapeRoomConfig`.

- **Hints** are ordered per question. Revealing hint _i_ costs the hint's own penalty, else `hintPenalties[i]`, else `hintPenalty`. Used hints are recorded as `"<instanceId>"` for the first hint and `"<instanceId>:<i>"` after it.
- **Wrong answers** add `wrongAnswerPenalty` and count one attempt on the stage. When the count reaches `maxWrongAttempts`, the stage is revealed: `revealPenalty` is added, the stage counts as cleared, and no lockout applies. Below that limit the configured lockout applies.
- **Skipping** clears the current stage for `skipPenalty`; `null` disables it. Concurrent skips by team members are charged once.
- **Bonus**: with `bonusSeconds` set, the last stage is a bonus stage. The attempt completes when every other stage is cleared; the bonus stage then accepts one answer while time remains, and a correct answer credits `bonusSeconds`.
- **Penalties count only toward the ranked time.** The countdown ignores them, so an attempt expires at `startedAt + timeLimit` plus the grace period.
- **Ranking** orders attempts by solved stages (reveal, skip, and bonus excluded), then by ranked time: the last non-bonus stage outcome minus the start, plus penalties, minus the bonus credit. The lecturer dashboard shows the rank, the outcome counts, and the ranked time.

Individual attempts store outcomes in `EscapeRoomAttempt.stageOutcomes`, keyed by stack ID (by element instance ID in Live Quiz blocks). Group attempts append revealed, skipped, and bonus stages to `stageResponses` (with a `null` response for reveal and skip); their `stageOutcomes` hold the wrong-attempt counts and mirror the reveal, skip, and bonus outcomes that the participant view reads.

### Individual Practice Quiz and Microlearning

Participants must explicitly start one unique attempt per activity. The backend masks future stacks, validates that submissions target the current stage, claims concurrent submissions through Redis, grades exact response sets, applies the scoring rules, and completes the attempt once every non-bonus stack is solved, revealed, or skipped. Participant payloads never contain QR answer codes or unused hint text.

Hints are authorized against the current unlocked stack. Each request reveals the next hint in order and charges its penalty atomically; a request with no hint left is idempotent. Only the owning participant receives the restored `revealedHint` and `revealedHints` after reload. Lecturer hint editing uses patch semantics: omission preserves, blank or null clears, and non-empty values are trimmed.

Countdowns start from server-calculated `remainingSeconds` and `expiresInSeconds` snapshots and animate with the browser monotonic clock. Refetches after start, answers, hints, and lockout errors resynchronize those snapshots, while the server remains authoritative for expiry.

The lecturer progress dashboard is roster-based: every enrolled participant appears, including a `NOT_STARTED` row when no attempt exists. Reset requires WRITE access and is rejected while a response lifecycle claim is active. The prune job only marks finished attempts with `retentionProcessedAt`; finalized attempts (`COMPLETED`, `EXPIRED`) are kept, and only a lecturer reset deletes one. Response and instance statistics remain owned by the normal submission path.

### Group Activity

A Group Activity Escape Room has one shared attempt per `(groupId, groupActivityId)`, not one attempt per participant. Start and hint requests carry the group ID from the routed participant page; the server verifies that the activity belongs to the same course and that the authenticated participant belongs to that exact group before using it as the lifecycle actor. This remains deterministic when one participant belongs to multiple groups in a course, while concurrent starts by members of the same routed group converge on one attempt (`packages/graphql/src/services/escapeRooms.ts:startEscapeRoomAttempt`).

Each answerable instance of the stack, in element order, is one stage. The team clears stages in turn: `packages/graphql/src/services/groupEscapeRoomSubmissions.ts:submitEscapeRoomGroupActivityDecisions` accepts exactly one response for the current stage, rejects any other stage with `ESCAPE_ROOM_GATED`, validates the response shape and sample solution, and grades it in one serializable transaction. A correct answer appends the sanitized response to `EscapeRoomAttempt.stageResponses`. A wrong answer counts toward the reveal limit; below it, the shared lockout applies and the stage stays open (`ESCAPE_ROOM_LOCKOUT` with `attemptsLeft`), and at the limit the stage is revealed (`ESCAPE_ROOM_REVEALED`). Clearing the last non-bonus stage completes the attempt and writes the solved stages' responses as the instance decisions; revealed, skipped, and bonus stages contribute no decision. Concurrent answers by two members to the same stage clear it once. Content and flashcards may be displayed but are never stages. QR values are graded against the private source code and cleared before they are stored.

Participant details mask stages after the current one; cleared stages are returned with the team's answer through `EscapeRoomAttempt.stageDecisions`, and the participant page polls while the attempt is in progress so teammates see newly unlocked stages. Progress counts stages rather than stacks.

Hints and penalties are shared across every member and restored after reload. A hint can be revealed only for the current stage. Lecturer progress is group-roster based, including `NOT_STARTED` groups; resetting deletes both the shared attempt and its `GroupActivityInstance` so the group can restart cleanly.

### Live Quiz

A Live Quiz Escape Room is scoped to one non-assessment `ElementBlock` and one attempt per regular participant. It supports SC, MC, KPRIM, numerical, free-text, and QR Scan questions; temporary participants and assessment Live Quizzes are rejected. Participants explicitly start after the lecturer activates the block, and participant payloads reveal only the current uncleared question.

The response API validates the participant token, active quiz/block binding, attempt, lockout, expiry, and current stage before grading. Correct stages are recorded in an attempt-scoped Redis set, deterministic event IDs make accepted retries stable, and the response processor deduplicates delivery before updating ordinary Live Quiz statistics. A block-wide close gate drains active grading and accepted worker events before result aggregation, so a response cannot complete after the closure snapshot. Start, answer, hint, and lecturer reset share the same participant/block lifecycle claim, preventing stale answer or reset races.

The lecturer cockpit polls block-scoped progress, expands the owning course roster with `NOT_STARTED` participants, ranks attempts from `stageOutcomes` like the other modes (attempts completed before outcomes existed rank as solved at `completedAt` with their recorded penalties), and offers WRITE-authorized resets. Live Quiz templates preserve block settings and only the first per-instance hint, and no scoring rules; QR elements created from a template receive fresh private codes.

Closing a block finalizes its running attempts as `EXPIRED`. `deactivateLiveQuizBlock` does this only after `updateLiveQuizBlockResultsFromCache` returned a result, so a failed close leaves attempts running. The progress service applies the same expiry lazily to `IN_PROGRESS` attempts of an `EXECUTED` block, which covers a start that races the close. A stage is cleared when `stageOutcomes` records `SOLVED`, `REVEALED` or `SKIPPED`, or, for an unfinished attempt, when the Redis set has it, so finished attempts keep their counts after Redis expires.

`getEscapeRoomStageResults` normalizes every mode to per-stage outcomes, wrong attempts and hints for the lecturer table. A stage's debrief is stored in the element instance options as `escapeRoomDebrief`. It is kept out of the participant `ElementInstanceOptions` type, and the projector query returns it only once the block is `EXECUTED`.

The projector (`escapeRoomProjector`, page `/quizzes/<id>/escape-projector/<blockId>`) is readable without login with a digest `HMAC-SHA256(APP_SECRET, 'escape-projector:liveQuizBlock:<quizId>:<blockId>')`, or by a lecturer with READ access. The digest unlocks only that query for that block, not the results page, PIN or leaderboard profiles. The payload carries no attempt, participant or group ids. Participants are listed following the Live Quiz leaderboard opt-in (`Participation.isActive` in gamified courses, everyone otherwise), while the lecturer table lists everyone and ranks only opted-in participants.

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
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
