# PR #5109 — Sequential Review Map

- PR: https://github.com/uzh-bf/klicker-uzh/pull/5109
- Head SHA: `96efd27e5` (the PR head this map describes; working branches have since advanced past it, so anchor on the SHA, not a branch name)
- Base: `v3-ai`; diff range `origin/v3-ai...96efd27e5`
- Total size (measured, not copied from the PR body): **336 files changed, +28,740 / −878**
- Readiness contract: [2026-07-28 production readiness improvement plan](./2026-07-28-pr-5109-production-readiness-improvement-plan.md)
- Evidence at head: [2026-08-03 final production readiness evaluation](./2026-08-03-pr-5109-final-production-readiness-evaluation.md)

This PR is one monolithic branch that would normally have been a stack. The map
below cuts it into nine chunks in dependency order — shared contracts first,
then the MCP servers, the chat server layer, the chat UI, the host apps, the
automated verification, deployment, docs, and a mechanical remainder. Review
them top to bottom: each chunk only assumes the chunks above it, so you never
have to jump forward to understand what you are reading. For each chunk, run the
local `git diff` command (or paste the filter terms into the PR's "Files
changed" filter box), open the anchor files first to get the shape of the layer,
then answer the review questions. The "already proven" line tells you which
tests and CI jobs already cover the chunk, so you can spend your attention on
what automation cannot check: trust boundaries, contracts, and operational
risk. Every one of the 336 changed files is assigned to exactly one chunk; the
per-chunk counts sum to 336 (23 + 45 + 44 + 32 + 25 + 85 + 26 + 38 + 18 = 336).
Only chunk 9 is a mechanical bucket, and it is explicitly labelled as such.

All commands below are run from the repository root of a checkout that has
`origin/v3-ai` fetched.

## Chunk 1 — Shared contracts: types, GraphQL, Prisma enum, i18n

**Contract.** This layer defines every cross-package type and persisted-schema
element the rest of the PR depends on: the shared TypeScript contracts for chat
context, Manage-assistant messages and student MCP payloads; a new
participant-facing GraphQL query `courseChatbots` returning a deliberately
narrow `ChatbotPublic` type; one additive Prisma enum value
(`AuditLogType.ASSISTANT_PROPOSAL_CONFIRMED`) with its migration and the
mirrored analytics schema; and the EN/DE message keys the two drawers render.
Everything above this chunk assumes these shapes are stable and that the new
query never exposes lecturer-only chatbot configuration to participants.

**Size.** 23 files, +437 / −3.

```bash
git diff origin/v3-ai...96efd27e5 -- packages/types packages/i18n packages/graphql packages/prisma/src apps/analytics/prisma packages/util/src packages/util/test
```

**GitHub filter terms.** `packages/types/**`, `packages/i18n/**`,
`packages/graphql/**`, `packages/prisma/src/**`, `apps/analytics/prisma/**`,
`packages/util/src/**`, `packages/util/test/**`

**Read these first.**

1. `packages/graphql/src/services/chatbots.ts` — the new
   `getParticipantCourseChatbots` resolver service; the only new participant
   data path in the PR.
2. `packages/graphql/src/schema/resource.ts` — `ChatbotPublic`, the reduced
   field set participants may see.
3. `packages/prisma/src/prisma/schema/migrations/20260726184305_assistant_proposal_audit/migration.sql` —
   the entire schema change, two lines.
4. `packages/types/src/manageAssistant.ts` — the parent/iframe message contract
   used by chunks 4 and 5.
5. `packages/types/src/chatContext.ts` — the context envelope the PWA drawer
   hands to chat.
6. `packages/util/src/clientAuth.ts` — the shared token decode/extract helper
   the chat guards in chunk 3 build on.

**Review questions.**

1. `getParticipantCourseChatbots` gates on a `participation` row for
   `(courseId, ctx.user.sub)` and returns `[]` otherwise. Is participation the
   right gate for a course whose chatbots should perhaps be restricted further
   (archived course, chatbot not published)? Should an empty result and "no
   access" be distinguishable?
2. `ChatbotPublic` exposes `id`, `name`, `description`, `avatar`. Is anything in
   `description`/`avatar` lecturer-authored free text that could carry data a
   participant should not see?
3. The enum addition is **one-way**: PostgreSQL cannot drop an enum value. Does
   the value name `ASSISTANT_PROPOSAL_CONFIRMED` read correctly for future
   assistant surfaces beyond element creation, or will it need a sibling later?
4. `packages/i18n/request.ts` replaces a dynamic `import()` template with an
   explicit `switch`. Confirm no locale silently falls back to EN that
   previously resolved.

**Already proven.** `packages/graphql/test/courseChatbots.test.ts` runs in the
DB-backed `test-graphql` CI job (green at head). Repo typecheck 27/27 and the
`prisma-sync` check (schema mirrored to `apps/analytics`) pass. The migration was
applied by the `test-mcp-lecturer` workflow's migrate+seed step.

## Chunk 2 — MCP servers: `apps/mcp-lecturer` (new) and `apps/mcp-student` (hardened)

**Contract.** `apps/mcp-lecturer` is a new production workload: an HTTP-stream
MCP server that authenticates a short-lived HS256 bearer JWT
(`purpose: 'lecturer-mcp'`, scopes `manage:read` / `manage:draft`), then serves
nine lecturer tools — course/element reads, three draft helpers, and one signed
`element_create_draft_proposal`. It talks to **Postgres directly through
`@klicker-uzh/prisma`**, not through GraphQL, so it re-implements the permission
check itself against `derivedPermission` rows. It promises the chat layer above
that no tool ever returns data the calling lecturer could not see in Manage, and
that the proposal tool only ever mints a signed intent, never a database write.
`apps/mcp-student` gets the same structural hardening (tool policy table,
sanitized tool errors, shared tool runner) without a behavior change to its
existing tools.

**Size.** 45 files, +5,108 / −114.

```bash
git diff origin/v3-ai...96efd27e5 -- apps/mcp-lecturer apps/mcp-student util/mcpSmokeClient.mts
```

**GitHub filter terms.** `apps/mcp-lecturer/**`, `apps/mcp-student/**`,
`util/mcpSmokeClient.mts`

**Read these first.**

1. `apps/mcp-lecturer/src/auth.ts` — bearer extraction, purpose/role check and
   scope parsing; the outer authentication boundary.
2. `apps/mcp-lecturer/src/authorization.ts` — the permission lattice
   (`READ < EXECUTE < WRITE < ADMIN < OWNER`) and `requireDerivedPermission`;
   the inner authorization boundary.
3. `apps/mcp-lecturer/src/toolPolicy.ts` — the declarative table of the nine
   tools with RBAC scope, confirmation requirement and solution exposure.
4. `apps/mcp-lecturer/src/service.ts` (943 lines, the bulk of the chunk) — every
   Prisma query and the proposal signing.
5. `apps/mcp-lecturer/src/config.ts` — env resolution, including the
   `MCP_LECTURER_JWT_SECRET ?? APP_SECRET` fallback.
6. `apps/mcp-student/src/server.ts` — the refactor that the student server
   shares with the lecturer one (+56 / −105).

**Review questions.**

1. Direct Prisma access bypasses the GraphQL `authenticate → authorize →
   execute` chain. Does every read path in `service.ts` route through
   `requireDerivedPermission` (or an equivalent owner filter), and is there any
   query that filters only by id without a user predicate?
2. `verifyLecturerSession` requires `role === 'USER'` and
   `purpose === 'lecturer-mcp'`, but the secret falls back to `APP_SECRET` when
   `MCP_LECTURER_JWT_SECRET` is unset. With the fallback active, any
   `APP_SECRET`-signed token differs from a Manage session token only by the
   `purpose` and `scope` claims — is that separation sufficient, and should the
   dedicated secret be mandatory in production?
3. `parseScopes` silently drops unknown scope strings and
   `verifyLecturerSession` defaults `requiredScopes` to `['manage:read']`. Is
   every draft/proposal tool explicitly requiring `manage:draft`, or does any
   rely on the default?
4. `element_create_draft_proposal` is annotated `readOnlyHint: true` while
   `requiresHumanConfirmation: true`. Is "returns a signed token, writes
   nothing" correctly modelled as read-only for an MCP client that may auto-run
   read-only tools?
5. `toolErrors.ts` shapes what an error tells the model. Can a Prisma or network
   error message reach the model (and hence the lecturer's transcript) verbatim?

**Already proven.** 40/40 `mcp-lecturer` unit tests and 28/28 `mcp-student` unit
tests pass at head. The `test-mcp-lecturer` CI workflow additionally boots
Postgres, runs migrate + seed, starts the real server, and executes both
`smoke:local` (happy path) and `smoke:negative` (auth rejections) — green at
head.

## Chunk 3 — Chat server layer: `/api/manage/*`, auth mint, request envelope, proposals

**Contract.** This is the trust boundary of the whole feature. It promises that
(a) only a verified `next-auth.session-token` with a Manage role reaches the
assistant; (b) the lecturer's `UserLoginScope` is mapped down to an MCP scope
that can never exceed what the session could do at the GraphQL layer; (c) the
request envelope is bounded (16 MiB streamed body, 50 messages, 500 parts,
deadlines, one in-flight request, per-user rate limits) and client-supplied
message objects are reconstructed rather than forwarded; (d) MCP tool output is
fenced with a per-request sentinel so tool text cannot impersonate system
instructions; and (e) a proposal only becomes a database row when a signed,
subject-bound, single-use token is replayed by the same lecturer through
`/api/manage/proposals/confirm`, which then calls GraphQL with the lecturer's
own session token. It also carries the PWA-embed token exchange that lets the
PWA drawer authenticate a participant inside a cross-origin iframe.

**Size.** 44 files, +5,693 / −42 (27 source files plus 17 co-located unit test
files).

```bash
git diff origin/v3-ai...96efd27e5 -- apps/chat/package.json apps/chat/src/app/api apps/chat/src/app/auth apps/chat/src/lib/server apps/chat/src/lib/pwaEmbedAuth.ts apps/chat/src/middleware.ts apps/chat/src/instrumentation.ts apps/chat/src/services
git diff origin/v3-ai...96efd27e5 -- apps/chat/test/chat-context.test.ts apps/chat/test/lecturer-mcp.test.ts apps/chat/test/manage-assistant-runtime.test.ts apps/chat/test/manage-assistant-skills.test.ts apps/chat/test/manage-chat-request.test.ts apps/chat/test/manage-chat-route.test.ts apps/chat/test/manage-context.test.ts apps/chat/test/manage-parent-notify.test.ts apps/chat/test/manage-proposals.test.ts apps/chat/test/manageAuth.test.ts apps/chat/test/mcpAuthMint.test.ts apps/chat/test/middleware-matcher.test.ts apps/chat/test/proposal-to-element-instance.test.ts apps/chat/test/pwa-embed.test.ts apps/chat/test/rate-limiter.test.ts apps/chat/test/student-practice-mcp.test.ts apps/chat/test/tool-output-fencing.test.ts
```

**GitHub filter terms.** `apps/chat/src/app/api/**`, `apps/chat/src/app/auth/**`,
`apps/chat/src/lib/server/**`, `apps/chat/src/services/**`,
`apps/chat/src/middleware.ts`

**Read these first.**

1. `apps/chat/src/lib/server/manageAuth.ts` — who counts as a Manage user
   (`USER`/`ADMIN`, participant cookies rejected defensively).
2. `apps/chat/src/lib/server/mcpAuthMint.ts` — `resolveLecturerMcpScope`, the
   session-scope to MCP-scope downgrade, `OTP` rejection, and the 5-minute
   token cache keyed by user **and** scope.
3. `apps/chat/src/lib/server/manageChatRequest.ts` — the entire request
   envelope: bounded streaming reader, part/text/image limits, and the
   allowlist reconstruction in `validateManageChatRequest`.
4. `apps/chat/src/services/manageProposals.ts` — token verification, the
   in-process `jti` replay guard, the persisted-query call to GraphQL, and the
   best-effort audit write.
5. `apps/chat/src/services/toolOutputFencing.ts` — the per-request sentinel and
   fence-forgery neutralization.
6. `apps/chat/src/middleware.ts` — the `matcher` that deliberately excludes
   `api/manage/chat`, plus the PWA-embed token branch.
7. `apps/chat/src/lib/server/apiGuards.ts` — the reordered participant identity
   resolution (guest cookie → PWA embed cookie → bearer header →
   `participant_token`).

**Review questions.**

1. Neither `/api/manage/chat` nor `/api/manage/proposals/confirm` checks any
   feature flag: both are live for any authenticated lecturer the moment the
   chat image deploys (recorded as finding F1 in the readiness evaluation). Is
   "unreachable from the UI" an acceptable control for the enablement window,
   or should a server-side env gate land before merge?
2. The middleware `matcher` excludes `/((?!api/manage/chat$).*)` so Next does
   not buffer the 16 MiB body. Does that exclusion remove any protection the
   middleware was providing for that route, and is the `$` anchor tight enough
   (for example against `/api/manage/chat/` or a query string)?
3. `confirmManageProposal` forwards the lecturer's raw
   `next-auth.session-token` to the GraphQL API as both a bearer header and a
   cookie, with a synthetic `origin` header and `x-graphql-yoga-csrf: true`. Is
   chat the right component to be replaying a session token server-to-server,
   and does the synthesized CSRF header weaken Yoga's CSRF protection for other
   callers?
4. The `jti` replay guard is per-pod, in-memory, and tokens minted before the
   guard existed (no `jti`) are accepted without a replay check. With two chat
   replicas, a double-click can produce two elements. Is that acceptable, or
   does confirmation need a shared store or a DB uniqueness constraint?
5. `resolveLecturerMcpScope` degrades unknown or missing scopes to
   `manage:read`. Trace a delegated-login session (`FULL_ACCESS`) and a
   `SESSION_EXEC` session through mint → MCP verify → tool policy: does a
   `SESSION_EXEC` lecturer correctly lose the drafting tools?
6. `recordProposalConfirmationAudit` swallows its own errors after the element
   already exists. Is a silently missing audit row acceptable for the compliance
   story this enum value was added for?

**Already proven.** The `@klicker-uzh/chat` suite is 236/236 green at head and
includes dedicated files for the envelope (`manage-chat-request.test.ts`, 545
lines), the route (`manage-chat-route.test.ts`), auth (`manageAuth.test.ts`,
`mcpAuthMint.test.ts`), proposals (`manage-proposals.test.ts`, 367 lines),
fencing (`tool-output-fencing.test.ts`, 359 lines), the middleware matcher and
the rate limiter. Live browser verification at head confirmed a real streamed
`POST /api/manage/chat` 200 and that a deliberately leaky mocked 500 response
put zero canary strings into the accessibility tree.

## Chunk 4 — Chat assistant UI: `/manage` surface, proposal cards, embed hooks

**Contract.** The client half of `apps/chat`: a `/manage` page that renders the
assistant inside the Manage iframe, the proposal card and preview that turn a
signed proposal into a lecturer-visible "confirm this" affordance, tool labels
and fallbacks that describe tool activity without leaking raw payloads, and the
hooks/stores that receive the embedding parent's context over `postMessage` and
cache the validated parent origin. It promises the host apps (chunk 5) that the
iframe only ever accepts context from the origin it was handed, and that the
confirm button calls the chunk 3 route rather than persisting anything itself.

**Size.** 32 files, +1,776 / −173 (26 source files plus 6 component/hook test
files).

```bash
git diff origin/v3-ai...96efd27e5 -- apps/chat/src/app/manage apps/chat/src/app/globals.css apps/chat/src/components apps/chat/src/hooks apps/chat/src/stores apps/chat/src/lib/client apps/chat/src/lib/config
git diff origin/v3-ai...96efd27e5 -- apps/chat/test/authedFetch.test.ts apps/chat/test/chat-response-hydration.test.ts apps/chat/test/image-attachment-adapter.test.ts apps/chat/test/manage-proposal-card.test.ts apps/chat/test/manage-suggestions.test.ts apps/chat/test/tool-fallback.test.ts
```

**GitHub filter terms.** `apps/chat/src/components/**`, `apps/chat/src/hooks/**`,
`apps/chat/src/stores/**`, `apps/chat/src/app/manage/**`,
`apps/chat/src/lib/config/**`, `apps/chat/src/lib/client/**`

**Read these first.**

1. `apps/chat/src/components/manage-proposal-card.tsx` (277 lines) — the
   confirm affordance and its error/duplicate states.
2. `apps/chat/src/hooks/useEmbeddedManageContext.ts` — validation of the
   incoming `klicker:manage-context` message and where the parent origin is
   cached.
3. `apps/chat/src/services/manageParentNotify.ts` is in chunk 3, but read it
   next to `apps/chat/src/stores/manageParentStore.ts` here: the store is the
   only source of the concrete `postMessage` target origin.
4. `apps/chat/src/components/thread.tsx` (+291 / −104) — the largest UI change;
   both the student and Manage threads render through it.
5. `apps/chat/src/components/tool-fallback.tsx` and `tool-labels.ts` — what a
   lecturer sees while a tool runs.
6. `apps/chat/src/lib/config/attachmentLimits.ts` — shared with the chunk 3
   server envelope; the two must not drift.

**Review questions.**

1. `useEmbeddedManageContext` accepts a parent context message. What does it
   validate before caching `event.origin`, and can a page that frames chat
   from an unexpected origin get its origin cached and then receive the
   `element-created` notification?
2. The proposal card renders model-authored content (question text, options,
   explanation). Is that rendered as text or as markdown/HTML, and can a
   prompt-injected proposal render active content in the lecturer's tab?
3. `manage-proposal-preview.tsx` shows the lecturer what will be persisted.
   Does the preview render the same fields the chunk 3 route actually sends to
   GraphQL, or could a mismatch let a lecturer confirm something they did not
   see?
4. Readiness finding F2: a 200 response with a non-stream body renders no
   assistant bubble and no error. Where in `thread.tsx` would a "stream ended
   without content" state belong?
5. `suggestions.ts` was deleted and replaced by `manageSuggestions.ts` (161
   lines). Confirm the student surface did not lose its suggestions.

**Already proven.** Covered by the same 236/236 chat suite (component tests for
the proposal card, tool fallback, suggestions and hydration). The Playwright
specs in chunk 6 drive this UI end to end inside both host apps. Live browser
verification at head: drawer opens, real answer streams, generic error contract
holds, focus is restored on close.

## Chunk 5 — Host app integration: Manage widget and PWA course-chat drawer

**Contract.** The two host applications embed the chat surfaces. In
`apps/frontend-manage`, a feature-flagged (`NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED`)
launcher renders a modal drawer that marks the app root `inert` + `aria-hidden`,
declares `role="dialog" aria-modal="true"`, hands the iframe a context payload
plus its own concrete origin, and listens for the `element-created` message to
refresh the question pool. In `apps/frontend-pwa`, a course-chat drawer lists a
course's chatbots (via the chunk 1 query), mints a scoped embed token, and
frames the chat app with the same modal contract. This layer promises no
regression to the surrounding pages when the flag is off — the launcher compiles
out entirely.

**Size.** 25 files, +2,098 / −39.

```bash
git diff origin/v3-ai...96efd27e5 -- apps/frontend-manage apps/frontend-pwa ':(exclude)apps/frontend-manage/Dockerfile' ':(exclude)apps/frontend-pwa/.env.stg'
```

**GitHub filter terms.** `apps/frontend-manage/src/**`,
`apps/frontend-manage/test/**`, `apps/frontend-pwa/src/**`

**Read these first.**

1. `apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx`
   (392 lines) — flag check, inert handling, origin-checked message listener,
   iframe handshake.
2. `apps/frontend-manage/src/components/assistant/manageAssistantContext.ts`
   (220 lines) — exactly which page context is handed to the assistant.
3. `apps/frontend-pwa/src/components/chatbot/CourseChatDrawer.tsx` (476 lines) —
   the participant-side equivalent.
4. `apps/frontend-pwa/src/lib/chatbot/embedAuth.ts` — how the scoped embed token
   is obtained before framing chat.
5. `apps/frontend-manage/src/components/assistant/manageAssistantConfig.ts` —
   `isManageAssistantEnabled` and `buildManageAssistantUrl`, including the
   `parentOrigin` parameter.
6. `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/index.tsx` — the new
   chatbot index route, and the five `microLearnings`/`practiceQuizzes` page
   edits next to it.

**Review questions.**

1. `manageAssistantContext.ts` decides what leaves the Manage tab. Does it ever
   include participant-identifying data, response data, or full element
   payloads rather than ids and names?
2. Five unrelated-looking Manage components change `h-full` to
   `min-h-full shrink-0` (`CatalogBrowser`, `UserGroupsManagement`,
   `AnswerCollections`, `Chatbots`, `MediaLibrary`). Confirm this is the layout
   consequence of the drawer's flex container and that each page still fills the
   viewport with the flag off.
3. The widget listens for messages and compares `event.origin` to
   `assistantOrigin`. Is `assistantOrigin` derived from build-time config
   (trustworthy) or from anything runtime-influenced?
4. Readiness finding F3: Escape pressed inside the iframe does not close the PWA
   drawer, because the keydown lands in the cross-origin document. Is the
   remaining keyboard path (Tab to the close control) an acceptable a11y
   contract for release?
5. With the flag unset, does the widget tree fully compile out, or does the
   Manage bundle still ship the assistant code behind a runtime check?

**Already proven.** Unit tests for the config, context builder and
element-created message. Both drawers are driven end to end by
`Y-manage-assistant.spec.ts` (603 lines) and `Y-course-chat-drawer.spec.ts` (269
lines), green across all eight Playwright shards at head. The inert +
`aria-modal` implementation was specifically re-verified at head (the readiness
evaluation records an initial "no background inertness" report as an
investigated false positive). VoiceOver remains the one open human gate.

## Chunk 6 — Automated verification: Playwright specs, DeepEval harness, test CI

**Contract.** The evidence layer. Playwright specs cover both drawers as a real
user drives them; the `evaluation/manage-assistant` DeepEval harness scores the
assistant along six dimensions (E1 tool selection, E3 grounding, E4 proposal
quality, E5 refusal-to-persist, E6 prompt injection, E7 degradation recovery)
against 49 versioned ground-truth cases; and three CI workflows wire the
`mcp-lecturer` suite, the nightly judge-based eval, and the extra Playwright env
into the pipeline. This chunk promises that the claims made in the readiness
evaluation are reproducible.

**Size.** 85 files, +8,073 / −10 (75 of them under `evaluation/manage-assistant`,
mostly one-per-case ground-truth Markdown files).

```bash
git diff origin/v3-ai...96efd27e5 -- playwright evaluation/manage-assistant .github/workflows/test-mcp-lecturer.yml .github/workflows/test-manage-assistant-eval-nightly.yml .github/workflows/test-playwright.yml .github/workflows/test-olat-api.yml
```

**GitHub filter terms.** `playwright/**`, `evaluation/manage-assistant/**`,
`.github/workflows/test-*.yml`

**Read these first.**

1. `evaluation/manage-assistant/README.md` — what the harness is, how to run it,
   and which dimensions need a paid judge.
2. `.github/workflows/test-manage-assistant-eval-nightly.yml` — the long header
   comment explains the skip-versus-fail asymmetry; read it before judging the
   guard job.
3. `playwright/tests/Y-manage-assistant.spec.ts` (603 lines) — the strongest
   behavioral contract in the PR.
4. `playwright/util/manageAssistant.ts` (481 lines) — the fixtures and stubs;
   check what is mocked versus real.
5. `evaluation/manage-assistant/tests/scoring.py` plus
   `test_scoring_contract.py` — the pass/fail thresholds the "OVERALL: PASS"
   claim rests on.
6. `.github/workflows/test-mcp-lecturer.yml` — the only job that runs the MCP
   server against a live database.

**Review questions.**

1. Do the Playwright specs assert real streamed model output, or a stubbed
   response? If stubbed, what remains unproven on the PR hot path?
2. The nightly eval fails hard when the judge is configured but the target is
   unreachable, and skips cleanly when the judge is unconfigured. Since the
   secrets are not yet set, the job will skip indefinitely after merge — who
   owns setting them, and does a permanently skipped job read as green?
3. E6 (prompt injection) has ten cases. Are they scored strictly enough that a
   partial compliance (model discusses the injected instruction without
   following it) fails, and do they exercise indirect injection through tool
   output, not only direct user text?
4. The judged eval last passed 148/148 on 2026-08-01, before the base merge.
   The evaluation argues the merge touched no behavioral file. Spot-check that
   claim against `git diff e26e4bf2b^..e26e4bf2b -- apps/chat/src`.
5. `test-olat-api.yml` and its `Dockerfile.test` (chunk 9) change together to
   stop a CI hang. Is that unrelated fix acceptable inside this PR?

**Already proven.** Eight Playwright shards green at head; `test-mcp-lecturer`
green at head; the offline evaluator contract suite is 95 passed / 53 deselected
at head, matching its baseline exactly; `uv lock --check` and Ruff clean.
Firefox/WebKit matrix (46/46 on 2026-07-29) is stale relative to head because it
ran against images built under the pre-merge toolchain.

## Chunk 7 — Deploy, configuration and dev environment

**Contract.** Everything an operator touches. A complete new Kubernetes workload
for `mcp-lecturer` (Deployment, Service, HPA, PDB, ConfigMap) plus chart values
for stg and prd; the chat ConfigMap switch from a single `MCP_STUDENT_URL` to
scheme/host/port/path parts and the equivalent lecturer block; a chat memory
resize from 50 Mi/200 Mi to 200 Mi/400 Mi; two image-build workflows; the new
env vars registered in `turbo.json` `globalEnv`; the Manage Dockerfile build arg
that inlines the feature flag; and devcontainer/Traefik/LiteLLM updates for local
development.

**Size.** 26 files, +675 / −38.

```bash
git diff origin/v3-ai...96efd27e5 -- deploy .devcontainer .github/workflows/v3_mcp-lecturer-prd.yml .github/workflows/v3_mcp-lecturer-stg.yml util/traefik util/litellm turbo.json sonar-project.properties .gitignore .syncpackrc.mjs package.json apps/frontend-manage/Dockerfile apps/frontend-pwa/.env.stg
```

**GitHub filter terms.** `deploy/**`, `.devcontainer/**`,
`.github/workflows/v3_mcp-lecturer-*.yml`, `turbo.json`,
`sonar-project.properties`

**Read these first.**

1. `deploy/charts/klicker-uzh-v3/templates/deployment-mcp-lecturer.yaml` (97
   lines) — the new workload's security context, probes and env.
2. `deploy/env-uzh-prd/values.yaml` — the prd block, including the chat memory
   resize and the `mcp-lecturer-arm` image tag.
3. `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml` — how chat now
   discovers both MCP servers.
4. `turbo.json` — the five new `MCP_LECTURER_*` vars plus
   `NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED` in `globalEnv`.
5. `sonar-project.properties` — a new file-scoped S3776 suppression replacing an
   inline `NOSONAR` that Biome kept relocating.
6. `apps/frontend-manage/Dockerfile` — the single `ARG` that makes the flag
   reachable at build time.

**Review questions.**

1. `deploy/env-uzh-prd/values.yaml` pins `mcp-lecturer-arm: v3.4.0-alpha.61`, a
   tag cut before the app or its build workflow existed. A `helm upgrade` with
   the committed values would `ImagePullBackOff`. Should the tag be corrected in
   this PR, or is the deploy-time bump procedure documented well enough?
2. `MCP_LECTURER_JWT_SECRET` falls back to `APP_SECRET` in both the chat minter
   and the server config. Do the prd/stg values actually set a distinct secret,
   and if not, is the shared-secret posture explicitly accepted?
3. The chat memory resize is based on a 235 MiB peak measured pre-merge. The
   merge removed `@prisma/client` from chat's direct dependencies — is a
   re-probe required before the values are applied?
4. `mcp-lecturer` runs with `replicaCount: 2` and autoscaling disabled while the
   proposal replay guard is per-pod (chunk 3). Are two chat replicas and two MCP
   replicas consistent with the single-use token promise?
5. Does the new Deployment restrict egress/ingress appropriately given it holds
   direct database credentials, and does it reuse the same database secret as
   the backend?

**Already proven.** Twenty Docker image builds pass in CI at head. Nothing here
is exercised against a real cluster — the apply, the image-tag bump, and the
`prisma migrate deploy` are explicitly human-gated in the readiness evaluation
(section 4). Treat this chunk as the highest residual-risk area despite its
small line count.

## Chunk 8 — Documentation, wiki and plan record

**Contract.** The durable record. Wiki pages under `docs/` describe the new auth
paths, the chat platform surface, the testing story and one new
`docs/solutions/` lesson; two agent skills are updated; and `project/` carries
the plan lineage (ten plan and review documents at the top level, including the
readiness improvement plan and the final evaluation, plus six work-in-progress
plans) and 13 browser-verification screenshots. This layer promises
that the next engineer can find out why the code looks the way it does.

**Size.** 38 files, +4,557 / −8 (13 of the files are binary screenshots, which
contribute no line counts).

```bash
git diff origin/v3-ai...96efd27e5 -- docs .agents/skills project
```

**GitHub filter terms.** `docs/**`, `.agents/skills/**`, `project/**`

**Read these first.**

1. `docs/auth-model.md` (+37) — the authoritative description of the new token
   purposes and scopes; check it against chunks 2 and 3.
2. `docs/chat-platform.md` (+18) — the surface description including the new
   Manage route family.
3. `project/2026-07-28-pr-5109-production-readiness-improvement-plan.md` (1,117
   lines) — the readiness contract this PR is measured against.
4. `project/2026-08-03-pr-5109-final-production-readiness-evaluation.md` — the
   gate table, findings F1–F4, and the human-only gate list.
5. `docs/solutions/best-practice/dev-seed-is-not-idempotent-reset-first.md` — a
   standalone lesson unrelated to the feature.
6. `docs/testing.md` (+27) — where the DeepEval harness is documented for future
   contributors.

**Review questions.**

1. Does `docs/auth-model.md` describe the `MCP_LECTURER_JWT_SECRET` fallback and
   the scope downgrade accurately, or does it describe an intended state that
   the code does not implement?
2. The repo rule is that any behavior-changing PR updates the affected wiki
   pages. Is any page missing — in particular for the PWA embed token exchange
   and the new participant `courseChatbots` query?
3. `project/plans_wip/` gains six plan documents including
   `PLAN-external-mcp-oauth.md` and `PLAN-manage-docs-skills-rag.md`. Do they
   describe future work rather than shipped behavior, and is that clear to a
   reader?
4. The screenshots are EN/Chromium only at head (the EN/DE desktop/mobile set is
   from 2026-07-28). Is that sufficient visual evidence for the PR record?

**Already proven.** The `agents-md` and format checks pass; `docs/log.md`
carries the 2026-08-03 entry. Content accuracy is exactly what automation cannot
check — this chunk needs human reading.

## Chunk 9 — Mechanical and generated remainder

**This is the mechanical bucket.** It exists so that every one of the 336 files
is assigned, and it contains only changes whose review value is a sanity check,
not a design judgement: the rollup-to-tsc build cleanup across five packages
(each contributing `package.json`, `tsconfig.json` and a deleted
`rollup.config.js`), the generated `pnpm-lock.yaml`, the `next-config`
`allowedDevOrigins` widening for worktree dev hosts, and the `olat-api`
`Dockerfile.test` CI-hang fix that pairs with the workflow change in chunk 6.

**Size.** 18 files, +323 / −451 (the only net-negative chunk).

```bash
git diff origin/v3-ai...96efd27e5 -- pnpm-lock.yaml packages/next-config apps/olat-api packages/grading packages/hatchet packages/markdown packages/util ':(exclude)packages/util/src' ':(exclude)packages/util/test' packages/prisma ':(exclude)packages/prisma/src'
```

**GitHub filter terms.** `pnpm-lock.yaml`, `packages/*/rollup.config.js`,
`packages/*/tsconfig.json`, `packages/next-config/**`,
`apps/olat-api/test/docker/**`

**Read these first.**

1. `packages/prisma/package.json` and `packages/prisma/tsconfig.json` — the
   pattern the other four packages repeat.
2. `packages/next-config/index.js` — the `**.klicker.localhost` to `**.localhost`
   widening, gated on `NODE_ENV === 'development'`.
3. `pnpm-lock.yaml` — skim the added dependency names only (+276 / −241).

**Review questions.**

1. Is `allowedDevOrigins: ['**.localhost']` unambiguously development-only, and
   does any production build path evaluate that branch?
2. Do the five rollup removals leave any consumer importing a path that only the
   rollup build produced?
3. Does the lockfile add any dependency not explained by `apps/mcp-lecturer`,
   the chat AI SDK, or the DeepEval harness?

**Already proven.** Repo typecheck 27/27, production build 24/24, syncpack and
format checks all pass at head; `test-olat-api` is green.

## Cross-cutting concerns

**Trust boundaries.** There is one identity chain worth tracing end to end
before signing off, and it crosses chunks 5 → 3 → 2: the browser holds a
`next-auth.session-token`; `getAuthenticatedManageUser` (chunk 3) verifies it
and reads `role` plus `UserLoginScope`; `resolveLecturerMcpScope` maps that scope
down to `manage:read` or `manage:read manage:draft` and mints a 5-minute HS256
JWT carrying `purpose: 'lecturer-mcp'`; `verifyLecturerSession` (chunk 2)
re-checks role, purpose and scope; and `requireDerivedPermission` then re-checks
the lecturer's per-object permission directly against the database. Two
properties deserve explicit attention: the minted secret falls back to
`APP_SECRET` when `MCP_LECTURER_JWT_SECRET` is unset, so purpose and scope
claims are the only thing separating an MCP token from other `APP_SECRET`-signed
tokens; and every unknown scope degrades to read-only rather than failing
closed. Separately, the request envelope in `manageChatRequest.ts` is the model's
input boundary — 16 MiB streamed, 50 messages, 500 parts, 1 M text characters,
one in-flight request per pod, with client message objects reconstructed from an
allowlist rather than forwarded — and `toolOutputFencing.ts` is the model's
output-trust boundary, wrapping tool results in a per-request sentinel so tool
text cannot pose as system instruction.

**Feature-flag scope.** `NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED` is a Next
build-time inline consumed only by the Manage frontend launcher. It is absent
from the prd and stg env files, so production images ship with the launcher
compiled out — a fail-safe default — but flipping it is an image rebuild plus
redeploy, not a Helm value change, so it is not an incident-time kill switch.
Critically, **the server routes are not gated**: `/api/manage/chat` and
`/api/manage/proposals/confirm` are live for any authenticated lecturer as soon
as the chat image deploys. This is finding F1 in the readiness evaluation and is
the single most consequential open design question in the PR.

**Base-merge commits — skim, do not re-review.** Three of today's commits are
not feature work. `e26e4bf2b` merges `v3-ai` into the branch, pulling in
TypeScript 6, Prisma 7, Biome, Knip and Gitleaks; `35aa6fc12` is the fix for the
two findings from that merge's own dedicated read-only review; `96efd27e5`
records the readiness evaluation document. All three carry their own review
record, so skim them for surprises rather than reviewing them line by line:

```bash
git show --stat e26e4bf2b
git show 35aa6fc12
```

**Known-open items that are not review findings.** Four items are already
recorded and do not need rediscovering: the VoiceOver pass has never been run
(human-only gate); the prd image tag is a placeholder; the Prisma enum migration
is additive and one-way; and the GitGuardian check is red from an inherited
`v3-ai` staging-JWT disposition closed by a separate PR, not by this branch.

## Suggested review order and time budget

Review in chunk order — each chunk assumes the ones before it.

1. Chunk 1, shared contracts — **20 min**. Small, and it fixes the vocabulary
   for everything else.
2. Chunk 2, MCP servers — **75 min**. New production workload with its own
   authorization implementation; the direct-Prisma decision is the key call.
3. Chunk 3, chat server layer — **90 min**. The trust boundary; budget the most
   time here, especially for the proposal confirmation path.
4. Chunk 4, chat assistant UI — **45 min**. Focus on the proposal card and the
   `postMessage` handling rather than styling.
5. Chunk 5, host app integration — **45 min**. Focus on the modal contract, the
   context payload, and the flag-off behavior.
6. Chunk 6, automated verification — **40 min**. Mostly reading what is asserted;
   the evidence itself is already green.
7. Chunk 7, deploy and configuration — **30 min**. Small diff, highest
   operational risk; read every value.
8. Chunk 8, docs and plans — **20 min**. Skim for drift against chunks 2 and 3.
9. Chunk 9, mechanical remainder — **10 min**. Sanity check only.

Plus roughly **15 min** for the cross-cutting section and the base-merge skim.

**Total: about 6 hours of focused review.** A sensible two-session split is
chunks 1–3 first (about 3 hours, the security-critical core), then chunks 4–9
(about 2.5 hours). If time is severely limited, chunks 2, 3 and 7 are the ones
that must not be skipped.
