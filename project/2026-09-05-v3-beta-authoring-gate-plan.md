# V3 beta discovery and chatbot authoring gates
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
| Beta discovery | Extend | Every authenticated lecturer can find informational Beta Features in header, account settings and first login. Chatbots is named as a beta feature. |
| Published participant access | Reuse unchanged | Publication and course Participation rules remain authoritative; isActive is not access control. |
- ADR: no new primitive or hard-to-reverse architecture decision. Update docs/feature-flags.md only; reopening entitlement architecture, storage or participant rules requires a new ruling.
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
- Do: keep existing BetaEnrollmentSettings informative for every authenticated lecturer in settings and first-login; expose header link without eligibility or signup visibility gates. Name Chatbots in paired EN/DE beta copy.
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
- Draft v1: native planner REVISE; product direction approved. Four accepted corrections: explicit ownership map; complete field boundary/tests; UI discovery/control contract; isolated browser/backend fixture proof.
- Draft v2: native planner APPROVED. A subsequent read-only Claude advisor consultation failed before work: OAuth session expired and could not be refreshed. No authentication repair attempted; this does not replace or invalidate the native planner approval.
- Status: user approved the reviewed execution contract on 2026-09-05. Begin authoring gate implementation. Source baseline remains fbc5f4fcc2, clean apart from this plan; no upstream integration or publication.
- Authoring gate source implemented. GraphQL codegen/SDL parity, GraphQL types, Manage types and Playwright types pass. Focused schema suite: 83 passing tests; two synthetic GrowthBook fixture tests pass. Test-only backend preload is limited to start:test, refuses non-test startup, and targets only the seeded eligible lecturer with a false default.
- Baseline check:all failed before implementation from simultaneous Prisma generation (ENOTEMPTY and partial generated types) and Analytics choosing Python 3.14. Serial Prisma regeneration/build passed. Full checks remain required after integration, using Analytics Python 3.12.
- Browser proof pending: retained manual runtime returned Bad Gateway after checks. Canonical full-profile ensure is waiting in the provider queue; no manual database reset or runtime deletion. Source-only checks do not establish enabled authoring browser behavior. Beta discovery implementation and independent slice/final reviews remain.
