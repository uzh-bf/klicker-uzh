# Element Batch Sharing Implementation Plan

> **For agentic workers:** REQUIRED SKILLS: use `klicker-graphql-api` for
> Tasks 1–2, `klicker-frontend-ui` for Tasks 3–4,
> `klicker-playwright-e2e` for the browser test, and
> `klicker-testing-verification` plus `klicker-wiki-maintenance` for Task 5.
> The repository forbids Superpowers plugin skills. Track every step with the
> checkbox syntax below.

**Goal:** Let lecturers grant one permission to one lecturer or user group
across selected Elements from the existing batch-operations modal, with
independent update/sharing eligibility and exact sharing skip reasons.

**Architecture:** Keep the existing element-update mutation unchanged and add
an element-specific batch-sharing mutation. The Manage modal coordinates both
mutations through one Apply button, displays action-specific preflight state,
and switches to a read-only result view on any partial or failed outcome.

**Tech Stack:** TypeScript 6, Prisma 7, Pothos GraphQL 4, Apollo Client 3,
Next.js 16/React 19, next-intl 4, UZH BF design system, Vitest 3, Playwright
1.58, pnpm 11, devrouter.

## Global Constraints

- Operate on source `Element` records only; do not change `ElementInstance`
  semantics.
- Sharing is optional and independent from archive, status, multiplier, and
  base-points updates.
- Require server-side derived `ADMIN` or `OWNER` permission per Element.
- Accept exactly one target: `shortnameOrEmail` or `userGroupId`.
- Expose READ, WRITE, and ADMIN in the element UI; do not add propagation.
- Upsert existing direct permissions with `propagation: false`.
- Preserve direct-sharing behavior for every existing object type.
- Resolve the target once, process eligible Elements sequentially in one
  transaction per Element, and return deterministic per-ID outcomes.
- Do not add dependencies, a Prisma migration, shared package types, Hatchet
  work, gamification changes, or seed data.
- Gate the batch-sharing UI with `userProfile.privatePreview`, matching direct
  element sharing.
- Add German and English text and stable `data-cy` selectors.
- Run every pnpm command below inside the DevPod through `devrouter exec . --`.
- Context7 is required by repository policy but is unavailable in this session;
  implementation must re-check the pinned library APIs if Context7 becomes
  available before editing framework integration code.

## Stack topology and execution prerequisite

This is a cross-layer change with two independently testable reviewer surfaces.
Use the repository's native stack workflow once `$stacked-change` and
`$gh-stack` are available:

1. **Layer 1 — `feat/element-batch-sharing`:** approved specification,
   GraphQL service/contract, integration tests, generated operations, and API
   wiki update.
2. **Layer 2 — `feat/element-batch-sharing-ui`:** Manage UI, i18n, Playwright,
   user documentation, screenshots, and final verification.

The topology owner is the current workspace at
`/Users/paldov/.codex/worktrees/f8ad/klicker-uzh`. Do not create the child layer
or publish PRs until the user approves this topology. The named stack skills are
not available in the current session; do not improvise stack commands. If the
user explicitly authorizes a normal single PR instead, execute every task on
`feat/element-batch-sharing` and retain the work-package commit boundaries.

---

## File structure

### Layer 1: GraphQL batch-sharing capability

- Create `packages/graphql/test/elementBatchSharing.test.ts`: isolated
  database-backed coverage of the service contract and permission invariants.
- Modify `packages/graphql/src/services/sharing.ts`: extract target resolution
  and one-object grant helpers; add the batch service and exported result types.
- Modify `packages/graphql/src/schema/sharing.ts`: expose result enums and
  object types.
- Modify `packages/graphql/src/schema/mutation.ts`: expose the authenticated
  batch mutation without a single-object `withPermission` wrapper.
- Create `packages/graphql/src/graphql/ops/MShareElementsBatch.graphql`: typed
  client operation.
- Regenerate `packages/graphql/src/ops.ts`,
  `packages/graphql/src/ops.schema.json`,
  `packages/graphql/src/public/schema.graphql`,
  `packages/graphql/src/public/client.json`, and
  `packages/graphql/src/public/server.json`.
- Modify `docs/graphql-api-layer.md`: document target-level versus per-item
  errors and the one-transaction-per-Element boundary.

### Layer 2: Manage UI and end-to-end verification

