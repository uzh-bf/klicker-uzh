import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ImportExportPackageArtifactDirection,
  PrismaClient,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { randomUUID } from 'node:crypto'
import { mkdtemp, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { inspectImportExportDatabase } from '../src/lib/importExportOperations/databaseCatalog.js'
import { evaluateImportExportInspection } from '../src/lib/importExportOperations/inspection.js'
import {
  createElementExportPackage,
  getElementExportPackageLink,
  importElementPackage,
  importElementPackageBuffer,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
import {
  cleanupImportExportPackages,
  readLocalImportExportPackageBlob,
  writeLocalImportExportPackageBlob,
} from '../src/services/packageStorage.js'
import {
  clearPackageRateLimitKeys,
  createValidationPackage,
  executeExportQuery,
  expectImportValidationError,
  rewritePackageJson,
  seedPackageFixture,
  uploadPreparedImportPackage,
  useImportExportTestEnvironment,
  withEnv,
} from './elementImportExportTestSupport.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()
  describe('database-backed package operations', () => {
    let prisma: PrismaClient
    let hatchet: Hatchet
    let emitter: EventEmitter
    let userOneCtx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
    let userTwoCtx: Awaited<ReturnType<typeof testInitialization>>['userTwoCtx']

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
    })

    afterEach(async () => await testCleanup(prisma))

    it('matches the executable production schema inspection contract', async () => {
      const inspection = await inspectImportExportDatabase(prisma)
      const checks = evaluateImportExportInspection({
        ...inspection,
        constraints: inspection.constraints.map((constraint) => ({
          ...constraint,
          is_validated: true,
        })),
      })

      expect(checks).toMatchObject({
        columnsReady: true,
        indexesReady: true,
        constraintsValidated: true,
        triggersReady: true,
      })
    })

    it('rejects packages containing source ids', async () => {
      const { selection } = await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )
      const spoofedPackage = rewritePackageJson(exported.buffer, {
        'manifest.json': (manifest: any) => ({
          ...manifest,
          elements: manifest.elements.map((element: any) => ({
            ...element,
            source: { id: 999_999, version: 999 },
          })),
          answerCollections: manifest.answerCollections.map(
            (collection: any) => ({
              ...collection,
              source: { id: 999_999, version: 999 },
            })
          ),
        }),
        'elements/element-1.json': (element: any) => ({
          ...element,
          source: { id: 999_999, version: 999 },
        }),
        'answer-collections/answer-collection-1.json': (collection: any) => ({
          ...collection,
          source: { id: 999_999, version: 999 },
          entries: collection.entries.map((entry: any) => ({
            ...entry,
            source: { id: 999_999 },
          })),
        }),
      })

      expectImportValidationError(
        () => validateElementImportPackageBuffer(spoofedPackage),
        ImportExportErrorCode.INVALID_PACKAGE
      )
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
            selectedElementRefs: ['element-1', 'element-999999'],
          },
          userTwoCtx
        )
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.INVALID_SELECTION,
      })
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
          ).rejects.toMatchObject({
            extensions: { code: ImportExportErrorCode.RATE_LIMITED },
          })

          await clearPackageRateLimitKeys(userOneCtx)
          await expect(
            prepareElementImportPackageUpload(
              { filename: 'package.zip', bytes: exported.buffer.length },
              userOneCtx
            )
          ).resolves.toMatchObject({ blobName: expect.any(String) })

          await clearPackageRateLimitKeys(userTwoCtx)
          const prepared = await uploadPreparedImportPackage(
            exported.buffer,
            userTwoCtx
          )
          await expect(
            validateElementImportPackage(
              { artifactId: prepared.artifactId },
              userTwoCtx
            )
          ).resolves.toMatchObject({ importToken: expect.any(String) })
          await expect(
            validateElementImportPackage(
              { artifactId: prepared.artifactId },
              userTwoCtx
            )
          ).resolves.toMatchObject({
            importToken: null,
            errors: [ImportExportErrorCode.RATE_LIMITED],
          })

          await clearPackageRateLimitKeys(userTwoCtx)
          const validation = await validateElementImportPackage(
            { artifactId: prepared.artifactId },
            userTwoCtx
          )
          expect(validation.importToken).toEqual(expect.any(String))
          await expect(
            importElementPackage(
              {
                importToken: validation.importToken!,
                selectedElementRefs: ['element-1'],
              },
              userTwoCtx
            )
          ).resolves.toEqual({
            importedElements: 1,
            importedAnswerCollections: 1,
            skippedElements: 0,
            warnings: [],
          })
          await expect(
            importElementPackage(
              {
                importToken: validation.importToken!,
                selectedElementRefs: ['element-1'],
              },
              userTwoCtx
            )
          ).resolves.toEqual({
            importedElements: 1,
            importedAnswerCollections: 1,
            skippedElements: 0,
            warnings: [],
          })
        }
      )
    })

    it('returns validation error codes without an import token for invalid uploads', async () => {
      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          const invalid = await uploadPreparedImportPackage(
            createValidationPackage({}, { options: { choices: [] } }),
            userTwoCtx
          )
          await clearPackageRateLimitKeys(userTwoCtx)

          await expect(
            validateElementImportPackage(
              { artifactId: invalid.artifactId },
              userTwoCtx
            )
          ).resolves.toMatchObject({
            importToken: null,
            errors: ['IMPORT_INVALID_OPTIONS'],
          })

          await clearPackageRateLimitKeys(userTwoCtx)
          await expect(
            validateElementImportPackage(
              { artifactId: randomUUID() },
              userTwoCtx
            )
          ).resolves.toMatchObject({
            importToken: null,
            errors: [ImportExportErrorCode.PACKAGE_NOT_FOUND],
          })
        }
      )
    })

    it('returns the package-not-found code when a validated package disappears before import', async () => {
      const tempDir = await mkdtemp(
        path.join(tmpdir(), 'klicker-import-missing-package-')
      )
      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          LOCAL_IMPORT_EXPORT_PACKAGE_DIR: tempDir,
          NODE_ENV: 'test',
        },
        async () => {
          const prepared = await uploadPreparedImportPackage(
            createValidationPackage(),
            userTwoCtx
          )
          const validation = await validateElementImportPackage(
            { artifactId: prepared.artifactId },
            userTwoCtx
          )
          expect(validation).toMatchObject({
            importToken: expect.any(String),
            errors: [],
          })

          await unlink(path.join(tempDir, prepared.blobName))

          await expect(
            importElementPackage(
              {
                importToken: validation.importToken!,
                selectedElementRefs: ['element-1'],
              },
              userTwoCtx
            )
          ).rejects.toMatchObject({
            extensions: { code: ImportExportErrorCode.PACKAGE_NOT_FOUND },
          })
        }
      )
    })

    it('redacts post-parse token-signing configuration failures', async () => {
      const prepared = await uploadPreparedImportPackage(
        createValidationPackage(),
        userTwoCtx
      )
      await clearPackageRateLimitKeys(userTwoCtx)

      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          IMPORT_EXPORT_TOKEN_SECRET: '',
          NODE_ENV: 'test',
        },
        async () => {
          let rejection: unknown
          try {
            await validateElementImportPackage(
              { artifactId: prepared.artifactId },
              userTwoCtx
            )
          } catch (error) {
            rejection = error
          }

          expect(rejection).toMatchObject({
            message: 'Import/export request failed.',
            extensions: {
              code: ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
            },
          })
          expect(JSON.stringify(rejection)).not.toContain('token secret')
          expect(JSON.stringify(rejection)).not.toContain(prepared.artifactId)
        }
      )
    })

    it('cleans up only expired recorded local package artifacts', async () => {
      const tempDir = await mkdtemp(
        path.join(tmpdir(), 'klicker-import-export-packages-')
      )
      const now = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const expiredAt = new Date(now.getTime() - 60 * 60 * 1000)
      const freshAt = new Date(now.getTime() + 60 * 60 * 1000)
      const expiredImportId = randomUUID()
      const expiredExportId = randomUUID()
      const freshImportId = randomUUID()
      const sentinelId = randomUUID()
      const expiredImportBlob = `imports/${userOneCtx.user.sub}/${expiredImportId}.zip`
      const expiredExportBlob = `exports/${userOneCtx.user.sub}/${expiredExportId}.zip`
      const freshImportBlob = `imports/${userOneCtx.user.sub}/${freshImportId}.zip`
      const sentinelBlob = `imports/${userOneCtx.user.sub}/${sentinelId}.zip`

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
          await writeLocalImportExportPackageBlob(
            sentinelBlob,
            Buffer.from('unrecorded-sentinel')
          )
          await userOneCtx.prisma.importExportPackageArtifact.createMany({
            data: [
              {
                id: expiredImportId,
                ownerId: userOneCtx.user.sub,
                direction: ImportExportPackageArtifactDirection.IMPORT,
                storageContainer: 'klicker-import-export',
                storageBlob: expiredImportBlob,
                reservedBytes: Buffer.byteLength('expired-import'),
                expiresAt: expiredAt,
              },
              {
                id: expiredExportId,
                ownerId: userOneCtx.user.sub,
                direction: ImportExportPackageArtifactDirection.EXPORT,
                storageContainer: 'klicker-import-export',
                storageBlob: expiredExportBlob,
                reservedBytes: Buffer.byteLength('expired-export'),
                expiresAt: expiredAt,
              },
              {
                id: freshImportId,
                ownerId: userOneCtx.user.sub,
                direction: ImportExportPackageArtifactDirection.IMPORT,
                storageContainer: 'klicker-import-export',
                storageBlob: freshImportBlob,
                reservedBytes: Buffer.byteLength('fresh-import'),
                expiresAt: freshAt,
              },
            ],
          })

          await expect(
            cleanupImportExportPackages({
              now,
              prisma: userOneCtx.prisma,
            })
          ).resolves.toMatchObject({
            deletedPackages: 2,
            wouldDeletePackages: 2,
            unsafePackageTargets: 0,
            deletedReceipts: 0,
            wouldDeleteReceipts: 0,
            deletedMediaFiles: 0,
            deletedStagingRecords: 0,
            wouldDeleteMediaFiles: 0,
          })
          await expect(
            readLocalImportExportPackageBlob(expiredImportBlob)
          ).rejects.toThrow()
          await expect(
            readLocalImportExportPackageBlob(expiredExportBlob)
          ).rejects.toThrow()
          await expect(
            readLocalImportExportPackageBlob(freshImportBlob)
          ).resolves.toEqual(Buffer.from('fresh-import'))
          await expect(
            readLocalImportExportPackageBlob(sentinelBlob)
          ).resolves.toEqual(Buffer.from('unrecorded-sentinel'))
        }
      )
    })
  })
})
