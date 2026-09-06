# DPO workflow integration execution plan

## Outcome and authority

Deliver the four packages in the [DPO integration roadmap](./2026-09-06-dpo-integration-roadmap.md) through ordinary PWA and Manage workflows, preserving existing styling and authoritative DPO wording. The roadmap owns policy, source pins, dependencies, decisions, and scope. This plan owns implementation and verification. Both must be read before execution.

The user authorized local implementation, synthetic checks, configured reviews, and local commits. A1 — separate branch placement is settled by the user; A2 — research delivery contract gates the affected export implementation. No publication, merge into a shared branch, deployment, real-data processing, or unrelated changes are authorized.

**Terminal:** all four roadmap packages pass their applicable behavior checks against their own recorded target baselines, use real local persistence and synthetic transfers, are committed and independently reviewed, and their exact runtimes are stopped. Unavailable prerequisites leave the affected behavior incomplete. Review may assess both branch ranges together but must neither claim combined runtime proof nor require the separately owned future merge. Draft-only results, disabled required capabilities, and screenshots alone cannot satisfy this terminal. Main owns this boundary and continues independent work when a package is gated.

## Separate target baselines

Core DPO changes target `v3`; AI-specific DPO changes target `v3-ai`. Preserve the existing draft worktree and its unrelated deletions. Audit existing task ownership and reuse a suitable task worktree where available; otherwise create isolated task branches from each refreshed target. Do not merge `v3`, `v3-ai`, or the pending consent chain together. The user's expected later merge of `v3-ai` is context, not authorization to perform it.

Core signup, assessment completion, profile, leaderboard, assessment downloads, and operational research exports belong on the `v3` target. Knowledge-base transfers and AI-only chat/analytics enforcement and export adapters belong on the `v3-ai` target. Shared code already present on both branches gets one canonical contract; record cross-branch dependencies and verify compatible adapters without claiming end-to-end behavior before its prerequisite exists. Preserve pending consent schema/API/settings ownership; an unmerged prerequisite is an explicit dependency, not permission to duplicate its model or import its whole branch.

Establish build/check evidence separately for each target and attribute baseline failures. Preserve inherited migration provenance. Implement the smallest DPO-only diffs; do not import the old development-only draft routes wholesale. Final verification records both branch ranges and any integration proof still dependent on the separately owned future merge.

## W1 — account and profile integration

Main owns shared schema, authorization, audit, and API changes. Delegate PWA composition to a native executor after the service contract exists. Reuse the pending chain's `Participant` data-use fields, `services/participants.ts`, `lib/learningAnalytics.ts`, `DataUseSettings.tsx`, and GraphQL operations. Avoid a second consent model and avoid renaming owned physical fields without agreement.

Add separate acknowledgement version/time, a concurrency revision, and narrowly scoped immutable choice/acknowledgement audit records using a suitable existing audit owner where available. Generate the minimum schema-aware migration, normally one for the account contract; sync analytics Prisma and rebuild generated clients. Database defaults remain undecided through absent completion metadata; never backfill acceptance or optional participation for legacy accounts.

Credential creation must atomically validate credentials, explicit LA choice, research choice, submitted disclosure version, and acknowledgement, then persist the account and audit. Authenticated edu-ID/LTI identities may exist locked; one completion transaction makes them usable. Repeated submissions are idempotent. A stale tab cannot overwrite a newer choice unnoticed. Renewing acknowledgement alone preserves purpose choices and effective eligibility history.

Settings use independent mutations carrying the displayed disclosure version and expected state revision. The server checks the submitted version and supplies database time; it rejects stale disclosure rather than stamping an old-page choice with the new version. A changed choice disclosure is distinct from acknowledgement-only renewal. Cancel and failed requests preserve saved state. LA withdrawal atomically changes eligibility and records a durable deletion/handoff request through the existing analytics owner. Re-enablement is prospective. Audit/queue failure cannot produce a false success. Research withdrawal is independent and serializes with research release authorization.

