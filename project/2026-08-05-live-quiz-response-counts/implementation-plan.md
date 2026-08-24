# Live Quiz Per-Element Response Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a lecturer the received and processed answer counts for every
element in an active or executed live quiz block.

**Architecture:** The response API records an exact numeric received counter;
response processors record an exact numeric processed counter only after a
complete aggregation batch succeeds. A bounded processed replay-claim set
prevents duplicate non-idempotent writes. The authorized `cockpitQuiz` query
reads the new counters and compatibility values and decorates the matching
`ElementInstance`; the existing two-second cockpit polling renders the values
without a new subscription.

**Tech Stack:** TypeScript 6, ioredis 5.4.1, Hatchet 1.9.4, Pothos GraphQL,
Apollo Client, Next.js 16, React 19, next-intl, Vitest, Playwright.

## Global Constraints

- Counts are per `ElementInstance`; never sum them into an `ElementBlock` total.
- `numOfResponsesReceived` counts response events accepted for a known live quiz
  element instance.
- `numOfResponsesProcessed` counts response events incorporated into live
  results.
- Assessment duplicate admission remains governed by the existing participant
  and database uniqueness checks. The received metric intentionally counts
  accepted transport events before that downstream boundary.
- Keep the existing `numOfParticipants` field and behavior unchanged.
- Use numeric Redis counters for reporting. Use the processed set only as a
  bounded replay claim, not as the processed count.
- Keep tracking keys under `lq:<quiz-id>:i:<instance-id>:*` so existing expiry
  and cleanup logic applies.
- Do not change Prisma, response validation rules, scoring, XP, leaderboards,
  cockpit polling, or subscription behavior.
- Add no runtime dependencies. The response processor adds the repository's
  existing Vitest version as a test-only dependency so its focused contract
  tests run in isolation.
- Add English and German messages and a stable `data-cy` selector per element.
- Update the engineering wiki in the same pull request.
- Target `v3` with one ordinary draft pull request.

## Approved redesign addendum (2026-08-24)

Problem: The original set-cardinality design left active received and processed
sets without an expiry. The processing marker was also counted before Redis
aggregation commands completed, so partial command failures could inflate
`numOfResponsesProcessed`.

Evidence: The integrated final review identified the unbounded active-set risk,
the partial-failure counting error, and duplicate source-string tests. The
real Redis contract now provides the stable seam for the replacement behavior.

Decision: Use these keys for new writes:

- `responses:received:count` — numeric ingress counter;
- `responses:processed:count` — numeric successful-aggregation counter;
- `responses:processed` — bounded replay-claim set with a 24-hour horizon.

The processing script initializes a missing processed counter once from the
legacy processed-set cardinality, claims the identifier, applies every command
with `redis.pcall`, and increments the counter only when no command fails. It
returns `already_processed`, `processed`, or `aggregation_failed`. The legacy
received set is read-only compatibility input; GraphQL adds its cardinality to
the new received counter. A missing processed counter falls back to the legacy
processed-set cardinality as an opaque pre-cutover baseline.

Risk: The compatibility bridge cannot make old workers increment the new
processed counter. Deploy GraphQL before new ingress, drain old response
processors before initializing processed counters, and run only the new
processors after initialization. Partial failures remain claimed and are not
replayed because some aggregation commands may already have applied.

Delegation Map:

| Slice | Owner | Acceptance |
|---|---|---|
| Contract and compatibility amendment | main | This addendum, design, and async-worker documentation describe exact keys, legacy limitations, retention, and rollout order. |
| Redis scripts and producer/processor adoption | main | Real Redis contract plus both focused processor suites pass; no source-token assertions remain. |
| Cockpit readers and retention | main | GraphQL count test covers new counters, legacy bridge, scheduled nulls, and pipeline degradation; cleanup expires response keys with checked results. |
| Integrated verification and review | main | Fresh repository checks, browser evidence or documented macOS blocker, required simplifier/slice/final reviews, and local commit. |

Authority: The user approved the redesign and local implementation, tests,
documentation, reviews, and commits, and requested that PR #5315 receive the
conflict-resolved branch. After the final review, publish this branch to the
PR head `feat/live-quiz-response-counts`; merging, deployment, worker draining,
and rollout remain withheld.

