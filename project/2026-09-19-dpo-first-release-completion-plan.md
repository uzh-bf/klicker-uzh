# DPO first-release completion plan

## Approval summary

Complete the first DPO release with transparent account disclosures, current privacy-policy acceptance, independent research and Learning Analytics (LA) choices, durable persistence, and accessible settings. Cover normal and assessment signup, existing PWA participants, registered chat participants, and persisted chat guests. Guests receive a short first-use explanation and the same choices before sending messages. Refusing both optional purposes permits ordinary use after acknowledgement.

Keep the shared database and participant contract on `v3` through PR #5970. Put chat-specific integration in a focused companion targeting `v3-ai`, consuming that foundation through the established branch synchronization. Preserve the existing authentication identity order and the separate per-chatbot disclaimer. Replace student-facing examples of individual LA rows with group-only explanations and synthetic illustrations. Publish the supplied final privacy-policy wording alongside the release.

The principal unresolved release risk is existing analytics code that ignores the new choices. This plan requires bounded containment and completion of any required retained-derived-data reconciliation before claiming the choices are effective. It does not implement the later analytics product, research exports, assessment exports, or KB confirmations.

The user approved these product boundaries and requested this detailed plan on 19 September 2026. This turn delivers a reviewed plan only. Subsequent implementation follows the packages and acceptance checks below. Task-branch commits and ordinary PR delivery are covered by standing implementation authority; target merges, protected-branch synchronization, deployment, and real-data cleanup require their named authorization. Completion means verified source and release evidence, not an implied deployment.

## Status and source of truth

- **Execution status:** user approved full implementation with an active goal on 19 September 2026. Core source changes are underway; verification is blocked by host runtime compatibility. The original planning review remains valid.
- **Owner:** main task owns integration, unresolved decisions, acceptance evidence, and release boundaries. One owner per package below; parallel execution is optional where write sets are disjoint.
- **Artifact home:** this `project/` directory in the existing task worktree. This is the current execution plan for the first release and supersedes older statements postponing chat onboarding.
- **Historical progress:** the 6 September DPO roadmap and PR #5819 execution plan remain historical records. Preserve their broader deferred work; do not import those broad branches into this release.
- **Review record:** native planner approved the revised plan on 19 September 2026 after one correction pass. Local evidence: `project/_local/reviews/2026-09-19-dpo-first-release-plan-hardening.md`. Implementation review and exact-head CI remain separate future evidence.

### Verified baseline — 19 September 2026

