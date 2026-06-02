# Full Implementation Plan: GraphQL to tRPC Dual-API Migration

## Identity

Plan path: `project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`

Supporting files:

- `README.md`
- `S00-plan-and-audit.md`
- `S01-api-package-kernel.md`
- `S02-backend-dual-mount.md`
- `S03-client-provider-shells.md`
- `S04-vertical-migrations.md`
- `S05-realtime-migration.md`
- `S06-final-cleanup.md`
- `GOAL_PROMPT.md`

Branch: `codex/trpc-dual-api-migration`

Target branch: `v3`

Current state as of 2026-06-02:

- Done: dual-stack plan, `packages/api` tRPC foundation, `/api/trpc` backend mount, frontend provider shells, and a frontend-control read pilot.
- Commit marker: `c6be4df9c feat(api): port dual-stack control pilot`.
- GraphQL still live by design: `/api/graphql`, `packages/graphql`, Apollo providers, GraphQL codegen, and GraphQL WS remain present.
- Remaining GraphQL operation files: about 300 under `packages/graphql/src/graphql/ops`.
- Highest remaining client surface by directory: manage app components and pages, then PWA pages/components, then control app.
- Realtime hotspots: PWA live quiz, PWA microlearning, PWA group activity, manage lecturer/cockpit feedback, backend GraphQL WS/pubSub.

## Goal

Migrate KlickerUZH from GraphQL/Apollo/generated operations to tRPC in a controlled dual-stack rollout:

- Grow `packages/api` and `/api/trpc` by workflow.
- Shrink Apollo usage by workflow.
- Keep GraphQL available until all active consumers are migrated.
- Remove GraphQL only after audits, runtime verification, and explicit cleanup gates pass.

## Non-Goals

- Do not rewrite domain behavior while changing transport.
- Do not replace Prisma schema or service architecture unless a resolver has transport-specific logic that must be extracted.
- Do not remove GraphQL during read/mutation/realtime migration.
- Do not batch unrelated workflows into one commit.
- Do not migrate generated GraphQL types globally before the consuming workflows are ready.

## Hard Rules

- Use `packages/api` for new tRPC routers, DTOs, schemas, and transport-neutral server helpers.
- Keep `packages/graphql` as the behavior source until the matching tRPC workflow is verified.
- Browser code must import only router types from `@klicker-uzh/api`.
- Do not import `appRouter`, Prisma clients, Node modules, or backend runtime modules into browser bundles.
- Use Zod for inputs.
- Use SuperJSON for tRPC serialization.
- Return DTOs, not broad Prisma records.
- Preserve enum string values.
- For app-local checks after API router changes, run `pnpm --filter @klicker-uzh/api build` first; root `pnpm run check` handles this through Turbo.
- Keep GraphQL subscriptions and `graphql-ws` until all realtime clients are migrated and verified.
- Use `npx agent-browser` screenshots for UI-facing verification when the local dev stack is running.
- Record every slice in the `Progress` section below before committing.

## Tooling Baseline

Use the repo-pinned Node and pnpm for local commands:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm <command>
```

Standard focused checks:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter <target-app> check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter <target-app> build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:all
```

Coexistence audit before S06:

```bash
rg -n "@apollo/client|ApolloProvider|@klicker-uzh/graphql|/api/graphql|graphql-yoga|graphql-ws" apps packages package.json pnpm-lock.yaml
rg -n "@trpc|createTRPC|/api/trpc|type AppRouter|TrpcProvider" apps packages package.json pnpm-lock.yaml
```

Cleanup audit for S06:

```bash
rg -n "@apollo/client|ApolloProvider|useQuery|useMutation|useSubscription|subscribeToMore" apps packages
rg -n "src/graphql/ops|ops\\.ts|ops\\.schema|client\\.json|server\\.json|graphql-codegen|TypedDocumentNode" apps packages
rg -n "graphql-yoga|graphql-ws|@graphql-yoga|@pothos|graphql-scalars|@klicker-uzh/graphql" apps packages package.json pnpm-lock.yaml turbo.json
rg -n "/api/graphql|graphqlEndpoint|GraphQL API" apps packages deploy util docs project
```

## Progress

### 2026-06-02 Done

- S01/S02 foundation committed.
- S03 provider shells committed.
- S04A frontend-control read pilot committed.
- Current runtime gap: browser smoke for the pilot still needs a running Klicker dev stack.

### Next

- Run S04A runtime verification against the local stack.
- Then migrate one remaining frontend-control workflow slice.

