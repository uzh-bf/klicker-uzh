# Full Implementation Plan: GraphQL to tRPC Dual-API Migration

## Identity

Plan path: `project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`

Goal prompt: `project/plans_future/graphql-to-trpc-dual-api-migration/GOAL_PROMPT.md`

Supporting files:

- `README.md`
- `S00-plan-and-audit.md`
- `S01-api-package-kernel.md`
- `S02-backend-dual-mount.md`
- `S03-client-provider-shells.md`
- `S04-vertical-migrations.md`
- `S05-realtime-migration.md`
- `S06-final-cleanup.md`

Branch: `codex/trpc-dual-api-migration`

Target branch: `v3`

Created from:

- Local KlickerUZH codebase inspection.
- Existing dual-stack tRPC branch commits.
- `graphql-to-trpc-migration` skill and the prior GBL UZH migration lessons.

## Goal

Problem: KlickerUZH currently uses GraphQL/Yoga/Pothos/codegen and Apollo Client across the backend, manage app, PWA, control app, shared components, and realtime subscriptions.

Goal: Migrate to tRPC end to end while keeping GraphQL live in parallel until all active consumers are gone and final cleanup gates pass.

Success:

- `packages/api` owns the application API.
- `/api/trpc` serves all migrated app workflows.
- Apollo hooks/providers and generated GraphQL operation imports are removed from active apps.
- GraphQL subscriptions are replaced by tRPC subscription flows or transport-neutral event invalidation.
- `/api/graphql`, `packages/graphql`, GraphQL WS, GraphQL codegen, persisted operation artifacts, and GraphQL dependencies are removed only after explicit S06 readiness approval.
- Full repository checks and browser smoke flows pass without GraphQL.

## Non-Goals

- Do not rewrite product behavior while changing transport.
- Do not replace Prisma schema, Hatchet flows, auth model, or deployment topology unless a GraphQL-specific dependency blocks migration.
- Do not remove GraphQL during S04/S05.
- Do not migrate by generated file count; migrate by user workflow.
- Do not force shared components to tRPC-specific types while Apollo-backed callers still exist.

## Current State

Done:

- S00 plan/audit files exist.
- S01 `@klicker-uzh/api` package exists with tRPC foundation.
- S02 backend mounts `/api/trpc` beside `/api/graphql`.
- S03 frontend tRPC providers exist beside Apollo in control, PWA, and manage.
- S04A control app read pilot is runtime-verified and committed.
- S04B control app live-quiz read migration is focused-check verified, direct-runtime verified, and committed.
- S04C control app mutation migration is focused-check verified and committed.
- S04D frontend-control Apollo removal is focused-check verified, direct-runtime verified at the tRPC HTTP layer, and ready to commit.

Committed markers:

- `d940d86d7 docs(api): plan dual-stack trpc migration`
- `ccffa7518 feat(api): add dual-stack trpc foundation`
- `a20a32aaa fix(check): restore dependency ordering`
- `c6be4df9c feat(api): port dual-stack control pilot`
- `9fd2c326c docs(project): add end-to-end trpc migration plan`
- `4d28f1d87 docs(project): record control trpc runtime verification`
- `df2d8f16e docs(project): refine trpc migration plan`
- `a274ab4b6 feat(api): migrate control read screens to trpc`
- `d53406154 feat(api): migrate control mutations to trpc`

Active work:

- S04E PWA participant shell and course reads are next.
- GraphQL remains intentionally live.
- Frontend-control no longer has active GraphQL/Apollo consumers or package dependencies.
- PWA and manage still depend heavily on Apollo/generated operations.
- GraphQL realtime remains active through Yoga/pubSub/GraphQL WS.

## Hard Rules

Do:

- Add new API behavior under `packages/api/src/trpc/**`.
- Use existing GraphQL resolvers/services as behavior source.
- Extract shared server services only when a resolver contains transport-specific logic that tRPC must reuse.
- Validate procedure inputs with Zod.
- Use SuperJSON consistently.
- Return explicit DTOs.
- Preserve enum string values and existing nullability semantics where clients depend on them.
- Import only tRPC router types into browser code.
- Keep `packages/graphql`, `/api/graphql`, GraphQL WS, GraphQL codegen, Apollo, and generated operations live until S06 cleanup gates pass.
- Update this `Progress` section before and after every slice.
- Run review and simplification after each slice before committing.
- Commit one slice at a time with conventional commits.

Avoid:

- Browser imports from `appRouter`, Prisma, Node-only modules, or backend runtime files.
- Broad Prisma records as client outputs.
- Global type rewrites before the consuming workflow is migrated.
- Combining read, mutation, realtime, and cleanup concerns in one commit.
- Removing GraphQL files because a local app seems migrated; run audits first.

## Tooling

Use pinned tooling:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm <command>
```

Focused checks after API changes:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker check
```

Focused checks after app changes:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter <target-app> check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter <target-app> build
```

Broad checks at major gates:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:all
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run test:run
```

Browser verification:

```bash
npx agent-browser open <local-url>
npx agent-browser screenshot /tmp/<slice>-before.png --full
npx agent-browser screenshot /tmp/<slice>-after.png --full
```

## Audit Commands

Coexistence audit during S04/S05:

```bash
rg -n "@apollo/client|ApolloProvider|@klicker-uzh/graphql|/api/graphql|graphql-yoga|graphql-ws" apps packages package.json pnpm-lock.yaml
rg -n "@trpc|createTRPC|/api/trpc|type AppRouter|TrpcProvider" apps packages package.json pnpm-lock.yaml
```

Per-app Apollo gate:

```bash
rg -n "@apollo/client|ApolloProvider|useApollo|SSELink|GraphQLWsLink|graphql-ws|@klicker-uzh/graphql|useQuery|useMutation|useSubscription|subscribeToMore" apps/<app>
```

Generated type leak gate:

```bash
rg -n "@klicker-uzh/graphql/dist/ops|TypedDocumentNode|src/graphql/ops|ops\\.ts|ops\\.schema|client\\.json|server\\.json" apps packages
```

Final GraphQL cleanup gate:

```bash
rg -n "@apollo/client|ApolloProvider|@klicker-uzh/graphql|graphql-yoga|graphql-ws|graphql-codegen|@pothos|graphql-scalars|/api/graphql" apps packages deploy docs project package.json pnpm-lock.yaml turbo.json
```

