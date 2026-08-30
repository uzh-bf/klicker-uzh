---
type: Domain Model
title: Domain Model
description: Core entities (User vs Participant, Course, Element, activities), status lifecycles, and the two-track gamification system.
timestamp: '2026-08-27'
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

`Participation.isActive` is the **course-leaderboard opt-in**, not an enrollment flag. It defaults to `false`; joining the course leaderboard flips it to `true`, and leaving the leaderboard sets it back to `false` while keeping the row and collected points. The existence of the `Participation` row is the course-membership check used by participant chatbot discovery and student MCP practice access. Assessment course access and assessment report issuance are backed by the **accepted course invitation** plus an active participant account — never by `Participation.isActive` — so leaderboard-inactive students keep their assessment and practice access.

### Assessment participant invitations

`ParticipantInvitation` records the intention to admit one email address to one SSO course before a `Participation` necessarily exists (`packages/prisma/src/prisma/schema/participant.prisma:ParticipantInvitation`). Email and course are unique together; the optional `matriculationNumber` is administrative metadata. Its `InvitationStatus` lifecycle has two states: `PENDING` and `ACCEPTED`. An accepted row links a `Participant` and records `acceptedAt`; it is retained as the admission record.

Invitation creation normalizes emails and matriculation numbers, reports invalid rows without failing the rest of a batch, and immediately accepts an invitation only when exactly one active `Participant` is identified through verified **affiliation** `ParticipantAccount` records (`packages/graphql/src/services/participantInvitations.ts:createParticipantInvitations`). Assessment-course imports accept at most 200 rows per request; larger files must be split before submission. A duplicate email does not create a second row; a newly supplied matriculation number updates only a `PENDING` invitation, while accepted admission records remain immutable. Unexpected database failures surface through GraphQL instead of becoming row-level success data. Lecturer-side deletion is deliberately narrower than course deletion: only `PENDING` invitations can be removed (`packages/graphql/src/services/participantInvitations.ts:deletePendingAssessmentParticipantInvitation`).

## Content hierarchy

- **`Element`** (`element.prisma`) — a question-bank item owned by a `User`; versioned via `version`/`originalId`; `type: ElementType`; options live in a typed `Json` field.
- **`ElementInstance`** — a _placement_ of an Element inside an activity. `type: ElementInstanceType` = `LIVE_QUIZ | PRACTICE_QUIZ | MICROLEARNING | GROUP_ACTIVITY`. It **snapshots** `elementData`/`options` at publication time and accumulates `results` — editing the source Element does not change published instances.
- Grouping differs by activity: **`ElementStack`** (ordered instance group) for PracticeQuiz/MicroLearning/GroupActivity; **`ElementBlock`** (with scheduling status) for LiveQuiz only.

`ElementType`: `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY`. Type-specific behavior is dispatched in `packages/graphql/src/services/stacks.ts` (correctness: `evaluateChoicesAnswerCorrectness`; per-type grading and response-format branches). Pure scoring math is in `packages/grading/src/index.ts`: `gradeQuestionSC`, `gradeQuestionMC` (hamming-distance partial credit), `gradeQuestionKPRIM` (0 wrong → full, 1 wrong → half, else 0), `gradeQuestionNumerical`.

## Chatbot response examples

`Chatbot` has at most one `ResponseExampleSet`. Each set owns current,
mutable `ResponseExample` rows scoped by exact `chatMode`, plus
`ResponseExampleEvidenceReference` rows that retain source, chunk, content-hash,
and citation-anchor lineage without storing source bodies. A response example
has one of the statuses `CANDIDATE`, `APPROVED`, `NEEDS_REVIEW`, or `REJECTED`.

The set stores a deterministic SHA-256 digest of its canonical content and
lineage projection. Review edits update the current row and digest; there is no
revision-history model. Deleting the chatbot cascades through the set, examples,
and evidence references. Synthetic candidates and evidence-eligible fixtures
are created only by local and test setup, not by a production caller.

### Student-owned practice elements

`PersonalElement` (`personalElement.prisma`) is a participant-owned,
course-bound practice card. It is deliberately separate from the lecturer-owned
`Element` table and currently stores only `FLASHCARD` content. A participant
must have a `Participation` row for the course, and temporary participants are
not eligible. Course and participant deletion cascade to the cards.