## Remaining Surface Summary

Evidence from local audits:

- `packages/graphql/src/graphql/ops` contains about 300 operation/fragment files.
- Manage app has the broadest Apollo/generated type surface.
- PWA has the most realtime-sensitive participant workflows.
- Control app has the smallest surface and should be finished first.
- Backend realtime currently uses GraphQL Yoga pubSub and `graphql-ws`.

Known realtime events:

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

## Execution Cadence

For every slice:

1. Update `Progress` with the active slice and intended write scope.
2. Fill operation mapping before code.
3. Add or extend API tests where behavior can be isolated cheaply.
4. Implement a narrow tRPC router/DTO/client change.
5. Run focused checks.
6. Run coexistence audit before S06.
7. Run browser verification for UI-facing changes when local stack exists.
8. Review the diff for scope and server-only import leaks.
9. Simplify incidental abstractions.
10. Update `Progress` with evidence and next step.
11. Commit only that slice with a conventional message.

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

## Slice Plan

### S04A Runtime Verify Current Control Pilot

Goal: Prove the committed control read pilot works in a real local environment.

Write scope:

- Plan progress only unless runtime issues are found.
- If issues are found, restrict fixes to `packages/api`, `apps/backend-docker`, and migrated frontend-control files.

Do:

1. Start or reuse the local Klicker stack.
2. Log into frontend-control with seeded delegated credentials.
3. Verify layout/user profile, course list, and course detail.
4. Confirm migrated requests hit `/api/trpc`.
5. Capture screenshots before/after navigation.

Check:

```bash
curl -sS http://localhost:3000/healthz
npx agent-browser open http://localhost:3003
npx agent-browser screenshot /tmp/klicker-control-trpc-course-list.png --full
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
```

Commit:

- `docs(project): record control trpc runtime verification`
- If code fix needed: `fix(api): stabilize control trpc pilot`

### S04B Finish Frontend-Control Reads

Goal: Move the remaining read-only control screens to tRPC.

Likely scope:

- `apps/frontend-control/src/pages/course/unassigned.tsx`
- `apps/frontend-control/src/pages/session/[id].tsx` read query portions
- Supporting live quiz list data only when the page can stay read-only

Avoid:

- Do not migrate control mutations in this slice.
- Do not change session/live quiz execution behavior.

Do:

1. Map remaining control GraphQL read documents.
2. Add `course`/`session` router procedures and DTOs.
3. Keep mutation buttons on Apollo if they are mixed into the same screen.
4. Replace only read hooks with tRPC.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
rg -n "@apollo/client|@klicker-uzh/graphql/dist/ops" apps/frontend-control
```

Commit: `feat(api): migrate control read screens to trpc`

### S04C Frontend-Control Mutations

Goal: Move control app mutations to tRPC with React Query invalidation.

Likely operations:

- logout user
- live quiz start/end/cancel actions
- block activate/deactivate actions
- live quiz setting changes used by control

Do:

1. Add mutation procedures that reuse existing GraphQL services.
2. Map domain errors to `TRPCError`.
3. Replace Apollo `useMutation` and `refetchQueries` with tRPC mutation hooks and targeted invalidation.
4. Keep optimistic behavior only where GraphQL already had an equivalent.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build
npx agent-browser open http://localhost:3003
```

Commit: `feat(api): migrate control mutations to trpc`

### S04D Control App Apollo Removal Gate

Goal: Remove Apollo from frontend-control only after all control consumers are gone.

Gate:

```bash
rg -n "@apollo/client|@klicker-uzh/graphql|graphql-ws|SSELink|useApollo|ApolloProvider" apps/frontend-control
```

Do:

1. Remove control app Apollo provider and helper only if the gate is clean except provider/package references.
2. Remove control app GraphQL dependencies from `apps/frontend-control/package.json`.
3. Keep backend GraphQL and other apps untouched.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --lockfile-only
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-control build
```

Commit: `chore(control): remove apollo after trpc migration`

### S04E PWA Auth, Participant Shell, and Course Overview Reads

Goal: Move low-risk PWA participant reads before activity execution paths.

Likely scope:

- `apps/frontend-pwa/src/components/Layout.tsx`
- profile/edit profile reads
- participant course overview/list reads
- course landing pages with activity list reads

Avoid:

- Do not migrate live quiz execution yet.
- Do not migrate push subscription mutation until participant auth reads are stable.

Do:

1. Add participant-aware procedures and auth middleware.
2. Preserve bearer token and cookie behavior in the PWA tRPC helper.
3. Return narrow participant/course DTOs.
4. Replace Apollo query hooks in shell pages.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
npx agent-browser open http://localhost:3001
```