Terminal: The local branch contains the verified redesign and readiness
evidence, with deployment compatibility conditions recorded. Pause only for a
new data-contract decision, unavailable required verification capability, or
an authority boundary.

Progress: Complete locally — the counter/replay redesign is implemented,
formatted, typechecked, covered by focused worker/util/GraphQL tests, verified
against real Redis, and included in the refreshed branch against current
`origin/v3`. The remote PR still requires publication of this branch before
GitHub can recalculate its mergeability.

This addendum supersedes the earlier set-cardinality details in Tasks 1–6;
those sections remain as implementation history for the original package.

---

### Task 1: Centralize the Redis tracking-key contract

**Files:**

- Create: `packages/util/src/liveQuizResponseTracking.ts`
- Create: `packages/util/test/liveQuizResponseTracking.test.ts`
- Modify: `packages/util/src/index.ts`

**Interfaces:**

- Consumes: live quiz IDs as strings, instance IDs as strings or numbers, and
  status `'received' | 'processed'`.
- Produces:

```ts
export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

export function getLiveQuizResponseTrackingKey(args: {
  liveQuizId: string
  instanceId: string | number
  status: LiveQuizResponseTrackingStatus
}): string
```

- Exact key format:
  `lq:<liveQuizId>:i:<instanceId>:responses:<received|processed>`.

- [ ] **Step 1: Write the failing key-contract test**

Create `packages/util/test/liveQuizResponseTracking.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getLiveQuizResponseTrackingKey } from '../src/liveQuizResponseTracking.js'

describe('live quiz response tracking', () => {
  it('builds per-instance received and processed keys', () => {
    expect(
      getLiveQuizResponseTrackingKey({
        liveQuizId: 'quiz-id',
        instanceId: 42,
        status: 'received',
      })
    ).toBe('lq:quiz-id:i:42:responses:received')

    expect(
      getLiveQuizResponseTrackingKey({
        liveQuizId: 'quiz-id',
        instanceId: '43',
        status: 'processed',
      })
    ).toBe('lq:quiz-id:i:43:responses:processed')
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/util test -- test/liveQuizResponseTracking.test.ts
```

Expected: FAIL because `src/liveQuizResponseTracking.ts` does not exist.

- [ ] **Step 3: Implement the key helper**

Create `packages/util/src/liveQuizResponseTracking.ts`:

```ts
export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

export function getLiveQuizResponseTrackingKey({
  liveQuizId,
  instanceId,
  status,
}: {
  liveQuizId: string
  instanceId: string | number
  status: LiveQuizResponseTrackingStatus
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:responses:${status}`
}
```

- [ ] **Step 4: Export the helper from the utility package**

Append to `packages/util/src/index.ts`:

```ts
// export live quiz response tracking helpers
export * from './liveQuizResponseTracking.js'
```

- [ ] **Step 5: Verify the helper package**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/util test -- test/liveQuizResponseTracking.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/util check
devrouter exec . -- pnpm --filter @klicker-uzh/util build
```

Expected: the focused test, typecheck, and build all pass.

- [ ] **Step 6: Commit the shared contract**

```bash
git add packages/util/src/liveQuizResponseTracking.ts packages/util/src/index.ts packages/util/test/liveQuizResponseTracking.test.ts
git commit -m "feat(util): add live quiz response tracking keys"
```

### Task 2: Record received and processed response identifiers

**Files:**

- Modify: `apps/response-api/src/index.ts`
- Modify: `apps/hatchet-worker-response-processor/src/processors/processor.ts`
- Modify: `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts`

**Interfaces:**

- Consumes: `getLiveQuizResponseTrackingKey` from Task 1.
- Produces:

  - standard received set members: response API `messageId`;
  - assessment received set members: deterministic `correlationId`;
  - standard processed set members: the same `messageId`;
  - assessment processed set members: the same `correlationId`.

- [ ] **Step 1: Import the shared key helper in all three consumers**

Use these imports:

```ts
// apps/response-api/src/index.ts
import {
  getLiveQuizResponseTrackingKey,
  verifyJWT,
  type JWTPayload,
} from '@klicker-uzh/util'
```