| Actual destination                                          | Integration                                                                                                                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PWA `/createAccount` and `/course/[courseId]/createAccount` | Reuse `components/forms/CreateAccountForm.tsx`; remove password repetition/avatar/profile-visibility choices as required; retain real validation and course/LTI continuation |
| Auth `/student` and `pages/api/auth/[...nextauth].ts`       | Preserve account linking; route incomplete normal and assessment identities to ordinary completion immediately after edu-ID login                                            |
| PWA `/account/data-use`                                     | Shared new ordinary completion/renewal gate; assessment variant contains only notices, research/LA choices, and acknowledgement; keep token `/activation` separate           |
| PWA `/editProfile`                                          | Extend actual `components/participant/DataUseSettings.tsx`; persistent research/LA controls and LA withdrawal confirmation                                                   |
| Chat/LTI/response ingress                                   | Honor the same persisted account-usability predicate and preserve safe destination context                                                                                   |

Enforce current persisted usability on protected GraphQL participant operations, Chat access, assessment/report operations, and authenticated response ingress before queuing. Existing JWTs are not proof of current completion. Allow only explicitly listed authentication, self-state, completion, logout, and account-support operations while locked. Keep lecturer authentication separate. Reject gated registered credentials without anonymous fallback. Preserve accepted assessment submissions across later acknowledgement renewal; optional downstream processing checks its separate eligibility.

Use existing allowlisted origin/return-state helpers and opaque continuation where supported. Preserve LMS cookie-less behavior without introducing tokens in new URLs or logs. The existing chatbot disclaimer stays independent.

**Check:** synthetic PostgreSQL initial/renewal/stale-choice/stale-disclosure/duplicate/failure transactions; persisted reloads; linked/new assessment identity callback tests; old JWT and direct API denial; LTI course/chat return; unauthenticated and legitimate guest compatibility; withdrawal handoff, deletion/retry and re-enable race tests against the actual existing owner. Missing compatible owner is a local implementation dependency, not completion. Verify personal-insight and protected-lecturer-report claims against the integrated dependencies. Where evidence does not support a claim, obtain and record the smallest explicit wording correction before accepting the ordinary screen; do not silently expand into new dashboards or retain an unsupported promise.

## W2 — retained points and leaderboard integration

Delegate the bounded scoring change after main fixes the relevant target baseline and acceptance contract. Inspect all writers/readers around `services/courses.ts`, `services/stacks.ts`, `services/liveQuizzes.ts`, grading, response workers, leaderboard projections, and timeline queries.

Prefer retaining the existing course score record internally and filtering public projections by `Participation.isActive`. Create inactive participation where ordinary registered activity requires private point storage without public opt-in. Accrue ordinary points while inactive, preserve them on leave, and show retained totals immediately on first join/rejoin. Never replay historical rank awards. Preserve independent XP, earned awards, assessment corrections, reset windows, and course access.

Serialize or atomically update score and membership changes to prevent lost/double points. Filter all public course/session projections, not just the visible PWA row. Change the real `/course/[courseId]` join dialog and `LeaveLeaderboardModal.tsx`; `/join` remains course/PIN entry. Do not infer erased historical balances from raw answers.

**Check:** DB-backed inactive accrual, first join, leave, rejoin, duplicate processing, concurrent scoring/join, correction/reset behavior, private timeline visibility, public query exclusion, and unchanged historical awards. Verify the actual PWA course journey in both languages.

## W3 — course export integration

Main owns export authorization, eligibility, transaction/audit, and delivery services. Delegate Manage composition after those services exist. Both actions must be discoverable on Manage course details. Assessment retains the course results and live-quiz results contexts. Research may use a course-scoped dialog or page consistent with existing navigation; an orphan route is insufficient.

Replace the uncontrolled `csvFilename` action in `AssessmentStudentResultsTable.tsx` with the attestation flow wherever that shared table exposes assessment downloads. Reuse the current result columns and numeric/identity meanings. Require course ADMIN permission and a full authenticated authorized session server-side; attestations do not elevate access. Preserve ordinary result viewing under its existing permissions.

Create shared authenticated export services, proposed `packages/graphql/src/services/dataExports.ts`, request mutations, and an authenticated private download route in the backend. Reuse existing CSV primitives for assessment without importing the operator-only export CLI. Persist requester, course/scope, selected classes, relevant project fields, attestation version/time, request status, and exact artifact receipt under an appropriate audit owner. No new project approval administration is required.

For research, implement the contract settled by A2 — research delivery contract. Required project fields, valid email, deletion date not before today, at least one initially unchecked class, and acknowledgement are validated on the server and UI. Live-quiz, asynchronous, LA, and transcript classes remain explicit. Unsupported classes are rejected with a clear reason, never silently omitted or falsely reported exported. Their incompleteness remains visible in roadmap progress.

