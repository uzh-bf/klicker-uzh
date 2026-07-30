---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-07-30'
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

## Learning analytics participation

Optional learning analytics has two independent controls:

- `Course.isLearningAnalyticsEnabled` records whether the lecturer has enabled learning analytics for the course. It is separate from `Course.areAnalyticsValid`, which remains an analytics-data validity flag (`packages/prisma/src/prisma/schema/course.prisma:Course.isLearningAnalyticsEnabled`).
- Each `Participation` records the student's current `LearningAnalyticsParticipationStatus` (`UNDECIDED`, `INCLUDED`, or `EXCLUDED`), the disclosure version they acknowledged, their latest choice time, and `learningAnalyticsIncludedFrom` (`packages/prisma/src/prisma/schema/participant.prisma:Participation.learningAnalyticsStatus`).

`Participation.isActive` still controls ordinary course participation and gamification visibility; it is not learning-analytics consent. The shared eligibility helper admits activity only while the course control is enabled, the status is `INCLUDED`, the acknowledged disclosure version is current, and the activity timestamp is at or after `learningAnalyticsIncludedFrom` (`packages/util/src/learningAnalytics.ts:isActivityEligibleForLearningAnalytics`).

Course owners and administrators can change the course control through the
ADMIN-protected `setCourseLearningAnalyticsEnabled` mutation. A serialized
transaction atomically disables lecturer reads and idempotently deletes the
dedicated analytics models. It deliberately keeps participations, choice
history, responses, feedback, grades, points, and XP
(`packages/graphql/src/services/courses.ts:setCourseLearningAnalyticsEnabled`;
`packages/graphql/src/lib/learningAnalytics.ts:isLearningAnalyticsRolloutEnabled`).
The deployment gate `NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED` fails
closed in both the API and Manage UI and must stay off until participant
eligibility, computation filtering, de-identification/suppression, and legal
approval have all landed. The committed devcontainer enables it only for
synthetic local verification (`turbo.json`;
`.devcontainer/devcontainer.env`).

`LearningAnalyticsChoiceEvent` keeps the append-only choice history
(`packages/prisma/src/prisma/schema/participant.prisma:LearningAnalyticsChoiceEvent`).
Interactive PIN joins and course-specific account creation require an explicit,
neutral choice when course LA is enabled. LTI, invitation, and other automatic
joins remain `UNDECIDED` and prompt on the next course entry. The participant-only
choice mutation atomically updates the current snapshot and appends the event;
opting out also deletes participant-level dedicated analytics immediately while
leaving operational data and existing aggregates unchanged. Re-inclusion and
renewal after a disclosure change set a new prospective inclusion time
(`packages/graphql/src/services/participants.ts:setOwnLearningAnalyticsChoice`;
`packages/graphql/src/lib/learningAnalytics.ts:LEARNING_ANALYTICS_DISCLOSURE_VERSION`).
The choice API and PWA control are hidden while course LA is disabled, but the
stored choice and history remain available if the lecturer enables it again.

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

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
