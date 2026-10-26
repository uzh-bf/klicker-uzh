# Lecturer account deletion operator script

## Approved behavior

Prepare a reusable operator command for deleting one lecturer and eligible private
contents. Preview is read-only. Any sharing, foreign use, retained results,
assessment data, unresolved attribution retention or active/scheduled work blocks
the whole operation before any change. Report object kinds/IDs and ask whether
shared contents should be transferred or deleted; never resolve them automatically.
Invoke existing business deletion services, including permission propagation,
cache invalidation and policy refusals. Purge only unused private question rows
after ordinary soft deletion and locked dependency checks. Private object activity logs may be explicitly removed only if their sole object is the purged private question and any attribution belongs to the target. Delete User last only
when no teaching roots remain; never hide cleanup behind User cascades.

Latest direct user ruling supersedes the earlier freeze architecture: no account
freezing; the target lecturer will not log in during deletion. Other accounts
remain online. No schema migration, auth/session gate, global write trigger,
upload lifecycle, indefinite grant ledger or maintenance window is required.
This is a cooperative operator script. It does not promise safe execution against
arbitrary concurrent raw-SQL changes or another process editing the same content.
Shared access and public/published content, scheduled jobs and active workflows
are blockers rather than automatically suspended/cancelled. Apply reruns preview
before effects; later refusal or changed dependencies stops remaining steps and
reports partial progress. It cannot roll back earlier service commits or cloud
effects and must never claim whole-run transactional atomicity.

## Authority and delivery

The user's original script request, business-service reuse, sharing stop,
private-tombstone ruling, source-plan approval and latest no-freezing correction
authorize this reduced source sequence, local synthetic checks, reviews, ordinary
task-branch pushes and draft PRs. They do not authorize real deletion/transfer,
real migration, deployment, merge, marking ready or messaging human reviewers.

Repository /Volumes/HOME/Git/klicker/klicker-uzh, worktree
trees/lecturer-account-deletion. Target origin/v3. Current target and baseline 3d096cf8e38360bac4309ebc756d1a54cc586fbc. Fast-forwarded two OCR-only target commits before candidate checks to avoid stale review workflow behavior. Existing native two-layer topology
retained, no deletion/reordering/renaming: feat/lecturer-deletion-fence (now the
read-only preview foundation), then feat/lecturer-account-deletion (operator
apply). Names are historical, not a claim the script freezes accounts. Main owns
all stack actions. Artifacts root project/, private evidence project/_local/.
Standard execution mode. Runtime is task-scoped; stop it after final verification.

## Implementation

1. Inventory exact UUID + matching email and USER role; refuse ADMIN by default.
   Include all soft-deleted rows. Read exact target roots, graph relationships,
   access grants (direct/derived/group/catalog), foreign child ownership/use,
   retained responses/results/assessment, public state and job IDs. Inventory
   media-container references in all classified persisted rich-text/JSON fields;
   return dependency identifiers only, never foreign prose or participant data.
   Unknown nonempty schema relationships and incomplete URL scans fail closed for apply.
2. Preview produces a versioned JSON report bound to account UUID, matching email,
   database/storage identities and content fingerprint. Private saved reports
   outside tracked files. Offline help must not initialize DB/Hatchet/storage.
   Any blocker returns a report and transfer-or-delete instruction, no marker,
   session, job, permission, DB or blob mutation.
3. Apply requires explicit mode, report path, exact UUID/email/database/storage
   confirmation and unchanged fresh preview. Acquire operator-only exclusion to
   prevent duplicate executions; it does not affect lecturer access. Use existing registered persisted GraphQL mutations over the configured API so resolver
   checks, production cache invalidation and Hatchet wiring remain on the server.
   Sign the target lecturer JWT in memory, never log it. Operator supplies paired
   API/database/storage configuration from one trusted environment and explicitly
   confirms that binding; API userProfile must match UUID/email. Load the existing generated client/server operation manifests and send their persisted hashes; arbitrary operations are refused by production. This check alone
   cannot distinguish cloned databases; do not claim it proves physical identity.
   Delete in dependency order: templates, activities, courses, catalogs,
   questions, answer collections, tags, unused leaves/media, account metadata.
   Respect actual business branches; false/null results and residual roots stop.
   Course deletion uses requestCourseDeletion after child activities are removed.
   Persist intent before that mutation. Observe DB course absence with a bounded
   watcher; acceptance returns only courseId and is not completion. On ambiguous
   response, pending marker, timeout or cancellation, stop; never resubmit blindly.
4. Missing leaves get small service helpers with locked usage checks. Unsupported
   chatbots/threads, credentials/corrections and nonempty competency trees block
   rather than silently cascade. Unused disclaimers/trees may be removed by their
   checked helper. Group deletion/leave operations create new AuditLogEntry attribution without
   a User FK. Therefore any owned group or foreign-group membership blocks before
   effects until retention is resolved; do not call these routes then discover
   the predictable audit blocker. Existing audit attribution also blocks. No invented anonymization or retention policy.
