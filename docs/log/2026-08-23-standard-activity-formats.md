# Standard activity formats

**Date:** 2026-08-23

## What changed

Practice Quiz, Microlearning, and Group Activity are now standard capabilities:
creation, editing, and lifecycle management are available to all authenticated
users with full account access, regardless of Catalyst entitlement. See
[ADR 0037](../adr/0037-standard-activity-formats.md) for the decision record.

The `asUserWithCatalyst` auth-scope shorthand was removed from
`packages/graphql/src/schema/mutation.ts`; all 22 activity-lifecycle mutation
gates now use `.withAuth(asUserFullAccess)` directly. The `catalyst` scope in
`packages/graphql/src/builder.ts` is unchanged and remains available for
other Catalyst-gated surfaces.

## Why

Catalyst is being reserved for advanced capabilities (AI, learning analytics,
and future developments), while these three formats become the free tier's core
activity types alongside live quizzes.
