# V3 beta discovery and chatbot authoring gates

## Approval summary

Make beta features easy for every lecturer to find while restricting chatbot
creation to accounts with AI beta access and existing authoring permissions.
Reuse the current enrollment toggle. Keep informational discovery visible even
when signup closes or the current login cannot change enrollment.

Participant access, publication approval, account ownership and existing-member
opt-out remain unchanged. No schema, migration, dependency or live feature-flag
change is included. Verification must preserve the user's retained local data;
enabled authoring tests require a separate disposable runtime and database.

Approval already permits scoped local edits, isolated verification setup,
checks, independent reviews and commits. Completion requires passing relevant
checks and browser evidence plus integrated review. Push, PR publication,
upstream integration, merge, release, deployment and retained-data reset remain
outside this approval.

## Execution details

## Research
- Goal: reuse v3's existing beta enrollment toggle, show Beta Features to every authenticated lecturer, and protect lecturer chatbot authoring with ai-beta.
- Baseline: rs/v3-release-verification in trees/rs/v3-production-release, tracking origin/v3 at fbc5f4fcc2ffa1c8d25695679823134985c5a8d8; fresh fetch confirmed clean and zero ahead/behind. Target v3; no PR yet.
- Current evidence: BetaEnrollmentSettings already appears in settings and SuspendedFirstLoginModal, but hides when mayChange is false or enrollment closes. Header discovery requires beta-signup, Catalyst and full access. Chatbots menu currently uses privatePreview; page mounts authoring queries unconditionally. Seven authoring mutations share asChatbotAuthor without a feature check.
- v3-ai comparison: beta enrollment source is identical. Its separate aiFeaturesEnabled billing entitlement belongs to broader AI tools, not this change. Do not cherry-pick its AI menu, Knowledge Bases, or entitlement architecture.
- Research completed by main and read-only native executor fallback; configured explore failed before work with provider HTTP 400. No external research or secret access needed.
## Contract and authority
- One cohesive full-path source package. Main owns execution and integration. Boundary owner: self.
- User approved product direction and reversible work. Formal reviewed-plan approval covers scoped edits, isolated verification setup, reviews and local commits through the terminal condition.
- Withheld: upstream integration, push, PR publication, merge, tag/release, deployment, live GrowthBook/membership changes, production data, runtime deletion, and resetting the retained manual database.
- Terminal: locally committed, verified and independently reviewed package; report publication boundary separately.
- Pause only for a new material product/security decision, required unavailable capability, unprovable test isolation, or external action beyond authority.
- No schema, migration, dependency, participant access, gamification or worker behavior changes. Existing ownership, Catalyst, scope and publication controls remain.
## Primitive impact
| Primitive | Disposition | Contract |
| --- | --- | --- |
| Beta enrollment | Reuse | Existing saved-group membership and backend capability remain authoritative; beta-signup controls new opt-ins, not discovery. Preserve full-access eligibility, Catalyst requirement and existing-member opt-out. |
| Lecturer chatbot authoring | Compose | Require existing ai-beta alongside current authoring permissions, fail closed for missing/off/throwing evaluators. |
| Beta discovery | Extend | Every authenticated lecturer can find informational Beta Features in account settings and first login. The normal Settings menu entry provides navigation; no separate beta menu entry. Chatbots is named as a beta feature. |
| Published participant access | Reuse unchanged | Publication and course Participation rules remain authoritative; isActive is not access control. |
- ADR: no new primitive. Align ADR 0008 (shared feature flags) with the approved restrictive server-side beta gate and clarify ADR 0020 (publication approval) to distinguish the unchanged account entitlement. Update docs/feature-flags.md; reopening entitlement architecture, storage or participant rules requires a new ruling.
## Delegation Map
| Workstream | Owner and reason | Dependency | Acceptance |
| --- | --- | --- | --- |
| Research | Main, completed with read-only fallback evidence | None | Verified current v3 seams and bounded v3-ai comparison |
| Authorization and authoring UI gating | Main; security decision and critical-path coupling | Research | Every gated GraphQL field denies before service work; denied page mounts no authoring queries |
| Beta discovery | Main; coupled capability and UI contract | Authoring contract | Every lecturer scope sees discovery; mutation remains backend-capability controlled |
| Verification | Main; retained-runtime privacy/isolation boundary | Both implementation slices | Focused schema tests, checks and isolated browser proof |
| Integration and reviews | Main owns integration and required review dispatch; independent native roles remain reviewers | Verified committed slices | Simplifier and risk review per slice, then integrated final review |
- No independent implementation delegation proposed. Required read-only specialist gates follow rs-model-routing.
## Test portfolio
| Risk | Obligation and primary seam | Slice |
| --- | --- | --- |
| Flag bypass or weakened authorization | Extend chatbotAuthoringAuthorization.test.ts schema-backed tests: all seven mutations and publishing capability, missing/off/throwing/on flag, existing role/Catalyst/scope rejection; denied service mocks never called | Authoring gate |
| Data read despite disabled flag | Extend existing GraphQL tests: getChatbotsInfo returns null with no Prisma read on deny; retain enabled owner filtering and administrative/participant boundaries | Authoring gate |
| UI bypass | Extend T-chatbot-authoring.spec.ts and existing feature-access tests: menu eligibility, direct denied route with no authoring requests, enabled creation | Authoring gate |
| Discovery or enrollment regression | Extend B-feature-access.spec.ts: all lecturer scopes, open/closed signup, non-Catalyst, existing-member opt-out, unknown/error/pending/refresh failure; settings/header/first-login | Beta discovery |
| Lost usage or participant access | Reuse existing usage gating and participant/publication tests; add only missing consequential assertions | Both |
## Slice: authoring gate
- Do: add fail-closed ai-beta auth scope using existing feature evaluator and compose it into asChatbotAuthor.
- Gate updateChatbotModelSettings, updateChatbotModelPolicy, updateChatbotStandardModeConfig, createChatbot, updateChatbot, saveChatbotDisclaimer, requestChatbotPublication, and getChatbotPublishingCapability.
- getChatbotsInfo retains asUser and returns null before any Prisma query when ai-beta denies.
- Keep admin approve/reject, publication ownership/capability checks, participant routes and getChatModelRegistry unchanged.
- Header Chatbots entry requires ai-beta, Catalyst and FULL_ACCESS/ACCOUNT_OWNER, replacing privatePreview only for this entry. Gate direct route before mounting Chatbots or issuing its authoring queries; show stable informational unavailable state linking beta settings.
- Route: main; acceptance: field-by-field schema authorization tests, enabled path, denied no-query browser proof, GraphQL codegen/check and Manage check.
- Commit: fix(chatbots): gate lecturer authoring with AI beta.
## Slice: beta discovery
- Do: keep existing BetaEnrollmentSettings informative for every authenticated lecturer in settings and first-login, reached through the existing Settings menu. Name Chatbots in paired EN/DE beta copy. Omit the cohort-identifier explanation as explicitly requested on September 6.
- Controls appear only when mayChange is true, membership is known, and signup is open or the lecturer is already enrolled. Guard handlers too. Preserve mutation, confirmed membership, pending/refetch/refresh-failure handling and opt-out.
- Explain closed signup, insufficient eligibility/scope, or unavailable membership accurately without inferring membership from ai-beta.
- Keep account usage behind ai-beta. Update docs/feature-flags.md active flag table and rollout discovery instructions.
- Route: main; acceptance: existing feature-access suite updated for all discovery states, EN/DE desktop/mobile browser evidence, formatting/type checks.
- Commit: enhance(manage): make beta features discoverable to every lecturer.
## Verification and runtime boundary
- Preserve user-retained rs-v3-production-release runtime and database. Do not run standard Playwright there: global setup unconditionally cleans/seeds.
- Before mutation E2E, establish a separate test runtime and database and prove identities distinct from retained runtime. Configure browser AND backend evaluation using explicit synthetic test-only ai-beta fixtures; browser route interception alone does not prove backend flag behavior.
- Never globally enable ai-beta or contact real GrowthBook management services for tests. If isolated DB or backend-fixture control cannot be proven, report browser verification blocked without resetting retained data.
- Run repository-native GraphQL/Manage checks and codegen, focused GraphQL tests and Playwright specs on isolated lane, root check:all and build before completion. Git on host; toolchain checks in container; Playwright on host only.
- Browser screenshots before/after, EN/DE and desktop/mobile; no source/runtime success claim from mocks alone.
- Commit exact slices, run dedicated simplifier plus risk-selected slice reviewer, verify and integrate findings; run final reviewer over complete committed range after all required checks. Correctness, maintainability, security and architecture lenses apply.
- Stop and verify exact test runtime after use; retain original manual runtime under user's keep-running request. No deletion.
## Planning review and Progress
- Local finish, September 6: slice risk review completed without findings.
  The integrated final reviewer inspected all 23 paths through 0cd245b632 and
  reported only conflicting ADR wording. The main session verified the finding:
  ADR 0008's blanket prohibition was stale against the approved server-side gate;
  ADR 0020 referred to the separate account publication entitlement, not ai-beta.
  Both records now explicitly distinguish these controls. This documentation-only
  correction changes no behavior or approved product decision. Parent diff and
  source checks resolve the finding; existing runtime and test evidence remains
  applicable. The native final-review route failed with adapter_eof before a
  result; one trusted Sol-high continuity reviewer completed the same contract.
  All reviewers are closed. The local package is complete; further push to the
  existing draft PR requires explicit authorization. No release readiness is claimed.