- Modify
  `apps/frontend-manage/src/components/elements/manipulation/types.ts`: sharing
  configuration, applicability, snapshot, and execution-result types.
- Create
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchSharingCard.tsx`:
  controlled target and permission configuration only.
- Modify
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/SelectedElementsList.tsx`:
  separate update and sharing eligibility indicators.
- Create
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchOperationsResult.tsx`:
  immutable read-only outcome display.
- Modify
  `apps/frontend-manage/src/components/elements/manipulation/ElementBatchOperationsModal.tsx`:
  action coordination and result-mode state machine.
- Modify `apps/frontend-manage/src/pages/index.tsx`: retain the selection while
  the result screen is open and clear it on Close.
- Modify `packages/i18n/messages/en.ts` and
  `packages/i18n/messages/de.ts`: localized configuration, validation, and
  result strings.
- Modify `playwright/tests/X-review.spec.ts`: mixed-permission combined
  status-and-sharing browser flow.
- Modify `apps/docs/docs/tutorials/element_batch_operations.mdx`: explain
  sharing and independent eligibility.
- Create `docs/log/2026-08-17-element-batch-sharing.md`: durable change record
  linked to the API and tutorial documentation.

---

### Task 1: Batch-sharing service and permission invariants

**Work package:** Layer 1

**Files:**

- Create: `packages/graphql/test/elementBatchSharing.test.ts`
- Modify: `packages/graphql/src/services/sharing.ts:4012-4593`
- Regression test:
  `packages/graphql/test/elementSharing.test.ts`

**Interfaces:**

- Consumes: `ContextWithUser`, `DB.PermissionLevel`, `DerivedPermission`,
  `recomputeDerivedPermissions`, and the existing permission/audit schema.
- Produces:

```ts
export const elementBatchSharingStatuses = [
  'SHARED',
  'SKIPPED',
  'FAILED',
] as const

export const elementBatchSharingReasons = [
  'INSUFFICIENT_PERMISSION',
  'ELEMENT_NOT_FOUND_OR_DELETED',
  'SHARING_FAILED',
] as const

export const elementBatchSharingTargetErrors = [
  'INVALID_OR_SELF_TARGET',
  'USER_GROUP_UNAVAILABLE',
] as const

export interface ElementBatchSharingOutcome {
  elementId: number
  status: (typeof elementBatchSharingStatuses)[number]
  reason?: (typeof elementBatchSharingReasons)[number] | null
}

export interface ElementBatchSharingResult {
  targetError?: (typeof elementBatchSharingTargetErrors)[number] | null
  outcomes: ElementBatchSharingOutcome[]
}