Commit: `feat(api): migrate pwa participant reads to trpc`

### S04F PWA Account, Login, Join, and Push Mutations

Goal: Move participant account/join/auth-adjacent mutations after read shell is stable.

Likely operations:

- participant login/logout variants
- magic link and LTI participant login
- join course with pin
- participant account create/activate/update/delete
- push subscription registration

Risks:

- Token/cookie behavior.
- Redirect behavior.
- Embedded/LTI launch assumptions.

Do:

1. Migrate one auth/join group at a time.
2. Preserve token storage semantics exactly.
3. Use browser verification for login/join paths.
4. Keep GraphQL fallback until each flow is verified.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa build
npx agent-browser open http://localhost:3001
```

Commit: one commit per flow group, for example `feat(api): migrate pwa join flow to trpc`

### S04G PWA Practice Quiz and Microlearning Workflows

Goal: Migrate participant activity pages that are not live quiz realtime first.

Likely scope:

- practice quiz overview and stack execution
- bookmarks
- microlearning overview/detail/evaluation reads
- activity feedback mutations that do not depend on GraphQL subscriptions

Do:

1. Create activity DTOs compatible with shared components.
2. Avoid forcing shared component props to tRPC-only types while manage still uses GraphQL.
3. Use structural types for shared component props where mixed consumers remain.
4. Migrate mutations with targeted invalidation.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-pwa check
npx agent-browser open http://localhost:3001
```

Commit: one commit per activity family.

### S04H PWA Group Activity Workflows

Goal: Migrate group activity reads and mutations, leaving realtime subscriptions for S05.

Likely scope:

- group join/create/random pool operations
- group activity stack reads
- group messages/submissions/grading-facing participant actions

Do:

1. Separate query/mutation migration from subscription migration.
2. Preserve group membership authorization.
3. Keep `subscribeToMore` components until S05.

Commit: `feat(api): migrate pwa group activity workflow to trpc`

### S04I Manage Shell, User Settings, Course List, and Dashboard Reads

Goal: Establish manage app tRPC usage with low-risk reads.

Likely scope:

- `apps/frontend-manage/src/components/Layout.tsx`
- user settings/profile pages
- course list/dashboard reads
- analytics navigation reads that only need course metadata

Do:

