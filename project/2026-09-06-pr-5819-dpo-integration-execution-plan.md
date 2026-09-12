# Participant policy onboarding — first DPO milestone

## Outcome and authority

Deliver the milestones in the current order of the [DPO integration roadmap](./2026-09-06-dpo-integration-roadmap.md), preserving existing styling and authoritative DPO wording. The 12 September priority ruling below supersedes older all-package delivery gates. The roadmap owns policy, source pins, dependencies, decisions, and scope. This plan owns implementation and verification. Both must be read before execution.

The user authorized local implementation, synthetic checks, configured reviews, local commits, task-branch pushes, and draft PR delivery. The deferred broader core delivery remains [PR #5819](https://github.com/uzh-bf/klicker-uzh/pull/5819), branch `rs/dpo-core-integration`, targeting `v3`. AI changes retain their separate `rs/dpo-ai-integration` branch targeting `v3-ai`. The user explicitly approved incorporating the canonical consent prerequisites into the existing task branches, preserving provenance and migrations; the user also authorized direct attested ADMIN research downloads, including selected free text and transcripts, without a separate human review workflow. Shared-branch integration, marking ready, merging, deployment, real-data processing, and unrelated changes remain outside authority.

**First-milestone terminal:** account creation, assessment entry, existing-account completion/renewal, saved participant choices, and the updated privacy policy pass the focused acceptance below. Publish a coherent reviewed draft containing that scope with verified exact-head checks and stop its exact runtimes. Required acceptance or persistence cannot be replaced by a visual demonstration. Exports, analytics processing/configuration and KB confirmations do not block this milestone. The overall DPO backlog remains incomplete until its later milestones pass their own checks. Marking ready, merging and deployment retain their separately named authority boundaries.

## Active extraction — 12 September 2026

Implementation worktree: `trees/rs/participant-policy-onboarding`, branch
`rs/participant-policy-onboarding`, target `v3` at
`bebe30b5f906a8d8efb83583755a7645462810b7`. Remote refs fetched this session.
The coherent account prerequisite gets its own draft; none exists yet.
Existing PRs #5819 and #5825 retain their deferred source. This follows the
approved first-milestone extraction and does not modify existing forge topology.
The M1 plan was approved by planner Bacon in round 2; the local review receipt
remains in the core worktree. Full-path review gates apply.

Main owns the coupled Participant schema, transactional service, GraphQL/response
admission, generated migration and verification. Executor Russell owns the PWA
and DE/EN copy extraction. Trusted worker Euler owns only the two policy pages.
Acceptance is the focused matrix below. Advisor consultation uses GLM continuity
after Claude CLI returned an expired OAuth session; it is not a final review.

The target Participant schema has none of the nine consent/acknowledgement fields.
Reuse researchConsent, researchConsentChoiceAt,
researchConsentDisclosureVersion, learningAnalyticsConsent,
learningAnalyticsChoiceAt, learningAnalyticsDisclosureVersion,
dataUseAcknowledgedAt, dataUseAcknowledgedVersion and dataUseRevision plus
ParticipantDataUseEvent with its unique participantId/revision key, cascading
foreign key and immutable-history trigger. Add no analytics indexes or processors.
The new migration will be schema-generated in the isolated marked runtime.

Overlap in retained migrations: 20260826090907 adds the six purpose columns;
20260907220626 adds the three acknowledgement/revision columns, event table,
unique index, foreign key, function and two triggers. 20260826090913 and
20260826090914 add deferred purpose indexes; 20260908140800 adds the deferred
withdrawal table referencing the event key. The first two overlapping pending
bundles must not be deployed after M1 unchanged. Preserve old branches and
already-applied SQL. Later integration must generate the remaining schema delta
from the landed M1 baseline on a fresh delivery branch, retain all custom
non-overlapping SQL, and compare that final schema to the preserved broad
contract. Existing disposable runtimes with old migration histories are outside
this installation path. Current-target and composed-schema upgrade proof remain
required before claiming compatibility; production applied history is unverified.

## First milestone: account disclaimers and policy — 12 September 2026

The user explicitly prioritized this milestone for Monday 14 September. Implement and verify it before KB work; KB upload confirmations follow second. Actual research/assessment exports and learning-analytics configuration, collection, computation and reports are deferred. Preserve the broader existing work and its contracts, including retained points and all-member group averages, without making that scoring change part of the first release.

### Required behavior

- Normal account creation displays the updated concise disclosures and independent research/analytics choices. Assessment entry displays the same collapsible structure with the additional identity, answer/result, audit-log, authorized-access and retention information, without adding ordinary account fields to assessment completion.
- Existing participants in either normal PWA or assessment must complete the form if the current policies have not been acknowledged or either purpose choice has never been recorded. A saved `false` is complete. Legacy defaults alone do not establish a recorded choice. Preserve saved choices when only policy acknowledgement requires renewal.
- Persist the two account-wide choices, choice metadata, acknowledgement version/time and concurrency revision atomically in the participant database. Retain narrowly scoped acknowledgement/choice history. Reject stale tabs and incomplete direct requests; do not use local storage or a JWT as evidence of current completion. Both optional purposes may be refused without losing course or assessment access after acknowledgement.
- Keep saved-choice profile controls consistent with the policy. Preference capture does not activate a course, collection, computation, export, or dashboard. Preserve legitimate guest access and safe normal/assessment continuation. Include the backend assessment self-deletion restriction needed to support its notice.
- Update the published-policy source in `apps/docs/docs/datenschutz.mdx` and its English counterpart from the supplied 8 September revision, including the user's later assessment clarification. Keep UI and policy links aligned. Describe deferred capabilities truthfully; do not introduce a claim about scoring retention, analytics availability, export availability or deletion timing that the first release cannot support.

### Extraction and ownership

Main owns the focused source/migration dependency cut, auth integration and delivery packaging. The existing broad core PR includes export services, scoring changes, an analytics schema foundation and a withdrawal processor. Do not publish the entire branch as the first milestone or remove these features destructively. Reuse canonical participant field names and acknowledgement semantics, and verify a migration path compatible with later DPO integration; do not import the full analytics schema merely to save two choices or rewrite already-applied migrations.

For this extraction, replace W1's processing dependency with preference persistence: the first-milestone service writes participant choices and their audit event without calling `invalidateAnalyticsEligibility`, creating withdrawal work or starting its consumer. The existing full-DPO service retains those responsibilities for the later milestone. Bringing processing online later requires the writer/withdrawal integration before activation; a saved preference alone is not proof that the processing contract is implemented. Preserve the account row lock and revision checks independently of the analytics-wide lock. Consolidate the account-only regression cases and retain withdrawal-specific tests with their later owner.

Before source extraction, record the exact target schema, canonical participant fields, generated account-only migration identity, and every overlapping operation in the retained broad migrations. Define the later migration path without duplicate column/table creation or edits to already-applied SQL. The existing bundled consent/analytics migration cannot be copied wholesale. Schema-equivalence and upgrade verification must cover both a current-target installation and the later combined DPO path. This reconciliation is a first-milestone implementation prerequisite; analytics computation and its schema are not.

Delegate only settled, separable source work after that dependency cut is known. Preserve the existing core and AI worktrees, unpublished commits and KB WIP. Resolve the focused prerequisite PR packaging before any forge topology change. Core continues to target `v3`; any necessary AI auth adaptation targets `v3-ai` and preserves its current LTI account/guest/scoped-token handling. The future `v3` to `v3-ai` merge remains a compatibility obligation, not authority to merge either target.

### Focused acceptance

Use synthetic fixtures for new normal signup, first assessment entry, and existing participants in both modes with missing acknowledgement, outdated version, either missing choice, and both saved refusals. Verify reload and a new session, profile updates, safe return to the intended activity, duplicate submissions, stale-tab rejection and acknowledgement renewal without resetting choices. Exercise old-token/direct protected API requests and legitimate guest flows; assessment deletion must remain denied server-side.

Verify the minimum schema-aware migration against the target schema without backfilling acceptance. Check DE/EN desktop/mobile forms, collapsed disclosure content, keyboard interaction, policy links and the rendered policy pages. Run focused persistence/auth tests plus required package checks and independent reviews on the extracted source. Historical full-branch checks are reusable only where the tested source and dependencies remain unchanged. Complete exact-head published checks before claiming draft delivery.

### Milestone ownership and test portfolio

This assignment supersedes the older feature-wide Delegation Map and verification dependencies for the first release. Main retains coupled auth, persistence, migration and integration decisions. Source workers receive only the settled owned subset; no worker owns topology or external effects.

| Work | Milestone and owner | Test obligation and acceptance |
| --- | --- | --- |
| Participant fields, acknowledgement, revision and history; minimum migration | M1, main | Replace/consolidate existing account DB cases for the extracted dependencies; extend migration verification for the later combined path |
| Normal signup, assessment entry, existing-account gate and profile | M1, one bounded source worker after the contract is fixed; main integrates auth | Extend existing auth/persistence cases and add focused missing-choice, saved-false, renewal and normal/assessment browser cases where absent |
| German policy, English translation and concise disclosures | M1, main owns source alignment; bounded copy composition may be delegated | No prose-pinning tests; render pages, check links, manually compare the supplied source, and capture relevant DE/EN responsive interactions |
| KB confirmation and transfer | M2, existing KB slice owner | Existing W4 tests plus real transfer/ingestion and direct-bypass acceptance; never a prerequisite for M1 |
| Exports, LA processing and retained points | M3, existing W1 processing, W2 and W3 owners | Preserve existing withdrawal/export/scoring tests and later integration obligations; run only if their behavior changes, never as M1 completion gates |

The first milestone stops at its reviewed, published draft with exact-head evidence and stopped runtime. It does not wait for M2/M3 and does not itself authorize ready marking, merging or deployment.

## Primitive and compatibility contracts

Participant owns the account-wide choices and acknowledgement. ParticipantDataUseEvent
is its immutable revision history; no course-specific consent or analytics owner is added.
Both refusals satisfy completion. Guest admission remains separate. The server checks
current persisted state on protected operations; old tokens carry no completion authority.
Assessment mode reuses the same account form composition with extended notices and a
server-side self-deletion restriction. The account-wide acknowledgement version is
`2026-09-08`; renewing it preserves previously recorded purpose metadata.

The implementation reuses the existing signup, profile, GraphQL and response paths.
New files are the account disclosure, completion gate and settings components,
`account/data-use` page, return-path helper and its behavioral test, the shared
completion predicate, transactional account service, GraphQL gate and operations,
focused account integration/deletion tests, and the single generated migration.
The chatbot launcher preserves its token props on participation errors so the
ordinary client gate can handle incomplete cookie-less accounts.

The v3-ai merge must retain its LTI probe, partitioned-cookie and stored-token
helpers alongside this account gate. Account schema and migration bytes stay
canonical. Later DPO migrations must be generated as the remaining delta from
this baseline; the overlapping deferred history must not be applied unchanged.

## Progress

### First-milestone implementation — 12 September 2026

The account-only extraction is implemented and uncommitted in the active worktree.
Parent retains coupled auth, transaction, migration and integration verification;
independent PWA, policy and fixture source owners have completed their subsets.
The generated additive migration applies to the marked disposable runtime and
Prisma schema diff reports no difference. Focused account/LTI/deletion coverage
passes 28 tests; PWA helper coverage passes 9 tests; GraphQL and PWA typechecks
and the Docs build pass. The corrected broad GraphQL run passes 883/886 tests;
the remaining activity-sharing and assessment-reset failures need baseline
attribution (the existing helpers hardcode unavailable localhost Redis ports).
Browser normal completion, saved refusal, profile update and renewal passed.
Assessment browser, direct response admission, composed-schema compatibility,
root checks/build, committed-slice reviews and draft publication remain pending.
No draft exists for this extraction yet. The older broad native goal is blocked;
this milestone does not complete it. Exact runtime remains active for these checks.


