---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), canonical element invariants, status lifecycles, and the two-track gamification system.
timestamp: '2026-09-05'
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

### Assessment participant invitations

`ParticipantInvitation` records the intention to admit one email address to one SSO course before a `Participation` necessarily exists (`packages/prisma/src/prisma/schema/participant.prisma:ParticipantInvitation`). Email and course are unique together; the optional `matriculationNumber` is administrative metadata. Its `InvitationStatus` lifecycle has two states: `PENDING` and `ACCEPTED`. An accepted row links a `Participant` and records `acceptedAt`; it is retained as the admission record.

Invitation creation normalizes emails and matriculation numbers, reports invalid rows without failing the rest of a batch, and immediately accepts an invitation only when exactly one active `Participant` is identified through verified **affiliation** `ParticipantAccount` records (`packages/graphql/src/services/participantInvitations.ts:createParticipantInvitations`). Assessment-course imports accept at most 200 rows per request; larger files must be split before submission. A duplicate email does not create a second row; a newly supplied matriculation number updates only a `PENDING` invitation, while accepted admission records remain immutable. Unexpected database failures surface through GraphQL instead of becoming row-level success data. Lecturer-side deletion is deliberately narrower than course deletion: only `PENDING` invitations can be removed (`packages/graphql/src/services/participantInvitations.ts:deletePendingAssessmentParticipantInvitation`).

## Content hierarchy

- **`Element`** (`element.prisma`) — a question-bank item owned by a `User`; versioned via `version`/`originalId`; `type: ElementType`; options live in a typed `Json` field.
- **`ElementInstance`** — a _placement_ of an Element inside an activity. `type: ElementInstanceType` = `LIVE_QUIZ | PRACTICE_QUIZ | MICROLEARNING | GROUP_ACTIVITY`. It **snapshots** `elementData`/`options` at publication time and accumulates `results` — editing the source Element does not change published instances.
- Grouping differs by activity: **`ElementStack`** (ordered instance group) for PracticeQuiz/MicroLearning/GroupActivity; **`ElementBlock`** (with scheduling status) for LiveQuiz only.

`ElementType`: `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY`. Type-specific behavior is dispatched in `packages/graphql/src/services/stacks.ts` (correctness: `evaluateChoicesAnswerCorrectness`; per-type grading and response-format branches). Pure scoring math is in `packages/grading/src/index.ts`: `gradeQuestionSC`, `gradeQuestionMC` (hamming-distance partial credit), `gradeQuestionKPRIM` (0 wrong → full, 1 wrong → half, else 0), `gradeQuestionNumerical`.

### Import/export persistence

Import/export durable state is owner-scoped and intentionally excludes participant/activity records. `ImportExportPackageArtifact` records an immutable exact private storage target, reserved/final bytes, digest, state, and expiry. `ElementImportReceipt` binds a unique token `jti`, immutable owner/source artifact/package hash/selection digest/selected refs, operation lease, and typed arrays of created IDs for exactly-once recovery. Once complete, its state, result arrays, and completion/retention timestamps are immutable; the optional live artifact relation may still become null after package expiry without losing token binding or replay results. `ImportMediaStaging` records an immutable receipt/owner/storage-target/content-hash identity plus fenced copy operation, state, and expiry; receipt identity never authorizes enumeration or deletion of unrelated blobs. Database triggers reject cross-owner links and identity/result rebinding. User and receipt deletion is restricted while exact cleanup records remain; media deletion or ownership transfer detaches the optional media relation without erasing staging history.

The application policy is a 24-hour artifact lifetime, hourly record-scoped cleanup, and longer completed-receipt retention. These durations are persisted as timestamps rather than database defaults. Upload, copy, transaction, retry, exactly-once replay, quota/lease, and cleanup boundaries are wired through the durable records above. Didactic fingerprints use version 2, while media classification remains independently versioned at 1. Every successful application-authored write leaves each active element and answer collection with a current, non-null didactic fingerprint before its transaction commits; Hatchet refresh and repair are defense-in-depth for historical or unexpected drift. With import/export enabled, first-party auto-loading media must resolve to its matching-owner `MediaFile` with media version 1 and either a valid SHA-256 or a null hash representing a deterministic known export omission; lifecycle markers, missing/stale rows, owner mismatches, and malformed hashes reject. While the feature is dark, lifecycle markers remain forbidden but ordinary legacy unresolved media is accepted for mixed-version rollout compatibility. The schema columns remain nullable during rollout, but a null fingerprint or a null/mismatched didactic version on an active resource violates the application invariant. For media, a null/mismatched `importFingerprintVersion` is unresolved, version 1 plus `contentHash` is verified package media, and version 1 with a null hash is an intentional known omission.

## Canonical element domain

