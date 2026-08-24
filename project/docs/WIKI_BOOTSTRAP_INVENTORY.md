# Wiki Bootstrap — Phase 1 Archaeology Inventory

Evidence base for `PLAN-llm-wiki-and-skills.md` (S2). Produced 2026-07-07 by 8 read-only research subagents (sequential pairs — rate-limit fallback), one question each. Every claim carries `path:line` or `path:Symbol` evidence from this worktree (commit base `544e184ef`). Wiki pages and skills must trace to this document or `WIKI_BOOTSTRAP_BRINGUP.md`; anything else gets re-verified before writing.

Companion: [WIKI_BOOTSTRAP_BRINGUP.md](WIKI_BOOTSTRAP_BRINGUP.md) (Phase 0 environment evidence + failure signatures).

---

## 1. Architecture

### Backend
- Express+Yoga entry: `apps/backend-docker/src/index.ts`. Prisma client from `@klicker-uzh/prisma` (`index.ts:3,19`), 5 ioredis clients: `redisExec`(6379), `redisAssessmentExec`(6381), `redisCache`+pub/sub clients(6380) `index.ts:32-70`, `createRedisCache`/`createInMemoryCache` wrap `index.ts:78-87`, `createPubSub` over `createRedisEventTarget` `index.ts:72,100`.
- App factory `apps/backend-docker/src/app.ts:20 prepareApp()`. Middleware chain: `cors()` `app.ts:51`, custom `jwtMiddleware` (verifies cookie/bearer JWT via `verifyJWT` from `@klicker-uzh/util`) `app.ts:62-119`, `cookieParser()` `app.ts:121`. Yoga created `app.ts:124` with `EnvelopArmor` `app.ts:30-38`, `useCSRFPrevention` `app.ts:146`, `usePersistedOperations` reading `@klicker-uzh/graphql/dist/server.json` `app.ts:15,149-156`; context via `enhanceContext({prisma, redisExec, redisAssessmentExec, pubSub, emitter, hatchet, tasks})` `app.ts:175-183`. Mounted `/api/graphql` `app.ts:194`, health `/healthz` `app.ts:190`.
- Hatchet tasks constructed at startup via `prepareHatchetTasks` (`@klicker-uzh/hatchet`), injected into ctx as `tasks` `index.ts:106-114,127-129`.
- Homegrown data-migration runner runs before serving: `migrate(prisma)` `index.ts:104` (see §4 Migrations).
- WS subscriptions: `graphql-ws` `useServer` reuses schema/context on same HTTP server `index.ts:140-191`.

### Frontends → API
- `apps/frontend-manage/src/lib/apollo.ts`: `HttpLink` uri = `NEXT_PUBLIC_API_URL` (browser) / `API_URL_SSR` (SSR) `apollo.ts:80-84`; link chain `retryLink → errorLink → persistedLink (createPersistedQueryLink, hashes from @klicker-uzh/graphql/dist/client.json) → split(ws|http)` `apollo.ts:37-46,79-137`; plain `InMemoryCache` `apollo.ts:150`; CSRF header `x-graphql-yoga-csrf` `apollo.ts:87`.
- `apps/frontend-pwa/src/lib/apollo.ts`: same + `authLink=setContext` injecting `Bearer <participant_token from sessionStorage>` client-side / forwarding cookies SSR `apollo.ts:49-68,155,158`.

### Async topology
- `apps/response-api/src/index.ts`: bare `http.createServer`. Routes `/healthz` GET `index.ts:356-361`, `/AddResponse` POST `index.ts:364-373`. Non-assessment `handleAddResponse` `index.ts:93` → hatchet event `response-received:authenticated|anonymous` `index.ts:150-155`. Assessment path `handleAddAssessmentResponse` `index.ts:159`: JWT correlation-key verify, dedupe via `assessmentRedis.hget` `index.ts:286-304`, event `response-received:assessment` `index.ts:306-322`, `create-audit-log-entry` events throughout.
- `apps/hatchet-worker-general/src/index.ts main()` `index.ts:60`: `prepareHatchetTasks` with `handlers` from `@klicker-uzh/graphql`, workflow selection via `HATCHET_WORKFLOWS` env (`selectWorkflows` `index.ts:15-58`, default all), worker start `index.ts:135-140`. Tasks in `packages/hatchet/src/index.ts:12 prepareHatchetTasks()`: `create-audit-log-entry` (onEvents) `:41-58`, `publish-scheduled-*` `:63-122`, `end-expired-*` `:127-157`, `aggregate-block-closure-*` `:162-208`, daily crons (`updateGroupAverageScores`, `runningRandomGroupAssignments`, `finalRandomGroupAssignments`, `updateWeeklyTimelineEntries`, `0 0 * * *`) `:213-275`.
- `apps/hatchet-worker-response-processor/src/index.ts`: `processAnonymousResponseTask` (onEvents `response-received:anonymous`) `:13-26`, `processAuthenticatedResponseTask` durable `:28-34`, `processAssessmentResponseWorkflow` (durable + onFailure audit log) `:36-69`, `aggregateAssessmentResponsesTask` keyed `input.instanceId` `:71-82`. Live-quiz vs assessment set via `ASSESSMENT_MODE` env `:87-103`.
- Chain: response-api → hatchet event → response-processor consumes → re-emits aggregation events → general worker aggregates.

