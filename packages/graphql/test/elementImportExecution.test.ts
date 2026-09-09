import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  answerCollectionSchema,
  elementSchema,
  type PackageAnswerCollection,
  type PackageElement,
} from '../src/lib/importExportPackageContract.js'
import {
  createElementImportExecutionOperationCounters,
  executeElementImportExecutionPlan,
} from '../src/services/elementImportExecution.js'
import {
  bindStagedImportMedia,
  createElementImportExecutionPlan,
} from '../src/services/elementImportExecutionPlan.js'
import {
  computeAnswerCollectionImportFingerprintFromDb,
  computeElementImportFingerprintFromDb,
} from '../src/services/importExportFingerprints.js'
import { initializePrisma, testCleanup } from './helpers.js'

const MAX_WAL_BYTES = 128n * 1024n * 1024n

function createCollection(
  ref: string,
  entryCount: number
): PackageAnswerCollection {
  return answerCollectionSchema.parse({
    ref,
    name: `Collection ${ref}`,
    description: `Description ${ref}`,
    entries: Array.from({ length: entryCount }, (_, index) => ({
      ref: `${ref}-entry-${index}`,
      value: `${ref} value ${index}`,
    })),
  })
}

function createSelectionElement({
  ref,
  collection,
  selectedRefs,
}: {
  ref: string
  collection: PackageAnswerCollection
  selectedRefs: string[]
}): PackageElement {
  return elementSchema.parse({
    ref,
    name: `Selection ${ref}`,
    content: `Select an answer for ${ref}`,
    type: DB.ElementType.SELECTION,
    options: { hasSampleSolution: true, numberOfInputs: 1 },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    answerCollectionRef: collection.ref,
    answerCollectionItemRefs: selectedRefs,
  })
}

function createCaseStudyElement(
  collection: PackageAnswerCollection
): PackageElement {
  const selected = collection.entries.slice(0, 2)
  return elementSchema.parse({
    ref: 'case-study',
    name: 'Case study',
    content: 'Evaluate the cases',
    type: DB.ElementType.CASE_STUDY,
    options: {
      hasSampleSolution: true,
      criteria: [
        {
          id: 'criterion-1',
          name: 'Quality',
          order: 0,
          min: 0,
          max: 5,
          step: 1,
        },
      ],
      cases: [
        {
          id: 'case-1',
          title: 'Case 1',
          description: 'Case description',
          order: 0,
          solutions: selected.map((entry, index) => ({
            itemRef: entry.ref,
            criteriaSolutions: [
              {
                criterionId: 'criterion-1',
                min: index === 0 ? 4 : 1,
                max: index === 0 ? 5 : 2,
              },
            ],
          })),
        },
      ],
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    answerCollectionRef: collection.ref,
    answerCollectionItemRefs: selected.map((entry) => entry.ref),
  })
}

function createNineTypeElements(
  collection: PackageAnswerCollection
): PackageElement[] {
  const choice = (ix: number, correct: boolean) => ({
    ix,
    value: `Choice ${ix}`,
    correct,
  })
  const parse = (value: Record<string, unknown>) => elementSchema.parse(value)
  const common = {
    content: 'Imported content',
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
  }

  return [
    parse({
      ...common,
      ref: 'sc',
      name: 'Single choice',
      type: DB.ElementType.SC,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [choice(0, true), choice(1, false)],
      },
    }),
    parse({
      ...common,
      ref: 'mc',
      name: 'Multiple choice',
      type: DB.ElementType.MC,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [choice(0, true), choice(1, true), choice(2, false)],
      },
    }),
    parse({
      ...common,
      ref: 'kprim',
      name: 'Kprim',
      type: DB.ElementType.KPRIM,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          choice(0, false),
          choice(1, false),
          choice(2, false),
          choice(3, false),
        ],
      },
    }),
    parse({
      ...common,
      ref: 'free-text',
      name: 'Free text',
      type: DB.ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        restrictions: { maxLength: 20 },
        solutions: ['Answer'],
      },
    }),
    parse({
      ...common,
      ref: 'numerical',
      name: 'Numerical',
      type: DB.ElementType.NUMERICAL,
      options: {
        hasSampleSolution: true,
        restrictions: { min: -10, max: 10 },
        exactSolutions: [0],
      },
    }),
    parse({
      ...common,
      ref: 'content',
      name: 'Content',
      type: DB.ElementType.CONTENT,
      options: {},
    }),
    parse({
      ...common,
      ref: 'flashcard',
      name: 'Flashcard',
      type: DB.ElementType.FLASHCARD,
      explanation: 'Back of the flashcard',
      options: {},
    }),
    createSelectionElement({
      ref: 'selection',
      collection,
      selectedRefs: [collection.entries[0]!.ref],
    }),
    createCaseStudyElement(collection),
  ]
}