The row keeps its own SM-2 state (`eFactor`, `interval`, streak and response
counters, and `nextDueAt`). The GraphQL service caps a participant at 500 cards
per course and validates the grouped `ElementSourceReference` value stored in
the existing `sources` JSON. One reference represents one source material and
contains a stable title snapshot, source kind, exact cited chunk IDs as internal
lineage, an optional safe canonical URL, and ordered page spans or exact web
anchors. The parser accepts the unreleased flat prototype for compatibility but
every new write is grouped. It bounds references, chunk IDs, locators, URLs,
and the 64 KiB serialized value, rejects source bodies and signed URLs, and
persists no retrieved text.
The `origin` field records whether content was AI-generated or authored. Content
revisions increment `version`; the revision and learning-state reset contract is
defined by the service and does not create a lecturer trust state. Chat proposes
and generates at most five cards per request, and generation failures use
bounded codes rather than provider or retrieval diagnostics.

The backend owns the card-plan and candidate lifecycle.
personalElementGenerationContext authorizes course participation and returns
the course language and complete saved-title list without card bodies.
prepareCardPlan screens proposed titles against saved cards and within the
proposal using the deterministic title-similarity policy, and assigns stable
server-issued candidate identities. validateCardCandidate re-checks
participation, the accepted plan and active generation lease, source-message
ownership, the structural Flashcard payload, source bounds, and current title
similarity before a candidate can render. Generated content is validated structurally
(non-empty, bounded, contains letters or digits), never by matching English or
German sentences. The save transaction enforces candidate-ID uniqueness and
the per-course card cap, and repeats the title-similarity check inside the
serializable save transaction so two accepted candidates cannot pass a stale
read.

The full lifecycle is exposed through participant-authenticated GraphQL
operations. claimCardGenerationLease atomically claims or reclaims the
generation lease only after verifying current course participation, a published
chatbot, the exact ready plan tool result, a live server-claimed assistant
attempt on that plan's branch, and the absence of a newer ready plan on the same
branch. Completion requires the completed assistant message to contain a
terminal card-generation result;
completeCardGenerationLease and abortCardGenerationLease settle only the
caller's current attempt.
savePersonalElementCandidate accepts only course, assistant-message, tool-call,
and candidate identifiers. It reloads the persisted terminal generation
result, verifies its participant, course, published chatbot, accepted plan, and
lease lineage, and saves that candidate idempotently with the final duplicate
check in its transaction. discardPersonalElementCandidate accepts the same identifiers,
reloads the same trusted terminal candidate, and persists the negative decision
idempotently without copying generated content. updatePersonalElement applies
the expected-version and scheduling contract to a saved card.
savedPersonalElementCandidateIds returns only the requested saved candidate
identities for generated-message reloads; listPersonalElements returns the full
course collection used by practice and saved-card management.

Source references are system-managed. Manual edits to card text preserve the
existing set. A successful generated revision is reconstructed from its
persisted terminal assistant message and tool call, supplies the full card, and
replaces the complete set atomically; an abstention or failure changes neither.
The row's source message and tool-call fields identify the latest applied
generated content and make that exact revision idempotent.
The saved `PersonalElement` owns this snapshot independently of the Chat
generation record, so generated-message retention is not the citation
lifecycle. The rationale and future lecturer-owned composition contract are in
[ADR 0042](./adr/0042-generated-elements-own-source-reference-snapshots.md).

Chat candidates are not bulk-selected. Each card is saved or discarded on its
own. Discard uses the same persisted message, tool-call, and candidate lineage
as Save before storing `PersonalElementDiscard`, scoped to the participant,
course, and candidate ID; the save service rejects that candidate inside its
serializable transaction. This keeps the decision durable without copying
generated content into lecturer-owned tables.

`CardGenerationLease` is the durable claim for an approved Chat generation.
It links the participant and plan message, uses a unique
participant/plan-message/tool-call key, and expires for retry recovery. It is
operational coordination, not a second user-facing approval object.

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