No direct account/provider IDs or stable cross-export participant keys. Reuse export-local keys consistently inside an artifact. Record-level and free-text content remain personal data; identifier removal is not anonymity. Selected LA derivatives retain their original eligibility provenance; research permission does not require LA permission for operational response records. Recompute research aggregates from the release-eligible population. Stored group values may contain objectors' contributions even without identifiers; reject that class when eligible contributions cannot be obtained. Test a withdrawal that changes a group value before release. Re-enabled research may include older suitable records under the preserved package policy.

Generate bounded artifacts before releasing bytes. Recheck course permission, recorded research eligibility, and relevant revisions at release under a transaction/locking protocol shared with withdrawal. Changed eligibility forces rebuild or rejection. Persist the attestation and exact artifact receipt before the authenticated handoff. Re-download reevaluates authorization and eligibility. Use `no-store`, no public reusable URL, no silent truncation, and truthful failed/cancelled states. Server handoff is not proof the browser saved a file.

**Check:** actual synthetic assessment and research attachments, exact structured field/type semantics, independently selected classes, no direct-ID leakage, formula-safe assessment CSV, server field validation, permission revocation, withdrawal during preparation, failed audit, oversized requests, duplicate requests, and cancellation. Exercise both course-details entry actions and every assessment CSV entry point through the browser.

## W4 — knowledge-base confirmation integration

Delegate bounded KB composition and ticket changes after main settles the attestation schema and service contract. Use actual `/resources/knowledgeBases` and `/resources/knowledgeBases/[id]`, `packages/kb-management/src/components/{CreateKnowledgeBaseModal,KnowledgeBaseAddResourceModal,KnowledgeBaseReplaceFileModal,KnowledgeBaseFileDropzone,KnowledgeBaseUrlForm}.tsx`, and `services/knowledge.ts`.

Separate local file selection from transfer. Both rights and personal-data checkboxes start unchecked and reset on cancellation, reopening, changed material, or changed purpose/audience. Preserve ordinary author names and bibliographic credits. Do not claim automated file inspection or legal certification.

Before issuing upload/replacement SAS or initiating server URL/import fetch, validate authorization and persist the attestations bound to requester, KB, material/replacement target, notice, and current scope. Final confirmation/ingestion verifies the binding. Stale pre-existing tickets cannot authorize ingestion under the new contract. Changed audience/purpose requires renewed rights confirmation before the new use. Test existing shared/import paths as well as creation.

**Check:** local synthetic storage transfer and local ingestion receipt through the production code path, ticket issuance without either attestation denied, replacement/import/direct-call bypass denied, expired/stale bindings rejected, cancel/reset/error behavior, and keyboard/mobile dialogs. Mocks alone do not prove actual transfer. Missing local compatible storage remains a verification dependency.

## Cross-package verification and execution mechanics

Before runtime work, read repository frontend/browser, data-model, GraphQL, and runtime skills as applicable. Container commands use `devrouter exec <exact-worktree> -- ...`; host browser verification uses `pnpm playwright:host -- <focused args>`. Start only the required profiles. No secrets or real exports enter fixtures, logs, commits, or child prompts. No external model inference is required for synthetic acceptance.

Build affected packages before type checks. Run schema generation/sync and GraphQL generation where changed, then relevant native tests, formatting/lint, and required commit checks. Reuse passing unaffected checks. Tests protect consequential behavior, not prose or demo content.

Capture actual DE/EN signup, assessment, renewed gate, profile, leaderboard, both course export actions, and KB states at desktop, mobile, and LMS iframe sizes. Check keyboard focus, reload/back, error recovery, safe redirects, and returned artifacts. Compare with existing app styling.

Package reviewed copies of the German guide and three synthetic attachments as tracked application assets under `packages/shared-components/assets/data-use/`, after checking them for real data and local tooling configuration. Keep the shared ignored originals unchanged. Add an ordinary fixed-allowlist `/api/data-use-assets/[asset]` handler in PWA and use it from production compositions; keep the old development handler scoped to the old draft. Preserve anchors, attachment links, and form state. Verify all four assets using a local production-mode build with synthetic configuration, including missing/disallowed names. Do not use development-handler success as production-route evidence. This source packaging is not publication or DPO approval.

## Delegation Map

