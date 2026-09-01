---
name: klicker-graphql-api
description: Add or change a GraphQL query, mutation, subscription, or type in KlickerUZH end-to-end. Use when touching packages/graphql (Pothos schema, services, ops), wiring a frontend to new API data, choosing auth scopes/permissions for a field, or debugging Unauthorized/null results and persisted-query rejections.
---

# KlickerUZH GraphQL API Work

Facts (auth ladder, layering, error conventions): [docs/graphql-api-layer.md](../../../docs/graphql-api-layer.md). This skill is the build order. Reference feature: commit `ff61d9bc7` (#4951) — read its diff when unsure what a complete change looks like.

## Build order (one endpoint, end-to-end)

1. **Service function** — `packages/graphql/src/services/<area>.ts`. All logic, Prisma, Redis, pubSub here. Signature `(args, ctx: ContextWithUser) => …`. Errors: `GraphQLError` with `extensions.code` (grep `LIVE_QUIZ_PIN_INVALID` for the pattern) — not bare `Error`.
2. **Schema field** — `packages/graphql/src/schema/query.ts` / `mutation.ts` / `subscription.ts` (+ new object types in the area file). The resolver is a **one-liner** delegating to the service.
3. **Auth on the field** — copy the existing composition exactly (real shape from `deleteCourse` in `mutation.ts`; `withPermission` WRAPS the resolver):

   ```ts
   deleteCourse: t.withAuth(asUser).field({
     // asUser | asParticipant | asUserFullAccess | asUserSessionExec | asUserOwner | asAdmin
     nullable: true,
     type: Course,
     args: {
       id: t.arg.string({ required: true }),
       deleteDraftActivities: t.arg.boolean(),
     },
     resolve: withPermission(
       (args) => ({ courseId: args.id }), // -> PermissionCheck key for the target object
       DB.PermissionLevel.ADMIN, // READ | EXECUTE | WRITE | ADMIN, per operation severity
       async (_, args, ctx) => CourseService.deleteCourse(args, ctx)
     ),
   })
   ```

   Participant-facing fields usually need only `t.withAuth(asParticipant)`. Note `withPermission` returns `null` on failure (client sees a null field, not an error) — don't "fix" that.

   Multi-object batch fields are the deliberate exception: `withPermission`
   accepts one object selector and can only return one nullable field. Protect
   the batch with the appropriate `t.withAuth(...)` scope, then have the service
   load a bounded set of unique objects, check every object's permission, and
   return explicit per-object outcomes. Never infer permission for the whole
   batch from one selected object.

   Answer-bearing fields require defense in depth: use the exact object-level
   `OWNER` gate in the schema and repeat the exact-owner predicate in the
   service query. UI visibility is not authorization.

   Escape Room participant mutations accept only the activity identity and action payload. Resolve ownership, the current attempt, active stack, timer, lockout, and preview authority from the authenticated server context; never add client-provided ownership or progression flags.

4. **Arg validation** — Zod plugin `validate:` on args (email/regex/length examples in `mutation.ts`).
   For activity element inputs, validate the resolved new, retained, and duplicated element types in the service before any write. Template instantiation is a separate input path and needs the same fail-closed check.
5. **Client op** — new file `packages/graphql/src/graphql/ops/<Prefix><Name>.graphql`; prefix `Q`/`M`/`S`/`F` matches the kind. Reuse `F*` fragments where they exist.
6. **Codegen — never skip:**

   ```bash
   pnpm --filter @klicker-uzh/graphql generate
   ```

   Commit the handwritten operation/schema sources and the regenerated `src/public/schema.graphql` snapshot. `src/ops.ts` and `src/public/{client,server}.json` are ignored build outputs; package builds regenerate them before Rollup. Stale `server.json` = persisted-query rejection in prod modes; stale `ops.ts` = frontend typecheck failure.

   For rolling-deployment compatibility, do not mutate an operation document
   already used by a deployed frontend when adding fields or variables. Add a
   newly named operation for the updated client and retain the original file so
   its persisted hash remains in `server.json`.

7. **Frontend wiring** — `import { <Name>Document } from '@klicker-uzh/graphql/dist/ops'`; `useQuery`/`useMutation` (+ `refetchQueries`) per [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
8. **Tests** — graphql vitest for service logic (`pnpm --filter @klicker-uzh/graphql test:local`; see the heavy pattern in `38c92d035`); route further via `klicker-testing-verification`.

For pagination changes, test both finite `take`/`skip` values and omitted
values in the service, and verify that the generated operation variables and
public schema make the arguments optional. Do not emulate an unbounded query
with a large numeric limit.

## Subscriptions (extra steps)

Publish from the service (`ctx.pubSub.publish('<topic>', payload)`), subscribe in `subscription.ts` with a `filter` on the target id (template: `feedbackCreated`), consume with `subscribeToMore` + the generated `S*Document`.

## Debugging quick table

| Symptom                              | Likely cause                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `Unauthorized` GraphQLError          | layer-1 scope object mismatch (wrong role/scope for the caller)                |
| Field silently `null` for a lecturer | layer-2 `withPermission` failed (no ownership/grant at that `PermissionLevel`) |
| Op works in dev, rejected deployed   | package build did not regenerate `server.json` (step 6)                        |
| Frontend can't find `*Document`      | codegen not run after adding the op                                            |
| Mutation fails `workflow not found`  | Hatchet worker missing → `klicker-environment-doctor` check 7                  |