The KB is the source of truth for two derived representations: a Milvus index for semantic RAG and a FalkorDB knowledge graph for GraphRAG, question generation, visualization, and other graph-based AI features. Both representations use the same KB resource set; there is no graph-specific resource selection. Chatbots consume these KB-owned representations through their enabled KB binding rather than owning either representation.

Ownership follows three explicit system boundaries. Klicker owns KB product state, authorization, graph lifecycle, graph quota enforcement, and the lecturer/student experience. Catalyst owns graph generation, FalkorDB operation, the GraphML archive, graph-quality evaluation, and KG-system end-to-end tests. AI infrastructure owns data-ingestion, doc-processing, and pgvector. Catalyst consumes those provider contracts but does not import their code or control their operational lifecycle. This boundary is recorded in [ADR 0011](./adr/0011-catalyst-owns-knowledge-graph-runtime.md).

Knowledge graphs are optional per KB. A lecturer-level public-beta feature flag grants permission to enable the capability, but it changes no KB by itself. A lecturer with that permission explicitly opts individual KBs into graph generation; student graph access requires both that opt-in and a successfully published graph. The backend kill switch `KB_GRAPH_DISABLED=true` blocks new opt-ins and dispatches while leaving existing read and cleanup paths available.

The two representations have independent lifecycles. Milvus ingestion remains resource-scoped and determines ordinary RAG readiness. FalkorDB generation is an expensive, KB-wide operation performed by an external graph-generation system outside this repository, and it consumes the processed documents ingestion already produced rather than the original blobs and URLs. Because each build spends the lecturer's own AI budget, builds are never scheduled: only an explicit request from a user with KB-edit permission starts one. The worker rechecks the global switch, KB opt-in, and reservation before the external effect; an already accepted external run is still reconciled if a gate changes afterward. A graph build failure does not block or regress the Milvus representation.

The KB's content revision is a digest over the active serving set — the `resourceId` and `activeContentSha256` of every non-deleted resource with an active hash — computed on demand rather than materialized on `KB`, so concurrent ingestion never serializes behind a single row. A resource stays in that set while a newer lecturer operation is `QUEUED` or `PROCESSING`; the pending operation state never suppresses its still-serving revision. A build request pins a KlickerUZH-generated build id, the KB id, that digest, and the per-resource hashes; the external system resolves them to processed documents and must fail the build when what it reads does not match. `KBGraphBuild` is the append-only build ledger, mirroring `KBIngestionRun`: its UUID is the build/idempotency key handed to the external system, which answers with its own operation id. `KB.activeGraphBuildId` is the single build slot and `KB.publishedGraphBuildId` names the build FalkorDB currently serves. At most one build is active per KB, claimed by conditional update, and a repeat request for the revision already building returns that build. When the KB advances mid-build the running build still finishes and publishes for its own revision; nothing is cancelled, no follow-up build is queued automatically, and KB edits are never blocked. Reconciliation uses the versioned terminal-result handoff with cron polling as backstop; provider status alone is never a publication proof: a W1-versioned terminal result must match the build, KB, owner, run, source digest, graph name, artifact, and metering identity before settlement.

Nothing lands in FalkorDB until a build is complete: each build writes to its own recorded graph name and the published pointer moves only to a successful build, so no reader ever observes a partial graph and a failed build leaves the serving graph untouched. An operational FalkorDB graph that is no longer active or published stays through a bounded retirement grace period before KB maintenance sweeps it. A successful build's GraphML export follows the longer knowledge-base archive lifecycle: it remains while the knowledge base exists and for 30 days after deletion, and it is excluded from the resource quota. Failed or incomplete builds do not create a durable GraphML archive.

FalkorDB is a reconstructible serving projection rather than the durable graph record. Completed GraphML artifacts form the graph archive and recovery source; a restore validates build identity, source digest, provenance, and graph counts before publication moves. The operational trade-off is recorded in [ADR 0010](./adr/0010-graphml-archive-recovers-falkordb.md).

The restore half of that decision is not built yet: no code in this repository imports a GraphML export back into FalkorDB (roadmap W4 step 6). Until it lands, losing FalkorDB means rebuilding every affected graph from its sources at the lecturer's cost, even though the archive itself is now retained for the full knowledge-base lifetime per [ADR 0015](./adr/0015-graphml-follows-kb-lifecycle.md). Operationally: the archive protects the record, not the recovery time.

