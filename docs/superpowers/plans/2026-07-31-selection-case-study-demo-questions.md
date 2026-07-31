# Selection and Case Study Demo Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed complete selection and case-study demo questions, their shared answer collection, and a new Demo Live Quiz block when a new lecturer opts into demo content.

**Architecture:** Keep `changeInitialSettings` and `seedDemoQuestions` as the existing entry points. Add one private, transaction-backed helper in the account service for the relational answer-collection bundle, return relation-enriched elements to the existing `processElementData` live-quiz path, and cover the persisted resources and instance snapshots with a database-backed service test.

**Tech Stack:** TypeScript 6, Node.js 24, Prisma 7.8, PostgreSQL, Vitest, pnpm 11, Turborepo, devrouter, agent-browser.

## Global Constraints

- Apply this behavior only when a new user submits first-login settings with `seedDemoElements: true`; do not backfill existing users or add a separate seeding action.
- Create exactly one answer collection named `Demo Teaching Activities` with the six entries and description specified below; both new elements must reference it.
- Seed `Demoquestion SE` with two inputs and the correct entries `Live poll` and `One-minute paper`.
- Seed `Demoquestion CS` with two cases, four selected items, three criteria, and a sample range for all 24 item/criterion combinations.
- Add one new untimed Demo Live Quiz block containing selection first and case study second; leave all existing blocks unchanged.
- Keep content English, matching the existing onboarding demos.
- Do not change Prisma schema, migrations, GraphQL schema/operations, frontend code, dependencies, or public documentation.
- Keep the new collection-plus-elements bundle atomic without refactoring the legacy seeder or changing its broader retry behavior.
- Before editing Prisma calls, use Context7 to resolve Prisma ORM and confirm the installed Prisma 7 transaction, nested-create, relation-connect, and relation-include APIs.
- Run pnpm, Prisma, and tests inside the self-contained DevPod through `devrouter exec . -- ...`.
- Use Prettier formatting, strict TypeScript, no semicolons, single quotes, and trailing commas.
- Use the approved design as the source of truth: `docs/superpowers/specs/2026-07-31-selection-case-study-demo-questions-design.md`.

---

## File Map

