import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementStatus,
  ElementType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { createZip, parseZip } from '../src/lib/zip.js'
import {
  createElementExportPackage,
  importElementPackageBuffer,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFour, userThree, userTwo } from './userData.js'

describe('Secure element import/export packages', () => {
  it('validates ZIP package structure strictly', async () => {
    const validPackage = createValidationPackage()

    expect(() => validateElementImportPackageBuffer(validPackage)).not.toThrow()
    expect(() => parseZip(rewriteZipPath(validPackage))).toThrow(
      /invalid zip entry path/i
    )
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, {}, [{ path: 'notes.txt', data: 'nope' }])
      )
    ).toThrow(/unexpected files/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { id: 42 } as any)
      )
    ).toThrow()
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { type: 'NOT_A_TYPE' } as any)
      )
    ).toThrow()
    expect(() =>
      validateElementImportPackageBuffer(Buffer.alloc(10 * 1024 * 1024 + 1))
    ).toThrow(/too large/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage(
          {
            elements: [
              {
                ref: 'selection-1',
                file: 'elements/element-1.json',
                answerCollectionRef: 'missing-collection',
              },
            ],
          },
          {
            ref: 'selection-1',
            type: ElementType.SELECTION,
            answerCollectionRef: 'missing-collection',
            answerCollectionItemRefs: ['missing-entry'],
          }
        )
      )
    ).toThrow(/unknown collection/i)
  })

  describe('database-backed package operations', () => {
    let prisma: PrismaClient
    let hatchet: Hatchet
    let emitter: EventEmitter
    let userOneCtx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
    let userTwoCtx: Awaited<ReturnType<typeof testInitialization>>['userTwoCtx']
    let userThreeCtx: Awaited<
      ReturnType<typeof testInitialization>
    >['userThreeCtx']
    let userFourCtx: Awaited<
      ReturnType<typeof testInitialization>
    >['userFourCtx']

    beforeAll(async () => {
      const {
        prisma: newPrisma,
        hatchet: newHatchet,
        emitter: newEmitter,
      } = await initializePrisma()
      prisma = newPrisma
      hatchet = newHatchet
      emitter = newEmitter
    })

    afterAll(async () => {
      await testCleanup(prisma)
      await prisma.$disconnect()
    })

    beforeEach(async () => {
      const initialized = await testInitialization(prisma, hatchet, emitter)
      userOneCtx = initialized.userOneCtx
      userTwoCtx = initialized.userTwoCtx
      userThreeCtx = initialized.userThreeCtx
      userFourCtx = initialized.userFourCtx
    })

    afterEach(async () => await testCleanup(prisma))

    it('requires WRITE+ permissions for portable element exports', async () => {
      const { singleChoice } = await seedPackageFixture(userOneCtx)

      await prisma.permission.createMany({
        data: [
          {
            userId: userTwo.id,
            elementId: singleChoice.id,
            permissionLevel: PermissionLevel.READ,
          },
          {
            userId: userThree.id,
            elementId: singleChoice.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userFour.id,
            elementId: singleChoice.id,
            permissionLevel: PermissionLevel.ADMIN,
          },
        ],
      })
      await recomputeDerivedPermissions({ elementId: singleChoice.id }, prisma)

      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userOneCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userTwoCtx
        )
      ).rejects.toThrow(/could not be exported/i)
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userThreeCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userFourCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
    })

    it('blocks exports when linked answer collections are not WRITE+', async () => {
      const { selection, answerCollection } =
        await seedPackageFixture(userOneCtx)

      await prisma.permission.createMany({
        data: [
          {
            userId: userTwo.id,
            elementId: selection.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userTwo.id,
            answerCollectionId: answerCollection.id,
            permissionLevel: PermissionLevel.READ,
          },
        ],
      })
      await recomputeDerivedPermissions({ elementId: selection.id }, prisma)
      await recomputeDerivedPermissions(
        { answerCollectionId: answerCollection.id },
        prisma
      )

      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userTwoCtx)
      ).rejects.toThrow(/answer collections could not be exported/i)
    })

    it('remaps answer collection entries when importing selection and case-study elements', async () => {
      const { answerCollection, selection, caseStudy, entries } =
        await seedPackageFixture(userOneCtx)
      const mediaFilesBefore = await prisma.mediaFile.count()

      const exported = await createElementExportPackage(
        { elementIds: [selection.id, caseStudy.id] },
        userOneCtx
      )

      expect(exported.filename).toMatch(/\.zip$/)
      expect(await prisma.mediaFile.count()).toBe(mediaFilesBefore)

      const preview = validateElementImportPackageBuffer(exported.buffer)
      expect(preview.preview.elements).toHaveLength(2)
      expect(preview.preview.answerCollections).toHaveLength(1)

      const result = await importElementPackageBuffer(
        {
          buffer: exported.buffer,
          selectedElementRefs: [
            `element-${selection.id}`,
            `element-${caseStudy.id}`,
          ],
        },
        userTwoCtx
      )

      expect(result).toEqual({
        importedElements: 2,
        importedAnswerCollections: 1,
      })

      const importedCollection = await prisma.answerCollection.findFirstOrThrow(
        {
          where: {
            ownerId: userTwo.id,
            name: answerCollection.name,
          },
          include: { entries: true },
        }
      )
      expect(importedCollection.id).not.toBe(answerCollection.id)

      const entryIdsByValue = new Map(
        importedCollection.entries.map((entry) => [entry.value, entry.id])
      )
      const importedSelection = await prisma.element.findFirstOrThrow({
        where: { ownerId: userTwo.id, name: selection.name },
        include: { answerCollectionItems: true },
      })
      expect(importedSelection.answerCollectionId).toBe(importedCollection.id)
      expect(
        importedSelection.answerCollectionItems.map((entry) => entry.id)
      ).toEqual([entryIdsByValue.get(entries[0]!.value)])
      expect(importedSelection.answerCollectionItems[0]!.id).not.toBe(
        entries[0]!.id
      )

      const importedCaseStudy = await prisma.element.findFirstOrThrow({
        where: { ownerId: userTwo.id, name: caseStudy.name },
        include: { answerCollectionItems: true },
      })
      expect(importedCaseStudy.answerCollectionId).toBe(importedCollection.id)
      expect(
        importedCaseStudy.answerCollectionItems.map((entry) => entry.id).sort()
      ).toEqual(
        [entries[0]!.value, entries[1]!.value]
          .map((value) => entryIdsByValue.get(value))
          .sort()
      )

      const importedCaseOptions = importedCaseStudy.options as any
      const importedSolutionIds = importedCaseOptions.cases.flatMap(
        (caseItem) => caseItem.solutions.map((solution) => solution.itemId)
      )
      expect(importedSolutionIds).toEqual(
        expect.arrayContaining([
          entryIdsByValue.get(entries[0]!.value),
          entryIdsByValue.get(entries[1]!.value),
        ])
      )
      expect(importedSolutionIds).not.toEqual(
        expect.arrayContaining([entries[0]!.id, entries[1]!.id])
      )
    })
  })
})