### GraphQL package layout
- `packages/graphql/src/builder.ts`: Pothos `SchemaBuilder`, plugins `ScopeAuthPlugin, PrismaPlugin, ZodPlugin, DirectivePlugin`, auth scopes `builder.ts:13-50`.
- `src/schema/*.ts`: Pothos types per domain + root `mutation.ts/query.ts/subscription.ts`; imported for side effects in `src/index.ts:7-24`, `builder.toSchema()` `index.ts:63`.
- `src/services/*.ts`: business logic + Prisma; also exported as `HatchetHandlers` map `index.ts:40-84`.
- `src/graphql/ops/*.graphql`: hand-written client ops → codegen (`codegen.ts:8`) → `src/ops.ts` + `src/public/{client.json,server.json,schema.graphql}`.

### App/package map (one-liners)
- apps/auth: Next.js Auth.js identity provider (`@auth/prisma-adapter`), `apps/auth/src/middleware.ts`.
- apps/frontend-control: Next.js lecturer live-control UI.
- apps/chat: Next.js AI chat (`@ai-sdk/*`), app router.
- apps/analytics: Python service, `apps/analytics/src/main.py`.
- apps/olat-api: Express OLAT LMS bridge, `apps/olat-api/src/index.ts`.
- apps/lti: LTI 1.3 launch service (`ltijs`), `apps/lti/src/index.ts`.
- apps/office-addin: Office task-pane add-in (manifest XMLs).
- apps/docs: Docusaurus site (user-facing docs).
- packages: grading (scoring math), types (shared TS incl. `HatchetHandlers`), util (JWT/cookie helpers), i18n (next-intl messages/routing), shared-components (cross-app React), markdown, next-config, transactional (react-email), export, word-cloud, prisma-data (seeds).

---

## 2. Domain model

### Entities
- `User` (user.prisma:1-6 enum context): edu-ID login, manage app, role USER/ADMIN. Owns Course, Element, activities.
- `Participant` (participant.prisma): pwa student, username/password or SSO, own `xp` field (participant.prisma:58). Separate from User — two apps/audiences (user.prisma:2-5 comments).
- `Participation` (participant.prisma:144-173): Participant↔Course join, `@@unique([courseId, participantId])` (:172), holds `isActive`, leaderboard links.
- `Course` (course.prisma:6-73): owns elementStacks, quizzes, participations, groupActivities, leaderboard, achievements, chatbots. `authType` SSO/PIN (course.prisma:1-4).
- `Element` (element.prisma:21-63): question-bank item, versioned (`version`, `originalId`), `type: ElementType`, `options Json`.
- `ElementInstance` (element.prisma:72-115): placement of Element in an activity; `type: ElementInstanceType` = LIVE_QUIZ/PRACTICE_QUIZ/MICROLEARNING/GROUP_ACTIVITY (element.prisma:65-70); snapshotted `elementData`/`options`/`results` Json; links to elementStack OR elementBlock.
- `ElementStack` (element.prisma:154-181): ordered instance group for PracticeQuiz/MicroLearning/GroupActivity.
- `ElementBlock` (element.prisma:189-212): LiveQuiz-only grouping/scheduling unit (`status: ElementBlockStatus`).
- Activities (quiz.prisma): `LiveQuiz` (:82-144), `PracticeQuiz` (:23-71), `MicroLearning` (:150-199), `GroupActivity` (:259-302, + `GroupActivityInstance`, `GroupActivityParameter/Clue/ClueInstance/ClueAssignment`).
- `UserActivities` (quiz.prisma:401-463): Prisma **view** unifying all 4 activity types for listing (comment :398-400).