- September 6 receiving-device continuation: Auth delegated login and providers
  work without source repair. The local enrollment fixture now connects the
  test-only backend payload to Manage, with explicit ignored-marker activation
  restricted to the manage profile. Main owns this coupled runtime/browser seam;
  delegation skip reason: critical-path coupling. The read-only mapping completed
  through trusted Luna continuity after the configured exploration route failed.
  Real opt-out and opt-in both converge in the browser. The publishing-capability
  query returns Unauthorized while opted out and resolves normally while opted
  in; existing publishing permission remains false. The authoring page follows
  both states. Backend tests (11), backend types and Manage types pass. Root
  check:all passes (35 type/prerequisite tasks and seven lint tasks); runtime
  regressions and focused formatting pass. Removing the local marker and
  reconciling ordinary manage startup returns 404 from both fixture routes.
  The engineering browser is closed. All 23 production build tasks pass with
  NODE_ENV=production; the first attempt inherited development mode and failed
  Auth logout prerendering. No Auth source repair was needed. The three focused
  authorization/enrollment suites pass all 110 tests. Fixture commit f44bc324a1
  is local only. The simplifier found no warranted reduction; slice risk review
  is running. Runtime shutdown waited for another worktree's provider lock,
  then completed. Fresh source-path provider readback is Stopped and the exact
  route count is zero. No database, cache or worktree was deleted.
  No real
  GrowthBook service, entitlement, retained database reset or production change
  is involved. Slice risk review and integrated final review
  remain pending. Fresh refs match the task upstream; the branch is 11 ahead and
  4 behind v3, including unrelated routing-version and review-workflow changes.
  No additional integration or push is authorized by this continuation.