## Execution Cadence

For each slice:

1. Read this plan and supporting slice file.
2. Check worktree status; preserve unrelated user changes.
3. Update `Progress` with active slice, write scope, and operation mapping.
4. Inspect GraphQL operation, resolver, service/helper, and active frontend consumers.
5. Implement the smallest complete workflow migration.
6. Add or update focused tests when cheap and meaningful.
7. Run focused checks.
8. Browser-verify UI slices when local stack and data allow.
9. Run coexistence or cleanup audit, depending on phase.
10. Run review subagent and simplification subagent.
11. Integrate accepted findings.
12. Re-run affected checks.
13. Update `Progress` with evidence, review outcome, residual risk, and next slice.
14. Commit only slice files.

Operation mapping template:

```text
Slice:
GraphQL operation(s):
GraphQL resolver(s):
Service/helper behavior source:
tRPC router.procedure:
Input schema:
Output DTO:
Active frontend consumers:
Apollo cache/refetch/subscription behavior:
React Query replacement:
Browser verification path:
Cleanup blocked until:
```

## Progress

### 2026-06-03 Done: S04D Frontend-Control Apollo Removal Gate

Status: implemented, focused-check verified, coexistence-audited, direct-runtime verified at the tRPC HTTP layer, reviewed/simplified, and ready to commit.

Write scope:

- `apps/frontend-control/src/pages/_app.tsx`
- `apps/frontend-control/src/lib/apollo.ts`
- `apps/frontend-control/src/lib/SSELink.ts`
- `apps/frontend-control/package.json`
- `pnpm-lock.yaml`
- `project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`

Operation mapping:

```text
Slice: S04D Frontend-Control Apollo Removal Gate
GraphQL operation(s): none remaining in frontend-control after S04B/S04C
GraphQL resolver(s): none
Service/helper behavior source: existing TrpcProvider and migrated tRPC hooks
tRPC router.procedure: no new procedure; existing user/course/liveQuiz control procedures
Input schema: no new schema
Output DTO: no new DTO
Active frontend consumers: frontend-control app shell, control course list/detail, unassigned, session, logout
Apollo cache/refetch/subscription behavior: remove unused Apollo provider, helper, persisted-query, GraphQL WS, and SSELink setup
React Query replacement: existing TrpcProvider stays as the sole API client provider in frontend-control
Browser verification path: control login/course list/unassigned/session/logout smoke, or record local stack gap
Cleanup blocked until: PWA/manage/shared/realtime migrations still require GraphQL; do not touch backend GraphQL or other apps
```

Gate evidence before edits:

- Per-app Apollo audit finds no frontend-control GraphQL operation imports or Apollo hook consumers.
- Remaining frontend-control GraphQL/Apollo hits are `apps/frontend-control/src/pages/_app.tsx`, `apps/frontend-control/src/lib/apollo.ts`, `apps/frontend-control/src/lib/SSELink.ts`, and `apps/frontend-control/package.json`.
- Apollo helper exports are not consumed outside frontend-control `_app.tsx`; PWA/manage have separate Apollo helpers and remain intentionally untouched.

Next:

- S04E active: migrate PWA participant shell and course reads while keeping PWA Apollo live for unmigrated flows.

Evidence:

- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --lockfile-only --config.confirmModulesPurge=false`: passed; incidental lockfile normalization was manually trimmed back to the frontend-control importer removals.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check`: passed.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build`: passed with existing Next/PWA/Browserslist/page-data warnings only.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:syncpack`: passed.
- `git diff --check`: passed.
- Branch-local backend started on `127.0.0.1:3100` with local cypress-style URL/cookie env and dummy local Hatchet config.
- Runtime tRPC smoke: `GET /api/trpc/system.health` returned `{ api: "trpc", status: "ok" }`.
- Runtime tRPC smoke: authenticated `GET /api/trpc/user.profile` returned seeded lecturer `lecturer@df.uzh.ch`.
- Runtime tRPC smoke: authenticated `GET /api/trpc/course.controlCourses` returned seeded control courses.
- Runtime tRPC smoke: authenticated `GET /api/trpc/liveQuiz.unassigned` returned `{ liveQuizzes: [] }`.
- Branch-local control dev server started on `localhost:3103` with `NEXT_PUBLIC_API_URL` pointed at the branch backend.

Audit:

- Per-app Apollo gate: no `@apollo/client`, `ApolloProvider`, `useApollo`, `SSELink`, `GraphQLWsLink`, `graphql-ws`, `@klicker-uzh/graphql`, `useSubscription`, or `subscribeToMore` hits remain in `apps/frontend-control`.
- Frontend-control dependency audit: no Apollo/GraphQL helper-only dependencies remain in `apps/frontend-control/package.json` or its lockfile importer.
- Coexistence audit: GraphQL/Apollo/Yoga references intentionally remain in backend, PWA, manage, `packages/graphql`, and the lockfile for S04E+.

Review:

- Correctness review: `_app.tsx` now keeps `NextIntlClientProvider` and `TrpcProvider` intact while removing only the Apollo wrapper; no frontend-control page imports Apollo helpers after S04B/S04C.
- Scope review: PWA/manage Apollo helpers and backend GraphQL runtime are untouched.
- Simplification review: removed the now-dead frontend-control Apollo helper and SSELink files instead of leaving unused compatibility shims.
- Subagent note: no review/simplification subagents were spawned because the currently available tool set does not expose the multi-agent tool.

Residual risk:

- Visual browser verification remains incomplete. `npx agent-browser` opened the branch-local app but landed on `chrome-error://chromewebdata/`; screenshots `/tmp/klicker-control-s04d-home.png` and `/tmp/klicker-control-s04d-localhost-home.png` are blank, while the branch dev server logged successful `GET /` responses. Playwright was not installed in this workspace, so no alternate screenshot tool was available without adding dependencies.
- The tRPC HTTP runtime smoke proves the branch backend and migrated control procedures are live, but it does not prove rendered browser interaction after Apollo removal.

### 2026-06-02 Done: S04B Finish Frontend-Control Reads

Status: implemented, focused-check verified, direct runtime verified, reviewed/simplified, and committed in `a274ab4b6`.