Every successful GraphML version remains archived while its KB exists. Deleting the KB starts a 30-day recovery grace period, after which maintenance purges its archived graphs. Long-term archival beyond that beta policy requires a new general-availability decision. The lifecycle is recorded in [ADR 0015](./adr/0015-graphml-follows-kb-lifecycle.md).

Version identity is the build ledger, not a separate version table. `KBGraphBuild` rows are append-only, each row is one attempt and the immutable record of the graph it produced, and the knowledge base's `activeGraphBuildId`/`publishedGraphBuildId` pointers are the only liveness state. Unified SC, MC, KPRIM, and flashcard generation keys `ElementGenerationBuild` off that build id instead of minting a second graph-version identity. Its generated drafts and reviews are build children, while each initial generation or flashcard retry provider call has an append-only `ElementGenerationSpend` keyed by the durable dispatch attempt. This is recorded in [ADR 0017](./adr/0017-graph-build-ledger-is-canonical.md).

Graph quota, AI credentials, and billing are separate concerns. Klicker enforces a non-sensitive per-lecturer, per-semester monetary quota and a per-build maximum in integer minor units, with persisted usage counters bounded to the database integer range. `KBGraphQuota` is locked while a reservation is created or settled; graph builds record `RESERVED`, `SETTLED`, `RELEASED`, or `NEEDS_HUMAN_REVIEW` so duplicate terminal delivery cannot double-charge. Before graph dispatch it reserves the estimated maximum cost and durably claims the provider-dispatch phase; an accepted run whose id cannot be correlated retains its reservation for human review and is not externally retried. Catalyst later reports actual metered cost against the build id and Klicker settles the reservation idempotently. A valid non-success result with metering settles actual usage without publishing, while an unmetered non-success releases only an ordinary reservation. A malformed, mismatched, over-reserved, overflowed, or unmetered success result holds the reservation for human review and never publishes. After a timeout, a matching late success can reclaim and publish only when no newer build exists and the current active-resource digest still matches; stale or superseded late results settle usage without publication. Cleanup claims also fence successful late results, so an artifact that is already being deleted cannot be resurrected as published. Automatic release only closes an ordinary `RESERVED` build; a later valid callback may reconcile a held build once before cleanup, while another malformed or failed result remains held.

Element generation spends from that same lecturer-semester quota. Each initial question/flashcard dispatch and each flashcard retry reserves one configured fixed price in a separate `ElementGenerationSpend`; the provider dispatch UUID is the idempotency key. Klicker validates deterministic coordinates first, claims the spend immediately before the provider call, and settles it only after acceptance or exact-run recovery. A definite failure before the claim releases it. An uncertain claimed outcome retains the reservation and fences redispatch while the provider index becomes consistent; after a 15-minute grace, only a definitive empty exact-attempt lookup releases the hold. Review and incomplete-publication events add no spend. The lecturer config keeps persisted quota currency separate from historical graph-build cost and reports quota currency/limit drift as unavailable. This accounting contract is recorded in [ADR 0013](./adr/0013-klicker-reserves-and-settles-graph-cost.md). For UZH-issued credentials, sensitive lecturer-to-cost-account information stays outside the Klicker database and is maintained manually in a spreadsheet for the beta. BYOK lecturers are billed by their own provider, while Klicker quota controls still apply. AI-provider credentials are a reusable platform concern shared by every AI feature, not part of the knowledge-graph model. Consumer applications retain only opaque handles and safe status; the generic custody and runtime-resolution design remains a separate work item.

The lecturer sees the cost boundary before spending: estimated maximum cost, remaining semester quota, and worst-case resulting balance. After Catalyst settles the build, the lecturer sees actual usage and cost. BYOK is identified as provider-billed; UZH-issued usage is identified as semester-billed.

The initial release is explicitly a beta and may open after the existing system tests and internal production canary pass. Curated real-model evaluation is a beta learning loop rather than an entry gate: Catalyst versions 30–50 reviewed, non-personal goldens from approved or synthetic sources and starts with local reports. That evidence gates widening, general availability, and graph-quality claims, as recorded in [ADR 0014](./adr/0014-beta-learns-before-quality-thresholds.md).

