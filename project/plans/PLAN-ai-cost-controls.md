# AI cost controls

## Approved extension: revise published chatbot settings

### Approval summary

Lecturers can revise the existing setup fields, including participant credits
and disclaimers, and submit those changes for approval. Students continue using
the last approved configuration until an administrator approves the exact
submitted revision. The user approved this behavior on 2026-09-08. This extension
supersedes the draft-only credit contract and post-publication exclusion below.

Keep one saved revision alongside the live chatbot, preserving its identity,
course, chat history, participant balances, and original publication date.
Account funding, provider configuration, course ownership, knowledge-base and
MCP bindings, custom prompts, and response-example review retain their existing
permissions and behavior. This is a revision of the lecturer setup, not a
snapshot of every runtime dependency.

Approval changes no participant balance or history. Initial credits apply to
new participants. Existing balances and stored totals remain until the next
ordinary reset, when the approved amount and maximum apply. Changing the reset
schedule starts that schedule at approval without an immediate extra top-up.
Changed disclaimer content requires renewed acceptance after approval.

Authority: implement, verify, review, commit, and ordinarily push the existing
task branch and update PR #5771. Keep the local runtime available for testing.
Do not merge, deploy, reset a database, modify infrastructure, or change external
providers. Boundary owner: main. Terminal: verified revision workflow and
conflict-free PR with required checks and reviews satisfied; runtime available
in Browser. Pause only for a material new product decision or unavailable
required capability; the approved live-versus-draft decision is settled.

### Binding implementation contract

| Product primitive | Disposition | Contract |
| --- | --- | --- |
| Chatbot configuration | Extend | One typed, validated saved revision; live columns remain canonical for participants. |
| Publication approval | Extend | Review and activate one immutable submitted version while the live chatbot stays published. |
| Participant credit policy | Extend | Activate changed policy without granting, clamping, or resetting existing balances. |
| Disclaimer acceptance | Reuse | A changed disclaimer identity requires renewed acceptance when linked at approval. |

The revision allowlist is name, description, avatar, standard-mode flags and
framing fields, model selection and allowlists, reasoning efforts, the four
participant-credit fields, disclaimer title and introduction, use case, and
expected student count. Preserve raw unedited legacy configuration instead of
materializing display fallbacks. Disclaimer management and media fields remain
unchanged. Never serialize a complete Prisma object into the revision.

Add nullable typed draft configuration, orthogonal revision status, a monotonic
revision version, and a nullable credit-reset-schedule activation timestamp to
Chatbot in one additive, tool-generated migration. A related revision-history
model and multiple drafts are out of scope. Expose the version even when the
draft is absent. The owner projection returns explicit authoring revision
content alongside unchanged live fields, usage, and acceptance counts.

All six authoring services share the fence: updateChatbot,
updateChatbotModelSettings, updateChatbotModelPolicy,
updateChatbotStandardModeConfig, updateChatbotCreditPolicy, and
saveChatbotDisclaimer. Published edits require the expected version. The first
edit atomically copies the live configuration and applies the change. Every
save compares and increments the version, including first-publication saves.
Absent version arguments may retain compatibility only where no race fence can
be defeated. Never substitute the current version for an omitted published-edit
token. Preserve null-versus-omitted metadata semantics.

Submission validates the complete saved configuration and live account
publishing capability, increments the version, clears a previous rejection
comment, and freezes the revision. Pending saves fail. Withdrawal and rejection
compare the pending version and preserve its content for editing; rejection
requires a comment. Resubmission produces a new token. An admin-only query
exposes the frozen snapshot and token without adding a dashboard.

Approval requires administrator authorization, the exact pending token, and
live account capability. After acquiring the Chatbot row lock, revalidate and
copy only allowlisted configuration, then clear the draft and increment the
version in one transaction. Preserve live PUBLISHED status and first
publishedAt. PAUSED bots cannot be edited or approved. Tokenless administrative
compatibility is limited to pre-migration pending requests at version zero;
every new submission needs its exact token. Legacy pending queries represent
the existing live configuration and version zero explicitly.

Draft disclaimer saves create unlinked replacement identities. Normalized
no-ops retain the identity. Never mutate historical disclaimer content or the
live disclaimer link before approval. Live acceptance counts stay attached to
the live disclaimer, not the draft. Owner test chat continues using live
configuration and must be labelled accordingly.

