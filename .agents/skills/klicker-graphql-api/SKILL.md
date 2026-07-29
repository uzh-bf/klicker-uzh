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
     // asUser | asParticipant | asUserFullAccess | asUserSessionExec | asUserOwner | asUserWithCatalyst | asAdmin
     nullable: true,
     type: Course,
     args: { id: t.arg.string({ required: true }) },
     resolve: withPermission(
       (args) => ({ courseId: args.id }), // -> PermissionCheck key for the target object
       DB.PermissionLevel.ADMIN, // READ | EXECUTE | WRITE | ADMIN, per operation severity
       async (_, args, ctx) => CourseService.deleteCourse(args, ctx)
     ),
   })
   ```

   Participant-facing fields usually need only `t.withAuth(asParticipant)`. Note `withPermission` returns `null` on failure (client sees a null field, not an error) — don't "fix" that.

4. **Arg validation** — Zod plugin `validate:` on args (email/regex/length examples in `mutation.ts`).
5. **Client op** — new file `packages/graphql/src/graphql/ops/<Prefix><Name>.graphql`; prefix `Q`/`M`/`S`/`F` matches the kind. Reuse `F*` fragments where they exist.
6. **Codegen — never skip, always commit:**

   ```bash
   pnpm --filter @klicker-uzh/graphql generate
   ```

   Commit the regenerated `src/ops.ts`, `src/ops.schema.json`, `src/public/schema.graphql`, `src/public/client.json`, `src/public/server.json` **with** the change. Stale `server.json` = persisted-query rejection in prod modes; stale `ops.ts` = frontend typecheck failure.

7. **Frontend wiring** — `import { <Name>Document } from '@klicker-uzh/graphql/dist/ops'`; `useQuery`/`useMutation` (+ `refetchQueries`) per [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
8. **Tests** — graphql vitest for service logic (`pnpm --filter @klicker-uzh/graphql test:local`; see the heavy pattern in `38c92d035`); route further via `klicker-testing-verification`.

## CODE contract rule

CODE has three deliberate surfaces documented in [docs/graphql-api-layer.md](../../../docs/graphql-api-layer.md): full lecturer `CodeElement`, authenticated full instance `AuthoringCodeElementData`, and participant-safe `CodeElementData`. When changing a union, resolver, fragment, or operation, update every applicable surface and run `test/codeGraphqlContract.test.ts`. Participant operations may expose public tests and static execution limits, but must omit hidden tests and runtime sandbox/session artifacts.

## Subscriptions (extra steps)

Publish from the service (`ctx.pubSub.publish('<topic>', payload)`), subscribe in `subscription.ts` with a `filter` on the target id (template: `feedbackCreated`), consume with `subscribeToMore` + the generated `S*Document`.

## Debugging quick table

| Symptom                              | Likely cause                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `Unauthorized` GraphQLError          | layer-1 scope object mismatch (wrong role/scope for the caller)                |
| Field silently `null` for a lecturer | layer-2 `withPermission` failed (no ownership/grant at that `PermissionLevel`) |
| Op works in dev, rejected deployed   | stale/uncommitted `server.json` (step 6)                                       |
| Frontend can't find `*Document`      | codegen not run after adding the op                                            |
| Mutation fails `workflow not found`  | Hatchet worker missing → `klicker-environment-doctor` check 7                  |