- Device-transfer landing on the receiving machine: fresh fetch confirms
  origin/rs/v3-release-verification at the recorded head fdd83714a6; the
  canonical worktree was recreated at trees/rs/v3-production-release as a
  local tracking branch and the disposable mirror was not recreated. PR #5799
  remains an open MERGEABLE draft; current-head CI is green except ocr-review,
  which failed all selected provider/subtask requests with zero findings, and
  the stale-pending final-ai-review status whose workflow skipped its review
  jobs on the draft; no human feedback exists. The user-requested retry
  resolved the escalation blocker. PATH selected Devrouter 0.0.51, whose
  helper lacks preparation support; the already-installed Volta 0.0.55
  executable successfully reconciled the manage profile. Workspace
  rs-v3-release-verification uses Compose project default-rs-9efcf and reports
  ready with no drift. Auth providers return JSON 200 and real delegated
  login succeeds. Browser checks confirm beta information and direct
  authoring denial with the flag off. The
  approved local enrollment fixture remains an uncommitted partial
  test-only preload extension: beta-signup rule, an in-process saved-group
  control plane behind the real HTTPS validation, membership-driven ai-beta,
  and updated node tests. Header lookup now uses Headers so the enrollment
  service's Authorization header is accepted case-insensitively. All 11
  backend unit tests, backend typechecking and focused Biome checks pass in
  the container. Browser/backend shared-payload integration and actual
  enrollment verification remain incomplete; integrated final review has
  not run. The fixture is not activated by ordinary development startup.