| Slice                                                   | Owner           | Dependency                                                                                                  | Acceptance                                                                                                          |
| ------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Separate target baselines                               | main            | A1 — separate branch placement                                                                              | Target-specific ancestry, preserved work, baseline checks                                                           |
| Shared account and attestation schema/API               | main            | Relevant target source                                                                                      | Minimum generated migration, atomic history and validation tests                                                    |
| Core account enforcement (`v3`)                         | main            | Existing consent schema/API/settings chain is not yet in `v3`; shared account contract required             | Core old-session/assessment/response denials and persisted completion                                               |
| AI account enforcement and withdrawal adapter (`v3-ai`) | main            | Compatible canonical account contract and separately owned LA deletion service; do not recreate either      | AI ingress denials and actual owner deletion/retry proof on the AI baseline                                         |
| PWA signup, gate, settings, guide assets                | native executor | Account contract and supported-copy decision                                                                | Real ordinary routes, reload/cancel/error, production-mode links                                                    |
| Retained points and leaderboard                         | native executor | Core target scoring baseline                                                                                | DB accrual/concurrency/publication/award invariants                                                                 |
| Core authenticated exports (`v3`)                       | main            | Core audit/consent contract and A2 — research delivery contract                                             | Assessment and operational research artifacts; permission/eligibility races                                         |
| AI export adapters (`v3-ai`)                            | main            | Canonical export contract plus compatible chat/LA owners; absent prerequisites remain explicit dependencies | AI artifacts and eligible aggregate recomputation on the AI baseline                                                |
| Manage export actions                                   | native executor | Export services                                                                                             | Both course-details actions and existing CSV entry points verified                                                  |
| KB confirmations and tickets                            | native executor | Attestation contract and KB baseline                                                                        | Actual local transfer, direct-call denial and stale bindings                                                        |
| Target-specific verification and closeout               | main            | All required slices and their actual prerequisites                                                          | Separate baseline acceptance, both diff ranges reviewed, local commits, stopped runtimes; no combined-runtime claim |

Main retains schema, authorization, release, and withdrawal seams because their transactions and ownership decisions are coupled. One writer owns shared files at a time; translation changes are serialized by main. Executors do not alter topology, policy, other owners' branches, or external systems.

Commit the approved plan before implementation. Commit coherent substantive slices, then run required simplifier and risk reviewer together when both apply. Main verifies and dispositions their findings. Run one integrated final reviewer on the complete committed local package after all required workflow evidence and exact runtime shutdown. Do not reuse draft review as functional integration review.

## Progress

2026-09-06: Native planner constructed the initial proposal. Parent verified key source contracts and preserved the four requested workflow packages; new analytics dashboards remain outside this execution scope. The same planner approved the roadmap and execution plan after all five challenge findings were corrected. A1 — source assembly and A2 — research delivery contract remain unresolved. No source integration or functional edits have begun. Review evidence is `project/_local/reviews/2026-09-06-dpo-integration-plan-hardening.md`.

2026-09-06: Read-only mapping completed and was preserved in `project/_local/reviews/2026-09-06-dpo-integration-source-map.md`; the mapping worker is closed. All independent planning work is complete. The goal is blocked after the same source-assembly approval boundary persisted for three goal turns. Resume on the pending source-assembly decision; account and leaderboard work can then proceed while the research delivery decision remains pending. No runtime was started and no upstream branches were integrated.

2026-09-06: User settled separate `v3` and `v3-ai` targets and rejected the combined branch. The source-assembly request and blocker are superseded. Resume with target-specific dependency verification and a bounded topology consistency review; the research delivery decision gates only its affected export work. No shared-branch merge is authorized.

Topology review correction: split core and AI enforcement/export ownership and acceptance. Each branch is verified independently; unavailable prerequisite behavior remains incomplete. The future shared-branch merge is not part of this terminal.

Native planner approved the revised topology after those two corrections. Formatting and whitespace checks passed. Current refreshed targets: `v3` at `19f2cac7eaa7a35f5502d697e61844ed3d4ce847` and `v3-ai` at `5c8ee4b6a034c22da8e85159214c629f371d0f3d`. The core target still lacks the pending consent fields. Begin independent retained-points integration on the core target while preserving the consent chain as a dependency.

2026-09-06 delivery: User authorized commits, push to draft PRs, and a device handoff. This supersedes earlier publication exclusions only for this checkpoint. Portable reviewed source material is in `project/dpo-reference-package/`; review receipts are in `project/dpo-review-evidence/`. Future functional work still targets separate branches, with no shared merge or deployment authority.
