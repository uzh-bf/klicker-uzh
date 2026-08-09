# Selection and Case Study Demo Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed complete selection and case-study demo questions, their shared answer collection, and a new Demo Live Quiz block when a new lecturer opts into demo content.

**Architecture:** Keep `changeInitialSettings` and `seedDemoQuestions` as the existing entry points. Run the first-login claim, demo seeding, and final settings update in one bounded Prisma interactive transaction. Claim `User.firstLogin` with a conditional update so concurrent requests serialize; a request that loses the claim returns the fresh user without seeding, while a failed seed rolls the claim back for retry. Pass the transaction context through the existing seeder and the private relational helper, return relation-enriched elements to the existing `processElementData` live-quiz path, and cover the persisted resources, instance snapshots, and concurrent replay behavior with database-backed service tests.

**Tech Stack:** TypeScript 6, Node.js 24, Prisma 7.8, PostgreSQL, Vitest, pnpm 11, Turborepo, devrouter, agent-browser.

## Global Constraints

- Apply this behavior only when a new user submits first-login settings with `seedDemoElements: true`; do not backfill existing users or add a separate seeding action.
- Create exactly one answer collection named `Demo Teaching Activities` with the six entries and description specified below; both new elements must reference it.
- Seed `Demoquestion SE` with two inputs and the correct entries `Live poll` and `One-minute paper`.
- Seed `Demoquestion CS` with two cases, four selected items, three criteria, and a sample range for all 24 item/criterion combinations.
- Add one new untimed Demo Live Quiz block containing selection first and case study second; leave all existing blocks unchanged.
- Keep content English, matching the existing onboarding demos.
- Do not change Prisma schema, migrations, GraphQL schema/operations, frontend code, dependencies, or public documentation.
- Keep the complete first-login seed atomic without refactoring the legacy seeder's content: conditionally claim `User.firstLogin` before seeding, pass one transaction client through every seed write, and leave a failed claim retryable through rollback.
- Before editing Prisma calls, use Context7 to resolve Prisma ORM and confirm the installed Prisma 7 transaction, nested-create, relation-connect, and relation-include APIs. If Context7 is unavailable, record the official Prisma documentation used as the fallback.
- Run pnpm, Prisma, and tests inside the self-contained DevPod through `devrouter exec . -- ...`.
- Use Biome formatting for TypeScript and Prettier for Markdown, strict TypeScript, no semicolons, single quotes, and trailing commas.
- Use the approved design as the source of truth: `project/2026-07-31-selection-case-study-demo-questions-design.md`.

---

## File Map