| Item                  | Verified state                                                                                                                        | Consequence                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Core PR               | [#5970](https://github.com/uzh-bf/klicker-uzh/pull/5970), open, non-draft, base `v3`, head `553fce6793c7f2153f49cabfad52cda9fc09fb91` | Preserve current PR state; audit the complete diff, not only new changes.                         |
| Task checkout         | `trees/rs-dpo-release-stack`, branch `rs/dpo-release-1-disclaimers`                                                                   | Reuse for core source and this plan.                                                              |
| Target                | `origin/v3` at `b15ac7434e9a427ff00d3b2868ef4821fd0d1bb7`; task is 26 ahead and 4 behind                                              | Refresh and deliberately integrate the resolved target before final proof.                        |
| AI target             | `origin/v3-ai` at `fde799a07884e2dd05a234c974f52cb4eb858168`                                                                          | Chat implementation must use this branch's current auth/guest contracts.                          |
| Existing broader work | Core PR #5819 and AI PR #5825 have preserved worktrees                                                                                | Reuse reviewed ideas selectively; do not ship deferred features through wholesale merges.         |
| Checks                | Previous head had passing required checks; final external AI review remained incomplete after provider failure                        | Reuse unchanged local proof only where applicable; obtain new exact-head CI after source changes. |

The dirty devcontainer/devrouter files, `packages/prisma-data/package.json`, `turbo.json`, and untracked `packages/prisma-data/src/scripts/local-eduid-link.ts` are separate local Edu-ID work. Exclude them from this package. Preserve the primary checkout's branch and other worktrees. This planning task neither starts nor stops a runtime.

## Scope and branch placement

| Required for this release                                            | Owner / target                             | Explicit completion boundary                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Normal signup, assessment entry, PWA policy renewal, profile choices | Core / `v3`, PR #5970                      | Existing screens, server enforcement, persistence and recovery verified.                                  |
| Shared consent state, version, revision and audit contract           | Core / `v3`, PR #5970                      | One canonical writer; explicit false counts as completed; no parallel chat schema.                        |
| Website privacy policy and student LA explanations                   | Core / `v3`, PR #5970                      | Final German source and English meaning reviewed; public explanation accessible before acceptance.        |
| Registered chat renewal and guest onboarding/settings                | Chat / focused `v3-ai` companion           | No content submission or model use before account-level completion; both refusals permit use.             |
| Minimal enforcement of deferred optional processing                  | Core and chat, in their respective targets | No optional collection/use contradicting a refusal; any required retained-LA reconciliation is completed. |

### Deferred packages, preserved for continuation

1. **KB confirmations:** upload/import/replacement and audience-change confirmation, direct API enforcement and ingestion proof. Resume against the already improved KB implementation after this release.
2. **Research and assessment exports:** permission checks, purpose eligibility, download behavior and audit evidence. No new exporter is required to save choices.
3. **LA product:** course activation, eligible computation, group-only reports, withdrawal processing/recomputation and operational monitoring. Minimal containment in this release is a prerequisite, not completion of this package.
4. **Retained points and group semantics:** retain previously settled behavior; gamification group averages include all members. Do not interpret LA opt-out as a change to gamification or course access.

No unrelated OAuth mocks, auth refactoring, new retention duration, analytics activation UI, provider migration, or infrastructure redesign belongs in the first release.

## Binding behavior

### Account and consent primitives

The existing `Participant` is the subject of the choices. Reuse its research/LA values, choice metadata, current disclosure acknowledgement, revision and append-only `ParticipantDataUseEvent`. Database Boolean defaults alone are not evidence of a recorded decision. An explicit `false` with complete metadata is a completed choice.

Research initially displays allowed for a new or unanswered account, with a visible state and an accessible opt-out. LA starts unanswered and requires an explicit yes/no. Submission requires an unchecked mandatory acknowledgement. Never silently persist the research default on page load, expand/collapse, authentication, or guest creation. Save acknowledgement and both choices atomically through the shared writer.

On policy renewal, retain recorded choices and choice timestamps unless the participant changes a value. Never silently turn a refusal into permission. Profile changes to a purpose do not implicitly renew policy acknowledgement. A stale revision or uncertain write must reload canonical state and require renewed acknowledgement where appropriate rather than overwrite another tab's changes. A retry after a successful write must remain safe.

Select one coordinated disclosure revision for the release. The currently implemented identifier is `2026-09-08`; it identifies disclosure semantics, not the website publication date. During copy reconciliation, decide whether the newly introduced guest presentation adds a material disclosure change requiring a bump. PWA, chat and server must agree on the accepted revision and completion predicate. Avoid different contracts under one identifier and avoid an unnecessary second renewal during the same rollout.

### Surface contracts

| Surface                                      | Required presentation                                                                                                                                   | Required behavior                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Normal signup, including Edu-ID continuation | Existing concise approved normal disclosure; data categories retained; independent choices                                                              | Required acknowledgement; both refusals still create a usable account.                                                          |
| Assessment account creation/entry            | Same collapsible structure, with assessment identity, responses/results, audit logs, authorized lecturer access and account/data retention restrictions | Correct assessment variant from trusted context; refusal does not block assessment; self-deletion restrictions remain enforced. |
| Existing PWA account                         | Mandatory completion/renewal route; saved choices retained                                                                                              | Return safely to the intended route after success; no redirect loop through privacy/help/logout.                                |
| Registered chat account                      | Mandatory account-policy completion in the chat entry flow                                                                                              | Preserve resolved identity and requested bot/thread; completion must not trigger guest fallback.                                |
| First-time chat guest                        | Short guest-account notice, privacy link, independent choices, unchecked acknowledgement, start/cancel actions                                          | Persist choices on the resolved guest participant before chat use; cancel causes no chat message/model call.                    |
| Returning chat guest                         | Renew only when version or choice metadata is incomplete                                                                                                | Reuse existing persona and choices; do not recreate a guest to evade the gate.                                                  |
| Settings                                     | Saved research and LA values, relevant consequences and links                                                                                           | PWA profile and guest-accessible chat settings write the same canonical record with revision protection.                        |

PWA's current completion page satisfies the blocking renewal requirement; do not replace it with a modal only to match the conversational word “popup.” Chat may use an in-app dialog/screen, with accessible focus handling and no dismiss-to-chat bypass. A forced completion surface must retain a meaningful cancel/exit path.

### Guest copy and identity

Use a short German introduction, translated equivalently into English:

> **Chat als Gast nutzen**
>
> Für diesen Chat wird ein Gastkonto angelegt. Du musst keinen Namen und keine E-Mail-Adresse angeben. Deine Chatnachrichten und die für den Betrieb erforderlichen Nutzungsdaten werden gespeichert und deinem Gastkonto zugeordnet.
>
> Du kannst unabhängig entscheiden, ob deine Daten für Forschung und Learning Analytics verwendet werden dürfen.

Follow this with the shared purpose choices, a linked privacy-policy acknowledgement and **Chat starten** / **Abbrechen**. Reuse approved research and LA wording; this introduction supplements the supplied account text where the guest workflow differs. Do not describe guests as anonymous or promise that messages cannot contain personal information. Do not add a new terms-acceptance requirement accidentally while adapting the guest form.

The current LTI guest key is derived from the launch subject and course. The same subject/course reuses a persona; another course can have another participant record. Choices therefore apply to that guest persona. Do not promise cross-course synchronization or link guests to registered accounts in this package.

A minimal guest identity/participation record may already exist when LTI launch completes. Explain this honestly; do not rewrite authentication to defer identity creation. Before acknowledgement, allow only operations needed to resolve identity, present/save choices, view policy/help, or exit. Block new messages, attachments, content processing, model calls and optional-purpose processing. Token expiry is not a retention policy and does not prove deletion of a guest account or chat history.

### Authentication and chatbot disclaimer composition

Keep authentication, account completeness, bot/course authorization, and bot-specific disclaimer as separate checks. In particular, do not fold consent completeness into `isActiveAccountParticipant` or another predicate that resolves missing/invalid identity and can fall back to a guest. Preserve session → linked account → guest launch precedence and existing runtime token precedence.

Registered and guest chat requests use a structured completion-required response after identity validation. The client preserves the intended destination and opens the appropriate completion surface. Unknown/expired identity follows existing authentication failure handling; it must not become a consent bypass or silently switch participant.

The existing `ChatUsageCredits.acceptedDisclaimerId` and `acceptedDisclaimerAt` remain the per-chatbot disclosure record. Completing account policy does not accept the bot disclaimer, and accepting the bot disclaimer does not complete account policy. Compose the sequence as identity/access resolution → account completion → bot-specific disclaimer → chat use. A changed bot disclaimer independently prompts again.

Ordinary anonymous live-quiz participation and its temporary participants are not the persisted chat-guest use case. Preserve their existing behavior. `Participation.isActive` remains a leaderboard flag, never a substitute for consent or access authorization.

### Processing and deletion truthfulness

The reviewed policy describes LA as separately enabled and automatically deleted when deactivated. Current source does not yet establish that behavior: the Python participant analytics collector reads participants without the new eligibility check, lecturer reads expose existing derivatives, and `ParticipantAnalyticsWithdrawal` has no verified consumer. A first recorded false for a legacy account may create no withdrawal if the old Boolean was already false.

The release must therefore keep deferred LA processing inactive and prevent access to disallowed derivatives. Inventory collectors, scheduled/pending jobs, recomputation, read/export paths and any optional chat telemetry. The first-release default is whole-path LA containment, not selective activation for opted-in participants. Stop or effectively block scheduled, queued, running and directly invoked derivation, and contain derivative reads/exports. Use an existing suitable switch if one exists; otherwise implement the smallest explicit containment. Findings requiring selective activation or a broader analytics implementation require a plan amendment before that work. `Course.areAnalyticsValid` is cache validity, not course LA activation. Do not repurpose it.

Preserve operational responses, scoring, assessment audit logs and chat history needed to provide the requested service. Do not equate them automatically with optional LA derivatives. Do not activate new research processing or telemetry by saving preferences. Any already active research-use path must respect recorded eligibility or remain contained until its later implementation.

Before release, determine whether retained derived LA data or pending withdrawals exist using authorized, values-free evidence. If they exist, prepare an idempotent, scoped reconciliation/cleanup with a dry-run and clear source/derived boundaries. Legacy first refusals must be covered. Actual retained-data deletion requires a separate named approval with target, backup/recovery limits and affected data classes. Disabling reads alone is not proof of deletion; a queued request is not completed deletion. The launch prerequisite is proof that writers are blocked, in-flight work cannot recreate derivatives, required scoped reconciliation/deletion is completed, and reads remain contained. Apply this before exposing the new choices and policy promises. If this cannot be resolved, report a release blocker instead of making the policy or UI promise untrue.

## Shared implementation seam

Include the following preparation on `v3` before merging the foundation; chat consumes it after normal synchronization. These are proposed edits, not claims that the files already exist.

| Seam                            | Concrete implementation boundary                                                                                                                                                                                                       | Contract                                                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical writer                | Keep implementation in `packages/graphql/src/services/participantAccountDataUse.ts`; narrow its context parameter to the existing Prisma client and verified user `sub`/`role` fields it actually uses                                 | GraphQL passes its existing context; chat constructs that small context only after validating its participant identity. Keep role validation, transaction, revisions, timestamps and errors in one implementation.                                 |
| Server-only package entry       | Add `packages/graphql/src/participant-data-use.ts` as a narrow re-export; extend existing `packages/graphql/rollup.config.js` in both normal and instrumented-test entry lists to emit `dist/participant-data-use.js` and declarations | Chat imports this server entry only; do not pull the GraphQL schema or Prisma into browser code and do not add a new package/dependency. Verify emitted path and transitive imports.                                                               |
| Shared choice presentation      | Move the reusable choice view to `packages/shared-components/src/participant/ParticipantDataUseChoices.tsx`; keep PWA `ParticipantDataDisclosure.tsx` as its normal/assessment composition                                             | The moved view remains browser-only and uses existing design-system controls and shared translations. PWA and chat are the two concrete callers. Avoid a generic consent-form framework.                                                           |
| Chat transport                  | New `apps/chat/src/app/api/chatbots/[chatbotId]/data-use/route.ts`                                                                                                                                                                     | GET reads canonical state; POST completes acknowledgement and choices; PATCH changes one recorded purpose. Existing verified participant/bot access and origin protections apply even before completion. No request accepts a participant ID.      |
| Chat composition                | New `apps/chat/src/components/ParticipantDataUseGate.tsx`, integrated into existing `assistant.tsx`                                                                                                                                    | One normal/guest presentation and settings mode; use the shared choice view and existing request helper. Keep bot-specific disclosure separate. Extend existing `apiGuards.ts`, without altering identity resolution, to apply account completion. |
| Conditional reconciliation tool | Only if inventory proves no existing tool can satisfy retained-data cleanup: `packages/prisma-data/src/scripts/reconcile-participant-analytics-withdrawals.ts`                                                                         | Dry-run by default; explicit scoped execution, idempotency, derivative-only allowlist, no output containing participant content. Exact table inventory and live execution authority must be resolved before implementing destructive mode.         |

The transport returns the canonical purpose values and metadata, acknowledgement version/time, revision, current required version and completion status. POST accepts the existing completion input (`expectedRevision`, `disclosureVersion`, two Booleans, `acknowledged: true`). PATCH accepts one purpose, its Boolean value, disclosure version and expected revision using the existing choice-update semantics; it never renews acknowledgement.

Map existing domain error codes without changing their meaning: invalid input → HTTP 400, stale revision → 409, completion required → 403, lock timeout → 503 with recoverable UI, forbidden → 403; expired/missing authentication retains the current 401 behavior. Do not convert database/transport errors into success or default consent values. GET and successful writes return current canonical state; on conflict or uncertain response the client rereads it. Version mismatch uses the existing invalid-input response and refreshes required-version metadata before resubmission.

The new completion route bypasses only the account-completion check, never identity or bot/course authorization. Existing content routes remain protected: `chat`, `practice/submit`, `knowledge-graph`, thread/message/attachment/feedback/title operations and bootstrap reads must be classified explicitly. Do not gate unrelated lecturer preview/manage routes through participant logic. Public policy/help are accessible without loading protected history.

## Delegation map and stop conditions

Current planning uses standard mode because the exact main-model identifier is not established. The native `planner` owns read-only plan hardening. Resolve the active execution mode again when implementation begins; the following assignments avoid duplicate ownership and require no new user-visible tasks.

| Slice                                              | Assigned owner                                                            | Dependency / boundary                                                                                                     | Stop condition                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Package 0 and shared server seam                   | Main                                                                      | Auth/data decisions are tightly coupled to existing source; no external dispatch of private documents                     | Inventory or public-contract change exceeds this plan: report the concrete amendment before dependent work.          |
| Core UI and docs in Package 1                      | Native `executor`, bounded write set assigned after Package 0             | Only approved copy/behavior and public synthetic artifacts; main owns original private documents and final reconciliation | Shared contract unresolved; continue unrelated copy review locally.                                                  |
| Core containment in Package 2                      | Main                                                                      | Requires classified operational-versus-derived data boundaries                                                            | Live access or destructive reconciliation lacks named authority; complete dry-run/source work first.                 |
| Chat seam and AI-specific containment in Package 3 | Main                                                                      | Requires foundation availability through authorized target integration; authentication coupling justifies local ownership | Wait for foundation integration; continue independent core/doc work. No duplicate schema or workaround branch merge. |
| Package 4                                          | Main, with configured simplifier/reviewer roles at their applicable gates | Integrated source and available verification environment                                                                  | Preserve exact head and report missing browser/provider/CI capability; passing unrelated checks cannot replace it.   |

The executor is a native bounded subagent, not a new peer task. If its provider cannot receive the required context within the repository privacy boundary, keep that work in main and record the reason. Main must still verify its output. The reviewed plan is not a command to dispatch all roles at once.

## Implementation packages

### Package 0 — Reconcile source, copy and release inventory

**Owner:** main. **Dependencies:** none. **Acceptance:** an exact-head inventory identifies what already works, remaining changes, active optional-processing paths and unresolved release evidence.

- Fetch remote state; reconfirm PR bases, protected branches, task dirt and ownership. Integrate current `v3` into the core task branch once needed for readiness, with a normal merge and explicit source SHA. Preserve unrelated work.
- Review PR #5970's complete range against this plan. Reuse passing behavior coverage; do not recreate the implementation or pull in broad PR #5819/#5825 changes.
- Compare the German disclosures and policy with the supplied DOCX files using accepted tracked changes. Review English for equivalent meaning. Keep documents and extracted private originals outside public Git history. Do not test prose using exact-string snapshots.
- Resolve the common disclosure revision, policy URLs and rollout compatibility. Inventory live configuration only within authorized systems; no cluster connectivity or production content discovery is implied.
- Record current collectors, eligibility checks, derivative stores, read paths and withdrawal processing. Unknown live activation remains unknown until verified.

### Package 1 — Finish the shared foundation and student information

**Owner:** core. **Target:** PR #5970 / `v3`. **Acceptance:** all core journeys work with durable choices, accurate notices and public explanations; migration and API compatibility are reviewed.

Primary files are `apps/frontend-pwa/src/components/participant/{ParticipantDataDisclosure,ParticipantDataUseChoices,DataUseSettings}.tsx`, the existing signup/profile and `pages/account/data-use.tsx` routes, `packages/util/src/participantAccountDataUse.ts`, `packages/graphql/src/services/participantAccountDataUse.ts`, and `packages/graphql/src/lib/participantAccountGate.ts`.

- Close verified defects in normal/assessment signup, renewal and profile settings with the smallest changes. Keep design-system buttons and independent collapsibles with whole-row triggers. Research starts collapsed; show its choice without requiring expansion. All sections can remain open together.
- Recheck the existing schema/migration rather than add another consent model. Review Prisma-generated provenance, schema equivalence, custom SQL necessity and immutable-audit/cascade semantics. Add a migration only if a demonstrated schema gap requires one; use the repository's generated migration workflow.
- Reuse the atomic writer and revision contract. Expose only the smallest server-side reusable boundary required by chat; do not create parallel mutation variants or duplicate locking/audit transactions.
- Review `apps/docs/docs/datenschutz.mdx`, `apps/docs/docs/privacy_policy.mdx`, and the LA use-case content in `apps/docs/src/constants.tsx`. Replace/remove the individual-student performance-table illustration and claims, preserving useful group-level examples. Any replacement uses synthetic group data.
- Provide a direct, locale-correct LA explanation link available before acceptance. Explain what the choice covers, group-level presentation, where it can be changed, and current availability honestly. Privacy and LA information must not depend on completing the gate they explain.

### Package 2 — Enforce minimal optional-processing containment

**Owner:** core, coordinated with chat for AI-specific paths. **Target:** respective existing branch owners. **Dependencies:** Package 0 inventory. **Acceptance:** no inventoried optional writer/read path violates recorded choices or deferred activation; required retained-derivative reconciliation is complete and pending/in-flight work cannot recreate it.

- Cover `apps/analytics/src/modules/participant_analytics/get_participant_responses.py`, relevant scheduling/recomputation entry points, `packages/graphql/src/services/analytics.ts` and their GraphQL reads. Preserve operational data flows and gamification.
- Disable the whole deferred LA path at its effective boundaries; do not add selective LA activation in this release. Test direct invocation and reads, not just hidden UI. Handle queued work without introducing a new analytics platform.
- Reconcile pending withdrawal records and legacy first-false cases in the release inventory. Prepare minimal cleanup tooling only if existing mechanisms cannot satisfy the required disposition. Keep real-data execution separately authorized.
- Measure the shared LA advisory-lock behavior for synthetic existing-user renewal and LA-settings changes. Initial signup avoids this lock and must remain independent. The existing five-second timeout must fail atomically with recoverable UI. Change lock granularity only if evidence shows a real onboarding problem; independently review any locking change.
- Document deploy-time containment settings, rollback behavior and evidence required to prove them. Do not infer live containment from source flags alone.

### Package 3 — Add registered and guest chat completion

**Owner:** chat. **Target:** focused companion on `v3-ai`. **Dependencies:** stable shared contract from Package 1; production delivery follows foundation integration. **Acceptance:** registered and guest browser/API journeys persist the same records and enforce both independent disclosure layers.

Primary seams on `v3-ai` are `apps/chat/src/lib/server/apiGuards.ts`, `apps/chat/src/lib/server/ltiGuest.ts`, the chat request routes, `apps/chat/src/components/assistant.tsx`, and `apps/chat/src/services/disclaimers.ts`. The guest identity module should need little or no change; it is evidence for persona scope, not a refactoring target.

- Add authenticated status/completion/settings transport using the shared canonical service. Derive participant identity from verified server context; never trust a submitted participant ID. Preserve existing origin, scope and bot/course protections, including embedded usage.
- Add the account-completion guard to every content-use entry point identified by inventory, including attachments and alternate message/thread routes. Allow only narrowly required completion/help/exit operations before acknowledgement. Recheck current persisted state on requests, not only a cached token claim.
- Reuse common choice components through an existing shared package where both apps need them. Extract only browser-safe presentation; keep Prisma and server functions out of client bundles. Do not copy independent form or persistence implementations.
- Show the registered-user renewal and simplified guest notice. Preserve bot/thread/return destination safely. Keep pending requests from automatically sending on acknowledgement unless the user explicitly resumes sending.
- Provide chat-accessible guest settings with canonical values, revision handling and relevant withdrawal consequences. Reuse this entry point for registered chat users if it avoids unnecessary navigation without expanding scope.
- Preserve and compose the bot-specific disclaimer. Verify all combinations: account missing only, bot disclaimer missing only, both missing, both current, and either changing later.

### Package 4 — Integrated proof and release preparation

**Owner:** main. **Dependencies:** Packages 1–3 and completed required retained-data reconciliation. **Acceptance:** reviewed PRs, exact-head checks, browser evidence, compatible branch sequence and a truthful release checklist.

- Run the feature-wide tests below in the repository's required runtime. Use synthetic local identity fixtures; do not alter production OAuth/authentication for test convenience. Host Git/forge commands and host Playwright retain their repository boundaries.
- Capture actual DE/EN desktop/mobile screenshots and interaction evidence for normal signup, assessment entry, existing-user renewal, profile choices, registered chat, guest onboarding/settings and student LA information. Record current source SHA, route, viewport and fixture provenance; publish permitted synthetic evidence through the project forge workflow.
- Perform simplification and final review under the active execution-mode rules. Resolve ordinary review feedback before final AI review; a provider failure is a pending gate, never a successful review.
- Update whole-branch PR descriptions with scope, migration/rollout consequences, screenshots, tests and remaining release gates. Preserve #5970's current non-draft state; any new companion starts draft. Do not request human reviewers automatically.
- Record completed and deferred work in this plan. Supply the exact merge/deployment/cleanup sequence for separate authorization when code and evidence are ready. Do not declare deployment complete from source or CI alone.

## Branch and rollout sequence

Keep core and AI ownership separate. Native GitHub stacks are supported, but a `v3` foundation and a `v3-ai` consumer are not a native parent/child stack simply because the consumer depends on the foundation. This plan changes no stack topology. Use a cross-PR dependency until the established `v3` → `v3-ai` synchronization carries the shared contract.

1. Finish and verify PR #5970 against fresh `v3`. Prepare the focused chat change against current `v3-ai` with its dependency explicit. If shared code is unavailable there, limit preparation to contract/design work until authorized foundation integration; do not duplicate migrations or combine the broad DPO branches into a verification branch.
2. After separately authorized merge of the verified core head, synchronize `v3` into `v3-ai` by the repository's normal merge convention. This target-branch push needs named authority. Follow the repository's integration-PR exception for substantive conflicts.
3. Refresh the chat task branch from the integrated `v3-ai`, complete browser/API proof and exact-head CI, and merge only with separate authorization. Verify shared schema, version, defaults and writer are identical.
4. Prepare ordered deployment: compatible database foundation; verified optional-processing containment and required retained-data reconciliation; then reachable updated policy/docs and core API/PWA/chat gates. Containment must precede exposure of the new promises and choices. If deployment is staggered, old chat must be contained or held back from user traffic until it can enforce the shared choices. Do not announce end-to-end completion during the gap.
5. Promotion beyond `v3-ai` follows `v3-ai` → `v3-audit` through the required integration PR and exact-head checks. Any deployment, live cleanup or branch promotion requires its own approved targets and effects.

A rollback must not erase saved choices, acknowledgement history or audit events. Preserve additive schema and containment while reverting incompatible UI/server changes. Review mixed-version behavior and migration rollback limitations before production approval; never regain availability by silently bypassing completion.

## Feature-wide acceptance portfolio

Use behavior and structured protocol assertions. Do not pin translations, prose, screenshot hashes or demonstration records. Reuse existing tests when they already observe the invariant.

| Boundary                | Required cases                                                                                                                                                                                                       | Primary evidence                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Atomic persistence      | Both false; each independent combination; initially unanswered LA; metadata completeness; stale revision; duplicate retry; event failure rollback; acknowledgement renewal preserving unchanged choice timestamps    | Existing `participantAccountDataUse.integration.test.ts` and `participantDataUse.integration.test.ts`, extended only for gaps |
| Core admission          | Existing token becomes incomplete after version change; direct API bypass denied; allowed completion/help/logout; both refusals permitted; ordinary temporary live-quiz behavior preserved                           | Existing GraphQL gate and subscription tests plus focused regressions                                                         |
| Normal/assessment UX    | Signup, trusted assessment variant, first login, reload, keyboard, multi-open sections, collapsed research, two-tab conflict/uncertain response, safe return path, assessment deletion restriction                   | Existing `playwright/tests/A-login.spec.ts`, assessment deletion tests and browser walkthrough                                |
| Chat admission          | Registered versus guest identity retained; no consent-driven fallback; direct message/attachment routes denied before completion; expired/scoped tokens; embedded origin/session behavior; both refusals permit chat | Existing chat guard/LTI/embed tests plus minimal completion regressions and real browser paths                                |
| Guest lifecycle         | First launch, cancel, same-persona return, different course persona, renewal, guest settings, persisted refusal after reload and relaunch                                                                            | Synthetic LTI/browser fixture; canonical database/API assertions without outputting tokens                                    |
| Two disclaimer layers   | Account only/bot only/both required; neither accepts the other; changed account version and changed bot disclaimer each prompt independently                                                                         | Chat service tests and browser sequence                                                                                       |
| Optional processing     | Python/GraphQL containment implemented; regression tests added; live state unknown                                                                                                                                   | Verify source in the runtime, then obtain scoped deployment/data inventory evidence.                                          |
| Shared release contract | Migration upgrade from pre-feature state; schema equivalence; common version and false semantics; PWA settings reflected in chat and vice versa; mixed-version rollout behavior                                      | Disposable database upgrade and integrated cross-app verification after target synchronization                                |
| Student information     | Public links before acknowledgement, DE/EN meaning, group-only examples, usable small-screen and keyboard presentation                                                                                               | Human copy review and browser captures; no exact-copy unit tests                                                              |

### Frozen test dispositions

The matrix above defines cases; this table defines the maintained test changes. New paths are proposals. Do not create additional suites merely to match implementation modules; amend this portfolio only for a demonstrated uncovered behavior.

| Risk                                                                 | Disposition                                                                                                                                     | Exact location                                                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Shared persistence, revision and audit                               | Extend existing only for the reduced server context/second caller                                                                               | `packages/graphql/test/participantAccountDataUse.integration.test.ts`                                        |
| Advisory lock, withdrawal and contention                             | Extend existing                                                                                                                                 | `packages/graphql/test/participantDataUse.integration.test.ts`                                               |
| Normal/assessment onboarding and settings                            | Extend existing for uncovered flows; reuse current passing cases                                                                                | `playwright/tests/A-login.spec.ts`; `packages/graphql/test/assessmentAccountDeletion.test.ts`                |
| Chat status/write transport, direct bypass and two disclosure layers | Add new, one integrated behavior suite                                                                                                          | `apps/chat/test/participant-data-use.integration.test.ts`                                                    |
| Identity precedence and guest-persona reuse                          | Extend existing only where the new guard affects behavior                                                                                       | `apps/chat/test/lti-guest.test.ts`; `apps/chat/test/pwa-embed.test.ts`; `apps/chat/test/authedFetch.test.ts` |
| Registered/guest UI, settings and relaunch                           | Extend existing                                                                                                                                 | `playwright/tests/Y-chat.spec.ts`                                                                            |
| Contained derivative reads and reconciliation outcomes               | Extend existing consent integration suite using minimal synthetic derivatives; add cleanup cases there only if tool is required                 | `packages/graphql/test/participantDataUse.integration.test.ts`                                               |
| Whole-path collector inactivity                                      | None: bounded executable verification of disabled entry points, scheduler/queue disposition and no post-containment synthetic derivative writes | Package 2 evidence; no new Python test framework                                                             |
| Migration and mixed-version upgrade                                  | None: existing disposable-database migration procedure and integrated browser/API checks                                                        | Package 4 evidence, recorded with exact revisions                                                            |
| Policy wording, translations, illustrations and layout               | None: final-document comparison, browser interactions and screenshots                                                                           | Review evidence only; no prose-pinning assertions                                                            |

Use a bounded synthetic cohort of 20 existing participants with five concurrent renewal/settings requests, then one deliberate advisory-lock hold beyond the configured five-second lock timeout. Require no deadlock, duplicate event, lost update, partial transaction or unhandled client state; every uncontended request completes and every timed-out request remains unchanged and succeeds after lock release and explicit retry. Record latency without claiming production capacity. Verify initial signup and research-only settings do not wait for the global lock. Expand this exercise only for an observed failure or a separately established production load requirement.

## Decisions and release gates

| Item                       | Default / disposition                                                                                 | When it blocks                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Guest policy and choices   | Agreed: persisted guests receive simplified notice and both choices                                   | Binding implementation requirement, not a new legal question to ask again.    |
| Guest retention            | No new duration inferred; account persistence and cookie expiry distinguished                         | Any new promise or cleanup policy requires a verified policy decision.        |
| Disclosure revision        | Reconcile material copy changes and select one common revision                                        | Before implementing version checks or publishing final copy.                  |
| Existing LA operation/data | Verify activation and retained derivatives; keep deferred processing contained                        | End-to-end release readiness until evidence and disposition exist.            |
| Retained-data deletion     | Prepare concrete dry-run/target/data-class scope if required                                          | Execution requires named authority; do independent source work meanwhile.     |
| Final review provider      | Last recorded attempt failed before reviewing due to provider limit                                   | Final-review gate remains pending until a permitted route actually completes. |
| Merge and deployment       | Exact PR heads, dependency sequence, policy availability, containment and rollback must be reviewable | Never inferred from approval of this planning document.                       |

## Progress and continuation

| Package                      | Status on 19 September                                                                         | Next concrete action                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Planning                     | Complete: planner approved; implementation subsequently authorized with a goal                 | Follow the execution checkpoint below.                                                |
| Existing core implementation | Shared writer and choice UI extracted; original copy reconciled; changes local and unverified  | Run container checks and browser proof after host compatibility repair.               |
| Optional processing          | Python/GraphQL containment implemented; regression tests added; live state unknown             | Verify source in the runtime, then obtain scoped deployment/data inventory evidence.  |
| Chat                         | Current `v3-ai` identity and bot-disclaimer seams mapped; new completion not implemented       | Freeze shared writer/response contract, then implement after dependency availability. |
| Documentation                | Bilingual student pages and direct links added; individual-row and one-person examples removed | Build/render docs and verify links before PR delivery.                                |
| Release                      | Not merge/deployment-ready as an end-to-end package                                            | Finish proof, review, dependency integration and explicit release authorization.      |

The user subsequently authorized working through the full plan with a goal. The current terminal condition is verified implementation, reviewed source and PR delivery for the approved packages, subject to the named target-integration, deployment and retained-data gates. The immediate implementation step is Package 0, followed by core/doc completion and processing containment; chat depends on the shared contract. Stop only the dependent branch when an external capability or separately gated action blocks it, and preserve exact source/evidence for continuation. Do not advance into the deferred packages merely because the first-release code is finished.

### Execution checkpoint — 19 September 2026

- Integrated `origin/v3` at `03cfbd6f21602bf2bc7e7df1dd8d324b6d789c2c` into the task branch with normal merge `0a950d4bef79ba1aa90daf2201f4c8688be1de64`. No target branch was pushed. Current `v3-ai` baseline observed: `e752c70db39e0120fd2f47d8e7d3e98180e373af`.
- Shared server seam implemented in the working tree: narrow verified identity/Prisma context, separate server build entry, shared browser choice component with explicit assessment context. Registered and guest chat implementation still waits for the approved foundation-integration dependency.
- DE/EN student help pages are `/lernanalyse` and `/learning_analytics`; consent links now point there. Removed the lecturer example containing individual student rows. Existing normal/assessment DOCX wording was compared with accepted tracked changes; no substantive wording change was needed. Policy paragraph comparison found formatting differences and the existing correction of the source typo `verwendete` to `verwendet`.
- Keep disclosure revision `2026-09-08`: this package preserves the same purpose/retention contract; guest presentation explains the existing persisted persona rather than introducing a new purpose. Any later material change to that contract requires a coordinated version bump.
- Containment source now rejects Python analytics package import and returns no data from the four optional GraphQL analytics reads. A host-side dependency-free import check confirmed rejection before database initialization. Source containment is not live containment; old processes, notebooks and in-flight jobs still require separately authorized operational verification and stop/cleanup effects.
- Added behavior tests for the standalone canonical service, denied derivative reads and a 20-account/five-concurrent completion/settings cohort. Existing timeout/retry tests remain. Container tests/builds and browser proof have not run for these changes.
- Native docs executor completed the bounded three-file change. Main inspected its diff, linked the pages and visually inspected the existing illustrations. Retained the course-level activity chart; removed the quiz screenshot as well because its feedback panel exposes a one-person result (`N = 1`). No private source documents were sent to the executor.
- Runtime diagnosis: Devrouter 0.0.77 rejects installed Devsy 1.19.0, requesting 1.16.2; `ensure` retained its recovery candidate. `doctor` reports this exact checkout's full profile stopped. The requested shared-tool compatibility repair is pending user authorization; no downgrade, lifecycle-lock bypass or runtime deletion was performed.
- Four pre-existing additive migrations remain in #5970 (foundation, two indices, withdrawal queue). Do not rewrite potentially applied history without verifying provenance/application state. The migration-count/provenance check remains open until the disposable runtime is available.

#### Release inventory to finish before activation

The Python `src` import boundary covers the eight initialization scripts and maintained notebooks that import `src.modules`. The derivative model set is `ParticipantAnalytics` (with `CompetencyAnalytics`), `AggregatedAnalytics` (with `AggregatedCompetencyAnalytics`), `ParticipantCourseAnalytics`, `AggregatedCourseAnalytics`, `ParticipantPerformance`, `InstancePerformance`, `ActivityPerformance`, `ParticipantActivityPerformance`, and `ActivityProgress`. These are distinct from operational `QuestionResponse`, `QuestionResponseDetail`, points, assessment records and `ChatMessage`.

The four GraphQL read services are `getCourseActivityAnalytics`, `getCourseWeeklyActivity`, `getCoursePerformanceAnalytics`, and `getActivityAnalytics`; all now short-circuit before reading derivatives. A reviewed source allowlist is not authority to delete those tables. Required remaining evidence is values-free counts and runtime/job status in the named deployment; classify any additional writer/read path before release. If records require reconciliation, prepare the scoped dry-run and obtain named execution approval; first-false legacy participants cannot be handled by draining the existing true-to-false queue alone.

No new cleanup script has been created because retained-data presence and the authorized target have not been established. The plan's conditional script remains available if the inventory proves it necessary. Ordinary deployment of the consent UI must remain blocked until effective writer/in-flight containment and any required deletion are proved.

Verification checkpoint: repository-native Biome formatting passed for the eight
changed implementation/test modules; Prettier passed for the plan, bilingual docs
and engineering documentation; `git diff --check` passed. Biome lint also reported
pre-existing `noThenProperty` on Yup's required `then` API and existing
`noExplicitAny` warnings; no unrelated lint rewrite was retained. The docs
executor's check used host binaries (not container validation); main's formatter
checks likewise do not substitute for required container builds/tests. The two
retained dashboard images were inspected visually by main before the quiz example
was removed. No application runtime or new browser screenshots are available.

The implementation remains uncommitted while required container checks are
blocked. The target-integration merge is the only new commit; no push or PR-body
update has been made and #5970 is not claimed ready. All unrelated Edu-ID local
changes are preserved. The native goal is blocked pending host-tool repair approval; its full objective
is not complete.

Runtime release attempt: `devrouter stop` for the exact task checkout failed with
`Retained container population or immutable identity changed.` Although the
preceding doctor report described the full profile as stopped, final provider and
route release cannot be claimed. Recovery state is preserved. No raw container
mutation, ownership-record edit, lock bypass or deletion was attempted. Host-tool
compatibility and ownership proof must be repaired through the lifecycle manager
before runtime-dependent work resumes.

### Continuation source audit — 19 September 2026

Previous goal turn: **progress**, with shared source, containment, documentation
and tests changed. This continuation confirmed the working tree and source seams;
no repair approval has arrived and no failed runtime operation was retried.

Added the remaining planned regression case: initial account creation with both
purposes refused must complete and append exactly one audit event while another
transaction holds the analytics advisory lock. This complements existing
research-only nonblocking and settings timeout/retry coverage. It remains unrun
pending the container. Verified that PWA Tailwind already scans shared component
sources and the documentation site serves its docs at `/`, so the moved view and
new direct links follow existing source configuration. These checks do not prove
browser behavior or generated package output.


### Blocked audit — 19 September 2026

The same host compatibility/ownership blocker has persisted across the initial
goal execution and two continuations. The first two turns made source progress;
no remaining independent step can satisfy the required container/browser gates.
No repair approval has arrived. The installed Devrouter remains 0.0.77; the
recorded ensure/doctor failure rejects Devsy 1.19.0 and retained-runtime ownership
proof remains unresolved. No active verification process is being awaited.

Mark the goal **blocked**, preserving the complete objective and local changes.
Resume on approval of the pending host-tool compatibility repair or evidence that
a compatible managed runtime has been restored. Then run the focused checks,
review/commit/push the core package, and obtain the separately named foundation
merge/synchronization authority before implementing the dependent chat package.
No core or chat implementation completion, PR readiness, deployment, retained-data
cleanup or runtime release is claimed.
