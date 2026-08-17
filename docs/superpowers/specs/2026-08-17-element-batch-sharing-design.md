---
type: Feature Design
title: Element Batch Sharing
description: Add permission sharing to element batch operations with per-element outcomes and skip reasons.
timestamp: '2026-08-17'
tags:
  - frontend-manage
  - graphql
  - sharing
  - elements
---

# Element Batch Sharing

## Goal

Let lecturers grant the same direct permission on multiple selected Elements
from the existing element batch-operations modal. Sharing can be used alone or
combined with the existing archive, status, multiplier, and base-points
operations. Users must see which Elements were not shared and why.

Archive, status, multiplier, and base points are existing, independent Element
updates. They are listed only to define which actions can share the same Apply
button; permission sharing does not change their meaning or eligibility rules.

## Non-goals

- Batch sharing activities, courses, collections, or catalog objects.
- Revoking permissions, transferring ownership, or changing several recipients
  in one batch.
- Adding propagation controls. Element sharing does not expose propagation.
- Making existing element updates and permission grants atomic as one unit.
- Changing the Prisma schema, gamification, Hatchet workflows, or seed data.

## Domain and authorization

The batch operates on source `Element` records, not published
`ElementInstance` snapshots. The target is exactly one lecturer, identified by
shortname or email, or one `UserGroup`. Every successful grant uses one selected
`PermissionLevel` for all eligible Elements.

The mutation requires an authenticated lecturer with full account access. For
each Element, the server rechecks the caller's derived permission and requires
`ADMIN` or `OWNER`; frontend flags are advisory only. Element type, review
status, archive state, and instance usage do not affect sharing eligibility.

Existing permissions are upserted. Re-sharing an Element with the same target
updates the permission level rather than creating a duplicate. Self-sharing,
unknown users, and inaccessible groups remain invalid exactly as in direct
sharing.

## User experience

The existing element batch-operations modal gains an optional sharing card,
shown under the same `privatePreview` gate as direct element sharing. Enabling
the card reveals:

- a mutually exclusive lecturer or user-group target;
- a permission-level selector with the existing element-sharing choices; and
- no propagation control.

The selected-elements list computes sharing eligibility independently from the
other selected actions. A row can therefore say that a status change will be
applied while sharing will be skipped because the caller lacks `ADMIN` or
`OWNER` access. The Apply button remains disabled until at least one action is
configured, all enabled action forms are valid, and at least one selected
action has an eligible Element. A share-only batch with no manageable Elements
therefore explains the skips but cannot be submitted.

Apply coordinates the existing element-update mutation and a new element
batch-sharing mutation. When both are selected, it invokes them sequentially
with isolated error capture so a thrown result does not suppress the other
call. The calls have independent outcomes and are not wrapped in a
cross-mutation transaction. This preserves valid existing updates when sharing
is inapplicable to an Element and preserves valid grants when another batch
action fails.

On complete success, the modal keeps today's behavior: refetch the Elements,
clear the selection, show a success toast, and close. If sharing is skipped or
either operation fails, the modal refetches but keeps the parent selection until
Close and switches to a read-only result view. It uses an immutable copy of the
original selection and shows:

- exact per-Element sharing outcomes and localized reasons;
- the existing element-update operation's full, partial, or failed aggregate
  result; and
- a Close action instead of another Apply action, preventing accidental
  repetition of version-changing updates.

## API contract

Add an `asUserFullAccess` GraphQL mutation with this logical shape:

```graphql
shareElementsBatch(
  elementIds: [Int!]!
  permissionLevel: PermissionLevel!
  shortnameOrEmail: String
  userGroupId: Int
): ElementBatchSharingResult!
```

Exactly one target field must be set. `ElementBatchSharingResult` contains a
nullable target-level error and one outcome for every unique requested Element
ID when the target is valid. Each outcome contains the Element ID, a status,
and an optional reason:

- `SHARED`;
- `SKIPPED / INSUFFICIENT_PERMISSION`;
- `SKIPPED / ELEMENT_NOT_FOUND_OR_DELETED`; or
- `FAILED / SHARING_FAILED`.