| File                                        | Responsibility                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/graphql/src/services/accounts.ts` | Create the shared answer collection and both relational elements, then include them in the existing demo live quiz.                                               |
| `packages/graphql/test/accounts.test.ts`    | Verify opt-in/opt-out behavior, relational integrity, exact case-study options, derived permissions, quiz snapshots, and initial results against a real database. |
| `docs/data-and-migrations.md`               | Document first-login demo seeding as a third, request-driven seed path and explain the shared answer-collection relationship.                                    |
| `docs/log/2026-08-04-...-seeding.md`        | Record the behavior and wiki update as a new dated log file (one file per change batch).                                                                          |

## Finalization research and decisions

- **Evidence:** Context7 was not available in this session. The repository already uses `PrismaTransactionClient` for transaction-safe helpers, and the official [Prisma transactions documentation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) confirms interactive transactions, nested relation writes, relation `connect`, relation `include`, and bounded `timeout`/`maxWait` options for the installed API family.
- **Decision:** Use one root interactive transaction with a conditional `user.updateMany({ where: { id, firstLogin: true }, data: { firstLogin: false } })` claim. Pass its transaction client through all demo seeding writes, remove the helper's nested transaction, and return a fresh user when the claim count is zero.
- **Risk:** This changes late first-login seed failures from partial persistence to all-or-nothing rollback. The explicit transaction timeout must be measured against the real seeder and concurrent replay test.
- **Test:** Run identical first-login calls with `Promise.all`; both calls must resolve without error, while the user has exactly one answer collection, nine demo elements, and one Demo Live Quiz. A deliberate late Prisma validation failure must leave `firstLogin` true and no demo resources persisted so a later retry can claim it. The finalized six-test focused suite completed in 7.51 seconds, below the 30-second transaction timeout.

## Progress

- **2026-08-09 — takeover:** Reconciled the existing `review/pr5261` worktree with `origin/v3` by merging current `origin/v3` at `014ac216a`; the worktree was clean at the merge point and the PR's six-file scope is preserved relative to `origin/v3`.
- **2026-08-09 — finalization:** Reworked first-login seeding around a conditional transaction claim, passed the transaction client through the full seeder, removed the helper's nested transaction, reduced the duplicated relation scaffolding, and added shortname-conflict, rollback-retry, and concurrent-replay coverage.
- **Active:** Commit the verified finalization diff, complete the exact-range final review and required maintainability/security gates, then read back the post-push CI/Sonar state only if publication is explicitly authorized.

### Task 1: Seed the relational selection and case-study bundle

**Files:**

- Create: `packages/graphql/test/accounts.test.ts`
- Modify: `packages/graphql/src/services/accounts.ts:1232-1545`

**Interfaces:**

- Consumes: `changeInitialSettings(args, ctx)`, `ContextWithUser`, `PrismaTransactionContextWithUser`, `recomputeDerivedPermissions(args, prisma)`, the existing `Demo Tag` created by the SC demo, and Prisma's transaction client inferred from `ctx.prisma.$transaction`.
- Produces: private `seedDemoSelectionAndCaseStudyElements(ctx)` returning `{ questionSE, questionCS }`, where both elements include `answerCollection.entries` and `answerCollectionItems` for later consumption by `processElementData`.

- [x] **Step 1: Confirm the installed Prisma APIs before editing**

Use Context7's `resolve-library-id` for Prisma ORM, then query documentation for Prisma 7.8 interactive transactions, nested relation creation, `connect`, and `include`. If Context7 is unavailable, use the official Prisma transactions documentation recorded in the research section. Confirm that the repository's existing calls remain valid; do not change dependency versions.

Expected: documentation supports `prisma.$transaction(async (tx) => ...)`, nested `entries.create`, relation `connect`, and nested relation `include` in create results.

- [x] **Step 2: Add the database-backed account-service test**

Create `packages/graphql/test/accounts.test.ts` with this setup and database-backed cases covering opt-in seeding, opt-out, repeated first-login calls, a shortname conflict, a deliberate late Prisma validation failure with retry, and concurrent identical first-login calls:

```ts
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementType,
  Locale,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  ElementOptionsCaseStudy,
  ElementOptionsSelection,
} from '@klicker-uzh/types'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { changeInitialSettings } from '../src/services/accounts.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userOne } from './userData.js'

const COLLECTION_ENTRIES = [
  'Live poll',
  'Think-pair-share',
  'Small-group case discussion',
  'One-minute paper',
  'Mini-lecture',
  'Instructor demonstration',
]