The last successfully published graph may remain available after the KB's active content revision advances, including after a resource is deleted or withdrawn. Staleness is the mismatch between the graph's pinned source digest and the current KB digest; timestamps alone are not the consistency contract. Klicker does not disable the graph automatically, and it does not surface staleness to students: the label appears only on the lecturer-facing KB and graph views, where the people who can spend a rebuild are the ones who see it. A provider `COMPLETED`, `FAILED`, `CANCELLED`, or timeout observation without the versioned result handoff clears the active slot, does not move the published pointer, and holds the reserved cost for human review; a later valid result may settle the ledger but still cannot publish without passing the same identity checks.

Resources move through `ADDED → QUEUED → PROCESSING → READY | FAILED`. `KBResource` stores the latest operation identity (`resourceVersion`, exact-byte `contentSha256`, attempt, and external operation), the independently active serving identity (`activeResourceVersion` and `activeContentSha256`), and the latest safe error code. `KBIngestionRun` is the append-only, resource-scoped ledger: lecturer dispatch uses the local attempt UUID, while a signed platform `resource.content_refreshed` event uses its event UUID and records the platform operation ID. A refresh advances only the serving identity, so it cannot overwrite a concurrent lecturer operation; the resource list and its status filter resolve through the stored lecturer attempt rather than the newest ledger row. A failed replacement therefore remains visible without erasing the previously active serving version. Ingestion transport and atomic status reconciliation are described in [Async & Workers](./async-and-workers.md).

Deletion is asynchronous and fenced by `deletedAt`/`deletedById` on both `KB` and `KBResource`. Owner queries hide tombstones immediately, while a `DELETE` ingestion run advances the resource version and retains local correlation state until the external serving version and digest are both empty. `KBUploadTicket` persists every blob-scoped upload grant with the same 15-minute expiry; confirmation atomically consumes it after creating the resource. The restrictive KB relation keeps pending tickets discoverable while abandoned blobs wait through the 24-hour retention grace.

`KBChatbot` is the typed ownership link between a knowledge base and a chatbot. A chatbot may retain historical disabled links, but the partial unique index `KBChatbot_one_enabled_per_chatbot_key` permits at most one enabled knowledge base per chatbot. The corresponding KB MCP configurations are derived runtime state, not the ownership relation itself.

Each KB retains at most 100 resource allocations and 500 MiB. Quota accounting includes hidden resource tombstones and unconsumed upload tickets, so asynchronous cleanup and concurrent upload requests cannot free or oversubscribe capacity early. A ticket reserves its declared bytes; confirmation converts that reservation into a resource without double counting. URL bytes become known during source preparation and atomically replace that resource's previous measured size under the parent-KB lock.

Lecturer-facing metrics are derived from these rows rather than stored counters. They distinguish visible resources and known bytes from retained quota usage, conservative 25 MiB reservations for legacy unknown-size rows, upload reservations, pending cleanup, and enabled chatbot consumers. The catalog computes the same measures with bounded grouped queries for one page of owned KBs.

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
- **Date shifting:** MicroLearning/GroupActivity schedules shift by the local calendar-day delta between old and new course start while preserving the Europe/Zurich wall-clock time across DST changes (`courseDuplication.ts:getCourseStartDayDelta`, `courseDuplication.ts:applyCourseStartDelta`). The duplication dialog initially derives the group creation deadline from its original offset to the course start, then lets the lecturer override it before creating the copy (`apps/frontend-manage/src/components/courses/modals/CourseDuplicationModal.tsx:FormikNativeDateInput`).

## Gamification details

- Responses are stored as `QuestionResponse`/`QuestionResponseDetail` (`response.prisma`) with `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Leaderboards: `LeaderboardEntry` with `LeaderboardType` `SESSION | COURSE`, updated via `stacks.ts:updateLeaderboardOnQuestionResponse`.
- `Achievement` (`gamification.prisma`) has `type` PARTICIPANT/GROUP/CLASS and `scope` GLOBAL/COURSE, with per-subject instance models; `Level` defines XP thresholds as a linked list; `Title` and `AwardEntry` complete the set.
- **Unmapped (verify in code before relying on it):** the exact trigger points for achievement awards, and the LiveQuiz bonus-point formula (time-decay multipliers).