```ts
// apps/hatchet-worker-response-processor/src/processors/processor.ts
import {
  getLiveQuizResponseTrackingKey,
  verifyJWT,
  type JWTPayload,
} from '@klicker-uzh/util'
```

```ts
// apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts
import { getLiveQuizResponseTrackingKey } from '@klicker-uzh/util'
```

- [ ] **Step 2: Record standard responses at ingress without allocating keys for unknown instances**

Immediately after constructing `message` in `handleAddResponse`, before
selecting and pushing the Hatchet event, add:

```ts
const instanceInfoExists = await redis.exists(
  `lq:${liveQuizId}:i:${instanceId}:info`
)

if (instanceInfoExists === 1) {
  await redis.sadd(
    getLiveQuizResponseTrackingKey({
      liveQuizId: String(liveQuizId),
      instanceId,
      status: 'received',
    }),
    message.messageId
  )
}
```

This preserves current handling for invalid or expired instance IDs while
preventing arbitrary requests from allocating tracking keys. A Redis failure
for a known instance propagates to the route-level error handler before Hatchet
enqueueing.

- [ ] **Step 3: Record assessment responses after auth and duplicate checks**

Immediately after constructing the assessment `message`, before the existing
`try` that pushes `response-received:assessment`, add:

```ts
await assessmentRedis.sadd(
  getLiveQuizResponseTrackingKey({
    liveQuizId: String(liveQuizId),
    instanceId,
    status: 'received',
  }),
  correlationId
)
```

The write remains after the existing `votes` duplicate check, so a known
assessment duplicate does not create another received member.

- [ ] **Step 4: Mark a standard response processed in the result pipeline**

After the element-type `switch` completes, but before the first processing
`try` block reaches its `catch`, append this command to the existing pipeline:

```ts
redisMulti.sadd(
  getLiveQuizResponseTrackingKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
    status: 'processed',
  }),
  message.messageId
)
```

Keep all validation, duplicate, late-response, and missing-metadata early
returns before this line. Those events remain received but are not reported as
processed.

- [ ] **Step 5: Mark an assessment response processed in the aggregation pipeline**

Add `correlationId` to the existing destructuring at the start of
`aggregateAssessmentResponses`:

```ts
const {
  correlationId,
  participantId,
  liveQuizId,
  blockId,
  instanceId,
  elementType,
  isGamificationEnabled,
  pointsAwarded,
  xpAwarded,
  response,
} = message
```

After the aggregation `switch` and before `await redis.exec()`, append:

```ts
redis.sadd(
  getLiveQuizResponseTrackingKey({
    liveQuizId,
    instanceId,
    status: 'processed',
  }),
  correlationId
)
```

Do not mark the event processed in `processAssessmentResponse`; at that stage
the database row exists, but Redis evaluation results have not yet been
aggregated.