For credit schedule changes, stamp activation only when the reset period
changes, after the approval transaction obtains the Chatbot lock. Reset
eligibility uses the later of the participant period baseline and activation.
Inventory every reset, initialization, and debit writer. Credit-writer
transactions acquire the Chatbot row FOR SHARE before loading policy and before
participant locks, retaining it through commit. Approval takes FOR UPDATE.
Preview reads use a consistent transaction observation with no state writes.
This prevents an old-policy writer from applying a reset after new-policy
activation. NONE preserves remaining credits and disables future resets.

### Ownership and verification

| Slice | Owner | Acceptance and dependency |
| --- | --- | --- |
| Plan and contract | Main | Planner-approved amendment; supersede only affected domain contracts. |
| Saved revision API | Executor | Schema and GraphQL source plus service tests for isolation, transitions, authorization, and concurrent version fences. Main owns generated migration and outputs. |
| Credit activation | Executor | After accepted generated schema: all writer and preview paths preserve balances, reset timing, and ordering against approval. |
| Lecturer workflow | Executor | After accepted API: existing setup forms edit revision, show live/draft distinction, submit, withdraw, and resubmit in English and German. |
| Integration and delivery | Main | Browser proof, required checks/build, independent reviews, PR update, and supported runtime lifecycle verification. |

The test portfolio extends existing chatbot authoring, publication, management,
participant-access, credit, and disclaimer suites. Add a test only for an
uncovered consequential behavior. Use test-owned synthetic data and stable
behavior assertions, never exact prose or seed counts. Test stale saves,
save/submit races, approve/withdraw/resubmit races, owner/account gates, full
live-configuration isolation, and old/new disclaimer acceptance. Credit tests
cover both lock orderings around approval, changed schedules including NONE,
lower caps, initial-credit-only edits, retained balances and stored totals.

UI acceptance requires dirty-form protection, conflict refetch without silently
discarding edits, pending forms disabled, saved drafts surviving reload, and
separate live and draft disclaimer information. Verify live participant
behavior before and after approval using synthetic fixtures. Capture relevant
desktop and compact layouts in English and German through browser tooling.

Generate the one migration with installed Prisma schema-diff tooling, inspect
it, and sync the analytics mirror. Build generated dependencies before checks.
Run focused tests and repository-required checks in the exact retained
container; browser tests use the supported host launcher. Backend and credit
slices require risk review and simplification; the integrated result requires
final review. Passing evidence is reused where its content and environment are
unchanged. Supported runtime lifecycle reconciliation must succeed before
delivery; identifying a running container alone is insufficient.

### Extension progress

- Current checkpoint, 2026-09-09: implementation and target integration are
  committed through `769cd462fa`. The final review covered the complete range
  from `c939ab348a`, including migration equivalence, revision isolation,
  authorization, credit locks, UI, and tests. Its six findings are addressed in
  the current correction: omit the redundant disclaimer identity argument,
  route review credit editing to Usage, test sequential disclaimer saves and
  revoked feature access, remove unreachable credit read-only UI and copy,
  gate withdrawal, and allow the legacy approval document to carry a revision
  token. There is no reject operation document to update. Retain the optional
  all-sections credits accordion because the component still supports that
  mode; the active workspace uses its separate Usage editor.
- Devrouter 0.0.62 restores canonical tooling access without recreating the
  retained runtime. The Devrouter owner confirms that no further recovery
  command is required and that separate exec calls must run sequentially.
  Configuration drift and the missing historical stop baseline remain known
  lifecycle limitations; do not restart or rewrite ownership to clear them.
  Keep the exact `rs/pr-5771-cost-controls` checkout and `feat-ai-cost-controls`
  runtime running through the user's next testing checkpoint.
- Correction verification: the five-file GraphQL run passed 226 of 227 tests;
  the remaining test expected an obsolete access-error code after target
  integration. Its corrected feature-gate suite passes all 15 tests. Focused
  production build passes all 11 tasks, and serial build/check/lint passes all
  13 tasks. The first combined development-environment build/check attempt hit
  duplicate generated Next.js types; the production build and separate checks
  pass without a source workaround. Earlier unaffected root and credit checks
  retain their evidence below.
- The existing authenticated in-app Browser verifies consecutive disclaimer
  saves and persistence after reload, then the review's Edit credits button
  opens the editable Usage form. The synthetic disclaimer title is restored;
  Benibot remains published with saved revision 12, and live credits remain
  100 / WEEKLY / 50 / 100. No revision was approved. Automatic approval review
  rejected the separate agent-browser login's password-in-arguments method;
  no retry or credential transfer was used. German revision visual proof and
  the full reset-based Playwright run remain unverified. Final correction
  review, task-branch push, and current-head hosted checks remain before merge
  readiness; this checkpoint does not claim the remote PR is conflict-free.