| File                                        | Responsibility                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/graphql/src/services/accounts.ts` | Create the shared answer collection and both relational elements, then include them in the existing demo live quiz.                                               |
| `packages/graphql/test/accounts.test.ts`    | Verify opt-in/opt-out behavior, relational integrity, exact case-study options, derived permissions, quiz snapshots, and initial results against a real database. |
| `docs/data-and-migrations.md`               | Document first-login demo seeding as a fourth, request-driven seed path and explain the shared answer-collection relationship.                                    |
| `docs/log.md`                               | Record the behavior and wiki update under 2026-07-31.                                                                                                             |

### Task 1: Seed the relational selection and case-study bundle

**Files:**

- Create: `packages/graphql/test/accounts.test.ts`
- Modify: `packages/graphql/src/services/accounts.ts:1232-1545`

**Interfaces:**

- Consumes: `changeInitialSettings(args, ctx)`, `ContextWithUser`, `recomputeDerivedPermissions(args, prisma)`, the existing `Demo Tag` created by the SC demo, and Prisma's transaction client inferred from `ctx.prisma.$transaction`.
- Produces: private `seedDemoSelectionAndCaseStudyElements(ctx)` returning `{ questionSE, questionCS }`, where both elements include `answerCollection.entries` and `answerCollectionItems` for later consumption by `processElementData`.

- [ ] **Step 1: Confirm the installed Prisma APIs before editing**

Use Context7's `resolve-library-id` for Prisma ORM, then query documentation for Prisma 7.8 interactive transactions, nested relation creation, `connect`, and `include`. Confirm that the repository's existing calls remain valid; do not change dependency versions.

Expected: documentation supports `prisma.$transaction(async (tx) => ...)`, nested `entries.create`, relation `connect`, and nested relation `include` in create results.

- [ ] **Step 2: Add the database-backed account-service test**

Create `packages/graphql/test/accounts.test.ts` with this setup and the two initial cases:

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

- [ ] **Step 3: Run the focused test and confirm the opt-in case fails**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: the opt-out case passes, while the opt-in case fails because `Demo Teaching Activities` does not exist.

- [ ] **Step 4: Add the private transaction-backed helper**

Insert this helper immediately before `seedDemoQuestions` in `packages/graphql/src/services/accounts.ts`:

```ts
async function seedDemoSelectionAndCaseStudyElements(ctx: ContextWithUser) {
  return ctx.prisma.$transaction(async (prisma) => {
    const answerCollection = await prisma.answerCollection.create({
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

    const questionSE = await prisma.element.create({
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

    const questionCS = await prisma.element.create({
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
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: questionSE.id, userId: ctx.user.sub },
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: questionCS.id, userId: ctx.user.sub },
      prisma
    )

    return { questionSE, questionCS }
  })
}
```

Call it after the content element and its permissions are created, while the `Demo Tag` is guaranteed to exist:

```ts
  await seedDemoSelectionAndCaseStudyElements(ctx)

  const blockData = [
```

- [ ] **Step 5: Format and run the focused test**

Run:

```bash
devrouter exec . -- pnpm exec prettier --write packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: both account-seeding tests pass. The opt-in test proves the exact collection, relations, JSON options, and owner permissions; the opt-out test proves no resources are created.

- [ ] **Step 6: Run the package typecheck**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
```

Expected: TypeScript exits with code 0.

- [ ] **Step 7: Commit the relational bundle**

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

- [ ] **Step 1: Extend the opt-in test with failing live-quiz assertions**

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

- [ ] **Step 2: Run the focused test and confirm the quiz assertion fails**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: the opt-in test fails because the current Demo Live Quiz has five blocks instead of six.

- [ ] **Step 3: Feed both elements into the existing live-quiz builder**

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

- [ ] **Step 4: Format and run the focused test again**

Run:

```bash
devrouter exec . -- pnpm exec prettier --write packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: both tests pass, including the complete live-quiz snapshot and initial-results assertions.

- [ ] **Step 5: Run GraphQL package checks**

Run:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit the live-quiz integration**

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
- Modify: `docs/log.md:1-3`

**Interfaces:**

- Consumes: the behavior implemented in Tasks 1 and 2.
- Produces: durable engineering-wiki guidance distinguishing request-driven onboarding seeding from the three environment fixture seed paths.

- [ ] **Step 1: Add the first-login seed-path documentation**

Insert this subsection after the existing Prisma 7 reset paragraph in `docs/data-and-migrations.md`:

```md
### First-login demo content

First-login demo content is a fourth, request-driven seed path rather than an environment fixture. When a new lecturer submits `changeInitialSettings` with `seedDemoElements: true`, `packages/graphql/src/services/accounts.ts:seedDemoQuestions` creates the owned demo elements and Demo Live Quiz. Selection and case-study demos share one owned `Demo Teaching Activities` answer collection: selection correctness and case-study items are Prisma relations to its entries, while case-study sample ranges embed those generated entry IDs in typed JSON. The relational collection-plus-elements bundle is created in a local transaction and then snapshotted into the final untimed live-quiz block through `processElementData`.

This path does not run for users who opt out, does not backfill existing accounts, and is independent of the dev, Cypress, and Playwright fixture seeds above.
```

- [ ] **Step 2: Add the wiki log entry**

Insert this at the top of `docs/log.md`, after `# Log`:

```md
## 2026-07-31

- **Update**: [data-and-migrations](./data-and-migrations.md) documents request-driven first-login demo seeding, including the shared answer collection used by the selection and case-study demos and their final Demo Live Quiz block.
```

- [ ] **Step 3: Format and inspect the documentation diff**

Run:

```bash
devrouter exec . -- pnpm exec prettier --write docs/data-and-migrations.md docs/log.md
git diff --check
git diff -- docs/data-and-migrations.md docs/log.md
```

Expected: Markdown is formatted, the diff is limited to the new subsection and dated log entry, and no public docs file changed.

- [ ] **Step 4: Commit the wiki update**

```bash
git add docs/data-and-migrations.md docs/log.md
git diff --cached --check
git commit -m "docs: document first-login demo seeding"
```

Expected: one documentation-only commit.

### Task 4: Complete quality and browser verification

**Files:**

- Verify: `packages/graphql/src/services/accounts.ts`
- Verify: `packages/graphql/test/accounts.test.ts`
- Verify: `docs/data-and-migrations.md`
- Verify: `docs/log.md`
- Compare against: `docs/superpowers/specs/2026-07-31-selection-case-study-demo-questions-design.md`

**Interfaces:**

- Consumes: all implementation and documentation commits.
- Produces: test, static-analysis, browser, screenshot, and clean-worktree evidence suitable for handoff or PR preparation.

- [ ] **Step 1: Run the isolated database-backed test one final time**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql test:local accounts.test.ts
```

Expected: two tests pass; the script tears down its disposable Postgres, Redis, and Hatchet resources.

- [ ] **Step 2: Run package and repository quality gates**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/graphql check
devrouter exec . -- pnpm --filter @klicker-uzh/graphql build
devrouter exec . -- pnpm run check:all
opengrep scan --config auto packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts
```

Expected: every command exits with code 0 and opengrep reports no blocking findings in the changed implementation.

- [ ] **Step 3: Prepare a disposable local onboarding state**

Run `devrouter ensure .` and confirm the reported checkout and routes match this worktree. Only against the self-contained local DevPod database, reset and reseed using the repository's documented destructive local sequence:

```bash
devrouter ensure .
devrouter exec . -- pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force
devrouter exec . -- pnpm --filter @klicker-uzh/prisma run prisma:push:raw
devrouter exec . -- pnpm --filter @klicker-uzh/prisma-data run seed:raw
```

Then set only the seeded local lecturer's first-login flag:

```bash
devrouter exec . -- sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE \"User\" SET \"firstLogin\" = true WHERE shortname = '\''lecturer'\'';"'
```

Expected: exactly one row is updated. Stop immediately if the database is not the disposable DevPod database.

- [ ] **Step 4: Verify onboarding and element-library behavior in a real browser**

Use the repository's `agent-browser` workflow and the Manage URL printed by `devrouter app ls --repo .`:

1. Sign in through delegated access as `lecturer` / `abcd`.
2. In the first-login modal, keep demo elements enabled and submit valid settings.
3. Confirm the element library shows `Demoquestion SE` with type Selection and `Demoquestion CS` with type Case Study.
4. Open each editor and confirm both reference `Demo Teaching Activities`; selection shows two correct answers, while case study shows two cases, four items, and three criteria.
5. Capture a screenshot of the element-library state containing both new demos.

Expected: no console errors, generic error notification, or missing answer-collection entries.

- [ ] **Step 5: Verify the Demo Live Quiz block in the browser**

Open `Demo Live Quiz` in Manage and inspect its final block:

1. Confirm the final block is untimed.
2. Confirm Selection appears first and Case Study second.
3. Open the available preview/run surface and confirm all six selection options and all case-study cases, items, criteria, and controls render.
4. Capture a screenshot of the final block and one screenshot of the rendered case-study state.

Expected: the new elements render through the existing UI with no frontend code changes.

- [ ] **Step 6: Restore the disposable local environment**

After screenshots are captured, reset and reseed the same verified local DevPod database with the commands from Step 3 so the lecturer account and demo resources return to the repository baseline.

Expected: no manual verification rows or demo resources remain outside the disposable environment.

- [ ] **Step 7: Review branch scope and acceptance criteria**

```bash
git diff --stat origin/v3...HEAD
git diff origin/v3...HEAD -- packages/graphql/src/services/accounts.ts packages/graphql/test/accounts.test.ts docs/data-and-migrations.md docs/log.md
git status --short --branch
```

Check every acceptance criterion in the approved design against the test assertions and browser evidence. Expected: only the spec, plan, account service, account test, and two wiki files differ from `origin/v3`; the worktree is clean.