- [ ] **Step 6: Verify backend types and builds**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/response-api check
devrouter exec . -- pnpm --filter @klicker-uzh/hatchet-worker-response-processor check
devrouter exec . -- pnpm --filter @klicker-uzh/response-api build
devrouter exec . -- pnpm --filter @klicker-uzh/hatchet-worker-response-processor build
```

Expected: all four commands pass without dependency or type changes.

- [ ] **Step 7: Commit ingestion and processing tracking**

```bash
git add apps/response-api/src/index.ts apps/hatchet-worker-response-processor/src/processors/processor.ts apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts
git commit -m "feat(live-quiz): track response processing state"
```

### Task 3: Expose per-element counts through the lecturer cockpit query

**Files:**

- Create: `packages/graphql/test/liveQuizResponseCounts.test.ts`
- Modify: `packages/graphql/src/schema/element.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/graphql/src/graphql/ops/QGetCockpitQuiz.graphql`
- Regenerate: `packages/graphql/src/ops.ts`
- Regenerate: `packages/graphql/src/ops.schema.json`
- Regenerate: `packages/graphql/src/public/schema.graphql`
- Regenerate: `packages/graphql/src/public/client.json`
- Regenerate: `packages/graphql/src/public/server.json`

**Interfaces:**

- Consumes: the received and processed Redis keys from Tasks 1–2.
- Produces nullable `ElementInstance.numOfResponsesReceived: Int` and
  `ElementInstance.numOfResponsesProcessed: Int` fields.
- Scheduled instances return `null`; active and executed instances return an
  integer, including zero.

- [ ] **Step 1: Write the failing GraphQL service integration test**

Create `packages/graphql/test/liveQuizResponseCounts.test.ts`:

```ts
import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementBlockStatus,
  ElementType,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { getLiveQuizResponseTrackingKey } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { getCockpitQuiz } from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedElements,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('live quiz cockpit response counts', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let liveQuizId: string | undefined

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    liveQuizId = undefined
  })

  afterEach(async () => {
    if (liveQuizId) {
      const keys = await userOneCtx.redisExec.keys(`lq:${liveQuizId}:*`)
      if (keys.length > 0) {
        await userOneCtx.redisExec.del(...keys)
      }
    }
    await testCleanup(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns independent counts for started elements and null for scheduled elements', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC, MC, NR, FT } = await seedElements(userOneCtx, AC1.id)
    const quiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: MC.id, type: ElementType.MC },
          { id: NR.id, type: ElementType.NUMERICAL },
          { id: FT.id, type: ElementType.FREE_TEXT },
        ],
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )
    liveQuizId = quiz.id

    const blocks = await prisma.elementBlock.findMany({
      where: { liveQuizId: quiz.id },
      include: { elements: true },
      orderBy: { order: 'asc' },
    })
    const activeBlock = blocks[0]!
    const mergedBlock = blocks[1]!
    const executedBlock = blocks[2]!
    const scheduledBlock = blocks[3]!
    const firstInstance = activeBlock.elements[0]!
    const secondInstance = mergedBlock.elements[0]!
    const executedInstance = executedBlock.elements[0]!
    const scheduledInstance = scheduledBlock.elements[0]!

    await prisma.elementInstance.update({
      where: { id: secondInstance.id },
      data: {
        elementBlock: { connect: { id: activeBlock.id } },
        order: 1,
      },
    })
    await prisma.elementBlock.delete({ where: { id: mergedBlock.id } })
    await prisma.elementBlock.update({
      where: { id: activeBlock.id },
      data: {
        status: ElementBlockStatus.ACTIVE,
        activeInLiveQuiz: { connect: { id: quiz.id } },
      },
    })
    await prisma.elementBlock.update({
      where: { id: executedBlock.id },
      data: { status: ElementBlockStatus.EXECUTED },
    })

    await userOneCtx.redisExec.hset(
      `lq:${quiz.id}:i:${firstInstance.id}:results`,
      'participants',
      1
    )
    await userOneCtx.redisExec.hset(
      `lq:${quiz.id}:i:${secondInstance.id}:results`,
      'participants',
      0
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
        status: 'received',
      }),
      'received-1',
      'received-2'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
        status: 'processed',
      }),
      'received-1'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: executedInstance.id,
        status: 'received',
      }),
      'executed-response'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: executedInstance.id,
        status: 'processed',
      }),
      'executed-response'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: scheduledInstance.id,
        status: 'received',
      }),
      'scheduled-response'
    )

    const cockpitQuiz = await getCockpitQuiz({ id: quiz.id }, userOneCtx)
    const returnedActiveBlock = cockpitQuiz?.blocks.find(
      (block) => block.id === activeBlock.id
    )
    const returnedScheduledBlock = cockpitQuiz?.blocks.find(
      (block) => block.id === scheduledBlock.id
    )
    const returnedExecutedBlock = cockpitQuiz?.blocks.find(
      (block) => block.id === executedBlock.id
    )

    expect(returnedActiveBlock?.elements[0]).toMatchObject({
      id: firstInstance.id,
      numOfResponsesReceived: 2,
      numOfResponsesProcessed: 1,
    })
    expect(returnedActiveBlock?.elements[1]).toMatchObject({
      id: secondInstance.id,
      numOfResponsesReceived: 0,
      numOfResponsesProcessed: 0,
    })
    expect(returnedExecutedBlock?.elements[0]).toMatchObject({
      id: executedInstance.id,
      numOfResponsesReceived: 1,
      numOfResponsesProcessed: 1,
    })
    expect(returnedScheduledBlock?.elements[0]).toMatchObject({
      id: scheduledInstance.id,
      numOfResponsesReceived: null,
      numOfResponsesProcessed: null,
    })
  })
})
```

- [ ] **Step 2: Run the focused integration test and confirm it fails**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- liveQuizResponseCounts.test.ts
```