- 2026-09-08: User approved retaining the live chatbot while revising all existing
  lecturer-facing setup fields. No implementation of revisions is complete yet.
- Planner construction and two-round hardening completed with APPROVED after
  accepting explicit empty-version, legacy-publication, credit-locking, and UI
  acceptance corrections. Claude advisor supported the snapshot approach and
  identified the reset-schedule activation risk. Its narrower field proposal
  was rejected because it conflicts with the user's approved broader scope.
- Active source is clean c75c91c6f4 on feat/ai-cost-controls, PR target v3-ai.
  Existing conflict and navigation fixes are delivered. Revision implementation,
  verification, and reviews remain.
- Resume verified the retained `feat-ai-cost-controls` runtime as ready with
  the manage profile. The process-identity error is sandbox-only; supported
  host devrouter exec and status succeed outside that restriction. The user
  requests retention for testing through the next checkpoint.
- Current target adds chatbot editor changes in 836d63bf45; integrate v3-ai
  once current writers finish, preserving its editor behavior and this credit
  and revision workflow. UI executor owns that reconciliation in its files.
- Revision schema validation passed in the retained container. Backend and
  credit workers continue their original scopes; the UI executor owns the
  lecturer workflow and EN/DE messages. Main owns navigation documentation,
  generated outputs, integration, browser proof, and delivery.

- A separate temporary PostgreSQL container `pr5771-revision-tests` runs on
  the exact task network with no host port and tmpfs data. Repository guarded
  bootstrap and schema push passed. GraphQL integration tests use this service
  so their cleanup cannot erase the retained browser seed. Main stops this
  auxiliary container after the tests; the Manage runtime stays available.

- Credit activation implementation is present. Independent main checks pass:
  chat TypeScript, three preview unit tests, and eight scoped PostgreSQL tests,
  including both lock orderings around policy approval.
  All three local feature-payload tests pass. Prisma migration SQL reproduced
  from the recorded pre-change schema and matches the additive migration.
- Backend schema projection and additive operation contracts are frozen;
  service transitions and tests remain with the backend worker. UI integration
  is active against those contracts. No revision slice is committed or reviewed
  yet; full checks, target integration, browser proof, and delivery remain.

- Resume recovery regenerated GraphQL operations successfully and adapted the
  authoring browser spec to the target's workspace navigation. Playwright
  TypeScript passes. The new browser case covers saved published credit
  revisions, reload, pending lock, and exact-version approval; execution remains.
- Supported runtime repair requires preserving the retained numeric
  `KB_GRAPH_BLOB_HOST_PORT`; without it the Compose hash check reports app
  configuration drift. Values-free comparison identified the mismatch. With
  that environment preserved, repair reaches semantic readiness. The remaining
  HTTP 500 is the UI worker's JSX helper using a `.ts` extension; correction is
  assigned to that owner. No runtime teardown or database reset occurred.

- Supported repair now succeeds with status `ready`, zero drift, auth HTTP 200,
  and Manage HTTP 307 readiness. The browser renders Benibot with Resources
  navigation and the live-configuration notice. The original retained database
  is intact. Preserve the user's keep-running request through delivery.

- Main independently reran chat TypeScript, three preview tests, eight isolated
  PostgreSQL credit tests, and the seven-file credit/types formatter check:
  all pass. Main removed two invalid cleanup promise type predicates from the
  concurrency tests; `Promise.allSettled` already accepts undefined values.
  A broader Biome lint invocation reports pre-existing switch declarations in
  `creditPeriods.ts`; no unrelated cleanup was applied.

- The root check's host-only Playwright CI contract failed inside the container
  because no host Devrouter binary exists there. Its exact Node test command
  passes on the host: 68 tests. A host pnpm wrapper attempted dependency repair
  and aborted before mutation; the direct checked-in Node command avoids it.
- Root parallel typechecking also raced Prisma build/check generators
  (`ENOTEMPTY` in generated client models). Serial Prisma regeneration/build
  succeeds. The equivalent repository checks now run with concurrency one.
  Target navigation and translation integration errors remain assigned to UI.

- Latest independent checks pass: Manage TypeScript, GraphQL source
  TypeScript, Playwright TypeScript, and three credit preview unit tests.
  The serial root check stops at the expected uncommitted public-schema diff;
  rerun after the generated snapshot is committed.