describe('Account demo element seeding', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
  })

  afterEach(async () => testCleanup(prisma))

  it('seeds selection and case study demos with one shared answer collection', async () => {
    await changeInitialSettings(
      {
        shortname: userOne.shortname,
        locale: Locale.en,
        sendUpdates: false,
        seedDemoElements: true,
      },
      userOneCtx
    )

    const collection = await prisma.answerCollection.findFirstOrThrow({
      where: {
        ownerId: userOne.id,
        name: 'Demo Teaching Activities',
      },
      include: { entries: true, permissions: true },
    })

    await expect(
      prisma.answerCollection.count({
        where: {
          ownerId: userOne.id,
          name: 'Demo Teaching Activities',
        },
      })
    ).resolves.toBe(1)

    expect(collection.description).toBe(
      'Reusable teaching activities used by the demo selection and case study questions.'
    )
    expect(collection.entries.map((entry) => entry.value).sort()).toEqual(
      [...COLLECTION_ENTRIES].sort()
    )
    expect(collection.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
        }),
      ])
    )

    const entryId = (value: string) => {
      const entry = collection.entries.find(
        (candidate) => candidate.value === value
      )
      if (!entry)
        throw new Error(`Missing test answer collection entry: ${value}`)
      return entry.id
    }

    const elements = await prisma.element.findMany({
      where: {
        ownerId: userOne.id,
        name: { in: ['Demoquestion SE', 'Demoquestion CS'] },
      },
      include: {
        tags: true,
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
        permissions: true,
      },
    })

    expect(elements).toHaveLength(2)
    const selection = elements.find(
      (element) => element.type === ElementType.SELECTION
    )
    const caseStudy = elements.find(
      (element) => element.type === ElementType.CASE_STUDY
    )
    expect(selection).toBeDefined()
    expect(caseStudy).toBeDefined()

    expect(selection).toMatchObject({
      name: 'Demoquestion SE',
      basePoints: true,
      pointsMultiplier: 1,
      answerCollectionId: collection.id,
    })
    expect(selection!.content).toBe(
      'You are teaching a large lecture and want to collect an individual response from every student. Select the two activities that meet this requirement.'
    )
    expect(selection!.explanation).toBe(
      'Live polls and one-minute papers collect an individual response from each student. Other activities can be highly interactive, but do not necessarily capture a response from everyone.'
    )
    expect(selection!.tags.map((tag) => tag.name)).toEqual(['Demo Tag'])
    expect(selection!.answerCollection?.id).toBe(collection.id)
    expect(selection!.options as ElementOptionsSelection).toEqual({
      hasSampleSolution: true,
      numberOfInputs: 2,
    })
    expect(
      selection!.answerCollectionItems.map((entry) => entry.id).sort()
    ).toEqual([entryId('Live poll'), entryId('One-minute paper')].sort())
    expect(selection!.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
        }),
      ])
    )

    expect(caseStudy).toMatchObject({
      name: 'Demoquestion CS',
      basePoints: true,
      pointsMultiplier: 1,
      answerCollectionId: collection.id,
    })
    expect(caseStudy!.content).toBe(
      'Compare four teaching activities in two teaching settings. For each case, rate every activity by expected student engagement, preparation effort, and in-class time.'
    )
    expect(caseStudy!.explanation).toBe(
      'The sample ranges are illustrative rather than universally correct. Appropriate ratings depend on how each activity is designed and facilitated.'
    )
    expect(caseStudy!.tags.map((tag) => tag.name)).toEqual(['Demo Tag'])
    expect(caseStudy!.answerCollection?.id).toBe(collection.id)
    expect(
      caseStudy!.answerCollectionItems.map((entry) => entry.id).sort()
    ).toEqual(
      [
        entryId('Live poll'),
        entryId('Think-pair-share'),
        entryId('Small-group case discussion'),
        entryId('Mini-lecture'),
      ].sort()
    )
    expect(caseStudy!.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
        }),
      ])
    )

    const caseStudyOptions = caseStudy!.options as ElementOptionsCaseStudy
    expect(caseStudyOptions).toEqual({
      hasSampleSolution: true,
      criteria: [
        {
          id: 'demo-engagement',
          name: 'Expected engagement',
          order: 0,
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: 'demo-preparation',
          name: 'Preparation effort',
          order: 1,
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: 'demo-time',
          name: 'In-class time',
          order: 2,
          min: 1,
          max: 20,
          step: 1,
          unit: 'min',
        },
      ],
      cases: [
        {
          id: 'demo-large-lecture',
          title: 'Large introductory lecture',
          description:
            'You are teaching an introductory lecture with 300 students in fixed seating. You have at most 20 minutes for an activity and need an approach that works at scale.',
          order: 0,
          solutions: [
            {
              itemId: entryId('Live poll'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 3, max: 5 },
                { criterionId: 'demo-preparation', min: 2, max: 3 },
                { criterionId: 'demo-time', min: 3, max: 7 },
              ],
            },
            {
              itemId: entryId('Think-pair-share'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 4, max: 5 },
                { criterionId: 'demo-preparation', min: 1, max: 2 },
                { criterionId: 'demo-time', min: 6, max: 10 },
              ],
            },
            {
              itemId: entryId('Small-group case discussion'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 3, max: 4 },
                { criterionId: 'demo-preparation', min: 3, max: 5 },
                { criterionId: 'demo-time', min: 12, max: 20 },
              ],
            },
            {
              itemId: entryId('Mini-lecture'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 1, max: 2 },
                { criterionId: 'demo-preparation', min: 2, max: 4 },
                { criterionId: 'demo-time', min: 10, max: 20 },
              ],
            },
          ],
        },
        {
          id: 'demo-small-seminar',
          title: 'Small advanced seminar',
          description:
            'You are teaching an advanced seminar with 20 students in a room with flexible seating. You can devote up to 20 minutes to an activity and want students to engage deeply with the material.',
          order: 1,
          solutions: [
            {
              itemId: entryId('Live poll'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 2, max: 4 },
                { criterionId: 'demo-preparation', min: 2, max: 3 },
                { criterionId: 'demo-time', min: 3, max: 7 },
              ],
            },
            {
              itemId: entryId('Think-pair-share'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 4, max: 5 },
                { criterionId: 'demo-preparation', min: 1, max: 2 },
                { criterionId: 'demo-time', min: 6, max: 10 },
              ],
            },
            {
              itemId: entryId('Small-group case discussion'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 4, max: 5 },
                { criterionId: 'demo-preparation', min: 3, max: 5 },
                { criterionId: 'demo-time', min: 12, max: 20 },
              ],
            },
            {
              itemId: entryId('Mini-lecture'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 1, max: 3 },
                { criterionId: 'demo-preparation', min: 2, max: 4 },
                { criterionId: 'demo-time', min: 10, max: 20 },
              ],
            },
          ],
        },
      ],
    })
  })

  it('does not seed demo resources when the user opts out', async () => {
    await changeInitialSettings(
      {
        shortname: userOne.shortname,
        locale: Locale.en,
        sendUpdates: false,
        seedDemoElements: false,
      },
      userOneCtx
    )

    await expect(
      prisma.answerCollection.count({ where: { ownerId: userOne.id } })
    ).resolves.toBe(0)
    await expect(
      prisma.element.count({ where: { ownerId: userOne.id } })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuiz.count({ where: { ownerId: userOne.id } })
    ).resolves.toBe(0)
  })
})
```

- [x] **Step 3: Run the focused test and confirm the opt-in case fails**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: the initial opt-in assertion fails before the seeder implementation exists; after implementation, the suite proves that a shortname conflict leaves `firstLogin` and demo resources unchanged, a failed transaction rolls back all newly-created demo resources and can be retried, and concurrent requests create one complete demo bundle.

- [x] **Step 4: Add the private transaction-backed helper**

Insert this helper immediately before `seedDemoQuestions` in `packages/graphql/src/services/accounts.ts`:

The code shape below is the implementation contract; the finalized helper uses local builders for repeated relation scaffolding and case-study ranges, while retaining the same transaction-client flow.

```ts
async function seedDemoSelectionAndCaseStudyElements(
  ctx: PrismaTransactionContextWithUser
) {
  const answerCollection = await ctx.prisma.answerCollection.create({
      data: {
        name: 'Demo Teaching Activities',
        description:
          'Reusable teaching activities used by the demo selection and case study questions.',
        entries: {
          create: [
            'Live poll',
            'Think-pair-share',
            'Small-group case discussion',
            'One-minute paper',
            'Mini-lecture',
            'Instructor demonstration',
          ].map((value) => ({ value })),
        },
        owner: { connect: { id: ctx.user.sub } },
      },
      include: { entries: true },
    })

    const getEntryId = (value: string) => {
      const entry = answerCollection.entries.find(
        (candidate) => candidate.value === value
      )
      if (!entry) {
        throw new Error(`Demo answer collection entry missing: ${value}`)
      }
      return entry.id
    }

  const questionSE = await ctx.prisma.element.create({
      data: {
        name: 'Demoquestion SE',
        type: DB.ElementType.SELECTION,
        content:
          'You are teaching a large lecture and want to collect an individual response from every student. Select the two activities that meet this requirement.',
        explanation:
          'Live polls and one-minute papers collect an individual response from each student. Other activities can be highly interactive, but do not necessarily capture a response from everyone.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          numberOfInputs: 2,
        },
        owner: { connect: { id: ctx.user.sub } },
        tags: {
          connect: {
            ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' },
          },
        },
        answerCollection: { connect: { id: answerCollection.id } },
        answerCollectionItems: {
          connect: [
            { id: getEntryId('Live poll') },
            { id: getEntryId('One-minute paper') },
          ],
        },
      },
      include: {
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
      },
    })

