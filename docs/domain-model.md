---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-08-01'
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

## Knowledge bases

Lecturer-owned knowledge bases use `KB` with child `KBResource` records (`packages/prisma/src/prisma/schema/knowledge.prisma:KB`, `packages/prisma/src/prisma/schema/knowledge.prisma:KBResource`). A resource is either a private uploaded blob or a public HTTP(S) URL. URL registration rejects credentials, fragments, secret-like query parameters, non-standard ports, and literal local, private, reserved, or IPv6 destinations through `packages/util/src/publicUrl.ts:normalizePublicHttpUrl`. Dispatch preparation resolves and pins every redirect hop to a public IPv4 address; the ingestion platform still enforces its own independent egress policy.

Resources move through `ADDED → QUEUED → PROCESSING → READY | FAILED`. `KBResource` stores the latest operation identity (`resourceVersion`, exact-byte `contentSha256`, attempt, and external operation), the independently active serving identity (`activeResourceVersion` and `activeContentSha256`), and the latest safe error code. `KBIngestionRun` is the append-only, resource-scoped ledger: lecturer dispatch uses the local attempt UUID, while a signed platform `resource.content_refreshed` event uses its event UUID and records the platform operation ID. A refresh advances only the serving identity, so it cannot overwrite a concurrent lecturer operation; a failed replacement therefore remains visible without erasing the previously active serving version. Ingestion transport and atomic status reconciliation are described in [Async & Workers](./async-and-workers.md).

Deletion is asynchronous and fenced by `deletedAt`/`deletedById` on both `KB` and `KBResource`. Owner queries hide tombstones immediately, while a `DELETE` ingestion run advances the resource version and retains local correlation state until the external serving version and digest are both empty. `KBUploadTicket` persists every blob-scoped upload grant with the same 15-minute expiry; confirmation atomically consumes it after creating the resource. The restrictive KB relation keeps pending tickets discoverable while abandoned blobs wait through the 24-hour retention grace.

`KBChatbot` is the typed ownership link between a knowledge base and a chatbot. A chatbot may retain historical disabled links, but the partial unique index `KBChatbot_one_enabled_per_chatbot_key` permits at most one enabled knowledge base per chatbot. The corresponding KB MCP configurations are derived runtime state, not the ownership relation itself.

Each KB retains at most 100 resource allocations and 500 MiB. Quota accounting includes hidden resource tombstones and unconsumed upload tickets, so asynchronous cleanup and concurrent upload requests cannot free or oversubscribe capacity early. A ticket reserves its declared bytes; confirmation converts that reservation into a resource without double counting. URL bytes become known during source preparation and atomically replace that resource's previous measured size under the parent-KB lock.

Lecturer-facing metrics are derived from these rows rather than stored counters. They distinguish visible resources and known bytes from retained quota usage, conservative 25 MiB reservations for legacy unknown-size rows, upload reservations, pending cleanup, and enabled chatbot consumers. The catalog computes the same measures with bounded grouped queries for one page of owned KBs.

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