### Element taxonomy
- `ElementType` (element.prisma:9-19): `SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY`.
- Dispatch: `packages/graphql/src/services/stacks.ts:1498-1519` `evaluateChoicesAnswerCorrectness` (SC/MC/KPRIM); grading dispatch :2302-2330; response-format dispatch per type :2927-3117.
- Grading math `packages/grading/src/index.ts`: `gradeQuestionSC` (:39-52), `gradeQuestionMC` (:54-70, hamming-distance partial credit), `gradeQuestionKPRIM` (:72-89, dist 0→1, 1→0.5, else 0), `gradeQuestionNumerical` (:97-135).

### Lifecycles / status enums
- `ElementStatus` (element.prisma:3-7): DRAFT, REVIEW, READY.
- `PublicationStatus` (quiz.prisma:1-8): DRAFT, SCHEDULED, PUBLISHED, ENDED, GRADED, TEMPLATE — on all 4 activity models (:32,112,157,265).
- `ReviewStatus` (quiz.prisma:10-14): INCOMPLETE, REVIEWED, MODIFIED_AFTER_REVIEW.
- `ElementBlockStatus` (element.prisma:183-187): SCHEDULED, ACTIVE, EXECUTED.
- `AccessMode` (quiz.prisma:77-80): PUBLIC, RESTRICTED (LiveQuiz).
- `InvitationStatus` (participant.prisma:1-4): PENDING, ACCEPTED.

### Gamification
- Points vs XP = two separate tracks, both in `packages/graphql/src/services/stacks.ts`: `computeAwardedPointsAndXP` (:2052-2153); points throttle `instance.options.resetTimeDays`, XP throttle `XP_AWARD_TIMEFRAME_DAYS = 1` (:80).
- Points require `Participation.isActive` (:2072,2090) → `LeaderboardEntry.score` upsert (`updateLeaderboardOnQuestionResponse` :2553+; model participant.prisma:194-217; `LeaderboardType` SESSION/COURSE :189-192).
- XP always accrues → `Participant.xp` increment (:2541-2550).
- `QuestionResponse`/`QuestionResponseDetail` (response.prisma) store `totalPointsAwarded`, `totalXpAwarded`, `score`.
- Achievements (gamification.prisma): `Achievement` (:33-61, `type` PARTICIPANT/GROUP/CLASS :3-7, `scope` GLOBAL/COURSE :9-12) + per-subject instance models (:63-115); `Title` (:16-29); `Level` XP thresholds w/ linked list (:155-166); `AwardEntry` (:126-149).

### Vocabulary
- `Participation` not "Enrollment". "Testkurs" etc. = seed-data names only (`packages/prisma-data/src/data/seedTEST.ts:253-360`: Testkurs, Testkurs 2, Non-Gamified Course, Assessment Course, Gamified Assessment Course, Testkurs Calendar View).
- `LiveQuiz` formerly "session" (migration script `packages/graphql/src/scripts/2024-11-07_migrate_live_session_to_live_quiz.ts`, `LiveQuiz.originalId` quiz.prisma:85).
- Sharing/permissions family in sharing.prisma (`PermissionLevel` :3, Permission/DerivedPermission/AccessRequest/UserGroup).

---

## 3. GraphQL API layer

### Auth layers
- Scopes defined once `packages/graphql/src/builder.ts:22-33,56-111`: `authenticated` (:62, logged in + not OTP), `role` (:63-76, USER passes USER|ADMIN; PARTICIPANT exact), `scope` (:77-108, ladder ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY), `catalyst` (:109). `defaultStrategy: 'all'` (:58); unauthorized → `GraphQLError('Unauthorized')` (:60).
- Per-field via `t.withAuth(<scopeObject>)`; scope objects in `mutation.ts:104-117` / `query.ts:128-130`: `asUser`, `asUserFullAccess`, `asUserSessionExec`, `asUserOwner`, `asUserWithCatalyst`, `asParticipant`, `asAdmin`.
- Canonical mutation `deleteCourse` (mutation.ts:644-655): L1 `t.withAuth(asUser)`; L2 `withPermission((args)=>({courseId:args.id}), PermissionLevel.ADMIN, ...)`; L3 `checkAccess` (services/sharing.ts:5650+) derived-permission lookup → then `CourseService.deleteCourse`. `withPermission` defined services/sharing.ts:5965-5987; returns `null` on failed check rather than throwing (:5984).
- Canonical queries: `controlCourse` (query.ts:160-173, PermissionLevel.EXECUTE), `getLiveQuizSummary` (query.ts:491-502, PermissionLevel.READ).
- `PermissionCheck` union (services/sharing.ts:5634-5648): courseId/liveQuizId/practiceQuizId/microLearningId/groupActivityId/elementId/answerCollectionId/catalogCollectionId.