- Device-transfer checkpoint: the user requests publication of the current work on a draft PR against v3 and continuation on another device. This authorizes pushing `rs/v3-release-verification` to origin and opening a draft; it does not authorize merge, tag, deployment or another upstream integration. The package is parked for transfer, not accepted or release-ready. Resume Auth API diagnosis, the approved local-only enrollment fixture, affected verification and the unused integrated-final review. The last real-login attempt failed before credentials with HTML 404s from Auth's API endpoints. Source-level Auth repair was proposed but not implemented. Browser cleanup could not execute after two permission-review timeouts. Retained local caches, database data and ignored review evidence remain machine-local and must not be committed.
- September 6 recovery follow-up: the user approved recoverable Chat-cache relocation and a local-only beta enrollment fixture. Chat's old cache is preserved at ignored `project/_local/chat-next-archive-20260906T1332`. Canonical repair eventually returned full/ready, all services healthy, no drift, and `recreated: false`; a missing-container inspection failure and a transient LiteLLM health timeout preceded that successful run. Chat now passes its JSON 401 readiness contract. Real routed Auth root loads, but delegated access reaches `/api/auth/error`; browser fetches of providers, signin/delegation and error all return HTML 404, confirmed in current Auth server logs. Root-page readiness is insufficient proof of authentication. No further cache removal or authentication source change was made. Local fixture source mapping is complete, but implementation and integrated final review remain pending. The configured exploration provider rejected the request for insufficient credits; one trusted native Luna continuity mapping completed and both children are closed. HEAD remains `70d3322a511d3f494c57eeb111d8848bdc6cfa0c`, ten ahead and two behind origin/v3; no additional upstream integration. Retain this runtime for the user's manual verification until the next checkpoint.
- Latest checkpoint: Auth now passes HTTP readiness after its caches were rebuilt outside Tailwind's scan path. Full startup instead detects a stale Chat API route. The preserve-next-cache marker correctly blocks automatic deletion; a separate request to recoverably archive only the Chat cache is awaiting the user. Managed state is degraded, so routed real-login proof is unavailable. No Chat cache or database data was changed. Both runtime review findings are resolved and both children are closed. The local beta fixture decision and integrated final review remain pending. Production disclaimer PR #5696 is still open against v3 on fresh readback.
- September 6 verification follow-up: all nine non-destructive beta discovery/disabled-authoring browser tests pass in 30 seconds. Host execution requires pinned Node and the direct repository runner to avoid pnpm's automatic dependency replacement and its older Devrouter PATH selection. Runtime corrections at `e54427a49d` pass the shell suite and the same-child risk re-review; the simplifier found no warranted reduction. Actual delegated login still returned 404, so the user explicitly approved recoverable Auth-cache regeneration. The first sibling archive contaminated Tailwind source scanning and caused invalid CSS; both the original and failed regenerated caches are now retained only under ignored `project/_local/` paths. Restart and real-login proof remain underway. The local-only enrollment fixture question remains unanswered; no live flags, data resets, publication or deployment changed.
- September 6 integration: the authorized one-time merge of v3 `1387f884ba` completed without conflicts at `3a311052f0`. The six already-adopted runtime files were preserved in a scoped stash because they exactly matched upstream. Do not reapply the stash. Three Chat suites, 60 Playwright CI contract tests and 28 FinanceWiki tests pass. Two preparation failures reproduced the transient Git-child issue; local repair commit `3976ebd61e` waits up to five seconds without bypassing the lifecycle guard. Shell regression tests pass, and canonical repair now reports full/ready with healthy services, workers and no drift. No data reset or deletion occurred. The runtime remains retained for manual verification. The local-only enrollment fixture decision and integrated final review remain pending; no push, tag or deployment is authorized.
- September 6 follow-up: Settings-only navigation and explanation removal pass formatting, Manage typechecking and real-browser settings/menu checks. Existing Header equality lint findings remain unchanged. The revised Playwright assertions are not yet rerun. The approved Gemini consultation completed using the exact high-effort catalog ID; its local report records the remaining manual enrollment and final-review gates. The user now explicitly authorizes one upstream v3 integration pass. Preserve the adopted runtime files in a scoped stash before merging: all six match origin/v3 exactly and must not be duplicated in a new implementation commit. Local-only enrollment fixture selection remains unresolved; no live GrowthBook access is authorized.
- September 6 UI revision: the user requests Settings-only beta navigation and removal of the cohort-identifier paragraph. These narrow changes and matching navigation tests are implemented; verification is in progress. Local database read confirms the seeded lecturer has both Catalyst flags and a FULL_ACCESS login. All three GrowthBook enrollment configuration variables are absent; changing Catalyst is not the solution. A local-only enrollment/feature fixture is a separate pending implementation choice; production flag permissions remain unchanged. Advisor invocation failed before inference because the CLI rejected the model/effort combination; the approved summary was not evaluated. Integrated final review waits for the revised package and local verification decision.
- September 6 recreation: the user explicitly authorized rebuilding the recycled runtime. Exact provider state was NotFound and former Compose containers/volumes were absent. After restoring the missing shared Devrouter network, canonical full-profile ensure completed bootstrap and returned ready with no drift. New app container 001d211c0627 mounts this exact worktree. Auth providers return 200; real delegated browser login, menu-to-beta-settings navigation and denied direct chatbot route all pass. Browser closed; runtime retained for the user's manual verification until the next checkpoint. No source or lockfile change, deletion, integration or publication. The prior Auth cache approval blocker is resolved. Final review remains pending: command approval rejected the required Gemini advisor consultation because its local verification summary needs explicit destination/payload authorization. Nothing was sent. See the latest recovery receipt in 2026-09-06-v3-release-readiness.md; older runtime status below is historical.
- Local verification is complete for the feature changes: eight authoring E2E tests and 148 focused database tests pass, alongside the previously recorded full build, checks and discovery proof. Disposable shutdown completed with fresh Stopped provider state and zero routes; no data was deleted. Package delivery remains pending retained Auth recovery approval. No final reviewer is dispatched while that goal requirement remains unresolved. Evidence-only documentation is ready for a scoped local commit; no push, integration, release or deployment is authorized.
- Runtime verification completed after command execution resumed. Canonical disposable full-profile startup and host-launcher reconciliation both passed with the bounded transient-Git wait. All eight authoring browser tests passed in 46.7s; all 148 tests in six focused GraphQL suites passed in 6.59s after a guarded disposable-only reset. The shared test helper emitted unused localhost Redis connection errors; do not infer Redis integration proof. Main feature source and retained runtime/cache remain unchanged. Final review and final local evidence commit remain; exact disposable shutdown follows the last runtime check.
- Subsequent diagnosis reproduced a transient orphaned `git diff HEAD --no-ext-diff --no-color` after successful Turbo preparation. A later process readback showed it had exited. A disposable-only bounded wait is syntax-checked but unverified: both canonical startup attempts and both guarded database-test attempts timed out in command approval before launch. No database reset ran. Both non-destructive stop attempts then failed in approval too, so the prior stopped receipt is stale after this reproduction. No command is running. First resume action is exact disposable runtime shutdown/verification, then the still-required runtime checks once execution capability returns. Main feature source and retained runtime remain unchanged.
- Pause receipt: child-process diagnosis could not launch after two permission-review timeouts. Devsy Issues message delivery failed with thread-not-found despite fresh inventory resolving that task. The disposable runtime was stopped without deletion; fresh provider state is Stopped and exact route count is zero. No browser, child reviewer or command remains running. The main manual runtime remains under its existing user verification lease. Resume child-process diagnosis when command approval works; do not claim authoring E2E or final review passed.
- September 6 continuation: fresh fetch leaves the feature branch three commits ahead and four behind origin/v3. No upstream integration. Frozen disposable dependency restoration completed, and targeted readback confirms Chat/Auth Next.js and backend NYC links. No prior host verification process remained running. Canonical full-profile repair passed all nine cached preparation tasks but failed because the process helper reported running children after synchronous preparation. Child-process diagnosis is pending; enabled authoring and integrated final review remain incomplete. The retained runtime and its cache remain unchanged.
- Discovery committed locally at 19ea2de078 after equivalent container hook checks plus host gitleaks/identity checks. Both native discovery passes completed: simplifier found no warranted reduction; GLM slice reviewer found no blocking issue. Parent verified and persisted both reports; both children are closed.
- Production build in the disposable lane passed 23 tasks in 2m55.956s. Host readback confirms all five standalone server outputs and all three service-worker artifact sets. The first authoring browser run reached only Bad Gateway: two attempted tests failed and six serial tests did not run. The host launcher's first filtered install removed container-visible dependency links; Next then failed and Turbo stopped every app. Frozen Linux dependency restoration is in progress in the disposable lane; no authoring failure is inferred from that run, and retained data/cache remain unchanged.
- Isolated browser proof: canonical manage ensure returned ready with no drift. Fresh Auth providers returned HTTP 200 and real delegated login succeeded. Menu navigation reached beta settings. English/German desktop and 390x844 mobile screenshots show readable beta information with restricted enrollment; the pre-existing global header overflows on mobile, while the beta section fits. The engineering browser is closed. Full production build is running only in the disposable lane. The first build invocation incorrectly forwarded a concurrency argument to package scripts and failed before building; the corrected command applies it to Turbo.
- Isolated verification continuation: created repo-local trees/rs/v3-beta-verification-isolated on rs/v3-beta-verification-isolated from exact HEAD 2be0a2108f, then mirrored the current feature and adopted runtime source with apply_patch. No upstream integration. The disposable lane alone pins Devrouter 0.0.55 and uses frozen bootstrap installation. Its committed database URLs resolve only to its Compose postgres service; Compose volumes are project-scoped. Canonical manage-profile ensure is starting the new lane. Retained Auth cache approval is still pending and no retained cache or database was changed.
- Current checkpoint, 2026-09-06: Devrouter 0.0.55 guarded warm ensure and a subsequent normal stop/restart both returned ready/full with no drift or recreation. Original container IDs and retained database are preserved. All 35 serial check tasks, remaining repository policy/lint checks, 83 authorization tests, 16 effective-mode tests and two backend fixture tests pass. The corrected discovery smoke now passes all nine tests in 14.6 seconds; the first-login fixture must intercept the preloaded ManageUserProfile operation as well as UserProfile.
- Real delegated login still reaches an Auth 404 after restart. Source exists in the exact container, static API routing works, process paths are correct and a standalone Watchpack probe discovers the catch-all source. This does not prove cache corruption. Requested permission to archive only apps/auth/.next recoverably and regenerate it; no cache mutation has occurred. Runtime is retained for the user's requested manual verification and this pending diagnostic decision. No browser, test, lifecycle command or child remains active at this checkpoint.
- Updated release evidence is in 2026-09-06-v3-release-readiness.md: five pending migrations, including nullable standardModeConfig, and the deployed disclaimer fix in open PR #5696 is still absent from origin/v3. Full build, isolated enabled-authoring proof, discovery commit/reviews and integrated final review remain pending. No release-readiness claim or publication is made.
- Resume on 2026-09-06: the user explicitly returns source and runtime ownership to this task and requests independent completion with a goal. Fresh fetch reports rs/v3-release-verification two commits ahead and four behind origin/v3; no upstream integration. Adopted runtime source matches the merged preparation/cache-preservation fix in PR #5790. Existing feature edits remain preserved and uncommitted.
- Devrouter 0.0.55 is installed. Before guarded full-profile repair, all eight retained containers were stopped, exact routes were zero, and no competing lifecycle command targeted this workspace. The ignored preserve-next-cache marker is enabled. Repair is running against the retained IDs without bootstrap or recreation; application readiness and acceptance remain pending.
- Remaining work: focused checks and safe discovery browser smoke, separate enabled-authoring test isolation, discovery commit and reviews, full checks/build and integrated final review. The previously completed authoring reviews remain applicable. No publication, tag, deployment, retained-data reset or upstream integration is authorized.
- Draft v1: native planner REVISE; product direction approved. Four accepted corrections: explicit ownership map; complete field boundary/tests; UI discovery/control contract; isolated browser/backend fixture proof.
- Draft v2: native planner APPROVED. A subsequent read-only Claude advisor consultation failed before work: OAuth session expired and could not be refreshed. No authentication repair attempted; this does not replace or invalidate the native planner approval.
- Status: user approved the reviewed execution contract on 2026-09-05. Begin authoring gate implementation. Source baseline remains fbc5f4fcc2, clean apart from this plan; no upstream integration or publication.
- Authoring gate source implemented. GraphQL codegen/SDL parity, GraphQL types, Manage types and Playwright types pass. Focused schema suite: 83 passing tests; two synthetic GrowthBook fixture tests pass. Test-only backend preload is limited to start:test, refuses non-test startup, and targets only the seeded eligible lecturer with a false default.
- Baseline check:all failed before implementation from simultaneous Prisma generation (ENOTEMPTY and partial generated types) and Analytics choosing Python 3.14. Serial Prisma regeneration/build passed. Full checks remain required after integration, using Analytics Python 3.12.
- Browser proof pending: retained manual runtime returned Bad Gateway after checks. Canonical full-profile ensure is waiting in the provider queue; no manual database reset or runtime deletion. Source-only checks do not establish enabled authoring browser behavior. Beta discovery implementation and independent slice/final reviews remain.
- Authoring gate committed locally at 2be0a2108f. Native simplifier returned DONE with no warranted reduction; independent slice risk review is still running. Nothing pushed.
- Beta discovery source now retains the header/settings/first-login information, names chatbot creation in EN/DE, and guards controls and handlers with backend capability and confirmed membership. Added closed, unknown, first-login and weaker-scope discovery assertions; enrollment mutation semantics are unchanged.
- Manage, backend and Playwright typechecks passed after discovery UI changes. The final added browser assertions still require a fresh Playwright typecheck and execution. Browser inspection confirmed the real denied chatbot route and its beta-settings link, plus visible English settings and German mobile settings without an enrollment control.
- Canonical runtime recovery initially failed auth readiness, later repaired a confirmed stale Chat cache and observed readiness, but exited nonzero with candidate rollback. The retained Manage route is reachable in the browser; do not describe the whole runtime as canonically healthy. Original runtime remains retained for the user's manual verification; no test runtime or database reset was created.
- Read-only browser smoke setup is isolated from database mutations by an ignored config with no global setup, no cleanup test and only intercepted enrollment writes. The host launcher was not started: automatic permission review timed out twice before execution. Do not bypass the launcher or run the standard reset against retained data. Full checks/build and enabled isolated-runtime proof remain required before completion.
- Native authoring slice reviewer returned DONE with no reportable findings. Its static test-preload review does not replace enabled runtime proof. Discovery remains uncommitted and still needs its own reviews. A subsequent serial repository-check command also timed out in automatic approval before launch; no check result exists for that attempt.
- Checkpoint: both completed authoring review children are closed. No command remains running. The engineering browser session v3-beta-gates remains open on German settings because its screenshot/close command also timed out before launch; closing it is the first cleanup action on resume. Original manual runtime is retained under the user's verification request. Next authorized steps are to resume checks, finish isolated enabled-authoring proof, commit/review discovery and perform integrated final review. The permission-review service must permit command launch before these can continue.
- Retry checkpoint: fresh fetch confirms the task branch is two commits ahead and zero behind origin/v3. Approval review now permits commands. New beta tests use element visibility, control state and enrollment transitions rather than literal prose, following the revised repository instructions. Main-session diff whitespace validation passes; container checks have not run.
- Runtime blocker: devrouter exec reports no running container for default-rs-01df8. Canonical ensure then failed during Node image lookup with Docker Hub DNS timeout, before container bootstrap. No reset/seed step ran in this attempt. The bootstrap script resets its database on container creation, so do not retry rebuilding the retained runtime until data preservation is resolved.
- Values-free inspection in Docker context orbstack found no exact compose-project containers/volumes, no volume name containing rs-01df8, and no container matching this worktree source-path label. These observations do not prove data loss or authorize recreation. Ask whether Docker was reset or its context changed; next verification remains authorized once the runtime/data boundary and image connectivity are resolved.
- The old engineering browser session is now closed. Its final German mobile screenshot shows Bad Gateway and is not UI acceptance evidence. No command or review child is running. Discovery remains uncommitted; full checks, isolated enabled-authoring proof, discovery reviews and final review remain incomplete. No publication or deployment occurred.