Expected: FAIL because cockpit element instances do not yet contain the two
response-count fields.

- [ ] **Step 3: Extend the Pothos element-instance type**

Add these optional properties to `IElementInstance` in
`packages/graphql/src/schema/element.ts`:

```ts
numOfResponsesReceived?: number | null
numOfResponsesProcessed?: number | null
```

Expose them beside `correlationKey`:

```ts
numOfResponsesReceived: t.exposeInt('numOfResponsesReceived', {
  nullable: true,
}),
numOfResponsesProcessed: t.exposeInt('numOfResponsesProcessed', {
  nullable: true,
}),
```

- [ ] **Step 4: Read response cardinalities once per started element**

Import `getLiveQuizResponseTrackingKey` in
`packages/graphql/src/services/liveQuizzes.ts`. In `getCockpitQuiz`, after
selecting the regular or assessment Redis client, add:

```ts
const responseCounts = new Map<
  number,
  { received: number; processed: number }
>()
const startedInstances = liveQuiz.blocks.flatMap((block) =>
  block.status === DB.ElementBlockStatus.SCHEDULED ? [] : block.elements
)

if (startedInstances.length > 0) {
  const responseCountPipeline = redis.pipeline()
  startedInstances.forEach((instance) => {
    responseCountPipeline.scard(
      getLiveQuizResponseTrackingKey({
        liveQuizId: id,
        instanceId: instance.id,
        status: 'received',
      })
    )
    responseCountPipeline.scard(
      getLiveQuizResponseTrackingKey({
        liveQuizId: id,
        instanceId: instance.id,
        status: 'processed',
      })
    )
  })

  const responseCountResults = await responseCountPipeline.exec()
  if (!responseCountResults) {
    throw new Error(`Failed to load response counts for live quiz ${id}`)
  }

  startedInstances.forEach((instance, index) => {
    const receivedResult = responseCountResults[index * 2]
    const processedResult = responseCountResults[index * 2 + 1]

    if (!receivedResult || receivedResult[0]) {
      throw receivedResult?.[0] ?? new Error('Missing received response count')
    }
    if (!processedResult || processedResult[0]) {
      throw (
        processedResult?.[0] ?? new Error('Missing processed response count')
      )
    }

    responseCounts.set(instance.id, {
      received: Number(receivedResult[1] ?? 0),
      processed: Number(processedResult[1] ?? 0),
    })
  })
}
```

- [ ] **Step 5: Attach counts to the matching element instance**

Inside the existing `blocks: liveQuiz.blocks.map(...)` reduction, compute these
fields before processing `elementData`:

```ts
const counts =
  block.status === DB.ElementBlockStatus.SCHEDULED
    ? null
    : (responseCounts.get(instance.id) ?? { received: 0, processed: 0 })
const responseCountFields = {
  numOfResponsesReceived: counts?.received ?? null,
  numOfResponsesProcessed: counts?.processed ?? null,
}
```

For the invalid-`elementData` branch, return:

```ts
return { ...instance, ...responseCountFields }
```

For the valid-`elementData` branch, return:

```ts
return {
  ...instance,
  ...responseCountFields,
  elementData: {
    ...elementData,
    options: null,
  },
}
```

- [ ] **Step 6: Request both fields in the cockpit operation**

Add below `elementType` in
`packages/graphql/src/graphql/ops/QGetCockpitQuiz.graphql`:

```graphql
numOfResponsesReceived
numOfResponsesProcessed
```

- [ ] **Step 7: Regenerate GraphQL artifacts**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql generate
```

Expected: schema, operation types, and persisted-operation manifests update
without codegen errors.

- [ ] **Step 8: Run the focused test and GraphQL checks**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- liveQuizResponseCounts.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
```

Expected: the per-element integration test and both package checks pass.

- [ ] **Step 9: Commit the GraphQL surface**