Target-level reason codes cover an invalid or self target and an unavailable
user group. The UI maps all codes to German and English text. Internal database
or recomputation errors are logged server-side and exposed only as the generic
`SHARING_FAILED` reason.

The hand-written operation file is named `MShareElementsBatch.graphql`; in line
with repository conventions, its operation is `ShareElementsBatch` and its
generated document is `ShareElementsBatchDocument`. GraphQL code generation
artifacts and persisted-query maps are committed with the change.

## Service design and consistency

Refactor the common core of the existing `shareObject` service into an internal
helper used by direct and batch sharing. Direct sharing keeps its current API
and behavior.

The batch service:

1. validates and resolves the target once;
2. loads the requested non-deleted Elements and the caller's derived permission
   levels in a bounded query;
3. creates a deterministic outcome for every requested ID;
4. processes each eligible Element in its own transaction; and
5. emits permission invalidation after each successful transaction.

Every successful transaction preserves the existing sharing invariants:

- upsert the direct user or group permission with `propagation: false`;
- for an individual target, delete matching pending access requests; group
  targets retain the existing object-wide recomputation behavior;
- recompute derived permissions for the Element and target;
- create a `PERMISSION_GRANTED` audit-log entry; and
- return the updated permission as a successful outcome.

One Element transaction failing does not roll back successful grants on other
Elements. Processing remains bounded and sequential because derived-permission
recomputation already requires careful transaction ordering. Duplicate input
IDs are normalized before processing; outcomes follow the unique IDs' first-seen
order.

## Layer footprint

- `packages/graphql`: Pothos result types and enums, mutation, sharing service,
  GraphQL operation, generated schema/client artifacts, and integration tests.
- `apps/frontend-manage`: batch-sharing card, form state, action-specific
  eligibility, Apply orchestration, result view, and cache/refetch handling.
- `packages/i18n`: German and English labels, validation messages, outcome
  reasons, and summary text.
- `playwright`: one real-browser element batch-sharing flow.
- `apps/docs` and `docs`: update the element batch-operations tutorial and the
  engineering sharing/API contract.

No Prisma migration, shared-type package change, Hatchet task, gamification
change, or seed addition is expected.

## Error handling

Client-side validation prevents missing or ambiguous targets and self-sharing
when the current profile makes that detectable. The server repeats all target
and permission validation.

Known target errors produce no permission writes. Known per-Element eligibility
errors are returned as `SKIPPED`. Unexpected per-Element transaction errors are
logged with the Element ID and returned as `FAILED / SHARING_FAILED` without
exposing internal details. Failure of one coordinated mutation does not hide the
other mutation's result.

The result screen and warning summary distinguish:

- all requested operations succeeded;
- existing updates succeeded but some sharing was skipped;
- sharing succeeded but an existing update operation failed; and
- both operation groups had failures.

## Verification

Add database-backed GraphQL integration coverage for:

- individual and user-group targets;
- mixed `ADMIN`/`OWNER` and lower-permission Elements;
- existing permission updates without duplicates;
- unknown and self targets and inaccessible groups;
- missing or deleted Elements;
- audit-log creation and derived-permission recomputation; and
- success, skipped, and failed result mapping.

Extend the existing Playwright element batch-operations scenario to select
Elements with different sharing permissions, combine a status change with a
sharing grant, verify the pre-apply skip reason, verify the read-only partial
result, reload, and confirm that only eligible Elements have the new permission.

Verification commands will include GraphQL code generation, targeted GraphQL
tests, filtered frontend/GraphQL type checks, formatting and lint checks, and a
real Manage UI run through devrouter. Capture desktop screenshots of the
configured sharing card and partial result state. No mock-heavy test layer or
new test dependency is required.

## Documentation

Update the element batch-operations tutorial with the sharing workflow,
eligibility rule, and partial-result behavior. Update the relevant engineering
wiki API/sharing page so the batch result and transaction boundary are explicit.
