import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementStatus,
  ElementType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { createHash } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { parseZip } from '../src/lib/zip.js'
import {
  createElementExportPackage,
  getElementExportPackageLink,
  getElementExportPackagePreview,
  importElementPackageBuffer,
  validateElementImportPackage,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
import { manipulateElement } from '../src/services/elements.js'
import { computeElementImportFingerprintFromDb } from '../src/services/importExportFingerprints.js'
import { createAnswerCollection } from '../src/services/resources.js'
import {
  clearPackageRateLimitKeys,
  expectPublicImportExportError,
  seedPackageFixture,
  uploadPreparedImportPackage,
  useImportExportTestEnvironment,
  withEnv,
} from './elementImportExportTestSupport.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFour, userThree, userTwo } from './userData.js'

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()
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

    it('requires ADMIN or OWNER permissions for portable element exports', async () => {
      const { singleChoice, selection } = await seedPackageFixture(userOneCtx)

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
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION,
      })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userThreeCtx
        )
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION,
      })
      await expect(
        getElementExportPackagePreview(
          { elementIds: [singleChoice.id] },
          userThreeCtx
        )
      ).resolves.toMatchObject({
        errors: ['ELEMENT_EXPORT_PERMISSION'],
      })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userFourCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id, selection.id] },
          userFourCtx
        )
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION,
      })
    })

    it('rejects legacy nonportable DB sources before export storage', async () => {
      const legacyName = `legacy-${'x'.repeat(256)}`
      const legacyElement = await prisma.element.create({
        data: {
          type: ElementType.SC,
          name: legacyName,
          content: 'Legacy content that remains otherwise canonical',
          explanation: null,
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
          ownerId: userOneCtx.user.sub,
        },
      })
      await recomputeDerivedPermissions({ elementId: legacyElement.id }, prisma)

      await expect(
        getElementExportPackagePreview(
          { elementIds: [legacyElement.id] },
          userOneCtx
        )
      ).resolves.toMatchObject({
        elements: [],
        errors: [ImportExportErrorCode.ELEMENT_NOT_PORTABLE],
      })
      await expect(
        createElementExportPackage(
          { elementIds: [legacyElement.id] },
          userOneCtx
        )
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      })

      await clearPackageRateLimitKeys(userOneCtx)
      await expectPublicImportExportError(
        getElementExportPackageLink(
          { elementIds: [legacyElement.id] },
          userOneCtx
        ),
        ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
        legacyName
      )

      const legacyCollection = await prisma.answerCollection.create({
        data: {
          name: `legacy-pool-${'y'.repeat(256)}`,
          description: 'Legacy pool with an out-of-contract name',
          ownerId: userOneCtx.user.sub,
          entries: { create: [{ value: 'Valid entry' }] },
        },
        include: { entries: true },
      })
      const legacyEntry = legacyCollection.entries[0]!
      const selection = await prisma.element.create({
        data: {
          type: ElementType.SELECTION,
          name: 'Selection with legacy pool',
          content: 'Select the correct entry',
          explanation: null,
          status: ElementStatus.READY,
          options: { hasSampleSolution: true, numberOfInputs: 1 },
          ownerId: userOneCtx.user.sub,
          answerCollectionId: legacyCollection.id,
          answerCollectionItems: { connect: { id: legacyEntry.id } },
        },
      })
      await recomputeDerivedPermissions({ elementId: selection.id }, prisma)

      await expect(
        getElementExportPackagePreview(
          { elementIds: [selection.id] },
          userOneCtx
        )
      ).resolves.toMatchObject({
        elements: [],
        errors: [ImportExportErrorCode.ELEMENT_NOT_PORTABLE],
      })
      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userOneCtx)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      })
    })

    it('requires ADMIN or OWNER on linked answer collections', async () => {
      const { selection, answerCollection } =
        await seedPackageFixture(userOneCtx)

      await prisma.permission.createMany({
        data: [
          {
            userId: userTwo.id,
            elementId: selection.id,
            permissionLevel: PermissionLevel.ADMIN,
          },
          {
            userId: userTwo.id,
            answerCollectionId: answerCollection.id,
            permissionLevel: PermissionLevel.READ,
          },
          {
            userId: userThree.id,
            elementId: selection.id,
            permissionLevel: PermissionLevel.ADMIN,
          },
          {
            userId: userThree.id,
            answerCollectionId: answerCollection.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userFour.id,
            elementId: selection.id,
            permissionLevel: PermissionLevel.ADMIN,
          },
          {
            userId: userFour.id,
            answerCollectionId: answerCollection.id,
            permissionLevel: PermissionLevel.ADMIN,
          },
        ],
      })
      await Promise.all([
        recomputeDerivedPermissions({ elementId: selection.id }, prisma),
        recomputeDerivedPermissions(
          { answerCollectionId: answerCollection.id },
          prisma
        ),
      ])

      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userTwoCtx)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION,
      })
      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userThreeCtx)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION,
      })
      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userFourCtx)
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })

      await expect(
        getElementExportPackagePreview(
          { elementIds: [selection.id] },
          userTwoCtx
        )
      ).resolves.toMatchObject({
        errors: [ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION],
      })
      await expect(
        getElementExportPackagePreview(
          { elementIds: [selection.id] },
          userThreeCtx
        )
      ).resolves.toMatchObject({
        errors: [ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION],
      })
      await expect(
        getElementExportPackagePreview(
          { elementIds: [selection.id] },
          userFourCtx
        )
      ).resolves.toMatchObject({ errors: [] })

      await prisma.permission.updateMany({
        where: {
          userId: userTwo.id,
          answerCollectionId: answerCollection.id,
        },
        data: { permissionLevel: PermissionLevel.ADMIN },
      })
      await recomputeDerivedPermissions(
        { answerCollectionId: answerCollection.id },
        prisma
      )
      await expect(
        getElementExportPackagePreview(
          { elementIds: [selection.id] },
          userTwoCtx
        )
      ).resolves.toMatchObject({ errors: [] })
      const artifactsBefore = await prisma.importExportPackageArtifact.count()
      await prisma.permission.updateMany({
        where: {
          userId: userTwo.id,
          answerCollectionId: answerCollection.id,
        },
        data: { permissionLevel: PermissionLevel.WRITE },
      })
      await recomputeDerivedPermissions(
        { answerCollectionId: answerCollection.id },
        prisma
      )
      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userTwoCtx)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION,
      })
      await expect(
        getElementExportPackageLink({ elementIds: [selection.id] }, userTwoCtx)
      ).rejects.toMatchObject({
        extensions: {
          code: ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION,
        },
      })
      await expect(prisma.importExportPackageArtifact.count()).resolves.toBe(
        artifactsBefore
      )
    })

    it('remaps answer collection entries when importing selection and case-study elements', async () => {
      const { answerCollection, selection, caseStudy, entries } =
        await seedPackageFixture(userOneCtx)
      const mediaFilesBefore = await prisma.mediaFile.count()
      const fingerprintWithoutTag = await computeElementImportFingerprintFromDb(
        selection.id,
        prisma
      )
      const sourceTag = await prisma.tag.create({
        data: {
          name: 'Confidential source tag',
          ownerId: userOneCtx.user.sub,
          questions: { connect: { id: selection.id } },
        },
      })
      await expect(
        computeElementImportFingerprintFromDb(selection.id, prisma)
      ).resolves.toBe(fingerprintWithoutTag)
      await prisma.tag.update({
        where: { id: sourceTag.id },
        data: { name: 'Renamed confidential source tag' },
      })
      await expect(
        computeElementImportFingerprintFromDb(selection.id, prisma)
      ).resolves.toBe(fingerprintWithoutTag)

      const exported = await createElementExportPackage(
        { elementIds: [selection.id, caseStudy.id] },
        userOneCtx
      )

      expect(exported.filename).toMatch(/\.zip$/)
      expect(await prisma.mediaFile.count()).toBe(mediaFilesBefore)

      const preview = validateElementImportPackageBuffer(exported.buffer)
      expect(preview.preview.elements).toHaveLength(2)
      expect(preview.preview.elements[0]).not.toHaveProperty('tags')
      expect(preview.preview.answerCollections).toHaveLength(1)

      const packageHash = createHash('sha256')
        .update(exported.buffer)
        .digest('hex')
      const exportedEntries = parseZip(exported.buffer)
      const exportedJson = exportedEntries
        .filter((entry) => entry.path.endsWith('.json'))
        .map((entry) => entry.data.toString('utf8'))
        .join('\n')
      expect(exportedJson).not.toContain('"tags"')
      expect(exportedJson).not.toContain('confidential source tag')
      const exportedPaths = exportedEntries.map((entry) => entry.path)
      expect(exportedPaths).toEqual(
        expect.arrayContaining([
          'manifest.json',
          'elements/element-1.json',
          'elements/element-2.json',
          'answer-collections/answer-collection-1.json',
        ])
      )
      expect(exportedPaths).not.toContain(
        `elements/element-${selection.id}.json`
      )
      expect(exportedPaths).not.toContain(
        `elements/element-${caseStudy.id}.json`
      )
      const exportedManifest = JSON.parse(
        exportedEntries
          .find((entry) => entry.path === 'manifest.json')!
          .data.toString('utf8')
      )
      expect(exportedManifest.elements).toEqual([
        {
          ref: 'element-1',
          file: 'elements/element-1.json',
          answerCollectionRef: 'answer-collection-1',
        },
        {
          ref: 'element-2',
          file: 'elements/element-2.json',
          answerCollectionRef: 'answer-collection-1',
        },
      ])
      expect(exportedManifest.answerCollections).toEqual([
        {
          ref: 'answer-collection-1',
          file: 'answer-collections/answer-collection-1.json',
        },
      ])
      const exportedCollection = JSON.parse(
        exportedEntries
          .find(
            (entry) =>
              entry.path === 'answer-collections/answer-collection-1.json'
          )!
          .data.toString('utf8')
      )
      expect(exportedCollection).not.toHaveProperty('version')

      const result = await importElementPackageBuffer(
        {
          buffer: exported.buffer,
          selectedElementRefs: ['element-1', 'element-2'],
        },
        userTwoCtx
      )

      expect(result).toEqual({
        importedElements: 2,
        importedAnswerCollections: 1,
        skippedElements: 0,
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
      expect(importedCollection.originalId).toBeNull()
      expect(importedCollection.version).toBe(1)
      expect(importedCollection.importFingerprint).toEqual(expect.any(String))

      const entryIdsByValue = new Map(
        importedCollection.entries.map((entry) => [entry.value, entry.id])
      )
      const importedSelection = await prisma.element.findFirstOrThrow({
        where: { ownerId: userTwo.id, name: selection.name },
        include: { answerCollectionItems: true, tags: true },
      })
      expect(importedSelection.answerCollectionId).toBe(importedCollection.id)
      expect(importedSelection.status).toBe(ElementStatus.REVIEW)
      expect(importedSelection.originalId).toBe(
        `import-package:${packageHash.slice(0, 16)}:element-1`
      )
      expect(importedSelection.importFingerprint).toEqual(expect.any(String))
      expect(importedSelection.tags).toEqual([])
      await expect(
        prisma.tag.count({
          where: {
            ownerId: userTwo.id,
            name: { contains: 'confidential source tag', mode: 'insensitive' },
          },
        })
      ).resolves.toBe(0)
      await expect(
        computeElementImportFingerprintFromDb(importedSelection.id, prisma)
      ).resolves.toBe(importedSelection.importFingerprint)
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
      expect(importedCaseStudy.status).toBe(ElementStatus.REVIEW)
      expect(importedCaseStudy.originalId).toBe(
        `import-package:${packageHash.slice(0, 16)}:element-2`
      )
      expect(importedCaseStudy.importFingerprint).toEqual(expect.any(String))
      await expect(
        computeElementImportFingerprintFromDb(importedCaseStudy.id, prisma)
      ).resolves.toBe(importedCaseStudy.importFingerprint)
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

    it('shows advisory duplicate warnings without blocking duplicate imports', async () => {
      const createdCollection = await createAnswerCollection(
        {
          name: 'Immediate duplicate collection',
          description: 'Created through the authored write path',
          answers: ['Alpha', 'Beta', 'Gamma'],
        },
        userOneCtx
      )
      if (!createdCollection) {
        throw new Error('Failed to create the duplicate-test collection.')
      }
      const answerCollection = await prisma.answerCollection.findUniqueOrThrow({
        where: { id: createdCollection.id },
        include: { entries: { orderBy: { value: 'asc' } } },
      })
      const selection = await manipulateElement(
        {
          type: ElementType.SELECTION,
          status: ElementStatus.READY,
          name: 'Immediate duplicate selection',
          content: 'Select the first answer',
          explanation: 'Created through the authored write path',
          basePoints: false,
          pointsMultiplier: 1,
          options: {
            hasSampleSolution: true,
            numberOfInputs: 1,
            answerCollection: answerCollection.id,
            correctAnswers: [answerCollection.entries[0]!.id],
          },
        },
        userOneCtx
      )
      if (!selection) {
        throw new Error('Failed to create the duplicate-test element.')
      }
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )
      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await clearPackageRateLimitKeys(userOneCtx)
          const prepared = await uploadPreparedImportPackage(
            exported.buffer,
            userOneCtx
          )

          const validation = await validateElementImportPackage(
            { artifactId: prepared.artifactId },
            userOneCtx
          )

          expect(validation.errors).toEqual([])
          expect(validation.elements).toHaveLength(1)
          expect(validation.elements[0]!.alreadyImported).toBe(true)
          expect(validation.elements[0]!.existingElementId).toBe(selection.id)
          expect(validation.answerCollections).toHaveLength(1)
          expect(validation.answerCollections[0]!.alreadyImported).toBe(true)
          expect(
            validation.answerCollections[0]!.existingAnswerCollectionId
          ).toBe(answerCollection.id)

          await expect(
            importElementPackageBuffer(
              {
                buffer: exported.buffer,
                selectedElementRefs: ['element-1'],
              },
              userOneCtx
            )
          ).resolves.toMatchObject({
            importedElements: 1,
            importedAnswerCollections: 1,
            skippedElements: 0,
          })

          const importedCopy = await prisma.element.findFirstOrThrow({
            where: {
              ownerId: userOneCtx.user.sub,
              name: selection.name,
              id: { not: selection.id },
            },
          })
          await clearPackageRateLimitKeys(userOneCtx)
          const normalizedValidation = await validateElementImportPackage(
            { artifactId: prepared.artifactId },
            userOneCtx
          )
          expect(normalizedValidation.elements[0]!.alreadyImported).toBe(true)
          expect(normalizedValidation.elements[0]!.existingElementId).toBe(
            selection.id
          )
          expect(
            normalizedValidation.answerCollections[0]!.alreadyImported
          ).toBe(true)

          await prisma.element.updateMany({
            where: { id: { in: [selection.id, importedCopy.id] } },
            data: { importFingerprintVersion: 99 },
          })
          await clearPackageRateLimitKeys(userOneCtx)
          const mismatchedVersionValidation =
            await validateElementImportPackage(
              { artifactId: prepared.artifactId },
              userOneCtx
            )
          expect(mismatchedVersionValidation.elements[0]!.alreadyImported).toBe(
            false
          )

          await expect(
            prisma.element.count({
              where: { ownerId: userOneCtx.user.sub, name: selection.name },
            })
          ).resolves.toBe(2)
          await expect(
            prisma.answerCollection.count({
              where: {
                ownerId: userOneCtx.user.sub,
                name: answerCollection.name,
              },
            })
          ).resolves.toBe(2)

          await expect(
            importElementPackageBuffer(
              {
                buffer: exported.buffer,
                selectedElementRefs: ['element-1'],
              },
              userTwoCtx
            )
          ).resolves.toMatchObject({
            importedElements: 1,
            importedAnswerCollections: 1,
          })

          const userTwoPrepared = await uploadPreparedImportPackage(
            exported.buffer,
            userTwoCtx
          )
          await clearPackageRateLimitKeys(userTwoCtx)
          const userTwoValidation = await validateElementImportPackage(
            { artifactId: userTwoPrepared.artifactId },
            userTwoCtx
          )

          expect(userTwoValidation.errors).toEqual([])
          expect(userTwoValidation.elements[0]!.alreadyImported).toBe(true)
          expect(userTwoValidation.answerCollections[0]!.alreadyImported).toBe(
            true
          )
        }
      )
    })
  })
})
