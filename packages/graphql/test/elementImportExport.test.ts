import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementStatus,
  ElementType,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { graphql } from 'graphql/index.js'
import { randomUUID } from 'node:crypto'
import { mkdtemp, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  cleanupImportExportPackages,
  readLocalImportExportPackageBlob,
  schema,
  writeLocalImportExportPackageBlob,
} from '../src/index.js'
import { createZip, parseZip } from '../src/lib/zip.js'
import {
  createElementExportPackage,
  getElementExportPackageLink,
  importElementPackage,
  importElementPackageBuffer,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
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
    expect(() =>
      validateElementImportPackageBuffer(
        createSelectionValidationPackage({
          manifestAnswerCollectionRef: 'collection-1',
          elementAnswerCollectionRef: 'collection-2',
          answerCollectionItemRefs: ['collection-2-entry-1'],
        })
      )
    ).toThrow(/reference mismatch/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createSelectionValidationPackage({
          manifestAnswerCollectionRef: 'collection-1',
          elementAnswerCollectionRef: 'collection-1',
          answerCollectionItemRefs: ['collection-2-entry-1'],
        })
      )
    ).toThrow(/unknown entry/i)
  })

  it('rejects globally duplicated package-local refs', () => {
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({
          elements: [
            { ref: 'element-1', file: 'elements/element-1.json' },
            { ref: 'element-1', file: 'elements/element-2.json' },
          ],
        })
      )
    ).toThrow(/element references must be unique/i)

    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({
          answerCollections: [
            {
              ref: 'collection-1',
              file: 'answer-collections/collection-1.json',
            },
            {
              ref: 'collection-1',
              file: 'answer-collections/collection-2.json',
            },
          ],
        })
      )
    ).toThrow(/answer collection references must be unique/i)

    const duplicateEntryRefPackage = rewritePackageJson(
      createSelectionValidationPackage({
        manifestAnswerCollectionRef: 'collection-1',
        elementAnswerCollectionRef: 'collection-1',
        answerCollectionItemRefs: ['collection-1-entry-1'],
      }),
      {
        'answer-collections/collection-2.json': (collection: any) => ({
          ...collection,
          entries: collection.entries.map((entry: any) => ({
            ...entry,
            ref: 'collection-1-entry-1',
          })),
        }),
      }
    )

    expect(() =>
      validateElementImportPackageBuffer(duplicateEntryRefPackage)
    ).toThrow(
      /globally unique|answer collection entry references must be unique/i
    )

    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage(
          {
            elements: [{ ref: 'shared-ref', file: 'elements/element-1.json' }],
            answerCollections: [
              {
                ref: 'shared-ref',
                file: 'answer-collections/shared-ref.json',
              },
            ],
          },
          { ref: 'shared-ref' },
          [
            {
              path: 'answer-collections/shared-ref.json',
              data: JSON.stringify({
                ref: 'shared-ref',
                name: 'Shared ref collection',
                description: '',
                entries: [{ ref: 'shared-ref-entry', value: 'Alpha' }],
              }),
            },
          ]
        )
      )
    ).toThrow(/package references must be globally unique/i)
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

    it('ignores spoofed source ids and imports only package-local refs', async () => {
      const { answerCollection, selection, entries } =
        await seedPackageFixture(userOneCtx)
      const targetCollection = await prisma.answerCollection.create({
        data: {
          name: 'Do not attach source collection',
          description: 'This collection id is spoofed in package metadata',
          ownerId: userThree.id,
          entries: {
            create: [{ value: 'Target Alpha' }, { value: 'Target Beta' }],
          },
        },
        include: { entries: true },
      })
      const targetElement = await prisma.element.create({
        data: {
          type: ElementType.SC,
          name: 'Do not update source element',
          content: 'This element id is spoofed in package metadata',
          explanation: null,
          status: ElementStatus.READY,
          options: {
            displayMode: 'LIST',
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
            choices: [
              { ix: 0, value: 'A' },
              { ix: 1, value: 'B' },
            ],
          },
          ownerId: userThree.id,
        },
      })
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )
      const spoofedPackage = rewritePackageJson(exported.buffer, {
        'manifest.json': (manifest: any) => ({
          ...manifest,
          elements: manifest.elements.map((element: any) => ({
            ...element,
            source: { id: targetElement.id, version: 999 },
          })),
          answerCollections: manifest.answerCollections.map(
            (collection: any) => ({
              ...collection,
              source: { id: targetCollection.id, version: 999 },
            })
          ),
        }),
        [`elements/element-${selection.id}.json`]: (element: any) => ({
          ...element,
          source: { id: targetElement.id, version: 999 },
        }),
        [`answer-collections/answer-collection-${answerCollection.id}.json`]: (
          collection: any
        ) => ({
          ...collection,
          source: { id: targetCollection.id, version: 999 },
          entries: collection.entries.map((entry: any, ix: number) => ({
            ...entry,
            source: {
              id: targetCollection.entries[
                ix % targetCollection.entries.length
              ]!.id,
            },
          })),
        }),
      })

      expect(() =>
        validateElementImportPackageBuffer(spoofedPackage)
      ).not.toThrow()

      const result = await importElementPackageBuffer(
        {
          buffer: spoofedPackage,
          selectedElementRefs: [`element-${selection.id}`],
        },
        userTwoCtx
      )

      expect(result).toEqual({
        importedElements: 1,
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
      expect(importedCollection.id).not.toBe(targetCollection.id)

      const targetEntryIds = targetCollection.entries.map((entry) => entry.id)
      const originalEntryIds = entries.map((entry) => entry.id)
      const importedSelection = await prisma.element.findFirstOrThrow({
        where: { ownerId: userTwo.id, name: selection.name },
        include: { answerCollectionItems: true },
      })
      expect(importedSelection.id).not.toBe(selection.id)
      expect(importedSelection.id).not.toBe(targetElement.id)
      expect(importedSelection.answerCollectionId).toBe(importedCollection.id)
      expect(importedSelection.answerCollectionId).not.toBe(targetCollection.id)
      expect(
        importedSelection.answerCollectionItems.map((entry) => entry.id)
      ).not.toEqual(expect.arrayContaining(originalEntryIds))
      expect(
        importedSelection.answerCollectionItems.map((entry) => entry.id)
      ).not.toEqual(expect.arrayContaining(targetEntryIds))
    })

    it('rejects selected element refs that are not present in the package', async () => {
      const { selection } = await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )

      await expect(
        importElementPackageBuffer(
          {
            buffer: exported.buffer,
            selectedElementRefs: [`element-${selection.id}`, 'element-999999'],
          },
          userTwoCtx
        )
      ).rejects.toThrow(/could not be found/i)
    })

    it('requires full-access scope for export package GraphQL queries', async () => {
      const { singleChoice } = await seedPackageFixture(userOneCtx)
      const restrictedContexts = [
        {
          ...userOneCtx,
          user: { ...userOneCtx.user, scope: UserLoginScope.READ_ONLY },
        },
        {
          ...userOneCtx,
          user: { ...userOneCtx.user, scope: UserLoginScope.SESSION_EXEC },
        },
      ]
      const queries = [
        {
          field: 'getElementDownloadLink',
          selection: 'filename',
        },
        {
          field: 'getElementExportPackageLink',
          selection: 'filename',
        },
        {
          field: 'getElementExportPackagePreview',
          selection: 'errors',
        },
      ]

      const ownerPreview = await executeExportQuery({
        field: 'getElementExportPackagePreview',
        selection: 'errors',
        elementIds: [singleChoice.id],
        ctx: userOneCtx,
      })
      expect(ownerPreview.errors).toBeUndefined()

      for (const ctx of restrictedContexts) {
        for (const query of queries) {
          const result = await executeExportQuery({
            ...query,
            elementIds: [singleChoice.id],
            ctx,
          })
          expect(result.errors?.[0]?.message).toMatch(/unauthorized/i)
        }
      }
    })

    it('rate limits package-heavy operations per user', async () => {
      const { singleChoice, selection } = await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )

      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_EXPORT_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_VALIDATE_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_IMPORT_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS: '60',
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await clearPackageRateLimitKeys(userOneCtx)
          await expect(
            getElementExportPackageLink(
              { elementIds: [singleChoice.id] },
              userOneCtx
            )
          ).resolves.toMatchObject({
            filename: expect.stringMatching(/\.zip$/),
          })
          await expect(
            getElementExportPackageLink(
              { elementIds: [singleChoice.id] },
              userOneCtx
            )
          ).rejects.toThrow(/try again later/i)

          await clearPackageRateLimitKeys(userOneCtx)
          await expect(
            prepareElementImportPackageUpload(
              { filename: 'package.zip' },
              userOneCtx
            )
          ).resolves.toMatchObject({ blobName: expect.any(String) })
          await expect(
            prepareElementImportPackageUpload(
              { filename: 'package.zip' },
              userOneCtx
            )
          ).rejects.toThrow(/try again later/i)

          const blobName = `imports/${userTwoCtx.user.sub}/${randomUUID()}-package.zip`
          await writeLocalImportExportPackageBlob(blobName, exported.buffer)

          await clearPackageRateLimitKeys(userTwoCtx)
          await expect(
            validateElementImportPackage({ blobName }, userTwoCtx)
          ).resolves.toMatchObject({ importToken: expect.any(String) })
          await expect(
            validateElementImportPackage({ blobName }, userTwoCtx)
          ).rejects.toThrow(/try again later/i)

          await clearPackageRateLimitKeys(userTwoCtx)
          const validation = await validateElementImportPackage(
            { blobName },
            userTwoCtx
          )
          await expect(
            importElementPackage(
              {
                importToken: validation.importToken,
                selectedElementRefs: [`element-${selection.id}`],
              },
              userTwoCtx
            )
          ).resolves.toEqual({
            importedElements: 1,
            importedAnswerCollections: 1,
          })
          await expect(
            importElementPackage(
              {
                importToken: validation.importToken,
                selectedElementRefs: [`element-${selection.id}`],
              },
              userTwoCtx
            )
          ).rejects.toThrow(/try again later/i)
        }
      )
    })

    it('cleans up expired local import/export package blobs', async () => {
      const tempDir = await mkdtemp(
        path.join(tmpdir(), 'klicker-import-export-packages-')
      )
      const now = new Date('2026-01-02T12:00:00.000Z')
      const expiredDate = new Date('2026-01-01T00:00:00.000Z')
      const freshDate = new Date('2026-01-02T11:00:00.000Z')
      const expiredImportBlob = `imports/${userOneCtx.user.sub}/expired.zip`
      const expiredExportBlob = `exports/${userOneCtx.user.sub}/expired.zip`
      const freshImportBlob = `imports/${userOneCtx.user.sub}/fresh.zip`

      await withEnv(
        {
          LOCAL_IMPORT_EXPORT_PACKAGE_DIR: tempDir,
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await writeLocalImportExportPackageBlob(
            expiredImportBlob,
            Buffer.from('expired-import')
          )
          await writeLocalImportExportPackageBlob(
            expiredExportBlob,
            Buffer.from('expired-export')
          )
          await writeLocalImportExportPackageBlob(
            freshImportBlob,
            Buffer.from('fresh-import')
          )
          await utimes(
            path.join(tempDir, expiredImportBlob),
            expiredDate,
            expiredDate
          )
          await utimes(
            path.join(tempDir, expiredExportBlob),
            expiredDate,
            expiredDate
          )
          await utimes(
            path.join(tempDir, freshImportBlob),
            freshDate,
            freshDate
          )

          await expect(
            cleanupImportExportPackages({ now, ttlHours: 24 })
          ).resolves.toEqual({ deletedPackages: 2 })
          await expect(
            readLocalImportExportPackageBlob(expiredImportBlob)
          ).rejects.toThrow()
          await expect(
            readLocalImportExportPackageBlob(expiredExportBlob)
          ).rejects.toThrow()
          await expect(
            readLocalImportExportPackageBlob(freshImportBlob)
          ).resolves.toEqual(Buffer.from('fresh-import'))
        }
      )
    })
  })
})