### Resolver-service contract
- `Context` (packages/graphql/src/lib/context.ts:18-36): req/res, prisma, redisExec, redisAssessmentExec, pubSub, emitter, `user?` (sub, role, scope, catalyst flags), hatchet, tasks. `ContextWithUser` (:38-47) = what `t.withAuth` narrows to. `enhanceContext` (:59-64).
- Schema files import services (`import * as XService from '../services/xxx.js'`); resolvers are one-liners (e.g. mutation.ts:1347-1349). Logic/Prisma/pubSub live in services only.

### Validation / errors
- Zod plugin (builder.ts:48), error shaping builder.ts:112-118 (issues joined into GraphQLError). Arg validators: mutation.ts:1341-1344 (email), :263 (regex PIN), :292,410 (length).
- Service errors: `GraphQLError` with `extensions.code` preferred (services/liveQuizzes.ts:2719-2721 `LIVE_QUIZ_PIN_INVALID`/FORBIDDEN, :2859, :2877); plain `throw new Error` also occurs (services/courses.ts:66,608,623,3242) — less preferred.

### Ops + codegen
- Prefix counts in `src/graphql/ops/`: 155 M*, 116 Q*, 16 F*, 12 S*, 1 legacy unprefixed. Examples: `MJoinParticipantGroup/MUpvoteFeedback/MDeleteUserLogin`, `QGetAssessmentCourseParticipants/QGetSinglePracticeQuiz/QGetRunningLiveQuiz`, `SFeedbackAdded/SFeedbackCreated/SFeedbackPinned`, `FActivityInfoData/FStackFeedbackEvaluations/FPracticeQuizDataWithoutSolutions`.
- `codegen.ts:1-75`: schema = `printSchema(schema)` from live Pothos; outputs `src/ops.ts` (typed-document-node), `src/ops.schema.json`, `src/public/schema.graphql`, `src/public/client.json` + `server.json` (persisted-query maps).
- Frontend usage: `apps/frontend-manage/src/components/sharing/useTransferObjectOwnership.ts:2-11` imports `*Document` from `@klicker-uzh/graphql/dist/ops`.
- Persisted queries: client.json op→hash (Apollo `createPersistedQueryLink`, manage apollo.ts:11,14); server.json hash→op (`usePersistedOperations`, app.ts:15,149-155); unknown hash rejected outside dev/test (app.ts:150-152).
- Ritual: `pnpm generate` in packages/graphql (package.json:95); `pnpm build` = generate + rollup (rollup.config.js:9-11,26-27 copies public/* to dist). `src/ops.ts` + `src/public/*` are **git-tracked** — regenerate AND commit after any op/schema change. Stale server.json → server rejects persisted-query hash in prod modes.

### Subscriptions (end-to-end example)
- Schema: subscription.ts:54-65 `feedbackCreated`, `pipe(ctx.pubSub.subscribe('feedbackCreated'), filter(d => d.liveQuizId === args.quizId))`.
- Publish: services/feedbacks.ts:88 `ctx.pubSub.publish('feedbackCreated', newFeedback)`.
- Op: `SFeedbackCreated.graphql`. Frontend: `apps/frontend-manage/src/components/interaction/AudienceInteraction.tsx:10,58-77` `subscribeToMore({document: FeedbackCreatedDocument, ...})`.

---

## 4. Data layer

### Split schema
- 14 `.prisma` files in `packages/prisma/src/prisma/schema/`: analytics, chat, course, datasource, element, gamification, js, other, participant, quiz, resources, response, sharing, user. Largest: quiz (465 lines), sharing (458), response (283).
- Merge: `packages/prisma/prisma.config.ts:9` `schema: 'src/prisma/schema'` (folder-as-schema, GA in prisma 6.16.1 — no preview flag on JS side; js.prisma:4 has only `["postgresqlExtensions", "views"]`).
- `datasource.prisma:1-5`: shared datasource (postgres, `DATABASE_URL`, `shadowDatabaseUrl`).
- `js.prisma:1-20`: generators — `client` (provider `prisma-client`, output `../client`, esm), `pothos` (output `../client/pothos.ts`), `json` (prisma-json-types-generator).
- Python twin `apps/analytics/prisma/schema/py.prisma:1-7`: `prisma-client-py`, `interface = "sync"`, `enable_experimental_decimal = true`, DOES use `prismaSchemaFolder` preview (older engine, prisma==0.15.0 per apps/analytics/pyproject.toml:15).

### Change ritual
- Root package.json:69-78: `prisma:migrate` → `@klicker-uzh/prisma prisma:migrate`; `prisma:setup` → `run-s prisma:setup:1 prisma:setup:2` (prisma setup, then prisma-data seed); `prisma:sync` → `./util/sync-schema.sh`.
- packages/prisma/package.json:19-33: `prisma:migrate` = `prisma migrate dev` (Infisical-wrapped, env dev); `prisma:setup` = `run-s prisma:reset prisma:push`; `generate` = `prisma generate`. Client output `packages/prisma/src/prisma/client/` (js.prisma:5).
- AGENTS.md:114 ritual matches: edit → `pnpm run prisma:migrate` → `pnpm run prisma:sync` → regen client → update graphql types/resolvers.

### Analytics sync
- `util/sync-schema.sh:1-10`: copies all `*.prisma` → `apps/analytics/prisma/schema/`, EXCLUDING js.prisma; py.prisma untouched in dest. Reason: Python client needs its own generator block. `enable_experimental_decimal` needed for Decimal fields (chat.prisma:14-15,65 `@db.Decimal(18,6)`).

### Seeding
- Entry points `packages/prisma-data/src/data/`: `seedTEST.ts` (main) + seedAccounts/Achievements/Chatbots/CompetencyTree/EmailTemplates/Flashcards/Levels/MCPServers/SummerSchool/Users.
- Root `prisma:setup:2` → `packages/prisma-data/package.json:42` `seed` = `tsx src/data/seedTEST.ts`.
- `seedTEST.ts:822-823,1005-1006` creates `testuser${ix+1}` (credentials documented AGENTS.md:128-130).
- E2E seeds are INDEPENDENT: Cypress `cypress/cypress.config.ts:730-746` `seedDatabase()` task; Playwright `playwright/global-setup.ts:107-450` own `seedDatabase()` (own fixtures) via `playwright.config.ts:25` globalSetup. Neither calls seedTEST.ts.

### Type flow + gotchas
- `prisma-json-types-generator` reads `/// [TypeName]` comments on Json fields (element.prisma:37-38 `[PrismaElementOptions]`, participant.prisma:60-61, response.prisma:35-36); TS declarations in `packages/graphql/src/types/app.ts:22-40` (`declare global { namespace PrismaJson {...} }`) importing shapes from `@klicker-uzh/types`.
- Decimal gotcha: chat credit fields are Prisma Decimal; unwrap via `toNumber()` helper (services/chatbots.ts:141-153); never truthy-check (Decimal(0) truthy — CODEBASE_NOTES).
- `@@unique([email, isSSOAccount])` (participant.prisma:65,100): same email may exist twice (SSO + manual) — dup-account trap when querying by email alone.

### Migrations
- Location `packages/prisma/src/prisma/schema/migrations/` (prisma.config.ts:8), ~170 dirs from `20220925181035_initial_migration` to `20260414223500_add_chat_attachment_preview_and_position` (example with backfill via ROW_NUMBER()).
- Homegrown boot-time runner: `apps/backend-docker/src/migration.ts:1-40` `migrate(prisma)` loops hardcoded `migrations` array (currently EMPTY :11) against own `Migration` model (not `_prisma_migrations`) — one-off data migrations, separate from `prisma migrate deploy`.

---

## 5. Frontend conventions

### Routers
- pages router: frontend-manage, frontend-pwa, frontend-control, auth (each has `src/pages`, no `src/app`).
- app router: chat only (`apps/chat/src/app`).

### Design system + styling
- `@uzh-bf/design-system` throughout: `apps/frontend-manage/src/components/sharing/TransferOwnershipModal.tsx:3` (`Button, FormikTextField, Modal, toast`), usage :46-146; `H2/H3` (pages/user/settings.tsx:4,25).
- Tailwind v4 CSS-first: no tailwind.config.js in manage; `apps/frontend-manage/src/globals.css:11` `@source "../node_modules/@uzh-bf/design-system/src"` + `@theme` block :18-181 (`--color-uzh-blue`, shadcn tokens).
- twMerge: `apps/frontend-manage/src/components/Layout.tsx:10,70-72`.

### Data fetching
- Query: pages/user/settings.tsx:1-19 — `useQuery(UserProfileDocument)`, guard `if (!user?.userProfile) return <Loader />` (Loader from `@klicker-uzh/shared-components/src/Loader`).
- Mutation: useTransferObjectOwnership.ts:1-67 — `useMutation(TransferObjectOwnershipDocument)` + `refetchQueries` arrays per objectType.

### i18n
- `packages/i18n`: routing.ts (locales en/de, default en), request.ts (next-intl getRequestConfig), messages/de.ts (3930 lines) + en.ts (3863).
- Namespaces = one per app + shared: `shared`, `auth`, `pwa`, `manage`, `control` (de.ts:2,490,505,1125,3857).
- Wiring: `apps/frontend-manage/next.config.mjs:5` `createNextIntlPlugin('./src/types/i18n.ts')`; messages loaded per page via getStaticProps (settings.tsx:41-47).
- Usage: `useTranslations()` no namespace arg, full-path keys (`t('manage.settings.userSettings')`, `t('shared.generic.cancel')`); `t.rich` for rich text.
- Rule: every new string → BOTH de.ts and en.ts, matching namespace.

### Forms
- Formik + Yup (NOT react-hook-form): TransferOwnershipModal.tsx:4,6,72-143 (`FormikTextField` bound by `name`).

### Test attributes
- Single convention `data-cy`; design-system components take `data={{ cy: '...' }}` prop (TransferOwnershipModal.tsx:52,114); raw `data-cy` in Layout.tsx:74; 81 files in manage use it; zero `data-testid`.
- Playwright reuses it: `playwright/playwright.config.ts:40-41` `testIdAttribute: 'data-cy'` → `page.getByTestId(...)` (tests/G-elements-mc.spec.ts:36). One convention, two consumers.

### Shared components + client state
- `packages/shared-components/src/`: Loader, DataTable, question renderers (ChoicesQuestion, FreeTextQuestion, NumericalQuestion, SelectionQuestion), Leaderboard, Podium, Flashcard, charts/, evaluation/, hooks/. Deep-import convention (`@klicker-uzh/shared-components/src/Loader`) — no barrel index.
- App-local components under each `src/components/`, relative imports (no `@/` alias in manage).
- No zustand outside chat. PWA offline side-channel: localforage (`apps/frontend-pwa/src/components/liveQuiz/storageHelpers.ts:14,24,50,73-93`) for quiz answers; Apollo cache = primary state.

---

## 6. Testing landscape

### Unit (vitest)
- Safe on fresh clone, no services: `packages/grading` (test/index.test.ts, pure grading fns), `packages/util` (test/{auth,email,jwt}.test.ts), `packages/word-cloud` (test/layout.test.ts), `packages/export` (test/index.test.ts, tmpdir only), `apps/chat` (test/*.test.ts, pure logic).
- NOT safe standalone: `packages/graphql` — 25 spec files in test/*.test.ts vs REAL Postgres + Hatchet + Redis + `HATCHET_CLIENT_TOKEN` (test/run-tests-local.sh:125,134,176,210; .env.example:1). One-command local path: `test:local` = `bash ./test/run-tests-local.sh` (package.json:103). vitest.config.ts:11-16 forces `pool: forks, singleFork: true` (serialized, shared DB state).
- `apps/olat-api`: test = `bash run-tests.sh` → docker compose test stack (run-tests.sh:6-13).
- Root `pnpm run test:run` = `turbo run test:run` fan-out incl. Cypress → needs seeded DB. Don't run blind (CODEBASE_NOTES).

### Cypress
- v~15.2.0 (cypress/package.json:15). 26 specs `cypress/cypress/e2e/*.cy.ts`, letter-prefix run order (`0-baseline-ops`, `A-login-workflow` … `X-review-workflow`).
- Scripts cypress/package.json:24-30: `test`/`test:run`/`test:run:one` Infisical env `dev-cypress`; `*:raw` variants skip Infisical. Coupled to root `dev:test` (package.json:61, NODE_ENV=test stack).
- CI cypress-testing.yml: draft PRs → 8-way `cypress-split` parallel no-Cloud (:41); non-draft/push v3 → Cypress Cloud recorded (:254).

### Playwright
- playwright/playwright.config.ts: testDir ./tests, chromium only (:56-60 others commented), baseURL `PLAYWRIGHT_BASE_URL ?? URL_STUDENT ?? http://127.0.0.1:3001` (:6-9), `workers: 1` (:18), globalSetup wipes+seeds DB once (:25; global-setup.ts:1-9).
- 27 specs, same letter scheme + `Y-chat.spec.ts` (no Cypress counterpart — parity drift).
- Scripts playwright/package.json:16-23: Infisical env `dev-playwright`; `*:raw` variants.
- CI playwright-testing.yml: official Playwright container v1.58.2, 5-way shard, draft + non-draft PRs.

### Component tests
- None. No @testing-library/react anywhere; no Cypress `component:` block (cypress.config.ts:726 e2e only). Coverage = pure-fn unit + full-stack e2e, nothing between.

### CI matrix + verified-before-PR
- Path-filtered: test-grading/test-util (own package only, no services), test-graphql (packages/graphql/**, spins postgres+postgres_hatchet+hatchet-lite v0.73.1+redis, test-graphql.yml:20-58), test-olat-api. Cypress/Playwright trigger on broad `apps/**, packages/**` → run on almost every code PR.
- Hooks run NO tests: pre-commit = `check:all` (typecheck+format+lint+syncpack), pre-push = build only. Manual expectation: scoped vitest for non-DB changes; e2e locally only when warranted; CI is the real e2e gate.

---

## 7. CI / deploy / release

### Check workflows
- check-format/lint/syncpack/types.yml: push v3/v3* + PR, paths apps/** packages/**. pnpm/action-setup@v4 version 11.5.0 `run_install: true`. Quirks: syncpack + types have NO branch filter on PR trigger (check-syncpack.yml:9-13, check-types.yml:9-13); check-types manually builds packages in dependency order first (check-types.yml:36-53) then `pnpm run check` (:58). Turbo remote cache env on all (TURBO_TOKEN/TEAM).

### Image builds
- 13 apps × stg+prd workflows (`v3_*-{stg,prd}.yml`): analytics, auth, backend-docker, chat, frontend-control/manage/pwa/pwa-assessment, hatchet workers ×2, lti, olat-api, response-api.
- stg trigger: push v3/v3* or PR touching app paths (v3_backend-docker-stg.yml:1-16); PR builds but doesn't push. prd trigger: tags `v*.*.*` only (v3_backend-docker-prd.yml:3-5).
- ghcr.io, image `<repo>/backend-docker`, tags via docker/metadata-action from git ref; separate arm/amd jobs with `-arm`/`-amd` suffixes; context repo root, `file: apps/backend-docker/Dockerfile`.

### Release
- Version bumps local/manual via standard-version: `pnpm run release[:alpha|:beta|:rc]` (package.json:38,79-86) → bumps root + ~20 package.jsons (.versionrc.js:2-32), CHANGELOG, commit, tag. Push tag → prd builds. Strict `v[0-9]+.[0-9]+.[0-9]+` tags also trigger release.yml (git-release action) — alphas build prd images but no GitHub Release.
- Current 3.4.0-alpha.64 (package.json:5). Helm Chart.yaml auto-bump DISABLED (.versionrc.js:33-40 commented) — chart at alpha.21, drifted.

### Deploy
- Helm chart `deploy/charts/klicker-uzh-v3/` (Chart.yaml name still `klicker-uzh-v2`, version stale). Per-service ConfigMaps/Deployments/Ingresses/hpa/pdb/priorities.
- env-uzh-stg values: `*.klicker.stg.df-app.ch`, selected source tag (currently `v3-ai`; unset selector defaults to `v3`) floating, `rollout.klicker.uzh.ch/release` pod annotation per release. env-uzh-prd: `*.klicker.uzh.ch`, pinned tags (alpha.62 at head), replicaCount 2.
- NO ArgoCD/Flux manifests in repo. Deployments carry `reloader.stakater.com/auto: "true"` (deployment-app.yaml:9 et al.). Deploy = helm-upgrade driven externally (mechanism not in repo — open question). `deploy/scripts/rollout.sh` = manual `kubectl rollout restart` (legacy namespace `klicker-v2-qa`).
- `deploy/compose*` = self-hoster examples (v2-era).

### Branch/PR flow + other gates
- v3 main; workflows filter `v3`,`v3*`. No PULL_REQUEST_TEMPLATE, no CONTRIBUTING.md — conventions implicit (conventional commits per .versionrc.js types: feat/enhance/fix/docs/refactor/perf/deploy/deps/build/ci/wip/test/style).
- claude.yml: @claude mention-triggered agent (claude-code-action@v1). claude-code-review.yml: auto-reviews every PR (sticky comment, biased toward Playwright coverage, max-3-blocking-issues). claude-dispatch.yml: repository_dispatch-triggered, can push.
- codeql weekly + PR (JS only, older action versions). SonarCloud (v3_sonarcloud.yml; sonar-project.properties: sources apps,packages,deploy). knip = manual script only, not CI-enforced (package.json:64).

---

## 8. Worked example — feature slice anatomy (`ff61d9bc7`, #4951)

Read-feature end-to-end, single commit, no migration:

1. **Types**: `packages/types/src/index.ts` — new `AssessmentResultsCourse`, renamed `StudentAssessmentResultsItem`, extended `ActivityStudentPerformance` (+`activityId`), split `reason`→`lecturerReason`/`studentReason`.
2. **Pothos schema**: `packages/graphql/src/schema/assessment.ts` (new object type), `query.ts` (new fields `assessmentResultsCourse` + `studentCourseResults`, arg added to `previousPointCorrections`).
3. **Service**: `services/courses.ts` — new `getAssessmentResultsCourse({courseId, preferredAffiliation}, ctx)`, reworked `getStudentAssessmentResults`.
4. **Auth**: `t.withAuth(asUser)` + `withPermission((args)=>({courseId}), PermissionLevel.ADMIN, ...)` for lecturer query; participant-facing sibling only `t.withAuth(asUser)`.
5. **Ops**: new `QGetAssessmentResultsCourse.graphql`, `QGetStudentCourseResults.graphql`; extended `FActivityStudentPerformanceData.graphql`, `QGetPreviousPointCorrections.graphql`.
6. **Committed codegen artifacts**: `src/ops.ts` (+78), `ops.schema.json` (+404), `public/{client,server}.json`, `public/schema.graphql` — same commit.
7. **Frontend**: new page `apps/frontend-manage/src/pages/courses/[id]/assessment/results.tsx` (`useQuery(GetAssessmentResultsCourseDocument, {fetchPolicy:'network-only'})`), new `CourseSingleStudentResults.tsx` (`useSuspenseQuery` + Suspense), nav button in `CourseOverviewHeader.tsx` gated `course.isAssessmentEnabled && course.isManager`. Design system: Button/H2/UserNotification/Tooltip + shared Loader. data-cy: reused existing hooks, none new.
8. **i18n**: +6/+6 lines de.ts/en.ts, namespaces `manage.assessment.*`, `manage.course.*`.
9. **Tests**: none in this commit (honest gap — read features shipped without e2e here).

NOT demonstrated: migration, mutation, subscription, e2e coverage. Companion `38c92d035` (#4958): prisma schema (participant, response) + migration.sql, mutations `MCorrectAssessmentPointsInstance/LiveQuiz.graphql`, `schema/mutation.ts`, heavy graphql vitest additions (instancePointCorrections/liveQuizPointCorrections +1984/+1691) — the migration+mutation+test-heavy pattern.

---

## Cross-cutting synthesis (feeds wiki + skills)

- One repeated ritual dominates correctness: **regenerate + commit codegen artifacts** (graphql ops + prisma client + persisted-query maps). Two independent staleness failure modes (typecheck fails / persisted-hash rejected) — both documented with evidence above.
- **Auth is 3 explicit layers with names**: `t.withAuth(scopeObject)` → `withPermission(...)` → `checkAccess` derived-permission lookup. Skills can prescribe exactly this.
- **Two-track gamification** (points need active Participation; XP unconditional) is the most guess-wrong domain fact.
- **Test-level routing** is decidable from change type: pure logic → package vitest; graphql services → `test:local` bootstrap; UI/flows → e2e (route to existing klicker-cypress/playwright skills); component-level does not exist.
- **data-cy is the single UI test hook**, consumed by both e2e frameworks.
- **Deploy trigger lives outside the repo** — wiki must say so honestly instead of inventing a GitOps story.

## Consolidated open questions (carried into S3+)

1. Who/what runs `helm upgrade` on tag push (external pipeline, not in repo) — ask maintainer, else document as external.
2. `prisma migrate deploy` invocation point in CI/Docker entrypoint not found — verify before documenting deployment DB-migration story.
3. No CI guard against stale codegen artifacts (generate-and-diff) — candidate improvement, note in wiki as risk not rule.
4. Achievement-award trigger + LiveQuiz bonus-points formula not traced (domain page: mark as unmapped).
5. analytics ActivityPerformance computation entry point not located.
6. Whether inline `authScopes:` is ever used vs always `t.withAuth` — sample said never; phrase skill rule as "use t.withAuth like all existing fields", not "never".