export async function shareElementsBatch(
  args: {
    elementIds: number[]
    permissionLevel: DB.PermissionLevel
    shortnameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser
): Promise<ElementBatchSharingResult>
```

- Internal boundaries:

```ts
type ResolvedSharingTarget =
  | {
      kind: 'USER'
      id: string
      shortname: string
      email: string
    }
  | {
      kind: 'USER_GROUP'
      id: number
      name: string
    }

type ShareableObjectSelector =
  | { catalogCollectionId: string }
  | { answerCollectionId: number }
  | { elementId: number }
  | { courseId: string }
  | { liveQuizId: string }
  | { practiceQuizId: string }
  | { microLearningId: string }
  | { groupActivityId: string }
```

- [ ] **Step 1: Write the failing mixed-permission service test**

Create the Vitest lifecycle with `initializePrisma`, `testInitialization`, and
`testCleanup`. Seed four Elements in first-seen input order: caller ADMIN,
missing ID, caller OWNER, duplicate ADMIN, caller WRITE, and deleted. Assert:

```ts
expect(result).toEqual({
  targetError: null,
  outcomes: [
    { elementId: adminId, status: 'SHARED', reason: null },
    {
      elementId: missingId,
      status: 'SKIPPED',
      reason: 'ELEMENT_NOT_FOUND_OR_DELETED',
    },
    { elementId: ownerId, status: 'SHARED', reason: null },
    {
      elementId: writeId,
      status: 'SKIPPED',
      reason: 'INSUFFICIENT_PERMISSION',
    },
    {
      elementId: deletedId,
      status: 'SKIPPED',
      reason: 'ELEMENT_NOT_FOUND_OR_DELETED',
    },
  ],
})
```

Use input
`[adminId, missingId, ownerId, adminId, writeId, deletedId]` and assert only
the owner/admin Elements receive a direct permission for `userTwo`.

- [ ] **Step 2: Run the test and confirm the red state**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- elementBatchSharing.test.ts
```

Expected: FAIL because `shareElementsBatch` and its result types are not
exported.

- [ ] **Step 3: Extract target resolution without changing direct sharing**

Move the user lookup at `sharing.ts:4042-4059` and group lookup at
`sharing.ts:4323-4339` behind:

```ts
async function resolveSharingTarget(
  args: {
    shortnameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: Pick<ContextWithUser, 'prisma' | 'user'>,
  mode: 'DIRECT' | 'EXACTLY_ONE'
): Promise<{
  target: ResolvedSharingTarget | null
  error: ElementBatchSharingResult['targetError']
}>
```

`DIRECT` preserves the current user-first behavior and returns the same `null`
result to `shareObject`. `EXACTLY_ONE` rejects neither/both targets and
unknown/self users with `INVALID_OR_SELF_TARGET`; missing or inaccessible
groups return `USER_GROUP_UNAVAILABLE`.

- [ ] **Step 4: Extract the caller-owned transaction helper**

Move the current user/group permission upsert, recomputation, and audit logic
behind:

```ts
async function grantObjectPermission(
  args: {
    object: ShareableObjectSelector
    target: ResolvedSharingTarget
    permissionLevel: DB.PermissionLevel
    propagation: boolean
    sourceUserId: string
  },
  prisma: PrismaTransactionClient
): Promise<DB.Permission>
```

For user targets, delete matching access requests and scope recomputation by
`userId`. For groups, preserve the current object-wide recomputation behavior.
Set `updateAccessRequests` only when the granted level is `ADMIN`. Keep the
existing audit type, object mapping, target fields, and messages.

- [ ] **Step 5: Rebuild `shareObject` on the two helpers**

Keep its public arguments, nullable return, 60-second transaction timeout,
Permission invalidation event, and `PermissionInfo` mapping unchanged. Emit
invalidation after transaction commit. If invalidation throws, log it without
turning a committed permission into a failed grant.

- [ ] **Step 6: Implement `shareElementsBatch` minimally**

Normalize IDs with `[...new Set(elementIds)]`. Resolve the target once, then
load non-deleted Elements and the caller's filtered derived permissions in one
query. Iterate the normalized IDs rather than Prisma result order. Return known
skips before starting a transaction. For each eligible ID, run
`grantObjectPermission` sequentially in its own 60-second transaction with
`propagation: false`, catch/log unexpected failures with the Element ID, and
continue.

- [ ] **Step 7: Run the mixed test and make it green**

Run the command from Step 2.

Expected: PASS with ordered, deduplicated outcomes and two permission writes.

- [ ] **Step 8: Add target-validation table tests**

Cover these exact inputs and results without permission writes:

```ts
const invalidTargets = [
  {
    args: {},
    targetError: 'INVALID_OR_SELF_TARGET',
  },
  {
    args: { shortnameOrEmail: userOne.shortname, userGroupId: 1 },
    targetError: 'INVALID_OR_SELF_TARGET',
  },
  {
    args: { shortnameOrEmail: userOne.shortname },
    targetError: 'INVALID_OR_SELF_TARGET',
  },
  {
    args: { shortnameOrEmail: 'missing-lecturer' },
    targetError: 'INVALID_OR_SELF_TARGET',
  },
  {
    args: { userGroupId: 999_999 },
    targetError: 'USER_GROUP_UNAVAILABLE',
  },
] as const
```

Also create a real group unrelated to the caller and assert
`USER_GROUP_UNAVAILABLE`.

- [ ] **Step 9: Add upsert and individual-invariant tests**

Preseed one READ permission and pending `AccessRequest`, share WRITE, then
assert one updated direct permission, no matching request, one derived WRITE
permission, one `PERMISSION_GRANTED` audit row with source/target/object IDs,
and one post-commit Permission invalidation.

- [ ] **Step 10: Add accessible-group tests**

Create one group for each caller relationship—owner, admin, and member—and
assert all are accepted. For one group, re-share the same Element at a new level
and assert a single direct group permission, `propagation: false`, derived
permissions for group members, audit target group ID, and invalidation.

- [ ] **Step 11: Add one localized failure-isolation test**

Use a scoped `vi.spyOn(prisma, '$transaction')` only to let the first real
transaction complete and reject the second. Restore the spy in `finally`.
Assert the first grant persists as `SHARED`, the second is
`FAILED / SHARING_FAILED`, no internal message is returned, and invalidation
exists only for the committed grant. This single spy tests the otherwise
unreachable partial-failure contract without adding a mock layer or dependency.

- [ ] **Step 12: Run batch and direct-sharing regression suites**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- elementBatchSharing.test.ts elementSharing.test.ts resourceSharing.test.ts activitySharing.test.ts courseSharing.test.ts
```

Expected: all selected files PASS; direct sharing remains unchanged for every
object selector.

### Task 2: GraphQL contract, generated client, and API documentation

**Work package:** Layer 1

**Files:**

- Modify: `packages/graphql/src/schema/sharing.ts:11-167`
- Modify: `packages/graphql/src/schema/mutation.ts:78-88,1258-1272`
- Create: `packages/graphql/src/graphql/ops/MShareElementsBatch.graphql`
- Regenerate: `packages/graphql/src/ops.ts`
- Regenerate: `packages/graphql/src/ops.schema.json`
- Regenerate: `packages/graphql/src/public/schema.graphql`
- Regenerate: `packages/graphql/src/public/client.json`
- Regenerate: `packages/graphql/src/public/server.json`
- Modify: `docs/graphql-api-layer.md:31-46`

**Interfaces:**

- Consumes: Task 1 result constants, interfaces, and `shareElementsBatch`.
- Produces: `ShareElementsBatchDocument` and generated
  `ShareElementsBatchMutation` types for Layer 2.

- [ ] **Step 1: Add a failing schema-contract assertion**

Add to `elementBatchSharing.test.ts`:

```ts
const field = schema.getMutationType()?.getFields().shareElementsBatch
expect(field).toBeDefined()
expect(String(field?.type)).toBe('ElementBatchSharingResult!')
expect(field?.args.map((arg) => arg.name).sort()).toEqual(
  ['elementIds', 'permissionLevel', 'shortnameOrEmail', 'userGroupId'].sort()
)
```

Run the targeted test and expect FAIL because the schema field does not exist.

- [ ] **Step 2: Expose result enums and objects in Pothos**

In `schema/sharing.ts`, create literal-backed enums from Task 1 constants and
object refs with these fields:

```ts
ElementBatchSharingOutcome: {
  elementId: Int!
  status: ElementBatchSharingStatus!
  reason: ElementBatchSharingReason
}

ElementBatchSharingResult: {
  targetError: ElementBatchSharingTargetError
  outcomes: [ElementBatchSharingOutcome!]!
}
```

Use `builder.enumType`, an `objectRef` followed by `implement`, `t.exposeInt`,
and `t.expose` following the existing `PermissionInfo` pattern.

- [ ] **Step 3: Add the authenticated mutation**

Import `ElementBatchSharingResult` and add after
`applyElementBatchOperations`:

```ts
shareElementsBatch: t.withAuth(asUserFullAccess).field({
  type: ElementBatchSharingResult,
  args: {
    elementIds: t.arg.intList({ required: true }),
    permissionLevel: t.arg({ type: PermissionLevel, required: true }),
    shortnameOrEmail: t.arg.string({ required: false }),
    userGroupId: t.arg.int({ required: false }),
  },
  resolve: (_, args, ctx) => SharingService.shareElementsBatch(args, ctx),
}),
```

Do not use `withPermission`: per-ID authorization belongs in the service so the
mutation can return skips.

- [ ] **Step 4: Add the client operation**

Create exactly:

```graphql
mutation ShareElementsBatch(
  $elementIds: [Int!]!
  $permissionLevel: PermissionLevel!
  $shortnameOrEmail: String
  $userGroupId: Int
) {
  shareElementsBatch(
    elementIds: $elementIds
    permissionLevel: $permissionLevel
    shortnameOrEmail: $shortnameOrEmail
    userGroupId: $userGroupId
  ) {
    targetError
    outcomes {
      elementId
      status
      reason
    }
  }
}
```

- [ ] **Step 5: Verify the FULL_ACCESS scope gate**

Resolve the schema field directly. Clone `userOneCtx` with
`user.scope = DB.UserLoginScope.READ_ONLY` and assert the resolver rejects with
`Unauthorized`. Call the same resolver with the original FULL_ACCESS or
ACCOUNT_OWNER context and valid arguments, then assert it reaches the service
and returns a typed result. This proves the Pothos scope wrapper without adding
a second API harness.

- [ ] **Step 6: Generate and inspect all tracked artifacts**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql generate
git diff -- packages/graphql/src/ops.ts packages/graphql/src/ops.schema.json packages/graphql/src/public/schema.graphql packages/graphql/src/public/client.json packages/graphql/src/public/server.json
```

Expected: the new enums, result types, mutation, typed document, and persisted
query appear; no unrelated schema drift is present.

- [ ] **Step 7: Document the API boundary**

Add a `Batch mutations with per-item outcomes` subsection to
`docs/graphql-api-layer.md` stating that target errors prevent all writes,
known per-ID eligibility errors are `SKIPPED`, unexpected per-ID transaction
errors are `FAILED`, each successful Element commits independently, and the UI
may coordinate this mutation with `applyElementBatchOperations` without
cross-mutation atomicity.

- [ ] **Step 8: Verify Layer 1**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- elementBatchSharing.test.ts elementSharing.test.ts resourceSharing.test.ts activitySharing.test.ts courseSharing.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
pnpm exec prettier --check docs/graphql-api-layer.md
```

Expected: all commands exit 0.

- [ ] **Step 9: Review and commit Layer 1**

Inspect `git diff`, `git diff --check`, generated artifacts, staged content,
and all data-bearing files for secrets or personal data. Commit:

```bash
git add packages/graphql/src packages/graphql/test/elementBatchSharing.test.ts docs/graphql-api-layer.md docs/superpowers
git commit -m "feat(graphql): add element batch sharing"
```

Do not publish or create the child layer until a separate reviewer accepts the
API result and direct-sharing regression evidence.

### Task 3: Sharing card, state contract, i18n, and red browser test

**Work package:** Layer 2

**Files:**

- Modify:
  `apps/frontend-manage/src/components/elements/manipulation/types.ts:135-155`
- Create:
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchSharingCard.tsx`
- Modify: `packages/i18n/messages/en.ts:1850-1930`
- Modify: `packages/i18n/messages/de.ts:1860-1940`
- Modify: `playwright/tests/X-review.spec.ts:827-1442`

**Interfaces:**

- Consumes: `ShareElementsBatchMutation`, `PermissionLevel`, `ObjectType`,
  `GetUserGroupsUserDocument`, `UserProfileDocument`, and
  `usePermissionLevelSelection`.
- Produces:

```ts
export type ElementBatchSharingTarget =
  | { type: 'USER'; shortnameOrEmail: string }
  | { type: 'USER_GROUP'; userGroupId: number }

export type ElementBatchSharingAction = {
  enabled: boolean
  permissionLevel: PermissionLevel
  target?: ElementBatchSharingTarget
}

export const INITIAL_ELEMENT_BATCH_SHARING: ElementBatchSharingAction = {
  enabled: false,
  permissionLevel: PermissionLevel.Read,
  target: undefined,
}
```

- [ ] **Step 1: Add the failing Playwright scenario**

During the existing element batch setup, share `data.MCML.title` with `pro2` as
ADMIN and `data.NRML.title` with `pro2` as WRITE. Before the activity-batch reset,
add one test titled `Batch-share elements with independent eligibility` that:

1. logs in with `loginInstitutionalCatalyst` (`pro2`);
2. selects MCML and NRML;
3. enables a status update and batch sharing to `pro1` at READ;
4. expects both update checks, MCML's sharing check, and NRML's sharing skip;
5. applies and expects FULL update, MCML SHARED, NRML
   SKIPPED/INSUFFICIENT_PERMISSION;
6. expects configuration and Apply controls to be absent in result mode;
7. closes, reloads, logs in with `loginIndividualCatalyst`, and confirms MCML
   is visible while NRML is absent.

Use these stable IDs:

```text
element-batch-sharing-checkbox
element-batch-sharing-username-or-email
element-batch-sharing-user-group
element-batch-sharing-permission-level
element-batch-sharing-check-${name}
element-batch-sharing-x-${name}
element-batch-result
element-batch-update-result
element-batch-sharing-result-${name}
close-batch-operations-result
```

- [ ] **Step 2: Run the browser test and confirm the red state**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/playwright test:run:raw tests/X-review.spec.ts --project=chromium --grep "Prepare elements for element list batch operations|Batch-share elements"
```

Expected: FAIL because `element-batch-sharing-checkbox` does not exist.

- [ ] **Step 3: Add controlled sharing and execution types**

Keep sharing state separate from `ElementBatchOperationActions` so
`ElementArchiveCard` can reset incompatible update actions without disabling
sharing. Add:

```ts
export type ElementBatchUpdateResult =
  | { status: 'NOT_REQUESTED' }
  | {
      status: 'FULL' | 'PARTIAL' | 'FAILED'
      requestedCount: number
      updatedCount: number
    }

export type ElementBatchExecutionResult = {
  updates: ElementBatchUpdateResult
  sharing?: ShareElementsBatchMutation['shareElementsBatch']
  sharingRequestFailed: boolean
}

export type ElementBatchSelectionSnapshot = Pick<
  Element,
  'id' | 'name' | 'isManager' | 'permissionLevel'
>
```

- [ ] **Step 4: Add English and German strings**

Under `manage.questionPool`, add matching keys for the card title/description,
target and permission labels, no eligible Elements, result title, SHARED,
SKIPPED, FAILED, each generated reason/target-error suffix, and update/sharing
full/partial/failed summaries. Reuse existing sharing permission and group
strings rather than duplicating them.

- [ ] **Step 5: Implement `ElementBatchSharingCard`**

Use a controlled `ElementBatchSharingAction`; do not render or call
`DirectSharingForm` because it owns a table row and submits immediately. Query
groups and the cached user profile. Render `Card`, `Checkbox`, `TextField`,
`SelectField`, and `Select`. Export:

```ts
export function getElementBatchSharingValidationError(
  action: ElementBatchSharingAction,
  currentUser: { shortname: string; email: string }
): 'TARGET_REQUIRED' | 'SELF_TARGET' | undefined
```

Require one non-empty target, clear the group when typing a user, clear the user
when selecting a group, and reject current shortname or email
case-insensitively. Use `usePermissionLevelSelection({ type:
ObjectType.Element })` so the options remain READ/WRITE/ADMIN.

- [ ] **Step 6: Run static checks for the new contract**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage check
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage lint
devrouter exec . -- pnpm --filter @klicker-uzh/playwright check
```

Expected: all commands exit 0; the Playwright behavior test remains red until
Task 4 wires the card into the modal.

### Task 4: Action-specific eligibility, mutation coordination, and result mode

**Work package:** Layer 2

**Files:**

- Modify:
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/SelectedElementsList.tsx:16-106`
- Create:
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchOperationsResult.tsx`
- Modify:
  `apps/frontend-manage/src/components/elements/manipulation/ElementBatchOperationsModal.tsx:26-297`
- Modify: `apps/frontend-manage/src/pages/index.tsx:192-209,489-497`

**Interfaces:**

- Consumes: Task 3 state/types/card and Task 2
  `ShareElementsBatchDocument`.
- Produces:

```ts
export type ElementBatchEligibility = {
  elementId: number
  updates: { eligible: boolean; reasons: string[] }
  sharing: { eligible: boolean; reasons: string[] }
}
```

- [ ] **Step 1: Split selected-row eligibility by action group**

Preserve the current update applicability calculation and test IDs. Add a
separate sharing column only when sharing is enabled. Its eligibility is
`element.isManager`; its skip tooltip uses the localized ADMIN/OWNER reason.
Accept these props:

```ts
{
  elements: readonly ElementBatchSelectionSnapshot[]
  eligibility: readonly ElementBatchEligibility[]
  updatesEnabled: boolean
  sharingEnabled: boolean
}
```

- [ ] **Step 2: Add the immutable result component**

`ElementBatchOperationsResult` accepts the selection snapshot and
`ElementBatchExecutionResult`. Render aggregate update status and one sharing
row per original Element. Map generated enum values directly to localized
suffix keys. For a target error, show the target-level message and no invented
per-Element outcome. Render only a Close button with
`close-batch-operations-result`.

- [ ] **Step 3: Add modal state without growing the existing action type**

Initialize:

```ts
const [sharingAction, setSharingAction] = useState(
  INITIAL_ELEMENT_BATCH_SHARING
)
const [executionResult, setExecutionResult] =
  useState<ElementBatchExecutionResult>()
const [selectionSnapshot] = useState<ElementBatchSelectionSnapshot[]>(() =>
  selectedElements.map(({ id, name, isManager, permissionLevel }) => ({
    id,
    name,
    isManager,
    permissionLevel,
  }))
)
```

Read `UserProfileDocument` from cache and render the sharing card only when
`privatePreview === true`.

- [ ] **Step 4: Compute independent counts and Apply validity**

Derive `updatesConfigured`, `eligibleUpdateCount`, `sharingFormValid`, and
`eligibleSharingCount`. Use:

```ts
const canApply =
  !applying &&
  !sharing &&
  (!sharingAction.enabled || sharingFormValid) &&
  ((updatesConfigured && eligibleUpdateCount > 0) ||
    (sharingAction.enabled && eligibleSharingCount > 0))
```

Send only update-eligible IDs to `applyElementBatchOperations`; send every
snapshot ID to `shareElementsBatch` so the server returns authoritative skips.

- [ ] **Step 5: Coordinate both mutations sequentially**

Execute the existing mutation first when configured, record FULL/PARTIAL/FAILED
from its expected and returned counts, and catch thrown errors. Then execute
batch sharing when enabled with the selected target and level, recording either
the typed result or `sharingRequestFailed: true`. Always attempt the second
selected operation even if the first throws.

- [ ] **Step 6: Implement complete and partial completion paths**

When every requested update and share succeeds, refetch, reset selection, toast,
and close exactly as today. Otherwise, refetch and set `executionResult` without
closing. Render `ElementBatchOperationsResult` from the immutable snapshot and
replace configuration/Apply controls. On result Close, reset the parent
selection and close.

- [ ] **Step 7: Preserve parent selection through archive refetches**

In `pages/index.tsx`, skip the `elements`-driven selection-pruning effect while
`batchOperationsOpen` is true. On the modal's result/success close path, call
`resetSelectedElements()` before closing, then allow normal pruning again.

- [ ] **Step 8: Run the targeted browser test to green**

Run the Task 3 Playwright command.

Expected: PASS; pro2 sees one sharing skip before Apply, both status changes
succeed, only the ADMIN-managed Element is shared to pro1, and the result is
read-only.

- [ ] **Step 9: Run existing element batch regression tests**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/playwright test:run:raw tests/X-review.spec.ts --project=chromium --grep "Prepare elements for element list batch operations|selected elements|applied operations|archiving|status changes|Batch-share elements"
```

Expected: all matched scenarios PASS and existing update test IDs remain valid.

### Task 5: Documentation, visual verification, and final quality gate

**Work package:** Layer 2

**Files:**

- Modify: `apps/docs/docs/tutorials/element_batch_operations.mdx`
- Create: `docs/log/2026-08-17-element-batch-sharing.md`
- Modify: `project/plans_wip/PLAN-element-batch-sharing.md`

**Interfaces:**

- Consumes: the completed GraphQL contract, UI behavior, test evidence, and
  screenshots.
- Produces: user/engineering documentation and merge-readiness evidence.

- [ ] **Step 1: Update the user tutorial**

Add a `Share selected Elements` operation explaining one common target/level,
ADMIN/OWNER eligibility, independent status/update behavior, existing-permission
updates, and the read-only partial result. Replace the current statement that
only Elements eligible for all selected updates are modified with the new
action-specific rule.

- [ ] **Step 2: Add the engineering change log**

Create a dated log entry listing the API result contract, per-Element
transaction boundary, private-preview UI, exact integration/Playwright tests,
and links to `docs/graphql-api-layer.md` and the element batch tutorial. Do not
copy the full design spec.

- [ ] **Step 3: Start and prove the real local environment**

Run:

```bash
devrouter ensure .
devrouter exec . -- tail -80 /tmp/dev.log
```

Stop tailing once Manage and API are compiled and reachable. Use delegated
local lecturer credentials; do not use Edu-ID or real course data.

- [ ] **Step 4: Perform mandatory browser verification**

Use `npx agent-browser` against the devrouter Manage URL. Verify owner-only
sharing, mixed ADMIN/WRITE selection, combined status + sharing, target
validation, full success, partial result, modal Close, reload persistence, and
German/English layout. Capture desktop screenshots of:

1. configured batch-sharing card with separate update/sharing indicators; and
2. partial read-only result with the skipped Element and reason.

Store evidence under
`project/plans_wip/assets/element-batch-sharing/` with synthetic seeded names.

- [ ] **Step 5: Run focused and repository-wide checks**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- elementBatchSharing.test.ts elementSharing.test.ts resourceSharing.test.ts activitySharing.test.ts courseSharing.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage check
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage lint
devrouter exec . -- pnpm --filter @klicker-uzh/playwright check
devrouter exec . -- pnpm --filter @klicker-uzh/playwright test:run:raw tests/X-review.spec.ts --project=chromium --grep "Prepare elements for element list batch operations|Batch-share elements"
devrouter exec . -- pnpm run check:all
devrouter exec . -- pnpm run build
opengrep scan --config auto packages/graphql/src/services/sharing.ts packages/graphql/src/schema apps/frontend-manage/src/components/elements/manipulation
```

Expected: every command exits 0. Record warnings separately; do not hide
failures behind `|| true`.

- [ ] **Step 6: Run a separate final review**

Have a reviewer who did not implement the code compare the union of both stack
layers against the approved design. Resolve or explicitly defer findings. Then
run `$thermo-nuclear-code-quality-review` as required before marking either PR
ready to merge; do not merge without explicit user approval.

- [ ] **Step 7: Review data hygiene and commit Layer 2**

Inspect the complete diff, staged data/docs/screenshots, generated artifacts,
and Playwright fixtures for secrets and personal data. Use only synthetic seeded
identities. Commit:

```bash
git add \
  apps/frontend-manage/src/components/elements/manipulation/types.ts \
  apps/frontend-manage/src/components/elements/manipulation/ElementBatchOperationsModal.tsx \
  apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchSharingCard.tsx \
  apps/frontend-manage/src/components/elements/manipulation/batchOperations/SelectedElementsList.tsx \
  apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchOperationsResult.tsx \
  apps/frontend-manage/src/pages/index.tsx \
  apps/docs/docs/tutorials/element_batch_operations.mdx \
  packages/i18n/messages/en.ts \
  packages/i18n/messages/de.ts \
  playwright/tests/X-review.spec.ts \
  docs/log/2026-08-17-element-batch-sharing.md \
  project/plans_wip/PLAN-element-batch-sharing.md
git commit -m "feat(manage): batch-share selected elements"
```

- [ ] **Step 8: Update progress and prepare draft PR evidence**

Move the repository plan from `project/plans_wip` to `project/plans` only when
all checks and browser evidence are complete. Draft PR descriptions must cover
the whole branch against its target, identify the independent transaction
boundary, list exact tests, and include both screenshots. Keep both layers draft
until reviewed; never merge, reorder, or unstack without user approval.

## Approved follow-up: align sharing recipient controls

### Task 7: Use a two-plus-one responsive field layout

**Files:**

- Modify:
  `apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchSharingCard.tsx`
- Modify:
  `docs/superpowers/specs/2026-08-17-element-batch-sharing-design.md`

- [x] **Step 1: Implement the approved layout**

Use two equal columns for User and User group at the desktop breakpoint. Make
Permission span both columns on the next row. Keep all three controls stacked
below that breakpoint, and constrain each select root and trigger to its column.

- [x] **Step 2: Verify static checks**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage check
devrouter exec . -- pnpm exec biome check apps/frontend-manage/src/components/elements/manipulation/batchOperations/ElementBatchSharingCard.tsx
```

- [x] **Step 3: Verify the rendered modal**

Use `npx agent-browser@0.32.2` against the real local Manage app at desktop and
narrow viewports. Confirm that the User, User group, and Permission labels and
controls do not overlap and that the shortname/email entry remains visible.

- [x] **Step 4: Update the draft PR evidence**

Replace the existing sharing-controls image in the PR summary. Clarify that
`Batch Share Admin` and `Batch Share Write` are synthetic Element names encoding
the caller's existing access, not permission levels granted by the batch.