5. Storage cleanup addresses only the exact UUID container after dependency
   cleanup. Preview/confirmation binds storage account without exposing keys.
   Idempotent delete and read-back must establish current unavailability before
   deleting MediaFile rows and User. Unknown/failed cloud calls stop; operator
   resumes from a new read-only preview and reconciled state. Provider soft delete,
   backups/CDN and independent analytics copies are outside active deletion claim.
   No unsupported claim of permanent physical erasure.

## Explicit inventory classification

Direct User relations: Account, Session and read-only UserLogin are authentication metadata
removed only with final User cleanup. Write-capable delegated UserLogin rows block; primary sessions remain under the explicit cooperative assumption. Element, Course, LiveQuiz, PracticeQuiz,
MicroLearning, GroupActivity, AnswerCollection, Tag, CatalogCollection and
MediaFile are teaching roots, routed through corresponding mutations or exact
unused-media finalization. ElementInstance may disappear only through its owning
activity; foreign-owned or orphan instances block. CompetencyTree and
ChatbotDisclaimer require locked zero-use helpers; nonempty trees, Chatbot and
ChatAccountUsage block. PointCorrection, VerifiableCredential revocation
attribution, foreign-object ActivityLogEntry attribution, non-FK AuditLogEntry
source/target IDs, and unclassified references block. Permission/DerivedPermission and AccessRequest rows on foreign content also block. Own-object grants disappear through the ordinary mutations before finalization; final User cleanup must not silently revoke foreign access.
_UserGroupMembers/_UserGroupAdmins membership and owned UserGroup block because
normal mutations create unresolved audit attribution. VerificationToken email
identifiers are not assumed lecturer-only; matching rows block rather than
removing another account's verification state. Unknown nonempty User references
block before effects.

Transitive owned graph: enumerate inbound FK relations with bounded ID/owner-only
queries. Accept only classified private structural descendants: ElementBlock,
ElementStack, ActivityTemplate, AnswerCollectionEntry, GroupActivityParameter,
GroupActivityClue, owned ActivityLogEntry and known permission/join metadata.
Foreign owners or foreign parent placements, answer-entry and template usages,
catalog/public assignments, other users/group access all block. Participation,
responses/detail/live responses, nonzero instance results or anonymousResults,
statistics/performance, feedback, corrections, invitations, credential records,
participant groups/awards/achievements and analytics block. Other nonempty
relations default to unsupported blockers. Never let a cascade classify data.

Media coverage: schema metadata enumerates all persisted text/JSON columns;
scan parameterized exact container UUID independent of hostname, including literal, nested percent-encoded and JSON-escaped forms,
including Element content/explanation/options, ElementInstance elementData,
options/results/anonymousResults, templates, course/activity descriptions,
answer entries, chatbot/avatar/prompts/disclaimers, media href and other string/
JSON fields. Return IDs/kinds, no foreign prose. Permit matches only in records
already inventoried as target-owned descendants. Transferred MediaFile hrefs
into the source container block. The complete text/JSON scan has a 5-second statement cap and 30-second transaction cap; timeout or result overflow blocks apply. A fixed field list was considered and rejected because response/prose copies can reference private media without a teaching FK. Do not weaken this check to make it faster. Unknown or opaque externally stored encodings remain outside active-data coverage; no generic write-time parser is installed.

Work: scheduled task IDs and non-draft/non-template activity status block; Course
assessment/deletionRequestedAt blocks. Read exact-account/source-course Redis
course-duplication source-lock keys without invoking queries that normalize job
status or mutate state. Missing/unknown work-state verification blocks. Do not
assume no-login means no pending work. Operator-created course deletion is the
only allowed pending job after apply starts and is reconciled by exact read-back.

Partial recovery: private receipt records immutable bindings, original action IDs,
and intent/completion around each effect. Fresh preview checks remaining roots.
Absent hard-deleted roots count as complete only for prior intended actions;
Element tombstones require normal-deletion evidence and unused checks before
purge. Pending course marker means observe, not resubmit. Unknown GraphQL outcome
is read back before any further action; null/false stops. Already-absent exact
storage is idempotent success; unreadable or ambiguous storage stops. Stuck course output identifies course UUID, request time and receipt action key, and requires manual worker/job reconciliation. Never automatically cancel or resubmit. No resume
can silently adopt new IDs, transfer ownership, or erase a newly shared object.
Full synthetic success exercises real resolvers/services through an in-process
transport, plus refusal and timeout/crash/soft-delete recovery cases; transport
mocks supplement but do not replace business evidence.

## Background work coverage

The test compares the actual prepareHatchetTasks registration set with a typed
classification map. Publication/expiry tasks are covered by status and scheduled
IDs; aggregation by publication/assessment/results; group/score/timeline work by
participation/group roots; duplication and sweeper by source locks; course deletion
by deletionRequestedAt. Audit transport logs externally and push sending is disabled.
New registrations require explicit classification. This is source coverage for the
matching deployed application revision, not a Hatchet-wide query for arbitrary
external workflows or work from unknown application revisions.