**Element options are no longer trusted as an untyped JSON record.** `packages/graphql/src/lib/elementDomain.ts:canonicalizeElementOptions` is the neutral, strict per-type boundary for all nine element types. Normal authoring calls it through `packages/graphql/src/services/elementMutationPreparation.ts:prepareElementMutation`, which produces one typed canonical persistence/relation plan for `elements.ts:manipulateElement`; the split package parser, snapshot, and import/export services call the same neutral canonicalization boundary before trusting or persisting options. Unrelated partial edits preserve existing legacy options and relations without recanonicalizing them. The domain module does not import from import/export code.

The canonical representation has these shared rules:

- Unknown option fields are rejected. Student-visible content must be meaningful; rich authored text is NFC-normalized without trimming its layout-significant whitespace.
- `pointsMultiplier` is an integer from 1 through 4. `CONTENT` and `FLASHCARD` always have `basePoints=false`; their multiplier remains part of the canonical payload.
- Only `SELECTION` and `CASE_STUDY` may carry answer-collection relations. Selected entry references are unique, belong to the linked pool when the pool is known, and type-inapplicable relation fields are rejected.
- Disabled solution or feedback flags remove the corresponding solution/feedback fields from the canonical representation instead of retaining dormant scoring data.

Per-type invariants are:

| Element type          | Canonical invariant                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SC` / `MC` / `KPRIM` | Choices are sorted into unique contiguous indices `0..n-1` and have meaningful text. With a sample solution, every `correct` value is Boolean; SC has exactly one correct choice, MC at least one, and KPRIM exactly four choices. An all-false KPRIM solution remains valid. Enabled answer feedback must be meaningful.                                                                                   |
| `NUMERICAL`           | Every value is finite and within `[-1e30, 1e30]`; negative zero becomes zero. Bounds are inclusive and ordered, accuracy is an integer in `0..100`, and configured solutions use exact values **or** ranges, never both. Solutions must lie within restrictions. Blank unit/placeholder text is removed.                                                                                                    |
| `FREE_TEXT`           | Every solution is trimmed without changing its Unicode normalization form; the current grader distinguishes canonically equivalent encodings, so preserving that representation is required for scoring fidelity. Blank solutions are rejected. `maxLength`, when present, is a positive integer and every solution must be reachable within it. Authored duplicates remain valid and preserve their order. |
| `SELECTION`           | `numberOfInputs` is a positive integer and cannot exceed the available pool. Correct entry references are unique pool members. A sample-solution pool contains at least `numberOfInputs` entries and may contain more; without a sample solution the selected solution list is removed.                                                                                                                     |
| `CASE_STUDY`          | Criteria and cases have unique non-reserved IDs and sequential zero-based order. Criterion bounds are finite with `min < max`; the step is positive and no wider than the range. With a sample solution, every selected item has exactly one bounded solution for every criterion in every case, and every correct interval contains at least one slider-reachable value.                                   |
| `CONTENT`             | Options are the strict empty object and base points are disabled.                                                                                                                                                                                                                                                                                                                                           |
| `FLASHCARD`           | Options are the strict empty object, explanation is required and meaningful, and base points are disabled.                                                                                                                                                                                                                                                                                                  |

`packages/graphql/test/elementDomain.test.ts` is the pure valid/invalid regression matrix for these rules.

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
- **Copied:** selected activities, including live-quiz random selection and ElementStack titles and descriptions (through the existing `manipulate*` services with a transaction client — creation invariants are not re-implemented), direct permissions of the course and of each copied activity (minus the duplicator's own row), `competencyTreeId`, `authType`, gamification/assessment flags. Every copied permission writes an `AuditLogEntry`. If a non-owner ADMIN duplicates, the source owner is granted ADMIN on the copy (`courseDuplication.ts:grantDuplicatedCourseAccessToSourceOwner`); the duplicator becomes OWNER.
- **Not copied:** participants/participations, groups, results, leaderboards, responses. Copies land in DRAFT with zeroed `results`/`anonymousResults` and fresh `instanceStatistics` (`packages/util/src/elements.ts:getActivityInstanceConnectOrCreate`, duplication branch). Live-quiz PINs are regenerated, never reused; a SSO course's `pinCode` is nulled.
- **Shared elements:** duplicated instances connect to the **same `Element` rows** and keep the source instance's `elementData` snapshot (same item version the previous cohort saw, even if the Element moved on — `areInstancesOutdated` flags the drift). Element edits reach both courses only through the instance-update flow.
- **Date shifting:** The duplication dialog requires a new start date; the end date is derived from the original course duration and cannot be edited in the dialog. MicroLearning/GroupActivity schedules shift by the local calendar-day delta between old and new course start while preserving the Europe/Zurich wall-clock time across DST changes (`courseDuplication.ts:getCourseStartDayDelta`, `courseDuplication.ts:applyCourseStartDelta`). The dialog initially derives the group creation deadline from its original offset to the course start, then lets the lecturer override it before creating the copy (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:FormikNativeDateInput`).

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
