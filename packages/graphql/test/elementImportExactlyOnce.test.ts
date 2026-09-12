import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementImportReceiptState,
  ElementStatus,
  ElementType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  createElementImportToken,
  parseElementImportTokenForOwner,
} from '../src/lib/elementImportToken.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  createElementExportPackage,
  importElementPackage,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
} from '../src/services/elementImportExport.js'
import { manipulateElement } from '../src/services/elements.js'
import { createPendingElementImportReceipt } from '../src/services/importExportPersistence.js'
import { uploadPreparedElementImportPackage } from '../src/services/packageStorage.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

type InitializedUserContext = Awaited<
  ReturnType<typeof testInitialization>
>['userOneCtx']

const TEST_ENV_KEYS = [
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

let testSequence = 0

function restoreTestEnvironment() {
  for (const [key, value] of originalEnvironment) {
    if (typeof value === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function createSelectionDigest(selectedElementRefs: readonly string[]) {
  return createHash('sha256')
    .update(JSON.stringify([...new Set(selectedElementRefs)].sort()))
    .digest('hex')
}

function getPublicErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const extensions = Reflect.get(error, 'extensions')
  return extensions && typeof extensions === 'object'
    ? Reflect.get(extensions, 'code')
    : null
}

async function expectPublicImportError(
  operation: Promise<unknown>,
  code: ImportExportErrorCode
) {
  await expect(operation).rejects.toMatchObject({
    message: 'Import/export request failed.',
    extensions: { code },
  })
}

async function clearPackageRateLimitKeys(ctx: InitializedUserContext) {
  const keys = await ctx.redisExec.keys('rate-limit:import-export-package:*')
  if (keys.length > 0) {
    await ctx.redisExec.del(...keys)
  }
}

async function createSourceElements(
  count: number,
  ctx: InitializedUserContext
) {
  const elements: Array<
    NonNullable<Awaited<ReturnType<typeof manipulateElement>>>
  > = []
  const sequence = ++testSequence

  for (let index = 0; index < count; index++) {
    const element = await manipulateElement(
      {
        type: ElementType.CONTENT,
        status: ElementStatus.READY,
        name: `Exactly once source ${sequence}-${index + 1}`,
        content: `Exactly once content ${sequence}-${index + 1}`,
        options: {},
      },
      ctx
    )
    if (!element)
      throw new Error('Failed to create exactly-once source element.')
    elements.push(element)
  }

  return elements
}

async function prepareValidatedPackage({
  elementCount,
  exporterCtx,
  importerCtx,
}: {
  elementCount: number
  exporterCtx: InitializedUserContext
  importerCtx: InitializedUserContext
}) {
  const sourceElements = await createSourceElements(elementCount, exporterCtx)
  const exported = await createElementExportPackage(
    { elementIds: sourceElements.map(({ id }) => id) },
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
  if (!validation.importToken || validation.errors.length > 0) {
    throw new Error('Failed to validate exactly-once import package.')
  }

  return {
    artifactId: prepared.artifactId,
    importToken: validation.importToken,
    packageHash: createHash('sha256').update(exported.buffer).digest('hex'),
    refs: validation.elements.map(({ ref }) => ref),
    sourceNames: sourceElements.map(({ name }) => name),
  }
}

async function countImportedElements(
  importerCtx: InitializedUserContext,
  sourceNames: string[]
) {
  return await importerCtx.prisma.element.count({
    where: {
      ownerId: importerCtx.user.sub,
      name: { in: sourceNames },
    },
  })
}

describe.sequential('exactly-once public element import', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let localPackageDir: string
  let exporterCtx: InitializedUserContext
  let importerCtx: InitializedUserContext

  beforeAll(async () => {
    localPackageDir = await mkdtemp(
      path.join(tmpdir(), 'klicker-import-exactly-once-')
    )
    process.env.IMPORT_EXPORT_ENABLED = 'true'
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'local'
    process.env.IMPORT_EXPORT_TOKEN_SECRET =
      'exactly-once-test-token-secret-with-sufficient-entropy'
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
    await clearPackageRateLimitKeys(importerCtx)
    await testCleanup(prisma)
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

  it('returns the stored result on sequential retry and creates one resource set', async () => {
    const prepared = await prepareValidatedPackage({
      elementCount: 1,
      exporterCtx,
      importerCtx,
    })
    const args = {
      importToken: prepared.importToken,
      selectedElementRefs: prepared.refs,
    }

    const first = await importElementPackage(args, importerCtx)
    const replay = await importElementPackage(args, importerCtx)

    expect(first).toEqual({
      importedElements: 1,
      importedAnswerCollections: 0,
      skippedElements: 0,
      warnings: [],
    })
    expect(replay).toEqual(first)
    await expect(
      countImportedElements(importerCtx, prepared.sourceNames)
    ).resolves.toBe(1)
    await expect(
      prisma.elementImportReceipt.findMany({
        where: { ownerId: importerCtx.user.sub },
        select: { state: true, createdElementIds: true },
      })
    ).resolves.toEqual([
      {
        state: ElementImportReceiptState.COMPLETE,
        createdElementIds: expect.arrayContaining([expect.any(Number)]),
      },
    ])
  })

  it('bounds concurrent same-token attempts and later replays the result', async () => {
    const prepared = await prepareValidatedPackage({
      elementCount: 1,
      exporterCtx,
      importerCtx,
    })
    const args = {
      importToken: prepared.importToken,
      selectedElementRefs: prepared.refs,
    }

    const attempts = await Promise.allSettled([
      importElementPackage(args, importerCtx),
      importElementPackage(args, importerCtx),
    ])
    const completed = attempts.filter(
      (
        attempt
      ): attempt is PromiseFulfilledResult<
        Awaited<ReturnType<typeof importElementPackage>>
      > => attempt.status === 'fulfilled'
    )
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult =>
        attempt.status === 'rejected'
    )

    expect(completed.length).toBeGreaterThanOrEqual(1)
    for (const attempt of completed) {
      expect(attempt.value).toEqual({
        importedElements: 1,
        importedAnswerCollections: 0,
        skippedElements: 0,
        warnings: [],
      })
    }
    for (const attempt of rejected) {
      expect(getPublicErrorCode(attempt.reason)).toBe(
        ImportExportErrorCode.RATE_LIMITED
      )
    }
    await expect(
      countImportedElements(importerCtx, prepared.sourceNames)
    ).resolves.toBe(1)

    await expect(importElementPackage(args, importerCtx)).resolves.toEqual({
      importedElements: 1,
      importedAnswerCollections: 0,
      skippedElements: 0,
      warnings: [],
    })
  })

  it('canonicalizes reordered and duplicate selected refs', async () => {
    const prepared = await prepareValidatedPackage({
      elementCount: 2,
      exporterCtx,
      importerCtx,
    })
    const [firstRef, secondRef] = prepared.refs
    if (!firstRef || !secondRef) throw new Error('Expected two package refs.')

    const first = await importElementPackage(
      {
        importToken: prepared.importToken,
        selectedElementRefs: [secondRef, firstRef, secondRef],
      },
      importerCtx
    )
    const replay = await importElementPackage(
      {
        importToken: prepared.importToken,
        selectedElementRefs: [firstRef, secondRef],
      },
      importerCtx
    )

    expect(first).toEqual({
      importedElements: 2,
      importedAnswerCollections: 0,
      skippedElements: 0,
      warnings: [],
    })
    expect(replay).toEqual(first)
    await expect(
      countImportedElements(importerCtx, prepared.sourceNames)
    ).resolves.toBe(2)
    await expect(
      prisma.elementImportReceipt.findFirstOrThrow({
        where: { ownerId: importerCtx.user.sub },
        select: { selectedElementRefs: true },
      })
    ).resolves.toEqual({ selectedElementRefs: [firstRef, secondRef].sort() })
  })

  it('rejects the same token with a changed selection', async () => {
    const prepared = await prepareValidatedPackage({
      elementCount: 2,
      exporterCtx,
      importerCtx,
    })
    const [firstRef, secondRef] = prepared.refs
    if (!firstRef || !secondRef) throw new Error('Expected two package refs.')

    await importElementPackage(
      {
        importToken: prepared.importToken,
        selectedElementRefs: [firstRef],
      },
      importerCtx
    )
    await expectPublicImportError(
      importElementPackage(
        {
          importToken: prepared.importToken,
          selectedElementRefs: [secondRef],
        },
        importerCtx
      ),
      ImportExportErrorCode.REPLAY_MISMATCH
    )

    await expect(
      countImportedElements(importerCtx, prepared.sourceNames)
    ).resolves.toBe(1)
  })

  it('replays a completed receipt after expiry but rejects an expired new jti', async () => {
    const prepared = await prepareValidatedPackage({
      elementCount: 1,
      exporterCtx,
      importerCtx,
    })
    const token = parseElementImportTokenForOwner({
      token: prepared.importToken,
      userId: importerCtx.user.sub,
    })
    const args = {
      importToken: prepared.importToken,
      selectedElementRefs: prepared.refs,
    }
    const completed = await importElementPackage(args, importerCtx)
    const expiredCompletedToken = createElementImportToken({
      userId: token.userId,
      artifactId: token.artifactId,
      packageHash: token.packageHash,
      expiresAt: Date.now() - 1,
      jti: token.jti,
    })

    await expect(
      importElementPackage(
        { ...args, importToken: expiredCompletedToken },
        importerCtx
      )
    ).resolves.toEqual(completed)

    const newJti = randomUUID()
    const expiredNewToken = createElementImportToken({
      userId: token.userId,
      artifactId: token.artifactId,
      packageHash: token.packageHash,
      expiresAt: Date.now() - 1,
      jti: newJti,
    })
    await expectPublicImportError(
      importElementPackage(
        { ...args, importToken: expiredNewToken },
        importerCtx
      ),
      ImportExportErrorCode.TOKEN_EXPIRED
    )
    await expect(
      prisma.elementImportReceipt.count({ where: { jti: newJti } })
    ).resolves.toBe(0)
    await expect(
      countImportedElements(importerCtx, prepared.sourceNames)
    ).resolves.toBe(1)
  })

  it('returns in-progress for an active pending receipt', async () => {
    const prepared = await prepareValidatedPackage({
      elementCount: 1,
      exporterCtx,
      importerCtx,
    })
    const token = parseElementImportTokenForOwner({
      token: prepared.importToken,
      userId: importerCtx.user.sub,
    })
    const selectedElementRefs = [...new Set(prepared.refs)].sort()

    await createPendingElementImportReceipt({
      prisma,
      jti: token.jti,
      sourceArtifactId: prepared.artifactId,
      artifactRecordId: prepared.artifactId,
      packageHash: prepared.packageHash,
      selectionDigest: createSelectionDigest(selectedElementRefs),
      selectedElementRefs,
      leaseId: randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 60_000),
      ownerId: importerCtx.user.sub,
    })

    await expectPublicImportError(
      importElementPackage(
        {
          importToken: prepared.importToken,
          selectedElementRefs,
        },
        importerCtx
      ),
      ImportExportErrorCode.IMPORT_IN_PROGRESS
    )
    await expect(
      countImportedElements(importerCtx, prepared.sourceNames)
    ).resolves.toBe(0)
  })
})