- Browser verification saved Benibot's initial-credit revision from 100 to 90.
  Reload retains revision version 1 at 90 while the live policy remains 100.
  Submission, pending-field locking, withdrawal, credit editing, and
  resubmission now pass through the actual browser. No revision was approved.
  The test draft is withdrawn and its initial credits are restored to 100;
  synthetic publication-request details remain in the editable draft.
  Exact-worktree `devrouter ensure --profile manage`
  succeeds with auth 200 and Manage 307 readiness.
- EN/DE key and ICU parity, Prisma analytics mirror consistency, and Syncpack
  pass. Compact browser proof found the new owner-preview notice overflowing
  its card; the UI worker owns the focused correction. Automatic approval
  review rejected changing the seeded lecturer's persistent language for
  German browser proof. Locale remains English; German visual proof is pending.
- The compact preview/notice fix passes screenshot inspection. Main removed
  unnecessary render-time refs from the clean-form synchronizer; focused
  formatting, Manage lint, and Manage TypeScript pass. Browser navigation
  cancellation retains an unsaved credit edit, then restoring the saved value
  leaves the form clean. Legacy API fences and their regression tests remain
  with the backend worker before commit, target integration, and reviews.
- Fresh PR feedback still reports GitGuardian incidents in two CI fixture
  files. A values-free `git diff --quiet HEAD origin/v3-ai --` check confirms
  both files are identical to the live target. Incident classification remains
  with the GitGuardian owner; no suppression or unrelated fixture rewrite is
  included. The constant-sharing nitpick is not required for correctness: the
  signed 32-bit protocol bound is stable, and a new shared abstraction is not
  needed for this revision workflow.

- Main took over the legacy API corrections after the backend correction pass
  left old save endpoints outside the revision fence. All six now delegate to
  the same staged workflow. Published writes require a version; first-publication
  legacy writes advance it while preserving owner preview. Administrative
  compatibility is limited to pre-migration pending requests at version zero.
- Six isolated revision transition tests pass, including all legacy authoring
  endpoints, unchanged live configuration, exact-version activation, competing
  saves, withdrawal/rejection/resubmission, and disclaimer identity retention.
  Regression-test updates remain owned by the test executor.
- Repository checks pass: 40 serial build/check tasks, seven lint tasks,
  staged formatting, Syncpack, agent-document and Git-identity checks, retired
  artifact checks, Prisma mirror validation, and 13 host-launcher checks.
  The separate host-only Playwright CI contract passes 68 tests.
  Gitleaks reports no staged leaks. GraphQL Rollup retains its existing
  declaration-resolution warnings; the explicit source type check passes.
- The actual browser saves and reloads the revised credit draft while the
  published policy remains unchanged. The draft value is restored to 100.
  Target integration, committed-slice reviews, integrated review, and delivery
  remain. The fetched target advanced to c939ab348a; integrate deliberately
  once the regression checks complete because the PR is still conflicted.

- Production build passes all 26 tasks. Seven revision integration tests pass,
  now including concurrent approval versus withdrawal of the same token.
  Browser submission and withdrawal pass after the legacy API corrections;
  the retained draft is editable again. No participant policy was activated.

- Revision implementation committed as 477086ab1e after staged secret scan,
  216 GraphQL regressions, source checks, and production build. Host commit
  hooks were replaced with their container-equivalent checks because pnpm
  belongs inside the retained container; host Git identity and Gitleaks passed.
- Integrated target c939ab348a to resolve real PR conflicts. Editor conflicts
  retain the target editor behavior already incorporated into the revision
  implementation. Backend keeps the development-only feature payload and
  accepts the target removal of the old test proxy. New target test handling
  remains intact. No conflict markers remain.
- Simplifier completed with two accepted reductions: reuse the existing credit
  policy query after the writer lock, and remove redundant branches after
  revision JSON validation. No new abstraction or dependency was added.
- Frozen-lockfile installation and integrated focused TypeScript checks pass.
  Integrated regressions pass 217 GraphQL tests and 11 credit tests.
  Full merged checks and risk review are running before the integration commit.

- Merged-tree checks pass 47 build/check/lint tasks plus formatting, Syncpack,
  identity, agent guidance, retired-artifact and Prisma mirror checks. The
  target's expanded host-launcher suite must run on the host: all 27 tests pass
  there, as do all 68 Playwright CI contract tests. Its container refusal is an
  environment boundary, not an application failure.
- Risk review found no high-confidence service or credit-locking finding, but
  its return narrowed the original scope incorrectly. The same reviewer is
  completing schema, migration, projection, UI, and remaining credit seams;
  the review gate remains pending until the full requested scope is covered.

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