```bash
git add packages/graphql/src/schema/element.ts packages/graphql/src/services/liveQuizzes.ts packages/graphql/src/graphql/ops/QGetCockpitQuiz.graphql packages/graphql/src/ops.ts packages/graphql/src/ops.schema.json packages/graphql/src/public/schema.graphql packages/graphql/src/public/client.json packages/graphql/src/public/server.json packages/graphql/test/liveQuizResponseCounts.test.ts
git commit -m "feat(graphql): expose live quiz response counts per element"
```

### Task 4: Render and verify per-element counts in the cockpit

**Files:**

- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`
- Modify: `apps/frontend-manage/src/components/liveQuiz/cockpit/LiveQuizBlock.tsx`
- Modify: `playwright/tests/O-live-quiz.spec.ts`

**Interfaces:**

- Consumes: generated `ElementInstance.numOfResponsesReceived` and
  `ElementInstance.numOfResponsesProcessed`.
- Produces:

  - `manage.cockpit.responsesReceived`;
  - `manage.cockpit.responsesProcessed`;
  - `data-cy="live-quiz-response-counts-<instance-id>"`.

- [ ] **Step 1: Add localized count labels**

Add under `manage.cockpit` in `packages/i18n/messages/en.ts`:

```ts
responsesReceived: 'Received: {number}',
responsesProcessed: 'Processed: {number}',
```

Add under `manage.cockpit` in `packages/i18n/messages/de.ts`:

```ts
responsesReceived: 'Empfangen: {number}',
responsesProcessed: 'Verarbeitet: {number}',
```

- [ ] **Step 2: Render counts beside each started element**

In the `block.elements?.map(...)` body in `LiveQuizBlock.tsx`, compute:

```ts
const hasResponseCounts =
  instance.numOfResponsesReceived !== null &&
  typeof instance.numOfResponsesReceived !== 'undefined' &&
  instance.numOfResponsesProcessed !== null &&
  typeof instance.numOfResponsesProcessed !== 'undefined'
```

Keep the existing question link and append this sibling when
`hasResponseCounts` is true:

```tsx
{
  hasResponseCounts ? (
    <span
      className="ml-2 whitespace-nowrap text-xs text-gray-600"
      data-cy={`live-quiz-response-counts-${instance.id}`}
    >
      {t('manage.cockpit.responsesReceived', {
        number: instance.numOfResponsesReceived,
      })}
      <span aria-hidden="true"> · </span>
      {t('manage.cockpit.responsesProcessed', {
        number: instance.numOfResponsesProcessed,
      })}
    </span>
  ) : null
}
```

Use a block-bodied map callback so `hasResponseCounts` is scoped to its own
instance. Do not gate the display on the block-wide `active` prop; executed
elements also carry non-null counts.

- [ ] **Step 3: Add integrated Playwright assertions at the existing first-block response checkpoint**

In the test named
`Respond to the first block of the running live quiz from the student view`,
after `rememberStudentPwaState(page)`, add:

```ts
await loginLecturer(page)
await page.getByTestId('activities').click()
await page.getByTestId(`live-quiz-cockpit-${data.course2.quiz.name}`).click()

for (const { title, expected } of [
  { title: data.SCML.title, expected: 1 },
  { title: data.MCML.title, expected: 1 },
  { title: data.KPML.title, expected: 1 },
  { title: data.NR.title, expected: 0 },
]) {
  const elementRow = page
    .getByRole('link', { name: title, exact: false })
    .locator('xpath=..')
  const counts = elementRow.getByTestId(/^live-quiz-response-counts-/)

  await expect(counts).toContainText(
    messages.manage.cockpit.responsesReceived.replace(
      '{number}',
      String(expected)
    ),
    { timeout: 30_000 }
  )
  await expect(counts).toContainText(
    messages.manage.cockpit.responsesProcessed.replace(
      '{number}',
      String(expected)
    ),
    { timeout: 30_000 }
  )
}
```

The answered elements prove successful end-to-end tracking; the unanswered
numerical element proves the UI reports each element independently instead of
reusing a block total.

- [ ] **Step 4: Format and typecheck the UI and E2E changes**

Run:

```bash
devrouter exec . -- pnpm exec biome check --write apps/frontend-manage/src/components/liveQuiz/cockpit/LiveQuizBlock.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts
devrouter exec . -- pnpm exec prettier --write playwright/tests/O-live-quiz.spec.ts
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-manage check
devrouter exec . -- pnpm --filter @klicker-uzh/playwright check
devrouter exec . -- pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium tests/O-live-quiz.spec.ts
```

Expected: formatting makes no further changes on a second pass, both typechecks
pass, and Playwright lists the live quiz workflow.

- [ ] **Step 5: Commit the lecturer UI and E2E assertion**

```bash
git add packages/i18n/messages/en.ts packages/i18n/messages/de.ts apps/frontend-manage/src/components/liveQuiz/cockpit/LiveQuizBlock.tsx playwright/tests/O-live-quiz.spec.ts
git commit -m "feat(manage): show live quiz response counts per element"
```

### Task 5: Document and validate the response-processing signal

**Files:**

- Modify: `docs/async-and-workers.md`
- Modify: `docs/log.md`
- Modify: `project/plans_wip/PLAN-live-quiz-response-counts.md`

**Interfaces:**

- Consumes: the implemented Redis-set semantics and UI behavior.
- Produces: durable documentation explaining that the difference is an
  operational signal, not exact queue depth.

- [ ] **Step 1: Document received and processed tracking**

Set the `docs/async-and-workers.md` timestamp to `'2026-08-05'`. After the
response-ingest paragraph, add:

```md
### Per-element response processing counts