function createBoundPlan({
  ownerId,
  packageHash,
  collections,
  elements,
}: {
  ownerId: string
  packageHash: string
  collections: PackageAnswerCollection[]
  elements: PackageElement[]
}) {
  return bindStagedImportMedia(
    createElementImportExecutionPlan({
      ownerId,
      packageHash,
      answerCollections: collections,
      elements,
      media: [],
    }),
    new Map()
  )
}

async function readWalLsn(prisma: DB.PrismaClient) {
  try {
    const rows = await prisma.$queryRaw<Array<{ lsn: string }>>`
      SELECT pg_current_wal_insert_lsn()::text AS lsn
    `
    return rows[0]?.lsn ?? null
  } catch {
    return null
  }
}

async function readWalDifference(
  prisma: DB.PrismaClient,
  before: string | null,
  after: string | null
) {
  if (!before || !after) return null
  try {
    const rows = await prisma.$queryRaw<Array<{ bytes: string }>>`
      SELECT pg_wal_lsn_diff(
        CAST(${after} AS pg_lsn),
        CAST(${before} AS pg_lsn)
      )::text AS bytes
    `
    return rows[0]?.bytes ? BigInt(rows[0].bytes) : null
  } catch {
    return null
  }
}

function failingTransactionClient({
  prisma,
  model,
  method,
  invocation,
  message,
}: {
  prisma: DB.Prisma.TransactionClient
  model: string
  method: string
  invocation: number
  message: string
}) {
  const delegate = (prisma as any)[model]
  let calls = 0
  const wrappedDelegate = new Proxy(delegate, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (property === method) {
        return async (...args: unknown[]) => {
          calls++
          if (calls === invocation) throw new Error(message)
          return await value.apply(target, args)
        }
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property === model) return wrappedDelegate
      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as DB.Prisma.TransactionClient
}

describe('bounded element import execution', () => {
  let prisma: DB.PrismaClient
  let ownerId: string

  beforeAll(async () => {
    prisma = (await initializePrisma()).prisma
  })

  beforeEach(async () => {
    await testCleanup(prisma)
    ownerId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.test`,
        shortname: `import-${ownerId.slice(0, 8)}`,
      },
    })
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('preserves all nine element types, private ownership, permissions, logs, relations, and fingerprints', async () => {
    const collection = createCollection('all-types-pool', 3)
    const elements = createNineTypeElements(collection)
    const plan = createBoundPlan({
      ownerId,
      packageHash: '1'.repeat(64),
      collections: [collection],
      elements,
    })
    const counters = createElementImportExecutionOperationCounters()
    for (const element of plan.elements) {
      expect(element).toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
    }
    expect(plan.answerCollections[0]).toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    })
    const result = await prisma.$transaction(
      async (tx) =>
        await executeElementImportExecutionPlan({
          plan,
          prisma: tx,
          counters,
        })
    )

    expect(result.createdElementIds).toHaveLength(9)
    expect(result.createdAnswerCollectionIds).toHaveLength(1)
    expect(counters).toEqual({
      collectionCreates: 1,
      entryCreateBatches: 1,
      entryRowsCreated: 3,
      entryRequeries: 1,
      elementCreateBatches: 1,
      elementRowsCreated: 9,
      relationUpdates: 2,
      permissionCreateBatches: 1,
      permissionRowsCreated: 10,
      activityLogCreateBatches: 1,
      activityLogRowsCreated: 9,
    })

    const imported = await prisma.element.findMany({
      where: { id: { in: result.createdElementIds } },
      include: {
        tags: true,
        answerCollectionItems: true,
        permissions: true,
      },
    })
    expect(imported).toHaveLength(9)
    expect(new Set(imported.map((element) => element.type))).toEqual(
      new Set(Object.values(DB.ElementType))
    )
    for (const element of imported) {
      expect(element).toMatchObject({
        ownerId,
        status: DB.ElementStatus.REVIEW,
        version: 1,
        isArchived: false,
        isDeleted: false,
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
      expect(element.tags).toEqual([])
      expect(element.permissions).toEqual([
        expect.objectContaining({
          userId: ownerId,
          permissionLevel: DB.PermissionLevel.OWNER,
          derived: false,
        }),
      ])
      await expect(
        computeElementImportFingerprintFromDb(element.id, prisma)
      ).resolves.toBe(element.importFingerprint)
    }

    const importedCollection = await prisma.answerCollection.findUniqueOrThrow({
      where: { id: result.createdAnswerCollectionIds[0] },
      include: { permissions: true, entries: true },
    })
    expect(importedCollection).toMatchObject({
      ownerId,
      version: 1,
      originalId: null,
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    })
    expect(importedCollection.permissions).toEqual([
      expect.objectContaining({
        userId: ownerId,
        permissionLevel: DB.PermissionLevel.OWNER,
        derived: false,
      }),
    ])
    await expect(
      computeAnswerCollectionImportFingerprintFromDb(
        importedCollection.id,
        prisma
      )
    ).resolves.toBe(importedCollection.importFingerprint)
    await expect(
      prisma.activityLogEntry.count({
        where: {
          userId: ownerId,
          type: DB.ActivityLogType.CREATION,
          objectType: DB.ObjectType.ELEMENT,
          elementId: { in: result.createdElementIds },
        },
      })
    ).resolves.toBe(9)

    const importedCaseStudy = imported.find(
      (element) => element.type === DB.ElementType.CASE_STUDY
    )!
    const caseOptions = importedCaseStudy.options as any
    expect(
      caseOptions.cases.flatMap((item) =>
        item.solutions.map((solution) => solution.itemId)
      )
    ).toEqual(
      expect.arrayContaining(
        importedCaseStudy.answerCollectionItems.map((entry) => entry.id)
      )
    )
    expect(JSON.stringify(caseOptions)).not.toContain('itemRef')
  })

  it('keeps shared-pool and 50-collection maxima bounded by batches, time, and WAL', async () => {
    const sharedCollection = createCollection('shared-pool', 2_000)
    const sharedSelectedRefs = sharedCollection.entries
      .slice(0, 50)
      .map((entry) => entry.ref)
    const sharedPlan = createBoundPlan({
      ownerId,
      packageHash: '2'.repeat(64),
      collections: [sharedCollection],
      elements: Array.from({ length: 100 }, (_, index) =>
        createSelectionElement({
          ref: `shared-selection-${index}`,
          collection: sharedCollection,
          selectedRefs: sharedSelectedRefs,
        })
      ),
    })
    const timings: number[] = []
    const walBytes: Array<bigint | null> = []

    for (let run = 0; run < 5; run++) {
      const counters = createElementImportExecutionOperationCounters()
      const walBefore = await readWalLsn(prisma)
      const startedAt = performance.now()
      await prisma.$transaction(
        async (tx) =>
          await executeElementImportExecutionPlan({
            plan: sharedPlan,
            prisma: tx,
            counters,
          }),
        { timeout: 15_000 }
      )
      timings.push(performance.now() - startedAt)
      const walAfter = await readWalLsn(prisma)
      walBytes.push(await readWalDifference(prisma, walBefore, walAfter))

      expect(counters).toEqual({
        collectionCreates: 1,
        entryCreateBatches: 4,
        entryRowsCreated: 2_000,
        entryRequeries: 1,
        elementCreateBatches: 4,
        elementRowsCreated: 100,
        relationUpdates: 100,
        permissionCreateBatches: 1,
        permissionRowsCreated: 101,
        activityLogCreateBatches: 1,
        activityLogRowsCreated: 100,
      })
      expect(timings[run]).toBeLessThan(15_000)
      if (walBytes[run] !== null) {
        expect(walBytes[run]).toBeLessThan(MAX_WAL_BYTES)
      }

      await prisma.element.deleteMany({ where: { ownerId } })
      await prisma.answerCollection.deleteMany({ where: { ownerId } })
    }

    const collections = Array.from({ length: 50 }, (_, index) =>
      createCollection(`split-pool-${index}`, 100)
    )
    const splitPlan = createBoundPlan({
      ownerId,
      packageHash: '3'.repeat(64),
      collections,
      elements: collections.flatMap((collection, collectionIndex) => {
        const selectedRefs = collection.entries
          .slice(0, 50)
          .map((entry) => entry.ref)
        return [0, 1].map((elementIndex) =>
          createSelectionElement({
            ref: `split-selection-${collectionIndex}-${elementIndex}`,
            collection,
            selectedRefs,
          })
        )
      }),
    })
    const splitCounters = createElementImportExecutionOperationCounters()
    const splitStartedAt = performance.now()
    await prisma.$transaction(
      async (tx) =>
        await executeElementImportExecutionPlan({
          plan: splitPlan,
          prisma: tx,
          counters: splitCounters,
        }),
      { timeout: 15_000 }
    )
    const splitDuration = performance.now() - splitStartedAt

    expect(splitDuration).toBeLessThan(15_000)
    expect(splitCounters).toEqual({
      collectionCreates: 50,
      entryCreateBatches: 10,
      entryRowsCreated: 5_000,
      entryRequeries: 1,
      elementCreateBatches: 4,
      elementRowsCreated: 100,
      relationUpdates: 100,
      permissionCreateBatches: 1,
      permissionRowsCreated: 150,
      activityLogCreateBatches: 1,
      activityLogRowsCreated: 100,
    })

    console.info(
      '[ElementImportExecutionBenchmark]',
      JSON.stringify({
        sharedPoolMs: timings,
        sharedPoolMedianMs: [...timings].sort((a, b) => a - b)[2],
        sharedPoolWorstMs: Math.max(...timings),
        sharedPoolWalBytes: walBytes.map((value) => value?.toString() ?? null),
        splitPoolMs: splitDuration,
        splitOperationCounters: splitCounters,
      })
    )
  }, 120_000)

  it('rolls back every write boundary without leaving authored rows', async () => {
    const collection = createCollection('rollback-pool', 501)
    const plan = createBoundPlan({
      ownerId,
      packageHash: '4'.repeat(64),
      collections: [collection],
      elements: Array.from({ length: 26 }, (_, index) =>
        createSelectionElement({
          ref: `rollback-selection-${index}`,
          collection,
          selectedRefs: [collection.entries[0]!.ref],
        })
      ),
    })
    const boundaries = [
      ['answerCollection', 'create', 1],
      ['answerCollectionEntry', 'createMany', 1],
      ['answerCollectionEntry', 'createMany', 2],
      ['answerCollectionEntry', 'findMany', 1],
      ['element', 'createManyAndReturn', 1],
      ['element', 'createManyAndReturn', 2],
      ['element', 'update', 1],
      ['element', 'update', 26],
      ['derivedPermission', 'createMany', 1],
      ['activityLogEntry', 'createMany', 1],
    ] as const

    for (const [model, method, invocation] of boundaries) {
      const message = `forced ${model}.${method}#${invocation}`
      await expect(
        prisma.$transaction(
          async (tx) =>
            await executeElementImportExecutionPlan({
              plan,
              prisma: failingTransactionClient({
                prisma: tx,
                model,
                method,
                invocation,
                message,
              }),
            }),
          { timeout: 15_000 }
        )
      ).rejects.toThrow(message)

      await expect(prisma.element.count({ where: { ownerId } })).resolves.toBe(
        0
      )
      await expect(
        prisma.answerCollection.count({ where: { ownerId } })
      ).resolves.toBe(0)
      await expect(
        prisma.derivedPermission.count({ where: { userId: ownerId } })
      ).resolves.toBe(0)
      await expect(
        prisma.activityLogEntry.count({ where: { userId: ownerId } })
      ).resolves.toBe(0)
      await expect(
        prisma.mediaFile.count({ where: { ownerId } })
      ).resolves.toBe(0)
    }
  }, 120_000)
})