const questionCS = await ctx.prisma.element.create({
      data: {
        name: 'Demoquestion CS',
        type: DB.ElementType.CASE_STUDY,
        content:
          'Compare four teaching activities in two teaching settings. For each case, rate every activity by expected student engagement, preparation effort, and in-class time.',
        explanation:
          'The sample ranges are illustrative rather than universally correct. Appropriate ratings depend on how each activity is designed and facilitated.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          criteria: [
            {
              id: 'demo-engagement',
              name: 'Expected engagement',
              order: 0,
              min: 1,
              max: 5,
              step: 1,
            },
            {
              id: 'demo-preparation',
              name: 'Preparation effort',
              order: 1,
              min: 1,
              max: 5,
              step: 1,
            },
            {
              id: 'demo-time',
              name: 'In-class time',
              order: 2,
              min: 1,
              max: 20,
              step: 1,
              unit: 'min',
            },
          ],
          cases: [
            {
              id: 'demo-large-lecture',
              title: 'Large introductory lecture',
              description:
                'You are teaching an introductory lecture with 300 students in fixed seating. You have at most 20 minutes for an activity and need an approach that works at scale.',
              order: 0,
              solutions: [
                {
                  itemId: getEntryId('Live poll'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 3, max: 5 },
                    { criterionId: 'demo-preparation', min: 2, max: 3 },
                    { criterionId: 'demo-time', min: 3, max: 7 },
                  ],
                },
                {
                  itemId: getEntryId('Think-pair-share'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 4, max: 5 },
                    { criterionId: 'demo-preparation', min: 1, max: 2 },
                    { criterionId: 'demo-time', min: 6, max: 10 },
                  ],
                },
                {
                  itemId: getEntryId('Small-group case discussion'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 3, max: 4 },
                    { criterionId: 'demo-preparation', min: 3, max: 5 },
                    { criterionId: 'demo-time', min: 12, max: 20 },
                  ],
                },
                {
                  itemId: getEntryId('Mini-lecture'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 1, max: 2 },
                    { criterionId: 'demo-preparation', min: 2, max: 4 },
                    { criterionId: 'demo-time', min: 10, max: 20 },
                  ],
                },
              ],
            },
            {
              id: 'demo-small-seminar',
              title: 'Small advanced seminar',
              description:
                'You are teaching an advanced seminar with 20 students in a room with flexible seating. You can devote up to 20 minutes to an activity and want students to engage deeply with the material.',
              order: 1,
              solutions: [
                {
                  itemId: getEntryId('Live poll'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 2, max: 4 },
                    { criterionId: 'demo-preparation', min: 2, max: 3 },
                    { criterionId: 'demo-time', min: 3, max: 7 },
                  ],
                },
                {
                  itemId: getEntryId('Think-pair-share'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 4, max: 5 },
                    { criterionId: 'demo-preparation', min: 1, max: 2 },
                    { criterionId: 'demo-time', min: 6, max: 10 },
                  ],
                },
                {
                  itemId: getEntryId('Small-group case discussion'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 4, max: 5 },
                    { criterionId: 'demo-preparation', min: 3, max: 5 },
                    { criterionId: 'demo-time', min: 12, max: 20 },
                  ],
                },
                {
                  itemId: getEntryId('Mini-lecture'),
                  criteriaSolutions: [
                    { criterionId: 'demo-engagement', min: 1, max: 3 },
                    { criterionId: 'demo-preparation', min: 2, max: 4 },
                    { criterionId: 'demo-time', min: 10, max: 20 },
                  ],
                },
              ],
            },
          ],
        },
        owner: { connect: { id: ctx.user.sub } },
        tags: {
          connect: {
            ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' },
          },
        },
        answerCollection: { connect: { id: answerCollection.id } },
        answerCollectionItems: {
          connect: [
            { id: getEntryId('Live poll') },
            { id: getEntryId('Think-pair-share') },
            { id: getEntryId('Small-group case discussion') },
            { id: getEntryId('Mini-lecture') },
          ],
        },
      },
      include: {
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
      },
    })

    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: ctx.user.sub },
      ctx.prisma
    )
    await recomputeDerivedPermissions(
      { elementId: questionSE.id, userId: ctx.user.sub },
      ctx.prisma
    )
    await recomputeDerivedPermissions(
      { elementId: questionCS.id, userId: ctx.user.sub },
      ctx.prisma
    )

    return { questionSE, questionCS }
  }
}
```

Call it after the content element and its permissions are created, while the `Demo Tag` is guaranteed to exist:

```ts
  await seedDemoSelectionAndCaseStudyElements(ctx)

  const blockData = [
```

- [x] **Step 5: Format and run the focused test**

The final implementation may use local builders for repeated relation and case-solution data to keep the helper below the Sonar duplication threshold, but every Prisma write and permission recomputation must use `ctx.prisma`.

Run:

```bash
devrouter exec . -- pnpm exec biome format --write packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: both account-seeding tests pass. The opt-in test proves the exact collection, relations, JSON options, and owner permissions; the opt-out test proves no resources are created.

- [x] **Step 6: Run the package typecheck**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
```

Expected: TypeScript exits with code 0.

- [x] **Step 7: Commit the relational bundle**

Review only the intended files, then commit:

```bash
git diff -- packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
git add packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
git diff --cached --check
git commit -m "feat(accounts): seed relational demo questions"
```

Expected: the commit contains the helper, its call, and the two database-backed tests only.

### Task 2: Add both relational demos to the Demo Live Quiz

**Files:**

- Modify: `packages/graphql/test/accounts.test.ts`
- Modify: `packages/graphql/src/services/accounts.ts:1546-1624`

**Interfaces:**

- Consumes: `seedDemoSelectionAndCaseStudyElements(ctx)` from Task 1 and its relation-enriched `{ questionSE, questionCS }` result.
- Produces: a sixth `blockData` entry with `timeLimit: null`, `randomSelection: null`, and `[questionSE, questionCS]`; complete `SelectionElementData` and `CaseStudyElementData` snapshots created by the existing `processElementData` path.

- [x] **Step 1: Extend the opt-in test with failing live-quiz assertions**

Add these type imports from `@klicker-uzh/types`:

```ts
import type {
  CaseStudyElementData,
  ElementOptionsCaseStudy,
  ElementOptionsSelection,
  ElementResultsCaseStudy,
  ElementResultsSelection,
  SelectionElementData,
} from '@klicker-uzh/types'
```

Append this code to the opt-in test, after the case-study options assertion:

```ts
const liveQuiz = await prisma.liveQuiz.findFirstOrThrow({
  where: { ownerId: userOne.id, name: 'Demo Live Quiz' },
  include: {
    blocks: {
      orderBy: { order: 'asc' },
      include: { elements: { orderBy: { order: 'asc' } } },
    },
  },
})

expect(liveQuiz.blocks).toHaveLength(6)
expect(
  liveQuiz.blocks.slice(0, 5).map((block) => ({
    timeLimit: block.timeLimit,
    randomSelection: block.randomSelection,
    elementTypes: block.elements.map((element) => element.elementType),
  }))
).toEqual([
  {
    timeLimit: 100,
    randomSelection: null,
    elementTypes: [ElementType.SC, ElementType.MC],
  },
  {
    timeLimit: null,
    randomSelection: null,
    elementTypes: [
      ElementType.KPRIM,
      ElementType.NUMERICAL,
      ElementType.FREE_TEXT,
    ],
  },
  {
    timeLimit: 50,
    randomSelection: null,
    elementTypes: [ElementType.SC],
  },
  {
    timeLimit: 20,
    randomSelection: null,
    elementTypes: [ElementType.MC],
  },
  {
    timeLimit: null,
    randomSelection: null,
    elementTypes: [ElementType.KPRIM],
  },
])
const demoBlock = liveQuiz.blocks[5]!
expect(demoBlock).toMatchObject({
  order: 5,
  timeLimit: null,
  randomSelection: null,
})
expect(demoBlock.elements.map((element) => element.elementType)).toEqual([
  ElementType.SELECTION,
  ElementType.CASE_STUDY,
])

const selectionInstance = demoBlock.elements[0]!
expect(selectionInstance.elementId).toBe(selection!.id)
const selectionData = selectionInstance.elementData as SelectionElementData
expect(selectionData.options.answerCollection?.id).toBe(collection.id)
expect(
  selectionData.options.answerCollection?.entries
    .map((entry) => entry.value)
    .sort()
).toEqual([...COLLECTION_ENTRIES].sort())
expect(selectionData.options.answerCollectionSolutionIds?.sort()).toEqual(
  [entryId('Live poll'), entryId('One-minute paper')].sort()
)

const selectionResults = selectionInstance.results as ElementResultsSelection
expect(selectionResults).toEqual({
  selections: Object.fromEntries(
    collection.entries.map((entry) => [entry.id, 0])
  ),
  total: 0,
})
expect(selectionInstance.anonymousResults).toEqual(selectionResults)

const caseStudyInstance = demoBlock.elements[1]!
expect(caseStudyInstance.elementId).toBe(caseStudy!.id)
const caseStudyData = caseStudyInstance.elementData as CaseStudyElementData
const expectedCaseStudyItemIds = [
  entryId('Live poll'),
  entryId('Think-pair-share'),
  entryId('Small-group case discussion'),
  entryId('Mini-lecture'),
].sort()
expect(caseStudyData.options.answerCollectionId).toBe(collection.id)
expect(caseStudyData.options.items?.map((item) => item.id).sort()).toEqual(
  expectedCaseStudyItemIds
)
expect(caseStudyData.options.criteria).toEqual(caseStudyOptions.criteria)
expect(caseStudyData.options.cases).toEqual(caseStudyOptions.cases)

const caseStudyResults = caseStudyInstance.results as ElementResultsCaseStudy
expect(caseStudyResults.total).toBe(0)
for (const caseId of ['demo-large-lecture', 'demo-small-seminar']) {
  for (const itemId of expectedCaseStudyItemIds) {
    for (const criterionId of [
      'demo-engagement',
      'demo-preparation',
      'demo-time',
    ]) {
      expect(
        caseStudyResults.assessments[caseId]![String(itemId)]![criterionId]
      ).toEqual({})
    }
  }
}
expect(caseStudyInstance.anonymousResults).toEqual(caseStudyResults)
```

- [x] **Step 2: Run the focused test and confirm the quiz assertion fails**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: the opt-in test fails because the current Demo Live Quiz has five blocks instead of six.

- [x] **Step 3: Feed both elements into the existing live-quiz builder**

Replace the Task 1 helper call with:

```ts
const { questionSE, questionCS } =
  await seedDemoSelectionAndCaseStudyElements(ctx)
```

Append this object after the existing KPRIM-only block in `blockData`:

```ts
    {
      questions: [questionSE, questionCS],
      timeLimit: null,
      randomSelection: null,
    },
```

Do not change `processElementData`, `getInitialInstanceResults`, block ordering logic, existing block contents, or quiz metadata.

- [x] **Step 4: Format and run the focused test again**

Run:

```bash
devrouter exec . -- pnpm exec biome format --write packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: both tests pass, including the complete live-quiz snapshot and initial-results assertions.

- [x] **Step 5: Run GraphQL package checks**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
```

Expected: both commands exit with code 0.

- [x] **Step 6: Commit the live-quiz integration**

```bash
git diff -- packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
git add packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
git diff --cached --check
git commit -m "feat(accounts): include relational demos in live quiz"
```

Expected: the commit contains only the new block wiring and its instance-level assertions.

### Task 3: Document first-login demo seeding

**Files:**

- Modify: `docs/data-and-migrations.md:41-50`
- Modify: `docs/log/2026-08-04-demo-selection-case-study-seeding.md` (new file)

**Interfaces:**

- Consumes: the behavior implemented in Tasks 1 and 2.
- Produces: durable engineering-wiki guidance distinguishing request-driven onboarding seeding from the three environment fixture seed paths.

- [x] **Step 1: Add the first-login seed-path documentation**

Insert this subsection after the existing Prisma 7 reset paragraph in `docs/data-and-migrations.md`:

```md
### First-login demo content

First-login demo content is a third, request-driven seed path rather than an environment fixture. When a new lecturer submits `changeInitialSettings` with `seedDemoElements: true`, `packages/graphql/src/services/accounts.ts:seedDemoQuestions` creates the owned demo elements and Demo Live Quiz inside the first-login transaction. Selection and case-study demos share one owned `Demo Teaching Activities` answer collection: selection correctness and case-study items are Prisma relations to its entries, while case-study sample ranges embed those generated entry IDs in typed JSON. The transaction-backed relational collection-plus-elements bundle is then snapshotted into the final untimed live-quiz block through `processElementData`.

This path does not run for users who opt out, does not backfill existing accounts, and is independent of the dev and Playwright fixture seeds above.
```

- [x] **Step 2: Add the wiki log entry**

Create `docs/log/2026-08-04-demo-selection-case-study-seeding.md`. The wiki
uses one log file per change batch — never append to `docs/log.md`, which
exists only to explain that convention:

```md
## 2026-08-04

- **Update**: [data-and-migrations](./data-and-migrations.md) documents request-driven first-login demo seeding, including the shared answer collection used by the selection and case-study demos and their final Demo Live Quiz block.
```

- [x] **Step 3: Format and inspect the documentation diff**

Run:

```bash
devrouter exec . -- pnpm exec prettier --write docs/data-and-migrations.md docs/log/2026-08-04-demo-selection-case-study-seeding.md
git diff --check
git diff -- docs/data-and-migrations.md docs/log/2026-08-04-demo-selection-case-study-seeding.md
```

Expected: Markdown is formatted, the diff is limited to the new subsection and dated log entry, and no public docs file changed.

- [x] **Step 4: Commit the wiki update**

```bash
git add docs/data-and-migrations.md docs/log/2026-08-04-demo-selection-case-study-seeding.md
git diff --cached --check
git commit -m "docs: document first-login demo seeding"
```

Expected: one documentation-only commit.

### Task 4: Complete quality and browser verification

**Files:**

- Verify: `packages/graphql/src/services/accounts.ts`
- Verify: `packages/graphql/test/accounts.test.ts`
- Verify: `docs/data-and-migrations.md`
- Verify: `docs/log/2026-08-04-demo-selection-case-study-seeding.md`
- Compare against: `project/2026-07-31-selection-case-study-demo-questions-design.md`

**Interfaces:**

- Consumes: all implementation and documentation commits.
- Produces: test, static-analysis, browser, screenshot, and clean-worktree evidence suitable for handoff or PR preparation.

- [x] **Step 1: Run the isolated database-backed test one final time**

```bash
devrouter exec . -- sh -lc 'export HATCHET_CLIENT_TOKEN="$(tr -d "[:space:]" < /config/authdisabled-token)" HATCHET_CLIENT_HOST_PORT=hatchet:7077 HATCHET_CLIENT_TLS_STRATEGY=none NODE_ENV=test; pnpm --filter @klicker-uzh/graphql exec vitest run test/accounts.test.ts'
```

Expected: six tests pass; the command uses the disposable DevPod database path and the focused run completes well below the 30-second transaction timeout. The package's `test:local` wrapper is not usable in this DevPod because it expects Docker inside the container.

- [x] **Step 2: Run package and repository quality gates**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
devrouter exec . -- pnpm run check:all
opengrep scan --config auto packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
```

Expected: every command exits with code 0 and opengrep reports no blocking findings in the changed implementation.

Read back the `SonarCloud Code Analysis` check for the exact published head. The quality gate must be green, and the duplication measure for new code must be at or below the repository threshold; the prior PR head failed because `accounts.ts` reported 72 duplicated lines. Do not report the PR as ready while that check remains red.

- [x] **Step 3: Prepare a disposable local onboarding state**

Run `devrouter ensure .` and confirm the reported checkout and routes match this worktree. Only against the self-contained local DevPod database, reset and reseed using the repository's documented destructive local sequence:

```bash
devrouter ensure .
devrouter exec . -- pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force
devrouter exec . -- pnpm --filter @klicker-uzh/prisma run prisma:push:raw
devrouter exec . -- pnpm --filter @klicker-uzh/prisma-data run seed:raw
```

Then set only the seeded local lecturer's first-login flag. The current container does not include `psql`, so use the generated Prisma client from a workspace package (holding no secret values in output) and report only the affected row count:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/prisma-data exec tsx -e 'import { prisma } from "@klicker-uzh/prisma"; void (async () => { const result = await prisma.user.updateMany({ where: { shortname: "lecturer" }, data: { firstLogin: true } }); console.log(JSON.stringify({ updatedUsers: result.count })); await prisma.$disconnect() })()'
```

Expected: exactly one row is updated. Stop immediately if the database is not the disposable DevPod database.

- [x] **Step 4: Verify onboarding and element-library behavior in a real browser**

Use the repository's `agent-browser` workflow and the Manage URL printed by `devrouter app ls --repo .`:

1. Sign in through delegated access as `lecturer` / `abcd`.
2. In the first-login modal, keep demo elements enabled and submit valid settings.
3. Confirm the element library shows `Demoquestion SE` with type Selection and `Demoquestion CS` with type Case Study.
4. Open each editor and confirm both reference `Demo Teaching Activities`; selection shows two correct answers, while case study shows two cases, four items, and three criteria.
5. Capture a screenshot of the element-library state containing both new demos.

Expected: no console errors, generic error notification, or missing answer-collection entries.

- [x] **Step 5: Verify the Demo Live Quiz block in the browser**

Open `Demo Live Quiz` in Manage and inspect its final block:

1. Confirm the final block is untimed.
2. Confirm Selection appears first and Case Study second.
3. Open the available preview/run surface and confirm all six selection options and all case-study cases, items, criteria, and controls render.
4. Capture a screenshot of the final block and one screenshot of the rendered case-study state.

Expected: the new elements render through the existing UI with no frontend code changes.

Evidence: `/private/tmp/pr5261-library-after.png`, `/private/tmp/pr5261-selection-editor.png`, and `/private/tmp/pr5261-case-study-editor.png` show the generated resources and editor previews. The corrected activity-details screenshot `/private/tmp/pr5261-demo-live-quiz-block6.png` shows the untimed sixth block with Selection before Case Study. After clearing the diagnostics, the final browser readback produced no new console or page errors; existing development warnings were not attributed to this change.

- [x] **Step 6: Restore the disposable local environment**

After screenshots are captured, reset and reseed the same verified local DevPod database with the commands from Step 3 so the lecturer account and demo resources return to the repository baseline.

Expected: no manual verification rows or demo resources remain outside the disposable environment.

- [ ] **Step 7: Review branch scope and acceptance criteria**

```bash
git diff --stat origin/v3...HEAD
git diff origin/v3...HEAD -- packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts docs/data-and-migrations.md docs/log/2026-08-04-demo-selection-case-study-seeding.md
git status --short --branch
```

Check every acceptance criterion in the approved design against the test assertions and browser evidence. Expected: only the spec, plan, account service, account test, and two wiki files differ from `origin/v3`; the worktree is clean.

- [ ] **Step 8: Complete the required review gates**

After committing the final changes, run one read-only integrated reviewer against the exact final commit range, with no edits or publication authority. Run the repository-required maintainability and bounded code-security gates for this full-path change, persist their reports under the ignored local review directory, verify every finding against the live diff, and rerun any gate whose addressed finding changes behavior. The final report must name the exact commit range and distinguish local evidence from GitHub CI, Sonar, browser, and post-push evidence.
