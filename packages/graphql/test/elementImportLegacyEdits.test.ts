import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementStatus,
  ElementType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  manipulateElement,
  manipulateElementInTransaction,
} from '../src/services/elements.js'
import {
  seedPackageFixture,
  useImportExportTestEnvironment,
} from './elementImportExportTestSupport.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

function expectCurrentDidacticFingerprint(value: {
  importFingerprint: string | null
  importFingerprintVersion: number | null
}) {
  expect(value).toMatchObject({
    importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  })
}

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()
  describe('database-backed package operations', () => {
    let prisma: PrismaClient
    let hatchet: Hatchet
    let emitter: EventEmitter
    let userOneCtx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']

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
    })

    afterEach(async () => await testCleanup(prisma))

    it('validates full authoring state and preserves omitted update fields', async () => {
      const elementsBefore = await prisma.element.count()
      await expect(
        manipulateElement(
          {
            type: ElementType.CONTENT,
            status: ElementStatus.READY,
            name: 'Whitespace content',
            content: '   ',
          },
          userOneCtx
        )
      ).resolves.toBeNull()
      await expect(prisma.element.count()).resolves.toBe(elementsBefore)

      const { singleChoice } = await seedPackageFixture(userOneCtx)
      const previous = await prisma.element.findUniqueOrThrow({
        where: { id: singleChoice.id },
      })
      await expect(
        manipulateElement(
          {
            id: singleChoice.id,
            type: ElementType.SC,
            name: 'Renamed through partial update',
          },
          userOneCtx
        )
      ).resolves.toMatchObject({ name: 'Renamed through partial update' })
      const updated = await prisma.element.findUniqueOrThrow({
        where: { id: singleChoice.id },
      })
      expect(updated).toMatchObject({
        content: previous.content,
        explanation: previous.explanation,
        basePoints: previous.basePoints,
        pointsMultiplier: previous.pointsMultiplier,
        options: previous.options,
      })
      expectCurrentDidacticFingerprint(updated)
    })

    it('persists a current fingerprint when manipulation runs in an existing transaction', async () => {
      const created = await prisma.$transaction(
        async (tx) =>
          await manipulateElementInTransaction(
            {
              type: ElementType.CONTENT,
              status: ElementStatus.READY,
              name: 'Transaction-scoped content',
              content: 'Created in an existing transaction',
              options: {},
            },
            { ...userOneCtx, prisma: tx }
          )
      )
      expect(created).not.toBeNull()

      const persisted = await prisma.element.findUniqueOrThrow({
        where: { id: created!.id },
      })
      expectCurrentDidacticFingerprint(persisted)
    })

    it('preserves nonportable legacy options during unrelated partial edits', async () => {
      const legacyOptions = {
        hasSampleSolution: true,
        unit: 'kg',
        accuracy: 0,
        restrictions: {},
        exactSolutions: [1],
        solutionRanges: [{ min: 0, max: 2 }],
      }
      const legacy = await prisma.element.create({
        data: {
          type: ElementType.NUMERICAL,
          status: ElementStatus.READY,
          name: 'Legacy numerical element',
          content: 'Legacy numerical content',
          basePoints: true,
          pointsMultiplier: 1,
          options: legacyOptions,
          ownerId: userOneCtx.user.sub,
        },
      })
      await recomputeDerivedPermissions({ elementId: legacy.id }, prisma)

      await expect(
        manipulateElement(
          {
            id: legacy.id,
            type: ElementType.NUMERICAL,
            name: 'Renamed legacy numerical element',
          },
          userOneCtx
        )
      ).resolves.toMatchObject({ name: 'Renamed legacy numerical element' })

      const persisted = await prisma.element.findUniqueOrThrow({
        where: { id: legacy.id },
      })
      expect(persisted).toMatchObject({ options: legacyOptions })
      expectCurrentDidacticFingerprint(persisted)
    })

    it('preserves unchanged answer-collection relations during partial edits', async () => {
      const { selection, caseStudy } = await seedPackageFixture(userOneCtx)
      const before = await prisma.element.findMany({
        where: { id: { in: [selection.id, caseStudy.id] } },
        include: { answerCollectionItems: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      })

      await expect(
        manipulateElement(
          {
            id: selection.id,
            type: ElementType.SELECTION,
            name: 'Renamed selection',
          },
          userOneCtx
        )
      ).resolves.toMatchObject({ name: 'Renamed selection' })
      await expect(
        manipulateElement(
          {
            id: caseStudy.id,
            type: ElementType.CASE_STUDY,
            name: 'Renamed case study',
          },
          userOneCtx
        )
      ).resolves.toMatchObject({ name: 'Renamed case study' })

      const after = await prisma.element.findMany({
        where: { id: { in: [selection.id, caseStudy.id] } },
        include: { answerCollectionItems: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      })
      expect(
        after.map(({ answerCollectionId, answerCollectionItems }) => ({
          answerCollectionId,
          answerCollectionItemIds: answerCollectionItems.map(({ id }) => id),
        }))
      ).toEqual(
        before.map(({ answerCollectionId, answerCollectionItems }) => ({
          answerCollectionId,
          answerCollectionItemIds: answerCollectionItems.map(({ id }) => id),
        }))
      )
    })

    it('preserves a detached legacy answer-collection relation during a partial edit', async () => {
      const detachedSelection = await prisma.element.create({
        data: {
          type: ElementType.SELECTION,
          status: ElementStatus.READY,
          name: 'Detached legacy selection',
          content: 'Detached legacy selection content',
          basePoints: true,
          pointsMultiplier: 1,
          options: {
            hasSampleSolution: false,
            numberOfInputs: 1,
          },
          ownerId: userOneCtx.user.sub,
        },
      })
      await recomputeDerivedPermissions(
        { elementId: detachedSelection.id },
        prisma
      )

      await expect(
        manipulateElement(
          {
            id: detachedSelection.id,
            type: ElementType.SELECTION,
            name: 'Renamed detached legacy selection',
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        name: 'Renamed detached legacy selection',
        answerCollectionId: null,
      })
      const persisted = await prisma.element.findUniqueOrThrow({
        where: { id: detachedSelection.id },
      })
      expect(persisted).toMatchObject({ answerCollectionId: null })
      expectCurrentDidacticFingerprint(persisted)
    })
  })
})