## Feature verification portfolio

| Consequential behavior | Obligation and seam |
| --- | --- |
| No partial delete on sharing/foreign placements/retained data | Add disposable DB preview and full-command refusal tests; no API/blob effects |
| Business permissions, cache events and tombstone cleanup | Add real resolver execution, locked purge refusal and foreign-record preservation |
| Unknown schema and background work | Add synthetic FK drift and actual typed task-registration classification |
| Lost response/pending course recovery | Add full command with real resolvers and transport fault injection; no mutation replay |
| Exact storage/account completion | Add synthetic container identity, metadata and session cleanup; no live Azure call |

## Paths and owners

| Slice | Owner | Files and acceptance |
| --- | --- | --- |
| P1 preview | main | New packages/graphql/src/services/lecturerDeletion.ts; new packages/graphql/test/lecturerDeletion.test.ts; scope classification and checked unused-leaf helpers live in the same service. Synthetic proof all sharing/foreign/retention/job blockers prevent any effect; exact UUID/email binding and complete schema classification. |
| P2 apply | main | Same service/test for locked tombstone purge/finalization; no schema/auth/upload files. Existing services remain unchanged. Real business-service fixtures and participant/foreign preservation. |
| P3 CLI | executor after P2 interface fixed | New packages/graphql/src/scripts/deleteLecturerAccount.ts; new packages/graphql/test/lecturerDeletionCommand.test.ts for independently runnable command integration; existing script typecheck config and docs/data-and-migrations.md main-owned. Offline help, preview default, stale report refusal, exact apply confirmation, safe errors. |

Source mapping for real operator context is delegated read-only while main owns
preflight design. Keep existing services unchanged unless concrete integration
needs a seam. Before adopting new helper files, extend existing modules by default.
No dependency additions. Public PostgreSQL schema only; alternate schemas and cross-schema inbound FKs are refused. No application migrations.

## Verification and terminal

Plan gets one fresh independent Opus critique because no-freezing materially changes
its assumption; latest user instruction supplies scope change, no new generic
approval round. Focused synthetic unit/integration tests cover consequential
behavior: zero effects when blockers exist, service refusals, tombstone guards,
residual-root finalizer, foreign/participant preservation, exact storage and CLI
binding, safe partial recovery. Use marked disposable DB only; no real storage.
No browser/auth/API contract changes remain, so focused source/runtime tests suffice. Both success and refusal use real resolvers in process, with synthetic Redis/storage/fetch boundaries.

Run installed format/lint/typechecks and required repo checks at candidate tips;
previous full checks exposed a generation/declaration issue and host-only suite
routing. Run host policy tests on host and builds/tests in exact task container,
serialize Prisma generation to diagnose rather than bypassing checks. Stop and
verify runtime after final test. Required simplifier/risk review and integrated
Opus final review, hosted CI green at both layer tips, drafts attached and no
outstanding source blockers constitute terminal source delivery.

## Progress

Source implementation complete; integrated final review and hosted CI pending.
Full path, standard execution, existing two-layer draft stack retained. Lower:
https://github.com/uzh-bf/klicker-uzh/pull/6736. Upper:
https://github.com/uzh-bf/klicker-uzh/pull/6737. No real account, cloud or deployment
effects. No schema, auth, upload or account-freezing changes.

The user removed freezing. Opus's two plan consultations were dispositioned:
accepted hostname-independent media, foreign-grantee blockers, explicit course
recovery, delegated-login and background-task coverage, per-step/media checks and
audit verification. Broader concurrent-write locking was rejected under the
cooperative contract. Complete capped media discovery remains conservative;
production-size latency and real Azure behavior are documented operational gaps.

Independent lower risk review passed after explicit ADR0042 historic disclaimer
acceptance guards. Upper risk review passed. Both simplifiers completed; applied
local redundancy removal, public-schema signature reduction and intended-course
map. Reports in ignored project/_local/reviews. All source paths were covered.

Verification: freshly reset identity-guarded disposable DB, 24 focused tests pass;
all four draft activity types and course completion use real mutation/service
logic. Whole-run sharing stop, lost response without replay, stuck course without
resubmit, retained history and media drift are covered. Script and GraphQL
checkers pass. Root check:all was split only for the two host-only suites:
35 container tasks and 162 host tests pass. Full root build:23 tasks pass.
Focused Opengrep reports zero findings and no parse errors. No browser contract
changes or migration; screenshots do not apply. Final runtime shutdown pending.

Substantive package size: lower 2202 lines including consequential integration
tests, upper approximately1800 lines; no generated output or dependency additions.
Each layer has one coherent responsibility and independently runnable tests.
Main preserved unrelated checkout work. Existing task branches remain unchanged
in topology and names. Ordinary commits/pushes/drafts are within approved source
delivery; readiness, merge and real deletion require their separate authority.

Terminal remains complete source reviews and exact-head hosted checks for both
drafts, with the task runtime stopped. No CI, synthetic test or preview grants
real-deletion authority.
