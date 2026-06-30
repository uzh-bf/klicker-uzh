# S05 Realtime Migration

## Goal

Support tRPC subscriptions without breaking existing GraphQL subscriptions. Realtime migration should first decouple event publishing from GraphQL-specific pubsub, then expose subscription procedures and migrate clients.

## Dependencies

- S01 complete.
- S02 complete.
- S03 complete for target apps.
- Relevant S04 query/mutation verticals complete enough for subscription invalidation.

## Write Scope

- Event bridge utilities in `packages/api` or a shared server-only package, depending on audit results
- Backend event wiring in `apps/backend-docker`
- tRPC subscription routers
- One realtime client workflow at a time

## Avoid Scope

- Do not remove `graphql-ws` while any GraphQL subscription remains.
- Do not change live quiz semantics while changing transport.
- Do not collapse backend event bus and client migration into one large unreviewable change.

## Implementation Checklist

1. Audit GraphQL subscriptions and their payloads.
2. Identify event publishers and whether they publish through GraphQL pubSub, EventEmitter, Redis event target, or Hatchet task handlers.
3. Introduce a GraphQL-independent event envelope:
   - event name
   - domain key
   - payload DTO
   - timestamp if useful
4. Bridge current publishers so GraphQL subscribers keep receiving the old payloads.
5. Add tRPC subscription procedures for one realtime workflow.
6. Configure client subscription link in the relevant app.
7. Use subscription events to invalidate/refetch the same data the GraphQL subscription updated.
8. Verify with two browser sessions when practical.

## Acceptance Criteria

- Old GraphQL subscription clients continue to work.
- New tRPC subscription client works for the migrated workflow.
- Event payloads are documented and DTO-shaped.
- Reconnect/live-only limitations are documented if there is no replayable event id.

## Verification

```bash
rg -n "useSubscription|Subscription|pubSub|createPubSub|graphql-ws|httpSubscriptionLink|splitLink" apps packages
pnpm --filter @klicker-uzh/api check
pnpm --filter <target-app> check
pnpm --filter <target-app> build
```

Browser verification should include two sessions for live update paths when local seeded data and dev services are available.

## Agent Prompt

Implement one realtime migration slice. Keep GraphQL subscriptions active, introduce or reuse a transport-neutral event bridge, add the tRPC subscription, migrate one client workflow, and verify that both old and new realtime paths still function.
