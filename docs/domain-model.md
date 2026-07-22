---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), canonical element invariants, status lifecycles, and the two-track gamification system.
timestamp: '2026-07-22'
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