For every started live-quiz element instance, execution Redis stores two sets:
`lq:<quiz-id>:i:<instance-id>:responses:received` and
`lq:<quiz-id>:i:<instance-id>:responses:processed`. The response API records the
Hatchet event identifier in the received set; the response processor records the
same identifier only when live results have been updated. The lecturer cockpit
polls their cardinalities and reports both values per element.

The difference is an operational signal, not exact queue depth. It can include
queued work as well as invalid, duplicate, late, rejected, or failed responses.
Set membership makes reporting idempotent across task retries, but it does not
change the response pipeline's existing validation or result-aggregation retry
behavior. Existing live-quiz cache expiry removes these sets with the other
instance keys.
```

- [ ] **Step 2: Add the wiki log entry**

At the top of `docs/log.md`, add:

```md
## 2026-08-05

- **Update**: [async-and-workers](./async-and-workers.md) documents the
  per-element live-quiz received/processed response signal, retry-safe Redis set
  tracking, cockpit polling, and why the difference is not exact queue depth.
```

- [ ] **Step 3: Mark implementation slices complete in the repository tracker**

Update `project/plans_wip/PLAN-live-quiz-response-counts.md` so every completed
slice is checked and the progress log names the successful focused commands.
Do not move the tracker out of `plans_wip` until all runtime and review evidence
in Task 6 is complete.

- [ ] **Step 4: Validate docs and repository checks**

Run:

```bash
bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs
devrouter exec . -- pnpm run check:all
opengrep scan --config auto
devrouter exec . -- pnpm run build
```

Expected: wiki validation, repository checks, static analysis, and production
build pass. Record any unrelated pre-existing warning separately; do not weaken
checks to make the branch green.

- [ ] **Step 5: Commit the documentation**

```bash
git add docs/async-and-workers.md docs/log.md project/plans_wip/PLAN-live-quiz-response-counts.md
git commit -m "docs(live-quiz): document response processing counts"
```

### Task 6: Run the real workflow, review, and publish the draft PR

**Files:**

- Modify when an accepted review finding identifies a defect: only files
  already listed in Tasks 1–5.
- Move after all verification succeeds:
  `project/plans_wip/PLAN-live-quiz-response-counts.md` to
  `project/plans_archive/PLAN-live-quiz-response-counts.md`.

**Interfaces:**

- Consumes: the complete branch and the self-contained devrouter environment.
- Produces: browser evidence, independent review evidence, a pushed branch, and
  a draft PR targeting `v3`.

- [ ] **Step 1: Start and prove the real local environment**

Run:

```bash
devrouter ensure . --json
devrouter exec . -- tail -120 /tmp/dev.log
```

Stop tailing after the manage frontend, PWA, response API, GraphQL backend, and
response processor report ready. Confirm the response processor is in regular
live-quiz mode for the standard workflow.

- [ ] **Step 2: Run focused automated behavior checks**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/util test -- test/liveQuizResponseTracking.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test -- liveQuizResponseCounts.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/playwright exec playwright test --project=chromium tests/O-live-quiz.spec.ts
```