Write scope:

- `packages/api/src/trpc/routers/liveQuiz.ts`
- `packages/api/src/trpc/dto/liveQuiz.ts`
- `packages/api/src/trpc/schemas/liveQuiz.ts`
- `packages/api/src/trpc/root.ts`
- `packages/api/src/trpc/__tests__/control-read.test.ts`
- `apps/frontend-control/src/pages/course/unassigned.tsx`
- `apps/frontend-control/src/pages/session/[id].tsx` read query only
- `apps/frontend-control/src/components/liveQuizzes/EmbeddingModal.tsx`
- `apps/frontend-control/src/components/liveQuizzes/LiveQuizBlock.tsx`

Operation mapping:

```text
Slice: S04B Finish Frontend-Control Reads
GraphQL operation(s): QGetUnassignedLiveQuizzes, QGetControlLiveQuiz, QGetLiveQuizEmbeddingInfo, QGetSingleLiveQuiz
GraphQL resolver(s): unassignedLiveQuizzes, controlLiveQuiz, getLiveQuizEmbeddingInfo, liveQuiz
Service/helper behavior source: LiveQuizService.getUnassignedLiveQuizzes, getControlLiveQuiz, getLiveQuizEmbeddingInfo, getLiveQuizData
tRPC router.procedure: liveQuiz.unassigned, liveQuiz.control, liveQuiz.embeddingInfo
Input schema: liveQuizId string input for control and embeddingInfo
Output DTO: control live quiz list item DTO, control live quiz detail DTO, embedding info DTO
Active frontend consumers: unassigned live quiz page, running session page, PPT embedding modal, LiveQuizBlock prop types
Apollo cache/refetch/subscription behavior: session mutations remain Apollo for S04C; old read hooks move to React Query
React Query replacement: tRPC useQuery hooks; 1000 ms refetch interval for running session read
Browser verification path: control unassigned page; session/embedding pages if local seeded live quiz data exists
Cleanup blocked until: S04C control mutations and S04D control Apollo removal gate
```

Evidence:

- `pnpm --filter @klicker-uzh/api test`: passed, 10 tests after adding embedding permission-denial coverage.
- `pnpm --filter @klicker-uzh/api check`: passed.
- `pnpm --filter @klicker-uzh/api build`: passed.
- `pnpm --filter @klicker-uzh/frontend-control check`: passed.
- `pnpm --filter @klicker-uzh/frontend-control build`: passed with existing Next/PWA/Browserslist/page-data warnings only.
- `pnpm --filter @klicker-uzh/backend-docker check`: passed.
- `git diff --check`: passed.
- `pnpm run check:all`: passed during docs-only plan commit hook while S04B code was present in the worktree.
- Runtime backend: branch-local backend started on `127.0.0.1:3100`; `/healthz` returned `OK`.
- Runtime tRPC smoke: `GET /api/trpc/system.health` returned healthy tRPC response.
- Runtime S04B HTTP: authenticated `GET /api/trpc/user.profile,liveQuiz.unassigned` with a valid local lecturer JWT returned the seeded lecturer profile and `{ liveQuizzes: [] }`.
- Browser request evidence: `agent-browser` page load attempted `GET http://127.0.0.1:3100/api/trpc/user.profile,liveQuiz.unassigned?...`, proving the migrated unassigned page calls tRPC.
- Browser visual evidence gap: `agent-browser screenshot`, `snapshot`, and auth-page `open` hung repeatedly in isolated sessions; manual cookie/header auth also redirected because browser tooling did not apply auth reliably to the cross-origin tRPC fetch. Do not treat S04B as visually verified.
- Seeded-data gap: local lecturer `76047345-3801-4628-ae7b-adbebcfe8821` has only one `ENDED` live quiz, so running session and embedding modal states were not reachable naturally.
- Coexistence audit: GraphQL/Apollo/Yoga references intentionally remain in 508 files.
- Coexistence audit: tRPC references remain in 17 files.
- Control audit: remaining Apollo/generated usage is `_app` provider, Apollo helper/SSELink, Header logout mutation, StartModal start mutation/refetch, and session page mutations; these are S04C/S04D scope.
- Migrated-file audit: no `GetUnassignedLiveQuizzesDocument`, `GetControlLiveQuizDocument`, `GetLiveQuizEmbeddingInfoDocument`, `GetSingleLiveQuizDocument`, `ElementBlockStatus`, or `PublicationStatus` references remain in the S04B migrated files.

Review:

- Correctness review: compared S04B procedures against `LiveQuizService.getUnassignedLiveQuizzes`, `getControlLiveQuiz`, and `getLiveQuizEmbeddingInfo`; behavior and permission level are aligned for the read consumers.
- Simplification review: kept the DTOs narrow, kept session mutations on Apollo for S04C, and avoided extracting shared services before mutation migration needs them.
- Subagent note: no review/simplification subagents were spawned because the current `multi_agent_v1` tool contract only permits spawning when the user explicitly asks for subagents.

Next:

- S04C active: migrate frontend-control logout/start/session mutations and React Query invalidation.

### 2026-06-02 Done: S04C Frontend-Control Mutations

Status: implemented, focused-check verified, coexistence-audited, reviewed/simplified, and ready to commit.

Write scope:

- `packages/api/package.json`
- `pnpm-lock.yaml`
- `packages/api/src/services/liveQuizExecution.ts`
- `packages/api/src/trpc/routers/user.ts`
- `packages/api/src/trpc/routers/liveQuiz.ts`
- `packages/api/src/trpc/procedures.ts`
- `packages/api/src/trpc/permissions.ts`
- `packages/api/src/trpc/dto/liveQuiz.ts`
- `packages/api/src/trpc/schemas/liveQuiz.ts`
- `packages/api/src/trpc/__tests__/**`
- `packages/graphql/src/services/liveQuizzes.ts`
- `apps/frontend-control/src/components/layout/Header.tsx`
- `apps/frontend-control/src/components/liveQuizzes/StartModal.tsx`
- `apps/frontend-control/src/pages/session/[id].tsx`

Operation mapping:

```text
Slice: S04C Frontend-Control Mutations
GraphQL operation(s): MLogoutUser, MStartLiveQuiz, MActivateSessionBlock, MDeactivateLiveQuizBlock, MEndLiveQuiz
GraphQL resolver(s): logoutUser, startLiveQuiz, activateLiveQuizBlock, deactivateLiveQuizBlock, endLiveQuiz
Service/helper behavior source: AccountService.logoutUser and LiveQuizService start/activate/deactivate/end behavior
tRPC router.procedure: user.logout, liveQuiz.start, liveQuiz.activateBlock, liveQuiz.deactivateBlock, liveQuiz.end
Input schema: id string input for start/end; quizId string + blockId int input for block activation/deactivation
Output DTO: logout user id/string; live quiz id/name/status; activated live quiz id/status/blocks; boolean for deactivation
Active frontend consumers: control Header, StartModal, session page mutation actions
Apollo cache/refetch/subscription behavior: start refetches unassigned live quizzes and redirects; session mutations rely on polling/read refresh
React Query replacement: invalidate liveQuiz.unassigned, liveQuiz.control, and affected course/control queries through trpc.useUtils()
Browser verification path: control unassigned start flow; running session activate/deactivate/end flow when seeded/manual live quiz data exists
Cleanup blocked until: S04D control Apollo removal gate
```

Service-boundary decision:

- Do not duplicate complex live-quiz mutation internals in tRPC.
- Extract transport-neutral live-quiz execution logic into `packages/api/src/services/liveQuizExecution.ts` and have both tRPC procedures and the existing GraphQL resolver/service layer delegate to it.
- Simple transport-shaped behavior, such as logout cookie expiry, may be implemented directly in the tRPC router if it is cheaper and behaviorally identical.
- Avoid a `packages/api` runtime import from `@klicker-uzh/graphql`; S04O remains a hard cleanup gate.

Mapping evidence:

- GraphQL resolvers use `asUserSessionExec` plus `PermissionLevel.EXECUTE` for start/end/activate/deactivate.
- Logout uses `asUser` and expires `next-auth.session-token` with the same cookie settings as login, but `maxAge: 0`.
- `startLiveQuiz`, `activateLiveQuizBlock`, `deactivateLiveQuizBlock`, and `endLiveQuiz` use Redis, Hatchet/scheduled jobs, pubSub, invalidation emitter, Teams notifications, and leaderboard/timeline updates. They must be reused/extracted, not copied into router handlers.

Next:

- S04D active: remove Apollo provider/helper/package residue from frontend-control after confirming no control GraphQL consumers remain.

Evidence:

- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --config.confirmModulesPurge=false`: passed after package dependency updates.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test`: passed, 17 tests.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check`: passed.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build`: passed.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check`: passed.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build`: passed with existing Next/PWA/Browserslist/page-data warnings only.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/graphql check`: passed.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/graphql build`: passed with existing Rollup/plugin TypeScript and circular-dependency warnings only.
- `volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker check`: passed.
- `git diff --check`: passed.

Audit:

- Control mutation audit: no `LogoutUserDocument`, `StartLiveQuizDocument`, `ActivateLiveQuizBlockDocument`, `DeactivateLiveQuizBlockDocument`, or `EndLiveQuizDocument` references remain in `apps/frontend-control/src`.
- Control Apollo audit: remaining hits are the app Apollo provider/helper/SSELink/package dependencies plus tRPC hook names; this is S04D scope.
- API dependency audit: no `packages/api` runtime import from `@klicker-uzh/graphql`; GraphQL now temporarily imports `@klicker-uzh/api` for the shared live-quiz execution service during coexistence.

Review:

- Correctness review: `user.logout` preserves GraphQL cookie expiry semantics; live-quiz start/activate/deactivate/end require USER + SESSION_EXEC scope and `PermissionLevel.EXECUTE` parity before calling the shared execution service.
- Service-boundary review: moved the complex Redis/Hatchet/pubSub/live-quiz side effects into `packages/api/src/services/liveQuizExecution.ts` and made GraphQL delegate to it, avoiding duplicated mutation internals and avoiding an API-to-GraphQL runtime dependency.
- Simplification review: kept S04C limited to remaining control mutations and targeted React Query invalidation; deferred Apollo provider/helper/package removal to S04D.
- Subagent note: no review/simplification subagents were spawned because the currently available tool set does not expose the multi-agent tool.

Residual risk:

- Browser runtime verification was not completed in this slice because the local stack/data was not exercised after the focused checks; S04D must include control smoke verification once the control app no longer has Apollo wiring.
- The service extraction is a large transport-neutral move from GraphQL into API; focused API tests mock the service boundary, while build/check coverage verifies both callers compile.

### 2026-06-02 Done: S04A Runtime Verify Current Control Pilot

Write scope:

- `apps/backend-docker/src/index.ts`: optional `PORT` override.
- `apps/backend-docker/.env.example`: default `PORT=3000`.
- Plan progress evidence.

Operation mapping:

```text
Slice: S04A Runtime Verify Current Control Pilot
GraphQL operation(s): QGetUserProfile, QGetControlCourses, QGetControlCourse
GraphQL resolver(s): user profile lookup, controlCourses, controlCourse
Service/helper behavior source: existing Prisma user/course/derivedPermission queries mirrored in packages/api
tRPC router.procedure: user.profile, course.controlCourses, course.controlCourse
Input schema: course.controlCourse uses { courseId: string }
Output DTO: user profile DTO, control course list item DTO, control course detail DTO
Active frontend consumers: frontend-control Layout, index page, course detail page
Apollo cache/refetch/subscription behavior: read-only hooks, no cache writes
React Query replacement: tRPC useQuery hooks through TrpcProvider
Browser verification path: course list and course detail against local tRPC backend
Cleanup blocked until: S04B/S04C/S04D
```

Evidence:

- `pnpm --filter @klicker-uzh/api test`: passed.
- `pnpm --filter @klicker-uzh/api build`: passed.
- `pnpm --filter @klicker-uzh/backend-docker check`: passed.
- `pnpm --filter @klicker-uzh/backend-docker build`: passed.
- `pnpm --filter @klicker-uzh/frontend-control check`: passed.
- Runtime: tRPC backend on `127.0.0.1:3100`; `GET /healthz` returned `OK`.
- Runtime: `GET /api/trpc/system.health` returned healthy tRPC response.
- Browser: course list screenshot `/tmp/klicker-control-trpc-s04a-list.png`.
- Browser: course detail screenshot `/tmp/klicker-control-trpc-s04a-detail.png`.
- Browser resource log included `/api/trpc/user.profile,course.controlCourses`.
- Browser resource log included `/api/trpc/user.profile,course.controlCourse`.
- Coexistence audit: GraphQL/Apollo/Yoga references intentionally present.