1. Add lecturer/user DTOs shared with or adapted from control where possible.
2. Avoid broad "course" DTOs; create page-specific shapes.
3. Keep Apollo mounted.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage build
npx agent-browser open http://localhost:3002
```

Commit: `feat(api): migrate manage shell reads to trpc`

### S04J Manage Resources, Groups, Sharing, and Catalog Reads

Goal: Migrate read-heavy manage resource domains before write workflows.

Likely scope by directory hotspots:

- `components/sharing`
- `components/catalog`
- `components/resources`
- `components/groups`
- answer collections read views

Do:

1. Build domain routers: `sharing`, `catalog`, `resources`, `groups`.
2. Keep permission checks equivalent to GraphQL services.
3. Prefer service extraction where GraphQL resolvers contain transport-specific glue.
4. Avoid coupling shared components to generated GraphQL types.

Commit: one commit per domain.

### S04K Manage Course and Activity Creation/Editing Mutations

Goal: Migrate manage write workflows that create/update courses and activities.

Likely scope:

- course create/edit/archive/delete
- live quiz/practice quiz/microlearning/group activity create/edit/delete
- template operations
- batch operations

Risks:

- Apollo cache updates and refetches.
- Wizard state and server validation.
- File upload SAS handling.

Do:

1. Migrate one wizard/action family at a time.
2. Replace `refetchQueries` with React Query invalidation.
3. Add tests for input validation and permission enforcement.
4. Browser verify wizard completion, not just typecheck.

Commit: one commit per wizard/action family.

### S04L Manage Element, Tag, and Answer Collection Editing

Goal: Migrate high-use content authoring workflows.

Likely scope:

- element manipulation components
- tag CRUD
- answer collection CRUD
- media/file upload interactions

Do:

1. Reuse existing element manipulation service logic.
2. Keep element data DTO discriminants stable.
3. Check browser bundle for server-only import leaks.
4. Run browser smoke for creating/editing each element type touched by the slice.

Commit: one commit per authoring family.

### S04M Manage Analytics, Evaluation, and Grading

Goal: Migrate reporting/evaluation pages after core authoring data shapes are stable.

Likely scope:

- analytics overview/activity/performance pages
- live quiz/practice quiz/microlearning evaluation pages
- grading group activity pages
- point corrections

Risks:

- Large nested DTOs.
- Decimal/date serialization.
- Shared chart components with generated GraphQL types.

Do:

1. Use SuperJSON for Date/Decimal-compatible transport.
2. Convert Decimal fields with explicit `!= null` checks.
3. Keep DTOs tailored to chart/table consumers.
4. Snapshot or browser verify representative analytics pages.

Commit: one commit per reporting family.

### S05A Transport-Neutral Realtime Event Bridge

Goal: Decouple realtime publishing from GraphQL-specific pubSub while GraphQL subscribers still work.

Write scope:

- `packages/api/src/trpc/events/**` or equivalent server-only module.
- `apps/backend-docker` wiring.
- Existing service publish call sites only as needed.

Do:

1. Define event names, payload DTOs, and domain keys.
2. Bridge current `ctx.pubSub.publish` events so GraphQL keeps receiving them.
3. Add tests for event envelope helpers.
4. Do not migrate clients yet.

Check:

```bash
rg -n "ctx\\.pubSub\\.publish|pubSub\\.publish|pubSub\\.subscribe" packages/graphql apps packages
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/api test
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker check
```

Commit: `feat(api): add realtime event bridge`

### S05B tRPC Subscription Link Setup

Goal: Add subscription-capable tRPC clients only where needed.

Do:

1. Confirm the tRPC 10 subscription transport choice from current docs.
2. Add split links in PWA/manage as needed.
3. Keep query/mutation links stable.
4. Do not enable subscriptions globally in apps that do not need them.

Commit: `feat(api): add trpc subscription clients`

### S05C PWA Realtime Migration

Goal: Replace PWA `subscribeToMore` workflows with tRPC subscriptions or event-triggered invalidation.

Workflow order:

1. live quiz block/settings updates
2. live quiz feedback events
3. microlearning ended/list updates
4. group activity started/ended/list updates

Do:

1. Migrate one subscriber component at a time.
2. Preserve payload filtering by quiz/activity/course id.
3. Prefer invalidation/refetch over manual cache surgery unless local state requires it.
4. Verify with two browser sessions.

Commit: one commit per realtime family.

### S05D Manage Realtime Migration

Goal: Replace manage cockpit/lecturer feedback subscriptions.

Likely scope:

- lecturer live quiz feedback pin/create/update events
- cockpit live quiz updates
- audience interaction feedback paths

Check:

```bash
rg -n "subscribeToMore|SubscribeToMoreOptions|useSubscription" apps/frontend-manage
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/frontend-manage check
```

Commit: `feat(api): migrate manage realtime to trpc`

### S05E Realtime GraphQL Client Gate

Goal: Remove app GraphQL WS client dependencies after no app subscriptions remain.

Gate:

```bash
rg -n "subscribeToMore|SubscribeToMoreOptions|useSubscription|GraphQLWsLink|graphql-ws" apps/frontend-control apps/frontend-manage apps/frontend-pwa
```

Do:

- Remove app `graphql-ws` deps only where gates are clean.
- Do not remove backend GraphQL WS until all apps and external consumers are clear.

Commit: `chore(apps): remove graphql ws clients`

### S05F Generated Type Leak Cleanup

Goal: Remove generated GraphQL type imports from migrated helpers and shared components.

Do:

1. Audit generated type-only imports.
2. Replace with `RouterOutputs`, domain types, or narrow structural types.
3. Keep mixed-consumer components structural until all callers are tRPC.

Check:

```bash
rg -n "@klicker-uzh/graphql/dist/ops" apps packages/shared-components packages/markdown
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
```

Commit: `chore(types): replace generated graphql type leaks`

### S05G App-Level Apollo Removal Gates

Goal: Remove Apollo app by app after each app has no active Apollo consumers.

Order:

1. frontend-control
2. frontend-pwa
3. frontend-manage

Gate per app:

```bash
rg -n "@apollo/client|ApolloProvider|useApollo|SSELink|GraphQLWsLink|@klicker-uzh/graphql" apps/<app>
```

Do:

- Remove app provider/helpers/deps only after the gate is clean except provider/helper/package files.
- Keep backend GraphQL and `packages/graphql` until all apps and server packages are clean.

Commit: one commit per app.

### S06A Final Backend and Package Cleanup Readiness Review

Goal: Decide whether final GraphQL removal is truly unblocked.

Do:

1. Run cleanup audits.
2. Check deployment/local-dev references.
3. Check external/public API assumptions with the user.
4. Record explicit approval or blocker in this plan.

Stop if:

- Any active consumer remains.
- Any production/staging compatibility requirement still needs GraphQL.
- Runtime browser verification for main flows has not passed.

Commit: `docs(project): record graphql cleanup readiness`

### S06B Remove Backend GraphQL Runtime

Goal: Remove `/api/graphql`, Yoga, persisted operations, GraphQL WS, and pubSub bridge after all consumers are gone.

Do:

1. Remove Yoga app mount and GraphQL WS setup.
2. Remove GraphQL-specific persisted operation loading.
3. Remove GraphQL-specific pubSub bridge code.
4. Keep tRPC endpoint and event bridge.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm --filter @klicker-uzh/backend-docker build
```

Commit: `chore(api): remove graphql backend runtime`

### S06C Remove `packages/graphql` and Codegen

Goal: Remove the GraphQL package and generated artifacts.

Do:

1. Remove workspace dependencies on `@klicker-uzh/graphql`.
2. Delete `packages/graphql`.
3. Remove GraphQL codegen scripts and Turbo dependencies.
4. Update lockfile.

Check:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --lockfile-only
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run build
```

Commit: `chore(api): remove graphql package`

### S06D Remove Final GraphQL Docs, Deploy, and Lockfile References

Goal: Clean up non-code references and dependency residue.

Do:

1. Update local dev docs from GraphQL API to tRPC API.
2. Update deployment manifests/charts if they expose GraphQL-specific env or routes.
3. Remove stale lockfile packages.
4. Keep historical project plan files unchanged except current progress notes.

Check:

```bash
rg -n "GraphQL|graphql|Apollo|apollo|/api/graphql|@klicker-uzh/graphql" apps packages deploy docs project package.json pnpm-lock.yaml turbo.json
```

Commit: `docs(api): remove graphql migration residue`

### S06E Final End-to-End Verification

Goal: Prove the repository works without GraphQL.

Required checks:

```bash
volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --frozen-lockfile
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:all
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run build
volta run --node 20.19.4 --pnpm 10.15.0 pnpm run test:run
```

Required browser flows:

- Manage delegated login, dashboard, course view.
- Manage create/edit representative activity.
- Manage live quiz cockpit if realtime remains.
- PWA participant login, course overview, practice quiz, microlearning, group activity.
- PWA live quiz with realtime updates using two sessions.
- Control course list/detail and live quiz control flow.

Required audits:

```bash
rg -n "@apollo/client|ApolloProvider|@klicker-uzh/graphql|graphql-yoga|graphql-ws|graphql-codegen|@pothos|/api/graphql" apps packages deploy docs project package.json pnpm-lock.yaml turbo.json
rg -n "@trpc|/api/trpc|TrpcProvider|createTRPC" apps packages package.json pnpm-lock.yaml
```

Commit: `docs(project): record final trpc verification`

### S07 MR/PR Finish

Goal: Prepare the branch for review/merge.

Do:

1. Run final security review.
2. Update this plan with final status and residual risks.
3. Use `$mr-description-writer` for the MR/PR body.
4. Include screenshots for UI-facing flows.
5. If an MR/PR ID becomes known, rename only the current plan file if the workflow requires ID in filename.

Commit:

- Metadata/documentation commit only if needed.

## Final Acceptance Criteria

- No active Apollo hooks/providers remain.
- No active generated GraphQL operation imports remain.
- No GraphQL endpoint or GraphQL WS server remains.
- No workspace package depends on `@klicker-uzh/graphql`.
- `packages/api` owns the public app API.
- All main manage/PWA/control workflows pass browser smoke.
- Realtime workflows pass with two-session verification where applicable.
- Full repository checks pass or any pre-existing external failures are documented with evidence.
- Cleanup audits are clean or contain only intentional historical documentation references.

## Residual Risks To Track

- Realtime behavior may be live-only without replay IDs; document reconnect limitations.
- Token/cookie behavior differs across manage, pwa, control, assessment, embedded, and LTI modes.
- Generated GraphQL types are deeply embedded in shared components; structural types will be safer during mixed state.
- Manage app has a wide mutation surface; migrate by workflow rather than package directory.
- Final GraphQL removal is production-risky and needs explicit user approval after soak.
