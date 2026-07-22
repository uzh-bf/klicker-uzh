import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementImportReceiptState,
  ElementStatus,
  ElementType,
  ImportMediaStagingState,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  createElementExportPackage,
  importElementPackage,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
} from '../src/services/elementImportExport.js'
import { manipulateElement } from '../src/services/elements.js'
import {
  createImportedMediaHref,
  readLocalImportedMedia,
  writeLocalImportedMediaExclusive,
} from '../src/services/importExportMediaBlobStore.js'
import { uploadPreparedElementImportPackage } from '../src/services/packageStorage.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

type InitializedUserContext = Awaited<
  ReturnType<typeof testInitialization>
>['userOneCtx']

const TEST_ENV_KEYS = [
  'APP_ORIGIN_API',
  'ASSESSMENT_MODE',
  'IMPORT_EXPORT_ENABLED',
  'IMPORT_EXPORT_PACKAGE_STORAGE',
  'IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY',
  'IMPORT_EXPORT_TOKEN_SECRET',
  'LOCAL_IMPORT_EXPORT_PACKAGE_DIR',
] as const

const originalEnvironment = new Map(
  TEST_ENV_KEYS.map((key) => [key, process.env[key]])
)

function restoreTestEnvironment() {
  for (const [key, value] of originalEnvironment) {
    if (typeof value === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function clearPackageRateLimitKeys(ctx: InitializedUserContext) {
  const keys = await ctx.redisExec.keys('rate-limit:import-export-package:*')
  if (keys.length > 0) {
    await ctx.redisExec.del(...keys)
  }
}

async function seedLocalMediaElement({
  label,
  bytes,
  ctx,
}: {
  label: string
  bytes: Buffer
  ctx: InitializedUserContext
}) {
  const mediaId = randomUUID()
  const storageBlob = `imported/${mediaId}.png`
  const href = createImportedMediaHref(ctx.user.sub, storageBlob)
  const contentHash = createHash('sha256').update(bytes).digest('hex')

  expect(
    await writeLocalImportedMediaExclusive(ctx.user.sub, storageBlob, bytes)
  ).toBe(true)
  await ctx.prisma.mediaFile.create({
    data: {
      id: mediaId,
      ownerId: ctx.user.sub,
      href,
      name: `${label}.png`,
      type: 'image/png',
      originalId: `source-media:${mediaId}`,
      contentHash,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    },
  })

  const element = await manipulateElement(
    {
      type: ElementType.CONTENT,
      status: ElementStatus.READY,
      name: `${label} element`,
      content: `![${label}](${href})`,
      options: {},
    },
    ctx
  )
  if (!element) throw new Error('Failed to create packaged-media element.')

  return { element, contentHash, bytes }
}

describe.sequential('public packaged-media import with local providers', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let localPackageDir: string
  let exporterCtx: InitializedUserContext
  let importerCtx: InitializedUserContext

  beforeAll(async () => {
    localPackageDir = await mkdtemp(
      path.join(tmpdir(), 'klicker-import-packaged-media-')
    )
    process.env.APP_ORIGIN_API = 'http://127.0.0.1:3000'
    process.env.IMPORT_EXPORT_ENABLED = 'true'
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'local'
    process.env.IMPORT_EXPORT_TOKEN_SECRET =
      'packaged-media-test-token-secret-with-sufficient-entropy'
    process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR = localPackageDir
    delete process.env.ASSESSMENT_MODE

    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    exporterCtx = initialized.userOneCtx
    importerCtx = initialized.userTwoCtx
    await clearPackageRateLimitKeys(importerCtx)
  })

  afterEach(async () => {
    try {
      if (importerCtx) await clearPackageRateLimitKeys(importerCtx)
    } finally {
      await testCleanup(prisma)
    }
  })

  afterAll(async () => {
    try {
      if (prisma) {
        await testCleanup(prisma)
        await prisma.$disconnect()
      }
      if (localPackageDir) {
        await rm(localPackageDir, { recursive: true, force: true })
      }
    } finally {
      restoreTestEnvironment()
    }
  })

  it('copies and finalizes only selected required media and replays without duplicates', async () => {
    const selected = await seedLocalMediaElement({
      label: 'selected-media',
      bytes: Buffer.from('selected packaged media bytes'),
      ctx: exporterCtx,
    })
    const unselected = await seedLocalMediaElement({
      label: 'unselected-media',
      bytes: Buffer.from('unselected packaged media bytes'),
      ctx: exporterCtx,
    })

    const exported = await createElementExportPackage(
      { elementIds: [selected.element.id, unselected.element.id] },
      exporterCtx
    )
    await clearPackageRateLimitKeys(importerCtx)
    const prepared = await prepareElementImportPackageUpload(
      { filename: exported.filename, bytes: exported.buffer.length },
      importerCtx
    )
    await uploadPreparedElementImportPackage(
      {
        artifactId: prepared.artifactId,
        capability: prepared.uploadCapability,
        contentLength: exported.buffer.length,
        contentType: 'application/zip',
        stream: (async function* () {
          yield exported.buffer
        })(),
      },
      importerCtx
    )

    await clearPackageRateLimitKeys(importerCtx)
    const validation = await validateElementImportPackage(
      { artifactId: prepared.artifactId },
      importerCtx
    )
    expect(validation.errors).toEqual([])
    expect(validation.importToken).toEqual(expect.any(String))
    const selectedPreview = validation.elements.find(
      ({ name }) => name === selected.element.name
    )
    if (!selectedPreview || !validation.importToken) {
      throw new Error('Selected packaged-media element was not validated.')
    }

    const importArgs = {
      importToken: validation.importToken,
      selectedElementRefs: [selectedPreview.ref],
    }
    const firstResult = await importElementPackage(importArgs, importerCtx)
    expect(firstResult).toEqual({
      importedElements: 1,
      importedAnswerCollections: 0,
      skippedElements: 0,
      warnings: [],
    })

    const receipt = await prisma.elementImportReceipt.findFirstOrThrow({
      where: { ownerId: importerCtx.user.sub },
    })
    expect(receipt.state).toBe(ElementImportReceiptState.COMPLETE)

    const staging = await prisma.importMediaStaging.findMany({
      where: { receiptId: receipt.id },
    })
    expect(staging).toHaveLength(1)
    expect(staging[0]).toMatchObject({
      ownerId: importerCtx.user.sub,
      receiptId: receipt.id,
      state: ImportMediaStagingState.FINALIZED,
      createdBlob: true,
      storageContainer: importerCtx.user.sub,
      storageBlob: expect.stringMatching(/^imported\/[0-9a-f-]{36}\.png$/),
      contentHash: selected.contentHash,
      mediaFileId: expect.any(String),
    })

    const staged = staging[0]!
    const expectedImportedHref = createImportedMediaHref(
      importerCtx.user.sub,
      staged.storageBlob
    )
    const importedMedia = await prisma.mediaFile.findUniqueOrThrow({
      where: { id: staged.mediaFileId! },
    })
    expect(importedMedia).toMatchObject({
      ownerId: importerCtx.user.sub,
      href: expectedImportedHref,
      contentHash: selected.contentHash,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      originalId: `import-media:${selected.contentHash}`,
    })
    expect(staged.mediaFileId).toBe(importedMedia.id)
    await expect(
      readLocalImportedMedia(importerCtx.user.sub, staged.storageBlob)
    ).resolves.toEqual(selected.bytes)
    await expect(
      readdir(
        path.join(
          localPackageDir,
          'imported-media',
          importerCtx.user.sub,
          'imported'
        )
      )
    ).resolves.toEqual([path.basename(staged.storageBlob)])

    const importedElement = await prisma.element.findFirstOrThrow({
      where: {
        ownerId: importerCtx.user.sub,
        name: selected.element.name,
      },
    })
    expect(importedElement.content).toBe(
      `![selected-media](<${expectedImportedHref}>)`
    )
    expect(importedElement).toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    })
    expect(receipt.createdElementIds).toEqual([importedElement.id])
    await expect(
      prisma.element.count({
        where: {
          ownerId: importerCtx.user.sub,
          name: {
            in: [selected.element.name, unselected.element.name],
          },
        },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.mediaFile.count({
        where: { ownerId: importerCtx.user.sub },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.mediaFile.count({
        where: {
          ownerId: importerCtx.user.sub,
          contentHash: unselected.contentHash,
        },
      })
    ).resolves.toBe(0)

    await expect(
      importElementPackage(importArgs, importerCtx)
    ).resolves.toEqual(firstResult)
    await expect(
      prisma.element.count({
        where: {
          ownerId: importerCtx.user.sub,
          name: selected.element.name,
        },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.mediaFile.count({
        where: { ownerId: importerCtx.user.sub },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.importMediaStaging.count({
        where: { receiptId: receipt.id },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.elementImportReceipt.count({
        where: { ownerId: importerCtx.user.sub },
      })
    ).resolves.toBe(1)
    await expect(
      readLocalImportedMedia(importerCtx.user.sub, staged.storageBlob)
    ).resolves.toEqual(selected.bytes)
    await expect(
      readdir(
        path.join(
          localPackageDir,
          'imported-media',
          importerCtx.user.sub,
          'imported'
        )
      )
    ).resolves.toEqual([path.basename(staged.storageBlob)])
  }, 60_000)
})