Review:

- Review subagent: `DONE_WITH_CONCERNS`; runtime proof and port docs addressed.
- Simplification subagent: `DONE_WITH_CONCERNS`; kept minimal `PORT` override.

## Remaining Slice Plan

### S04B Finish Frontend-Control Reads (Completed)

Goal: Complete the control app read-only migration.

Dependencies:

- S04A done.

Do:

1. Complete current uncommitted live quiz read router, DTO, schema, root export, and tests.
2. Replace Apollo read hooks in unassigned, session read portions, and embedding modal.
3. Replace generated GraphQL types in touched shared control components with `RouterOutputs` or narrow structural types.
4. Keep all mutations on Apollo for S04C.
5. Preserve polling behavior for running sessions.
6. Verify control pages and resource logs.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build
rg -n "GetUnassignedLiveQuizzesDocument|GetControlLiveQuizDocument|GetLiveQuizEmbeddingInfoDocument|GetSingleLiveQuizDocument|ElementBlockStatus|PublicationStatus" apps/frontend-control/src
```

Commit: `feat(api): migrate control read screens to trpc`

### S04C Frontend-Control Mutations

Goal: Move control app mutations to tRPC with React Query invalidation.

Remaining operations from the current control audit:

- `LogoutUserDocument` in `Header.tsx`.
- `StartLiveQuizDocument` in `StartModal.tsx`.
- `ActivateLiveQuizBlockDocument` in `session/[id].tsx`.
- `DeactivateLiveQuizBlockDocument` in `session/[id].tsx`.
- `EndLiveQuizDocument` in `session/[id].tsx`.

Do:

1. Re-audit remaining `useMutation`, Apollo cache writes, and `refetchQueries` in `apps/frontend-control/src`.
2. Add shared API permission helper with GraphQL parity for `PermissionLevel.EXECUTE`.
3. Add or reuse a USER + SESSION_EXEC tRPC procedure for live-quiz execution mutations.
4. Add mutation input schemas:
   - `{ id: string }` for start/end.
   - `{ quizId: string, blockId: number }` for block activation/deactivation.
5. Reuse GraphQL behavior source without duplicating complex mutation internals:
   - Preferred: extract transport-neutral live-quiz service logic to `packages/api/src/services/**` and make GraphQL delegate to it.
   - Accept temporary wrappers only when recorded and blocked by S04O.
6. Implement `user.logout` with the same cookie expiry semantics as GraphQL logout.
7. Implement `liveQuiz.start`, `liveQuiz.activateBlock`, `liveQuiz.deactivateBlock`, and `liveQuiz.end` with narrow DTO outputs.
8. Add focused API tests for auth/scope, permission denial, and success DTO mapping where service behavior can be mocked cheaply.
9. Replace Apollo mutations in Header, StartModal, and session page.
10. Replace Apollo refetch/cache writes with `trpc.useUtils()` invalidation:
    - `liveQuiz.unassigned`
    - `liveQuiz.control`
    - affected control course queries where start/end changes list membership.
11. Preserve button disabled/loading/error behavior and existing redirects.
12. Browser verify start/end/block flows with seeded or manually created live quiz; record data gaps if local seed only has ended quizzes.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build
rg -n "@apollo/client|@klicker-uzh/graphql|useMutation|refetchQueries|cache\\.modify|cache\\.write|LogoutUserDocument|StartLiveQuizDocument|ActivateLiveQuizBlockDocument|DeactivateLiveQuizBlockDocument|EndLiveQuizDocument" apps/frontend-control/src
```

Commit: `feat(api): migrate control mutations to trpc`

### S04D Frontend-Control Apollo Removal Gate

Goal: Remove Apollo from control only after no control consumers remain.

Gate:

```bash
rg -n "@apollo/client|ApolloProvider|useApollo|SSELink|GraphQLWsLink|graphql-ws|@klicker-uzh/graphql|useQuery|useMutation|useSubscription|subscribeToMore" apps/frontend-control
```

Do:

1. Confirm remaining hits are provider/helper/package files only.
2. Remove control Apollo provider/helper and app GraphQL dependencies.
3. Update lockfile.
4. Keep backend GraphQL and other apps untouched.
5. Browser smoke course list, unassigned page, session page, and logout.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --lockfile-only
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build
```

Commit: `chore(control): remove apollo after trpc migration`

### S04E PWA Participant Shell and Course Reads

Goal: Establish participant-side tRPC reads before risky activity execution paths.

Likely scope:

- PWA layout/profile/session bootstrapping.
- Participant course overview/list pages.
- Course landing pages and activity list reads.
- Assessment-mode equivalents if they share code.

Do:

1. Audit PWA read operations and auth token/cookie requirements.
2. Add participant-aware base procedures/middleware if current API helpers do not cover PWA auth.
3. Return narrow participant/course/activity summary DTOs.
4. Preserve cookie, bearer token, localStorage, and assessment-domain behavior.
5. Replace low-risk Apollo reads with tRPC reads.
6. Keep login/join mutations and realtime paths on GraphQL.
7. Browser verify participant login state and course overview.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
```

Commit: `feat(api): migrate pwa participant reads to trpc`

### S04F PWA Login, Join, Account, and Push Mutations

Goal: Move auth-adjacent participant mutations after the read shell is stable.

Likely operations:

- Participant login/logout variants.
- Magic link and LTI participant flows where they call GraphQL.
- Join course with PIN.
- Participant account create/activate/update/delete.
- Push subscription registration.

Risks:

- Token storage and cookie domain behavior.
- LTI/embedded redirect behavior.
- Assessment-domain behavior.

Do:

1. Split into sub-slices by flow if one commit becomes too large.
2. Preserve token/cookie semantics exactly.
3. Add server tests for permission and invalid-token cases where practical.
4. Replace Apollo mutation error handling with equivalent tRPC errors.
5. Browser verify login, join, logout, and push registration path where local environment supports it.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
```

Commit: one commit per flow group, for example `feat(api): migrate pwa join flow to trpc`

### S04G PWA Practice Quiz and Microlearning Non-Realtime

Goal: Migrate participant activity workflows that do not require live subscription replacement.

Likely scope:

- Practice quiz overview and stack execution.
- Bookmarks.
- Microlearning overview/detail/evaluation reads.
- Non-realtime activity feedback mutations.

Do:

1. Build activity DTOs compatible with shared components.
2. Keep shared component props structural where manage still uses GraphQL.
3. Preserve answer submission and grading semantics.
4. Replace Apollo refetches with targeted invalidation.
5. Browser verify representative practice quiz and microlearning flows.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
```

Commit: one commit per activity family.

### S04H PWA Group Activity Non-Realtime

Goal: Migrate group activity reads and mutations while leaving subscriptions for S05.

Likely scope:

- Group join/create/random pool operations.
- Group activity stack reads.
- Group messages/submissions/participant actions.

Do:

1. Separate query/mutation migration from subscription migration.
2. Preserve group membership authorization.
3. Keep `subscribeToMore` or GraphQL subscription consumers in place until S05.
4. Browser verify group creation/join and participant interaction.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
```

Commit: `feat(api): migrate pwa group activity workflow to trpc`

### S04I Manage Shell, Settings, Course List, and Dashboard Reads

Goal: Establish manage app tRPC usage with low-risk lecturer reads.

Likely scope:

- Manage layout/user profile/settings.
- Course list/dashboard reads.
- Course metadata reads used by navigation.
- Analytics navigation reads that do not need reporting payloads.

Do:

1. Reuse/adapt lecturer/user DTOs from control where safe.
2. Add page-specific course summary DTOs.
3. Keep Apollo mounted.
4. Avoid broad "course detail" DTOs that pull authoring/evaluation data prematurely.
5. Browser verify delegated login, dashboard, and a course page.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
```

Commit: `feat(api): migrate manage shell reads to trpc`

### S04J Manage Resources, Sharing, Catalog, Groups, and Collections Reads

Goal: Migrate read-heavy manage domains before write workflows.

Likely scope:

- Sharing views.
- Catalog/browser views.
- Resource views.
- Group views.
- Answer collection read views.
- Tag read views.

Do:

1. Build domain routers: `sharing`, `catalog`, `resources`, `groups`, `answerCollections`, `tags` as needed.
2. Preserve permission checks from GraphQL services.
3. Use DTOs tailored to tables/cards/selectors.
4. Replace generated type imports in touched shared helpers with structural types.
5. Browser verify representative list/detail pages.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
```

Commit: one commit per domain.

### S04K Manage Course and Activity Authoring Mutations

Goal: Migrate manage write workflows for courses and activities.

Likely scope:

- Course create/edit/archive/delete.
- Live quiz create/edit/delete.
- Practice quiz create/edit/delete.
- Microlearning create/edit/delete.
- Group activity create/edit/delete.
- Template operations.
- Batch operations.
- File/upload metadata calls when they are GraphQL-backed.

Risks:

- Complex wizard state.
- Apollo cache updates and broad refetches.
- Server validation.
- File upload/SAS flows.

Do:

1. Split by wizard/action family.
2. Move validation schemas close to procedures.
3. Reuse existing service logic for element manipulation and activity creation.
4. Replace Apollo cache/refetch behavior with targeted invalidation.
5. Browser verify a create/edit/save cycle for each migrated family.
6. Keep unrelated authoring families on Apollo until their slice.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
```

Commit: one commit per wizard/action family.

### S04L Manage Element, Tag, and Answer Collection Editing

Goal: Migrate high-use content editing surfaces.

Likely scope:

- Element manipulation components.
- Element data editing for supported question types.
- Tag CRUD.
- Answer collection CRUD.
- Media/file metadata interactions.

Do:

1. Preserve element data discriminants and shape semantics.
2. Keep shared editor components transport-neutral.
3. Avoid generated GraphQL types in shared props.
4. Run browser smoke for representative element type creation/editing.
5. Check browser bundle for server-only import leaks through app builds.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
```

Commit: one commit per authoring family.

### S04M Manage Analytics, Evaluation, Grading, and Reporting

Goal: Migrate reporting/evaluation pages after activity DTOs are stable.

Likely scope:

- Analytics overview/activity/performance pages.
- Live quiz evaluation.
- Practice quiz evaluation.
- Microlearning evaluation.
- Group activity grading.
- Point corrections and scoring views.

Risks:

- Large nested payloads.
- Decimal/date serialization.
- Chart/table components using generated GraphQL types.

Do:

1. Use SuperJSON and explicit Decimal conversions with `!= null` checks.
2. Create DTOs around chart/table needs instead of exposing resolver internals.
3. Browser verify representative analytics/evaluation pages.
4. Add procedure tests for permission boundaries and numeric conversion cases.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
```

Commit: one commit per reporting family.

### S04N Generated Type Leak Cleanup During Mixed State

Goal: Remove generated GraphQL type imports from migrated helpers/components without breaking mixed Apollo/tRPC callers.

Do:

1. Audit generated type-only imports in migrated app areas and shared packages.
2. Replace with `RouterOutputs`, domain-local interfaces, or narrow structural types.
3. Keep shared props structural until all callers are tRPC.
4. Do not delete generated files yet.

Check:

```bash
rg -n "@klicker-uzh/graphql/dist/ops|TypedDocumentNode|ElementBlockStatus|PublicationStatus" apps packages/shared-components packages/markdown
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
```

Commit: `chore(types): replace generated graphql type leaks`

### S04O API No-GraphQL Runtime Dependency Gate

Goal: Ensure the new API package can survive final GraphQL deletion.

Why: During coexistence it can be tempting to call `@klicker-uzh/graphql` services from tRPC. That can be acceptable only as a temporary bridge, but final cleanup cannot remove GraphQL while the future API package depends on it.

Gate:

```bash
rg -n "@klicker-uzh/graphql|packages/graphql|graphql/dist" packages/api apps/*/src
```

Do:

1. Audit every API/app import from `@klicker-uzh/graphql`.
2. For type-only generated imports in mixed shared components, replace with `RouterOutputs`, local structural types, or domain enums from a non-GraphQL package.
3. For runtime service imports, extract the needed transport-neutral service into `packages/api/src/services/**` or another server-only package and update GraphQL to delegate while it still exists.
4. Confirm `packages/api` has no runtime dependency on `@klicker-uzh/graphql`.
5. Keep this gate blocking S06.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
rg -n "@klicker-uzh/graphql|packages/graphql|graphql/dist" packages/api apps/*/src
```

Commit: `chore(api): remove graphql runtime dependency from trpc api`

### S05A Realtime Audit and Transport-Neutral Event Bridge

Goal: Decouple event publishing from GraphQL-specific pubSub while GraphQL subscriptions still work.

Known event names:

- `runningLiveQuizUpdated`
- `liveQuizSettingsChanged`
- `feedbackCreated`
- `feedbackPinned`
- `feedbackAdded`
- `feedbackRemoved`
- `feedbackUpdated`
- `groupActivityStarted`
- `groupActivityEnded`
- `singleGroupActivityEnded`
- `microLearningEnded`

Do:

1. Audit all GraphQL subscriptions, payloads, and publisher call sites.
2. Define event envelope: name, domain key, payload DTO, timestamp if useful.
3. Add server-only event bridge under `packages/api/src/trpc/events/**` or a better existing server-only location.
4. Bridge existing GraphQL pubSub publishing so old subscribers keep receiving old payloads.
5. Add event envelope/helper tests.
6. Do not migrate clients yet.

Check:

```bash
rg -n "ctx\\.pubSub\\.publish|pubSub\\.publish|pubSub\\.subscribe|createPubSub|useSubscription|subscribeToMore|GraphQLWsLink|graphql-ws" apps packages
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker check
```

Commit: `feat(api): add realtime event bridge`

### S05B tRPC Subscription Transport Setup

Goal: Add subscription-capable tRPC client/server plumbing where realtime clients need it.

Do:

1. Confirm current tRPC subscription transport API from docs for the installed version.
2. Add server subscription procedures for one smoke event if useful.
3. Add app client `splitLink`/subscription link only to apps that need subscriptions.
4. Keep existing query/mutation links stable.
5. Preserve cookies/credentials behavior for local, production, embedded, and assessment domains.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
```

Commit: `feat(api): add trpc subscription clients`

### S05C PWA Live Quiz Realtime

Goal: Replace PWA live quiz GraphQL subscription flows with tRPC subscriptions or event-triggered invalidation.

Likely scope:

- Live quiz block updates.
- Live quiz settings changes.
- Feedback events relevant to participant live quiz views.

Do:

1. Add tRPC subscription procedures filtered by quiz/course/session keys.
2. Replace `subscribeToMore`/`useSubscription` in one live quiz flow at a time.
3. Prefer React Query invalidation/refetch over manual cache surgery unless UI state needs direct patching.
4. Verify with two browser sessions.
5. Confirm GraphQL subscription clients still work until their consumers are gone.

Check:

```bash
rg -n "subscribeToMore|useSubscription|GraphQLWsLink|graphql-ws" apps/frontend-pwa
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
```

Commit: `feat(api): migrate pwa live quiz realtime to trpc`

### S05D PWA Microlearning and Group Activity Realtime

Goal: Replace remaining PWA subscription workflows.

Likely scope:

- `microLearningEnded`.
- `groupActivityStarted`.
- `groupActivityEnded`.
- `singleGroupActivityEnded`.

Do:

1. Migrate one event family at a time.
2. Preserve filtering by course/activity/group/participant.
3. Verify with two sessions when local data allows.
4. Record live-only/reconnect limitations if no replay ID exists.

Check:

```bash
rg -n "subscribeToMore|useSubscription|GraphQLWsLink|graphql-ws" apps/frontend-pwa
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
```

Commit: one commit per realtime family.

### S05E Manage Realtime

Goal: Replace manage cockpit/lecturer realtime GraphQL subscriptions.

Likely scope:

- Lecturer live quiz feedback create/update/pin/remove events.
- Cockpit live quiz updates.
- Audience interaction feedback paths.

Do:

1. Add manage-facing subscription procedures or reuse event procedures with role checks.
2. Replace Apollo subscription hooks.
3. Use invalidation/refetch for query-backed panels.
4. Verify lecturer/participant two-session flow for feedback/live quiz update.

Check:

```bash
rg -n "subscribeToMore|SubscribeToMoreOptions|useSubscription|GraphQLWsLink|graphql-ws" apps/frontend-manage
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
```

Commit: `feat(api): migrate manage realtime to trpc`

### S05F Realtime GraphQL Client Removal Gate

Goal: Remove app GraphQL WS client dependencies after no app subscriptions remain.

Gate:

```bash
rg -n "subscribeToMore|SubscribeToMoreOptions|useSubscription|GraphQLWsLink|graphql-ws" apps/frontend-control apps/frontend-manage apps/frontend-pwa
```

Do:

1. Remove app-side `graphql-ws` dependencies only when gates are clean.
2. Remove obsolete app subscription links/helpers.
3. Keep backend GraphQL WS until S06.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --lockfile-only
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
```

Commit: `chore(apps): remove graphql ws clients`

### S05G App-Level Apollo Removal Gates

Goal: Remove Apollo app by app after each app has no active Apollo consumers.

Order:

1. frontend-control, if not already done in S04D.
2. frontend-pwa.
3. frontend-manage.

Gate per app:

```bash
rg -n "@apollo/client|ApolloProvider|useApollo|SSELink|GraphQLWsLink|graphql-ws|@klicker-uzh/graphql|useQuery|useMutation|useSubscription|subscribeToMore" apps/<app>
```

Do:

1. Remove provider/helper/dependency only after the gate is clean except removal targets.
2. Update lockfile with package manifest changes.
3. Browser smoke the app.
4. Keep backend GraphQL and `packages/graphql` until all apps/packages are clean.

Commit: one commit per app, for example `chore(pwa): remove apollo after trpc migration`.

### S06A Final GraphQL Cleanup Readiness Review

Goal: Prove final GraphQL removal is truly unblocked.

Dependencies:

- All S04 workflow migrations complete.
- All S05 realtime migrations complete.
- App-level Apollo removal gates complete.
- Generated type leak cleanup complete.

Do:

1. Run all cleanup audits.
2. Check deployment, local dev, docs, generated artifacts, package scripts, and lockfile references.
3. Check whether any external/public GraphQL compatibility requirement exists.
4. Record explicit user approval for final removal in this plan.
5. Stop if any active consumer remains or approval is absent.

Check:

```bash
rg -n "@apollo/client|ApolloProvider|@klicker-uzh/graphql|graphql-yoga|graphql-ws|graphql-codegen|@pothos|graphql-scalars|/api/graphql" apps packages deploy docs project package.json pnpm-lock.yaml turbo.json
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
```

Commit: `docs(project): record graphql cleanup readiness`

### S06B Remove Backend GraphQL Runtime

Goal: Remove `/api/graphql`, Yoga, persisted operations loading, GraphQL WS server, and GraphQL-only pubSub bridge.

Do:

1. Remove Yoga app mount from `apps/backend-docker`.
2. Remove GraphQL WS server setup.
3. Remove persisted GraphQL operation loading from backend runtime.
4. Remove GraphQL-specific pubSub bridge code after no GraphQL subscribers remain.
5. Keep tRPC endpoint and transport-neutral event bridge.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker build
```

Commit: `chore(api): remove graphql backend runtime`

### S06C Remove `packages/graphql`, Codegen, and Persisted Operation Artifacts

Goal: Delete the GraphQL package and generated artifacts only after no workspace package depends on them.

Do:

1. Remove all workspace dependencies on `@klicker-uzh/graphql`.
2. Delete `packages/graphql`.
3. Remove GraphQL codegen scripts and Turbo dependencies.
4. Remove generated SDL/introspection/persisted operation files.
5. Update workspace lockfile.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --lockfile-only
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run build
```

Commit: `chore(api): remove graphql package`

### S06D Remove GraphQL Docs, Deploy, Env, and Lockfile Residue

Goal: Clean non-code residue after runtime/package removal.

Do:

1. Update local dev docs from GraphQL API assumptions to tRPC API assumptions.
2. Update deployment charts/manifests if GraphQL-specific env/routes remain.
3. Update package scripts, Turbo env/dependency declarations, and lockfile residue.
4. Keep historical archived plans unchanged; update only current migration plan/progress.

Check:

```bash
rg -n "GraphQL|graphql|Apollo|apollo|/api/graphql|@klicker-uzh/graphql|graphql-yoga|graphql-ws|graphql-codegen" apps packages deploy docs project package.json pnpm-lock.yaml turbo.json
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:all
```

Commit: `docs(api): remove graphql migration residue`

### S06E Final End-to-End Verification Without GraphQL

Goal: Prove the repo works without GraphQL.

Required checks:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --frozen-lockfile
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:all
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run test:run
```

Required browser flows:

- Manage delegated login, dashboard, and course view.
- Manage create/edit representative activity.
- Manage live quiz cockpit and feedback if realtime remains user-visible.
- PWA participant login, course overview, practice quiz, microlearning, group activity.
- PWA live quiz with two-session realtime updates.
- Control course list/detail, unassigned page, and live quiz control flow.

Required audits:

```bash
rg -n "@apollo/client|ApolloProvider|@klicker-uzh/graphql|graphql-yoga|graphql-ws|graphql-codegen|@pothos|graphql-scalars|/api/graphql" apps packages deploy docs project package.json pnpm-lock.yaml turbo.json
rg -n "@trpc|/api/trpc|TrpcProvider|createTRPC" apps packages package.json pnpm-lock.yaml
```

Do:

1. Record command results and browser screenshot paths in `Progress`.
2. Record any pre-existing external failure separately with evidence.
3. Run final security review and handle/defer findings explicitly.

Commit: `docs(project): record final trpc verification`

### S07 MR/PR Finish

Goal: Prepare the branch for review and merge.

Do:

1. Run final security review if not already completed in S06E.
2. Update this plan with final status, residual risks, and `Next Steps`.
3. Use `$mr-description-writer` for the MR/PR body.
4. Build the MR/PR body from:
   - `git log v3..HEAD`
   - `git diff --stat v3...HEAD`
   - `git diff --name-status v3...HEAD`
   - this plan's `Progress`
   - verification screenshots
   - existing MR/PR body, if any
5. Create a draft MR/PR unless user asks for ready.
6. If an MR/PR ID becomes known and workflow requires it, rename only this current plan file in a separate metadata commit.

Commit:

- Metadata/documentation commit only if needed.

## Final Acceptance Criteria

Done when:

- No active Apollo hooks/providers remain.
- No active generated GraphQL operation imports remain.
- No app-side GraphQL WS clients remain.
- No GraphQL endpoint or GraphQL WS server remains.
- No workspace package depends on `@klicker-uzh/graphql`.
- `packages/graphql` and GraphQL codegen artifacts are removed.
- `packages/api` owns all app API workflows.
- Main manage/PWA/control flows pass browser smoke.
- Realtime workflows pass two-session verification where practical.
- Full repository checks pass or any pre-existing/environmental failures are documented with evidence.
- Cleanup audits are clean or contain only intentional historical references.
- MR/PR body reflects the whole branch and remaining manual verification.

## Stop Conditions

Stop and report before S06 if:

- Any active Apollo/GraphQL consumer remains.
- Any app still imports generated GraphQL operation types for active code.
- Any GraphQL subscription consumer remains.
- External/public GraphQL compatibility is required.
- User has not approved final GraphQL removal.

Stop within a slice if:

- The local behavior source is unclear and guessing would change product behavior.
- Auth/cookie/LTI/assessment semantics cannot be verified from code or local runtime.
- Browser runtime verification is required but local infrastructure is unavailable; record the gap and ask whether to continue with code-only checks.

## Residual Risks To Track

- Realtime may be live-only without replay IDs; document reconnect behavior.
- PWA token/cookie behavior differs across normal, assessment, embedded, and LTI modes.
- Manage authoring mutations have broad cache invalidation behavior that needs workflow-level verification.
- Generated GraphQL types are embedded in shared components; structural props are safer during mixed state.
- Final GraphQL removal is high-risk and needs explicit approval after all audits are clean.

## Next Steps

Current next action:

1. Start S04C control mutations.
2. Remove Apollo from control only after S04C audit is clean.
3. Continue PWA/manage vertical migrations while keeping GraphQL live.