async function seedPackageFixture(
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
) {
  const answerCollection = await ctx.prisma.answerCollection.create({
    data: {
      name: 'Import export collection',
      description: 'Items used by portable element packages',
      ownerId: ctx.user.sub,
      entries: {
        create: [{ value: 'Alpha' }, { value: 'Beta' }, { value: 'Gamma' }],
      },
    },
    include: { entries: { orderBy: { value: 'asc' } } },
  })

  const [firstEntry, secondEntry] = answerCollection.entries
  if (!firstEntry || !secondEntry) {
    throw new Error('Test answer collection entries were not created.')
  }

  const singleChoice = await ctx.prisma.element.create({
    data: {
      type: ElementType.SC,
      name: 'Package SC',
      content: 'Single choice content',
      explanation: 'Single choice explanation',
      status: ElementStatus.READY,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'Correct', correct: true },
          { ix: 1, value: 'Distractor', correct: false },
        ],
      },
      ownerId: ctx.user.sub,
    },
  })

  const selection = await ctx.prisma.element.create({
    data: {
      type: ElementType.SELECTION,
      name: 'Package Selection',
      content: 'Selection content',
      explanation: 'Selection explanation',
      status: ElementStatus.READY,
      options: {
        hasSampleSolution: true,
        numberOfInputs: 1,
      },
      ownerId: ctx.user.sub,
      answerCollectionId: answerCollection.id,
      answerCollectionItems: {
        connect: [{ id: firstEntry.id }],
      },
    },
  })

  const caseStudy = await ctx.prisma.element.create({
    data: {
      type: ElementType.CASE_STUDY,
      name: 'Package Case Study',
      content: 'Case study content',
      explanation: 'Case study explanation',
      status: ElementStatus.READY,
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
            description: 'Case study description',
            order: 0,
            solutions: [
              {
                itemId: firstEntry.id,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 4, max: 5 },
                ],
              },
              {
                itemId: secondEntry.id,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 1, max: 2 },
                ],
              },
            ],
          },
        ],
      },
      ownerId: ctx.user.sub,
      answerCollectionId: answerCollection.id,
      answerCollectionItems: {
        connect: [{ id: firstEntry.id }, { id: secondEntry.id }],
      },
    },
  })

  await recomputeDerivedPermissions(
    { answerCollectionId: answerCollection.id },
    ctx.prisma
  )
  await Promise.all(
    [singleChoice, selection, caseStudy].map((element) =>
      recomputeDerivedPermissions({ elementId: element.id }, ctx.prisma)
    )
  )

  return {
    answerCollection,
    entries: answerCollection.entries,
    singleChoice,
    selection,
    caseStudy,
  }
}

function createValidationPackage(
  manifestOverrides: Partial<Record<string, unknown>> = {},
  elementOverrides: Partial<Record<string, unknown>> = {},
  extraFiles: { path: string; data: string }[] = []
) {
  const manifest = {
    type: 'klicker-element-package',
    version: 1,
    createdAt: new Date().toISOString(),
    elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
    answerCollections: [],
    ...manifestOverrides,
  }
  const element = {
    ref: 'element-1',
    name: 'Imported SC',
    content: 'Imported content',
    type: ElementType.SC,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'A' },
        { ix: 1, value: 'B' },
      ],
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    status: ElementStatus.READY,
    ...elementOverrides,
  }

  return createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    { path: 'elements/element-1.json', data: JSON.stringify(element) },
    ...extraFiles,
  ])
}

function rewriteZipPath(buffer: Buffer) {
  const from = Buffer.from('elements/element-1.json')
  const to = Buffer.from('element/../entry-1.json')
  if (from.length !== to.length) {
    throw new Error('ZIP test path replacement must keep the same length.')
  }

  const rewritten = Buffer.from(buffer)
  let offset = 0
  let replacements = 0

  while ((offset = rewritten.indexOf(from, offset)) !== -1) {
    to.copy(rewritten, offset)
    offset += to.length
    replacements++
  }

  expect(replacements).toBeGreaterThanOrEqual(2)
  return rewritten
}
