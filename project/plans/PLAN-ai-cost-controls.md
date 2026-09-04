# AI cost controls

## Goal

Make the three existing AI cost controls clear and reliable:

- show an actionable KB graph semester-quota error and prevent known-invalid
  graph-build submissions;
- keep the account owner's monthly chat-usage budget current in user settings;
- let a chatbot owner configure the complete per-participant credit policy while
  the chatbot is a draft or rejected.

## Non-goals

- No consolidated AI-cost dashboard or KB graph quota card in user settings.
- No course-collaborator access or change to chatbot ownership.
- No post-publication credit-policy edits or reconciliation of existing
  participant credit rows.
- No Prisma migration, gamification change, or new seed fixture.

## Design answers

- **Domain vocabulary:** `Chat account usage budget`, `Chatbot credit policy`,
  and `KB graph semester quota` are distinct account/chatbot concepts recorded
  in `CONTEXT.md`.
- **Layer footprint:** `packages/graphql`, `packages/kb-management`,
  `apps/frontend-manage`, `packages/i18n`, focused GraphQL tests, and browser
  evidence. The existing Prisma fields are sufficient.
- **Authorization:** existing `asChatbotAuthor` scope plus the live persisted
  chatbot owner; no course-sharing permission is introduced.
- **Gamification:** none.
- **Async:** graph dispatch and settlement are unchanged; only pre-dispatch UX
  and quota-error presentation change.
- **UI:** add a Credits setup step between Disclaimer and Publication Review,
  keep the policy read-only after submission, refresh settings on entry/focus,
  and render stale/retry and quota-specific error states in English and German.
- **Tests:** focused service/schema tests for credit-policy validation and
  publication behavior, package/app checks, root checks and build, plus
  delegated-login browser verification of all changed states.
- **Seeds/fixtures:** reuse existing local chatbot and knowledge-base fixtures.

## Credit-policy contract

- Defaults remain `1 / WEEKLY / 1 / 1`.
- All amounts are signed 32-bit non-negative integers.
- Initial credits and reset amount cannot exceed maximum credits.
- `NONE` normalizes reset amount to zero; every other reset period requires a
  positive reset amount and positive maximum.
- The policy is editable only in `DRAFT` and `REJECTED`, then frozen while
  pending, published, or paused.
- Publication reviews the saved policy without overwriting it.

## Implementation slices

1. Add owner-scoped credit-policy service/schema operations and update the
   publication operation to preserve the saved policy.
2. Add the Credits authoring step, validation, navigation state, and read-only
   publication summary.
3. Make account-usage settings network-fresh on mount/focus with last-known
   values, stale disclosure, and Retry.
4. Map `KB_GRAPH_QUOTA_EXCEEDED`, refresh authoritative quota values after a
   failed build, and preflight-disable insufficient selections.
5. Run codegen, focused tests, formatting/check/build, browser verification,
   independent review, and open a draft PR against `v3-ai`.

## Progress

- **2026-09-04:** Completed the `grill-with-docs` design interview, fetched
  `origin/v3-ai`, created `feat/ai-cost-controls`, and recorded the agreed
  domain vocabulary in `CONTEXT.md`.
- **2026-09-04:** Implemented the GraphQL credit-policy operations and
  rolling-compatible publication path, the Credits authoring/review UI,
  network-fresh account-usage settings with stale recovery, and actionable KB
  graph quota handling. Added focused validation and service integration tests,
  generated the public schema, and updated the engineering documentation.
- **2026-09-04:** Focused TypeScript checks passed for GraphQL,
  frontend-manage, and kb-management; the credit-policy and AI feature-gate
  tests pass. Repository-wide `check:all` passes, the branch-local bootstrap
  production build completed, and all 54 database-backed chatbot-management
  tests pass against a clean isolated database.
- **2026-09-04:** Browser verification passed in the isolated Manage runtime for
  English and German: editable draft credits and saved confirmation,
  publication review, current and stale/retry account usage, and the blocked KB
  graph build with an insufficient semester quota. Screenshots for all ten
  states are stored under `project/screenshots/`.
- **2026-09-04:** Follow-up standards fixes restored the Manage AI feature gate
  on credit-policy mutations and reduced the two new schema resolvers to direct
  service delegations.
- **2026-09-04:** Independent review identified the initial settings-refresh
  fallback and an ambiguous ownership sentence. Settings now renders cached
  values during an entry refresh and exposes stale or unavailable Retry states;
  the plan now states the agreed persisted-chatbot-owner boundary explicitly.
  The correction review returned no remaining high-confidence finding.
- **2026-09-04:** Consolidated publication onto the single
  `requestChatbotPublication` mutation. Removed the temporary alternate
  operation and the obsolete flat `proposedCredits` input; the mutation now
  validates and preserves the separately saved four-field credit policy.
