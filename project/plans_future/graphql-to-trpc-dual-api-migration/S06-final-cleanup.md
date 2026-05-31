# S06 Final Cleanup

## Goal

Remove GraphQL only after the migration is complete and audited. This slice is intentionally late and should be blocked until every active app workflow has moved to tRPC and realtime is covered.

## Dependencies

- S01 complete.
- S02 complete.
- S03 complete.
- All required S04 vertical migrations complete.
- S05 realtime migration complete if subscriptions are still used.
- Production/staging soak or explicit user approval for final removal.

## Cleanup Gates

All audits must be clean or every remaining hit must be documented as intentionally retained:

```bash
rg -n "@apollo/client|ApolloProvider|useQuery|useMutation|useSubscription" apps packages
rg -n "src/graphql/ops|ops\\.ts|ops\\.schema|client\\.json|server\\.json|graphql-codegen|TypedDocumentNode" apps packages
rg -n "graphql-yoga|graphql-ws|@graphql-yoga|@pothos|graphql-scalars|@klicker-uzh/graphql" apps packages package.json pnpm-lock.yaml turbo.json
rg -n "/api/graphql|graphqlEndpoint|GraphQL API" apps packages deploy util docs project
```

## Write Scope

- Remove GraphQL server mount from backend.
- Remove GraphQL WS setup.
- Remove Apollo providers and generated operation imports.
- Delete GraphQL operation/codegen files.
- Remove GraphQL dependencies and lockfile entries.
- Update docs/deploy references.
- Update migration plan with final verification evidence.

## Avoid Scope

- Do not combine final cleanup with new domain behavior.
- Do not remove external/public GraphQL compatibility without explicit confirmation.
- Do not skip browser verification because typechecks pass.

## Implementation Checklist

1. Freeze/record the final operation audit.
2. Remove app Apollo providers and packages.
3. Remove backend GraphQL mount and WS server.
4. Remove `packages/graphql` only after no workspace package depends on it.
5. Remove codegen scripts and generated artifacts.
6. Update `turbo.json`, package manifests, lockfile, deploy docs, and local dev docs.
7. Run full checks.
8. Smoke the main workflows in browser:
   - lecturer manage login and dashboard
   - student PWA login/course flow
   - control app live/session flow
   - realtime path if still present

## Acceptance Criteria

- All GraphQL cleanup audits are clean or documented.
- Full build/check suite passes or pre-existing failures are documented with evidence.
- Browser verification passes for main workflows.
- Rollback plan is explicit because this is the first slice that removes the old API.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run lint
pnpm run build
pnpm run test:run
rg -n "@apollo/client|graphql-yoga|graphql-ws|graphql-codegen|@pothos|@klicker-uzh/graphql|/api/graphql" apps packages package.json pnpm-lock.yaml turbo.json
```

## Agent Prompt

Execute S06 only after all previous slices are merged and the cleanup audits show no active GraphQL consumers. Remove GraphQL, run full verification, perform browser smoke checks, document any intentional remaining references, and stop if any audit result indicates an active dependency.