async function executeExportQuery({
  field,
  selection,
  elementIds,
  ctx,
}: {
  field: string
  selection: string
  elementIds: number[]
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
}) {
  return await graphql({
    schema,
    source: `query ExportPackage($elementIds: [Int!]!) {
      ${field}(elementIds: $elementIds) {
        ${selection}
      }
    }`,
    variableValues: { elementIds },
    contextValue: ctx,
  })
}

async function clearPackageRateLimitKeys(
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
) {
  const keys = await ctx.redisExec.keys('rate-limit:import-export-package:*')
  if (keys.length > 0) {
    await ctx.redisExec.del(...keys)
  }
}

async function withEnv<T>(
  overrides: Record<string, string>,
  fn: () => Promise<T>
) {
  const previousValues = new Map(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  )

  try {
    for (const [key, value] of Object.entries(overrides)) {
      process.env[key] = value
    }

    return await fn()
  } finally {
    for (const [key, value] of previousValues) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

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

function createSelectionValidationPackage({
  manifestAnswerCollectionRef,
  elementAnswerCollectionRef,
  answerCollectionItemRefs,
}: {
  manifestAnswerCollectionRef: string
  elementAnswerCollectionRef: string
  answerCollectionItemRefs: string[]
}) {
  const manifest = {
    type: 'klicker-element-package',
    version: 1,
    createdAt: new Date().toISOString(),
    elements: [
      {
        ref: 'selection-1',
        file: 'elements/selection-1.json',
        answerCollectionRef: manifestAnswerCollectionRef,
      },
    ],
    answerCollections: [
      { ref: 'collection-1', file: 'answer-collections/collection-1.json' },
      { ref: 'collection-2', file: 'answer-collections/collection-2.json' },
    ],
  }
  const collectionOne = {
    ref: 'collection-1',
    name: 'Collection 1',
    description: '',
    entries: [{ ref: 'collection-1-entry-1', value: 'Alpha' }],
  }
  const collectionTwo = {
    ref: 'collection-2',
    name: 'Collection 2',
    description: '',
    entries: [{ ref: 'collection-2-entry-1', value: 'Beta' }],
  }
  const element = {
    ref: 'selection-1',
    name: 'Imported selection',
    content: 'Imported selection content',
    type: ElementType.SELECTION,
    options: {
      hasSampleSolution: true,
      numberOfInputs: 1,
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    status: ElementStatus.READY,
    answerCollectionRef: elementAnswerCollectionRef,
    answerCollectionItemRefs,
  }

  return createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    {
      path: 'answer-collections/collection-1.json',
      data: JSON.stringify(collectionOne),
    },
    {
      path: 'answer-collections/collection-2.json',
      data: JSON.stringify(collectionTwo),
    },
    { path: 'elements/selection-1.json', data: JSON.stringify(element) },
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

function rewritePackageJson(
  buffer: Buffer,
  rewrites: Record<string, (value: any) => any>
) {
  return createZip(
    parseZip(buffer).map((entry) => {
      const rewrite = rewrites[entry.path]

      return {
        path: entry.path,
        data: rewrite
          ? JSON.stringify(rewrite(JSON.parse(entry.data.toString('utf8'))))
          : entry.data,
      }
    })
  )
}