Expected: all focused unit, integration, and full live-quiz workflow tests pass.

- [ ] **Step 3: Validate the cockpit visually in both locales**

Use `npx agent-browser` against the devrouter manage URL. Log in through delegated
access as `lecturer` / `abcd`, start a seeded live quiz block, submit responses
from the PWA, and verify:

1. each element row has its own received and processed values;
2. an unanswered element stays at `0 · 0` while answered siblings advance;
3. scheduled elements show no count status;
4. English and German labels fit without horizontal overflow;
5. the existing participant count, question links, and countdown remain intact.

Capture desktop screenshots for the active cockpit in both locales and record
their absolute paths in the tracker and PR description.

- [ ] **Step 4: Request an independent final branch review**

Dispatch a fresh review agent with the complete `origin/v3...HEAD` diff. Require
findings ordered by severity with file/line evidence, explicit checks for Redis
key consistency, retry semantics, per-element mapping, authorization, i18n,
generated artifacts, test strength, and documentation accuracy. Fix accepted
findings one at a time and rerun the smallest relevant check after each fix.

- [ ] **Step 5: Perform final data-hygiene and diff checks**

Run:

```bash
git status --short
git diff --check origin/v3...HEAD
git diff --stat origin/v3...HEAD
git log --oneline origin/v3..HEAD
```

Inspect every staged or committed data-like file for secrets and personal data.
Do not push if any real participant data, credentials, `.env` file, or response
export appears in the diff.

- [ ] **Step 6: Finalize the tracker and commit review fixes**

When every check and review item is resolved, update the tracker progress log
with commands, outcomes, screenshot paths, and deferred findings with rationale.
Archive the completed tracker and commit the final metadata or fixes:

```bash
git mv project/plans_wip/PLAN-live-quiz-response-counts.md project/plans_archive/PLAN-live-quiz-response-counts.md
git add project/plans_archive/PLAN-live-quiz-response-counts.md
git commit -m "chore(live-quiz): record response count verification"
```

- [ ] **Step 7: Push and create the requested draft PR**

Push `feat/live-quiz-response-counts`, then create a draft PR targeting `v3`
with a conventional title such as:

```text
feat(live-quiz): show per-element response processing counts
```

The PR body must summarize the whole branch, define received versus processed,
explain that the difference is not exact queue depth, list every verification
command and result, include both locale screenshots, and mention any explicitly
deferred review finding. Do not mark ready or merge without separate user
approval.

### Task 7: Align the element links and response statuses

**Files:**

- Modify:
  `apps/frontend-manage/src/components/liveQuiz/cockpit/LiveQuizBlock.tsx`
- Modify:
  `project/2026-08-05-live-quiz-response-counts/design.md`
- Replace:
  `project/2026-08-05-live-quiz-response-counts/live-quiz-response-counts-en.png`
- Replace:
  `project/2026-08-05-live-quiz-response-counts/live-quiz-response-counts-de.png`

- [ ] **Step 1: Render the element list as one shared two-column grid**

Keep every element link in the flexible left column and every response status
in the content-sized, right-aligned column. Preserve an empty right-hand cell
for scheduled elements, allow long element names to wrap, and keep each status
on one line. Do not change the GraphQL data, translations, links, or stable
`data-cy` selectors.

- [ ] **Step 2: Format and typecheck the lecturer UI**

Run:

```bash
pnpm exec biome check --write apps/frontend-manage/src/components/liveQuiz/cockpit/LiveQuizBlock.tsx
pnpm --filter @klicker-uzh/frontend-manage check
```

- [ ] **Step 3: Verify the aligned layout and refresh PR screenshots**

Use `npx agent-browser@0.32.2` against the real local lecturer cockpit. Verify
that every active element status shares the same right-hand column, scheduled
elements remain count-free, and the layout has no horizontal overflow in both
English and German. Replace both checked-in locale screenshots with captures of
the updated live UI.

- [ ] **Step 4: Publish the refinement to the existing draft PR**

Commit and push the component, design, plan, and screenshot updates. Update the
existing draft PR description so both screenshot embeds point to the new commit
and confirm that the rendered images show the two-column layout.
