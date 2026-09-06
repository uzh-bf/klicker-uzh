import { prisma } from '@klicker-uzh/prisma'
import {
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createImportExportArtifactStorageTarget,
  verifyImportUploadCapability,
} from '../src/lib/importExportCapabilities.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../src/lib/importExportErrors.js'
import {
  cleanupImportExportPackages,
  downloadLocalElementExportPackage,
  downloadPreparedElementImportPackage,
  prepareElementImportPackageUpload,
  readLocalImportExportPackageBlob,
  reserveElementExportPackageArtifact,
  uploadElementExportPackage,
  uploadPreparedElementImportPackage,
  writeLocalImportExportPackageBlob,
} from '../src/services/packageStorage.js'

const TEST_RUN_ID = randomUUID()
const TEST_EMAIL_PREFIX = `import-export-package-storage-${TEST_RUN_ID}`
const TOKEN_SECRET = `package-storage-test-secret-${TEST_RUN_ID}`
const ZIP_CONTENT_TYPE = 'application/zip'

const ORIGINAL_ENV = {
  IMPORT_EXPORT_ENABLED: process.env.IMPORT_EXPORT_ENABLED,
  IMPORT_EXPORT_PACKAGE_STORAGE: process.env.IMPORT_EXPORT_PACKAGE_STORAGE,
  IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY:
    process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY,
  IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY:
    process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY,
  IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY:
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY,
  IMPORT_EXPORT_TOKEN_SECRET: process.env.IMPORT_EXPORT_TOKEN_SECRET,
  LOCAL_IMPORT_EXPORT_PACKAGE_DIR: process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR,
  NODE_ENV: process.env.NODE_ENV,
}

let ownerId: string
let otherOwnerId: string
let localPackageRoot: string

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function createContext(
  userId: string,
  evalResult: unknown = [1, 1],
  prismaClient: ContextWithUser['prisma'] = prisma
) {
  return {
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: prismaClient,
    redisExec: {
      eval: vi.fn(async (script: string) =>
        script.includes('local globalKey') ? 1 : evalResult
      ),
    },
  } as unknown as ContextWithUser
}

function chunks(...values: Array<Buffer | string>) {
  return (async function* () {
    for (const value of values) {
      yield typeof value === 'string' ? Buffer.from(value) : value
    }
  })()
}

async function expectPackageError(
  operation: Promise<unknown>,
  code: ImportExportErrorCode
) {
  let error: unknown
  try {
    await operation
  } catch (caughtError) {
    error = caughtError
  }

  expect(error).toBeInstanceOf(ImportExportDomainError)
  expect(error).toMatchObject({ code })
}

async function expectPendingWithoutBlob({
  artifactId,
  blobName,
}: {
  artifactId: string
  blobName: string
}) {
  await expect(
    prisma.importExportPackageArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      select: { state: true, bytes: true, sha256: true },
    })
  ).resolves.toEqual({
    state: ImportExportPackageArtifactState.PENDING,
    bytes: null,
    sha256: null,
  })
  await expect(
    readLocalImportExportPackageBlob(blobName)
  ).rejects.toMatchObject({ code: 'ENOENT' })
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.IMPORT_EXPORT_ENABLED = 'true'
  process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
  process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'local'
  process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY = '1'
  process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY = '4'
  process.env.IMPORT_EXPORT_TOKEN_SECRET = TOKEN_SECRET

  const [owner, otherOwner] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}-owner@example.invalid`,
        shortname: `ieps-${TEST_RUN_ID}-owner`,
      },
    }),
    prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}-other@example.invalid`,
        shortname: `ieps-${TEST_RUN_ID}-other`,
      },
    }),
  ])
  ownerId = owner.id
  otherOwnerId = otherOwner.id
})

beforeEach(async () => {
  localPackageRoot = await mkdtemp(
    path.join(tmpdir(), 'klicker-import-export-package-storage-')
  )
  process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR = localPackageRoot
})

afterEach(async () => {
  await prisma.importExportPackageArtifact.deleteMany({
    where: { ownerId: { in: [ownerId, otherOwnerId] } },
  })
  await rm(localPackageRoot, { force: true, recursive: true })
})

afterAll(async () => {
  await prisma.importExportPackageArtifact.deleteMany({
    where: { ownerId: { in: [ownerId, otherOwnerId] } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, otherOwnerId] } },
  })
  restoreEnv()
})

describe('durable import/export package storage', () => {
  it('reserves a canonical owner-bound import artifact and exact upload capability', async () => {
    const bytes = 13
    const prepared = await prepareElementImportPackageUpload(
      { bytes },
      createContext(ownerId)
    )
    const target = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId: prepared.artifactId,
    })

    expect(prepared).toMatchObject({
      blobName: target.storageBlob,
      uploadURL: expect.stringContaining(
        `/api/import-export-packages/${prepared.artifactId}/upload`
      ),
    })
    expect(
      verifyImportUploadCapability({
        token: prepared.uploadCapability,
        secret: TOKEN_SECRET,
        userId: ownerId,
        artifactId: prepared.artifactId,
        bytes,
      })
    ).toMatchObject({ userId: ownerId, artifactId: prepared.artifactId, bytes })
    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: prepared.artifactId },
      })
    ).resolves.toMatchObject({
      ownerId,
      direction: ImportExportPackageArtifactDirection.IMPORT,
      state: ImportExportPackageArtifactState.PENDING,
      storageContainer: target.storageContainer,
      storageBlob: target.storageBlob,
      reservedBytes: bytes,
      bytes: null,
      sha256: null,
    })
  })

  it('streams an exact import upload, persists its hash and bytes, and replays without consuming or overwriting', async () => {
    const payload = Buffer.from('chunked package payload')
    const ctx = createContext(ownerId)
    const prepared = await prepareElementImportPackageUpload(
      { bytes: payload.length },
      ctx
    )

    await expect(
      uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: payload.length,
          contentType: ZIP_CONTENT_TYPE,
          stream: chunks(
            payload.subarray(0, 4),
            payload.subarray(4, 11),
            payload.subarray(11)
          ),
        },
        ctx
      )
    ).resolves.toEqual({
      bytes: payload.length,
      sha256: createHash('sha256').update(payload).digest('hex'),
      replayed: false,
    })
    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: prepared.artifactId },
        select: { state: true, bytes: true, sha256: true },
      })
    ).resolves.toEqual({
      state: ImportExportPackageArtifactState.READY,
      bytes: payload.length,
      sha256: createHash('sha256').update(payload).digest('hex'),
    })
    await expect(
      downloadPreparedElementImportPackage(
        { artifactId: prepared.artifactId },
        ctx
      )
    ).resolves.toMatchObject({ buffer: payload, blobName: prepared.blobName })

    let replayStreamConsumed = false
    const replayStream = (async function* () {
      replayStreamConsumed = true
      throw new Error('A replay must not consume the request stream.')
    })()
    await expect(
      uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: payload.length,
          contentType: ZIP_CONTENT_TYPE,
          stream: replayStream,
        },
        ctx
      )
    ).resolves.toEqual({
      bytes: payload.length,
      sha256: createHash('sha256').update(payload).digest('hex'),
      replayed: true,
    })
    expect(replayStreamConsumed).toBe(false)
    await expect(
      readLocalImportExportPackageBlob(prepared.blobName)
    ).resolves.toEqual(payload)
  })

  it('emits paired privacy-safe upload, download, and replay telemetry', async () => {
    const payload = Buffer.from('telemetry package payload')
    const ctx = createContext(ownerId)
    const prepared = await prepareElementImportPackageUpload(
      { bytes: payload.length },
      ctx
    )
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    let events: Array<Record<string, unknown>> = []

    try {
      await uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: payload.length,
          contentType: ZIP_CONTENT_TYPE,
          stream: chunks(payload),
        },
        ctx
      )
      await downloadPreparedElementImportPackage(
        { artifactId: prepared.artifactId },
        ctx
      )
      await uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: payload.length,
          contentType: ZIP_CONTENT_TYPE,
          stream: chunks(payload),
        },
        ctx
      )
      events = info.mock.calls.flatMap(([label, serialized]) =>
        label === '[ImportExportTelemetry]' && typeof serialized === 'string'
          ? [JSON.parse(serialized) as Record<string, unknown>]
          : []
      )
    } finally {
      info.mockRestore()
    }

    const uploadEvents = events.filter(
      ({ operation }) => operation === 'upload'
    )
    const downloadEvents = events.filter(
      ({ operation }) => operation === 'download'
    )
    expect(uploadEvents.map(({ outcome }) => outcome)).toEqual([
      'started',
      'success',
      'started',
      'replayed',
    ])
    expect(uploadEvents[0]?.correlationId).toBe(uploadEvents[1]?.correlationId)
    expect(uploadEvents[2]?.correlationId).toBe(uploadEvents[3]?.correlationId)
    expect(downloadEvents.map(({ outcome }) => outcome)).toEqual([
      'started',
      'success',
    ])
    expect(downloadEvents[0]?.correlationId).toBe(
      downloadEvents[1]?.correlationId
    )
    const serializedEvents = JSON.stringify(events)
    expect(serializedEvents).not.toContain(ownerId)
    expect(serializedEvents).not.toContain(prepared.artifactId)
    expect(serializedEvents).not.toContain(prepared.blobName)
  })

  it.each([
    {
      label: 'short',
      expectedCode: ImportExportErrorCode.INVALID_PACKAGE,
      streamed: Buffer.from('1234'),
    },
    {
      label: 'oversized',
      expectedCode: ImportExportErrorCode.UPLOAD_TOO_LARGE,
      streamed: Buffer.from('123456'),
    },
  ])('removes the durable record and blob after a $label claimed upload', async ({
    expectedCode,
    streamed,
  }) => {
    const ctx = createContext(ownerId)
    const prepared = await prepareElementImportPackageUpload({ bytes: 5 }, ctx)

    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: 5,
          contentType: ZIP_CONTENT_TYPE,
          stream: chunks(streamed),
        },
        ctx
      ),
      expectedCode
    )
    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: prepared.artifactId },
      })
    ).resolves.toBeNull()
    await expect(
      readLocalImportExportPackageBlob(prepared.blobName)
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains the exact ledger and byte quota when a claimed storage write is indeterminate', async () => {
    const payload = Buffer.from('indeterminate storage write')
    const ctx = createContext(ownerId)
    const prepared = await prepareElementImportPackageUpload(
      { bytes: payload.length },
      ctx
    )
    await mkdir(path.join(localPackageRoot, prepared.blobName), {
      recursive: true,
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    try {
      await expectPackageError(
        uploadPreparedElementImportPackage(
          {
            artifactId: prepared.artifactId,
            capability: prepared.uploadCapability,
            contentLength: payload.length,
            contentType: ZIP_CONTENT_TYPE,
            stream: chunks(payload),
          },
          ctx
        ),
        ImportExportErrorCode.INFRASTRUCTURE_FAILURE
      )
    } finally {
      info.mockRestore()
    }

    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: prepared.artifactId },
        select: {
          state: true,
          reservedBytes: true,
          storageBlob: true,
        },
      })
    ).resolves.toEqual({
      state: ImportExportPackageArtifactState.UPLOADING,
      reservedBytes: payload.length,
      storageBlob: prepared.blobName,
    })
  })

  it('rejects bad MIME, bytes, capabilities, users, and artifacts before creating a partial upload', async () => {
    const ownerCtx = createContext(ownerId)
    const otherCtx = createContext(otherOwnerId)
    const first = await prepareElementImportPackageUpload(
      { bytes: 5 },
      ownerCtx
    )
    const second = await prepareElementImportPackageUpload(
      { bytes: 5 },
      ownerCtx
    )
    const base = {
      contentLength: 5,
      contentType: ZIP_CONTENT_TYPE,
      stream: chunks('12345'),
    }

    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          ...base,
          artifactId: first.artifactId,
          capability: first.uploadCapability,
          contentType: 'text/plain',
        },
        ownerCtx
      ),
      ImportExportErrorCode.UNSUPPORTED_FILE_TYPE
    )
    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          ...base,
          artifactId: first.artifactId,
          capability: first.uploadCapability,
          contentLength: 4,
        },
        ownerCtx
      ),
      ImportExportErrorCode.TOKEN_INVALID
    )
    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          ...base,
          artifactId: first.artifactId,
          capability: `${first.uploadCapability}x`,
        },
        ownerCtx
      ),
      ImportExportErrorCode.TOKEN_INVALID
    )
    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          ...base,
          artifactId: first.artifactId,
          capability: first.uploadCapability,
        },
        otherCtx
      ),
      ImportExportErrorCode.PACKAGE_NOT_FOUND
    )
    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          ...base,
          artifactId: second.artifactId,
          capability: first.uploadCapability,
        },
        ownerCtx
      ),
      ImportExportErrorCode.TOKEN_INVALID
    )

    await expectPendingWithoutBlob(first)
    await expectPendingWithoutBlob(second)
  })

  it('does not claim or create a blob when the upload rate limit rejects', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const ctx = createContext(ownerId, [0, 1])
    const prepared = await prepareElementImportPackageUpload({ bytes: 5 }, ctx)

    try {
      await expectPackageError(
        uploadPreparedElementImportPackage(
          {
            artifactId: prepared.artifactId,
            capability: prepared.uploadCapability,
            contentLength: 5,
            contentType: ZIP_CONTENT_TYPE,
            stream: chunks('12345'),
          },
          ctx
        ),
        ImportExportErrorCode.RATE_LIMITED
      )
    } finally {
      info.mockRestore()
    }
    await expectPendingWithoutBlob(prepared)
  })

  it('does not claim, consume, or create a blob when upload concurrency is full', async () => {
    const ctx = createContext(ownerId)
    const prepared = await prepareElementImportPackageUpload({ bytes: 5 }, ctx)
    let streamConsumed = false
    const stream = (async function* () {
      streamConsumed = true
      yield Buffer.from('12345')
    })()
    vi.mocked(ctx.redisExec.eval).mockImplementation(async (script) =>
      String(script).includes('local globalKey') ? 0 : [1, 1]
    )

    await expectPackageError(
      uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: 5,
          contentType: ZIP_CONTENT_TYPE,
          stream,
        },
        ctx
      ),
      ImportExportErrorCode.RATE_LIMITED
    )

    expect(streamConsumed).toBe(false)
    expect(ctx.redisExec.eval).toHaveBeenCalledWith(
      expect.stringContaining('local globalKey'),
      2,
      `concurrency:{import-export-package}:upload:user:${ownerId}`,
      'concurrency:{import-export-package}:upload:global',
      expect.any(Number),
      120_000,
      1,
      4,
      expect.any(String)
    )
    await expectPendingWithoutBlob(prepared)
  })

  it('allows only one concurrent claim to consume and store an upload', async () => {
    const payload = Buffer.from('one durable package')
    const prepared = await prepareElementImportPackageUpload(
      { bytes: payload.length },
      createContext(ownerId)
    )
    let observedReads = 0
    let releaseReads!: () => void
    const bothReadPending = new Promise<void>((resolve) => {
      releaseReads = resolve
    })
    const artifactDelegate = {
      findFirst: vi.fn(async (args) => {
        const artifact =
          await prisma.importExportPackageArtifact.findFirst(args)
        observedReads += 1
        if (observedReads === 2) releaseReads()
        await bothReadPending
        return artifact
      }),
      updateMany: (
        ...args: Parameters<
          typeof prisma.importExportPackageArtifact.updateMany
        >
      ) => prisma.importExportPackageArtifact.updateMany(...args),
      deleteMany: (
        ...args: Parameters<
          typeof prisma.importExportPackageArtifact.deleteMany
        >
      ) => prisma.importExportPackageArtifact.deleteMany(...args),
    }
    const concurrentCtx = createContext(ownerId, [1, 1], {
      importExportPackageArtifact: artifactDelegate,
    } as unknown as ContextWithUser['prisma'])
    let consumedStreams = 0
    const stream = () =>
      (async function* () {
        consumedStreams += 1
        yield payload
      })()
    const upload = () =>
      uploadPreparedElementImportPackage(
        {
          artifactId: prepared.artifactId,
          capability: prepared.uploadCapability,
          contentLength: payload.length,
          contentType: ZIP_CONTENT_TYPE,
          stream: stream(),
        },
        concurrentCtx
      )

    const results = await Promise.allSettled([upload(), upload()])
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1
    )
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1
    )
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: { code: ImportExportErrorCode.IMPORT_IN_PROGRESS },
    })
    expect(consumedStreams).toBe(1)
    await expect(
      readLocalImportExportPackageBlob(prepared.blobName)
    ).resolves.toEqual(payload)
    await expect(
      readdir(path.dirname(path.join(localPackageRoot, prepared.blobName)))
    ).resolves.toEqual([`${prepared.artifactId}.zip`])
  })

  it('creates a ready export and validates local downloads by owner and capability', async () => {
    const payload = Buffer.from('private export package')
    const ctx = createContext(ownerId)
    const exported = await uploadElementExportPackage(
      {
        filename: 'My Export.zip',
        buffer: payload,
        publishGuard: async () => undefined,
      },
      ctx
    )
    const url = new URL(exported.downloadLink)
    const capability = url.searchParams.get('capability')
    const target = createImportExportArtifactStorageTarget({
      direction: 'EXPORT',
      ownerId,
      artifactId: exported.artifactId,
    })

    expect(exported.filename).toBe('my-export.zip')
    expect(capability).toEqual(expect.any(String))
    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: exported.artifactId },
      })
    ).resolves.toMatchObject({
      ownerId,
      direction: ImportExportPackageArtifactDirection.EXPORT,
      state: ImportExportPackageArtifactState.READY,
      storageContainer: target.storageContainer,
      storageBlob: target.storageBlob,
      reservedBytes: payload.length,
      bytes: payload.length,
      sha256: createHash('sha256').update(payload).digest('hex'),
    })
    await expect(
      downloadLocalElementExportPackage(
        { artifactId: exported.artifactId, capability: capability! },
        ctx
      )
    ).resolves.toEqual(payload)
    await expectPackageError(
      downloadLocalElementExportPackage(
        { artifactId: exported.artifactId, capability: `${capability}x` },
        ctx
      ),
      ImportExportErrorCode.TOKEN_INVALID
    )
    await expectPackageError(
      downloadLocalElementExportPackage(
        { artifactId: exported.artifactId, capability: capability! },
        createContext(otherOwnerId)
      ),
      ImportExportErrorCode.PACKAGE_NOT_FOUND
    )
  })

  it('removes the private blob and artifact when the final export guard rejects publication', async () => {
    const ctx = createContext(ownerId)
    const reservation = await reserveElementExportPackageArtifact(ctx)
    const publicationError = new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )

    await expectPackageError(
      uploadElementExportPackage(
        {
          filename: 'stale-export.zip',
          buffer: Buffer.from('stale private export'),
          reservation,
          publishGuard: async () => {
            throw publicationError
          },
        },
        ctx
      ),
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )

    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: reservation.artifactId },
      })
    ).resolves.toBeNull()
    await expect(
      readLocalImportExportPackageBlob(reservation.target.storageBlob)
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retries a serialization failure without uploading the export blob again', async () => {
    const payload = Buffer.from('single-write retry export')
    const reservation = await reserveElementExportPackageArtifact(
      createContext(ownerId)
    )
    let transactionAttempts = 0
    const transaction = prisma.$transaction.bind(prisma)
    const retryPrisma = new Proxy(prisma as any, {
      get(target, property, receiver) {
        if (property === '$transaction') {
          return async (...args: any[]) => {
            transactionAttempts += 1
            if (transactionAttempts === 1) {
              const callback = args[0] as (
                tx: ContextWithUser['prisma']
              ) => Promise<unknown>
              const rolledBackArtifactDelegate = new Proxy(
                prisma.importExportPackageArtifact,
                {
                  get(delegate, delegateProperty, delegateReceiver) {
                    if (delegateProperty === 'updateMany') {
                      return async () => ({ count: 1 })
                    }
                    const value = Reflect.get(
                      delegate,
                      delegateProperty,
                      delegateReceiver
                    )
                    return typeof value === 'function'
                      ? value.bind(delegate)
                      : value
                  },
                }
              )
              const rolledBackTransaction = new Proxy(prisma as any, {
                get(transactionTarget, txProperty, txReceiver) {
                  if (txProperty === 'importExportPackageArtifact') {
                    return rolledBackArtifactDelegate
                  }
                  const value = Reflect.get(
                    transactionTarget,
                    txProperty,
                    txReceiver
                  )
                  return typeof value === 'function'
                    ? value.bind(transactionTarget)
                    : value
                },
              }) as ContextWithUser['prisma']
              await callback(rolledBackTransaction)
              throw Object.assign(new Error('serialization failure'), {
                code: 'P2034',
              })
            }
            return await (transaction as any)(...args)
          }
        }
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as ContextWithUser['prisma']
    const ctx = createContext(ownerId, [1, 1], retryPrisma)
    const publishGuard = vi.fn(async () => undefined)

    await expect(
      uploadElementExportPackage(
        {
          filename: 'retry-export.zip',
          buffer: payload,
          reservation,
          publishGuard,
        },
        ctx
      )
    ).resolves.toMatchObject({ artifactId: reservation.artifactId })

    expect(transactionAttempts).toBe(2)
    expect(publishGuard).toHaveBeenCalledTimes(2)
    await expect(
      readLocalImportExportPackageBlob(reservation.target.storageBlob)
    ).resolves.toEqual(payload)
    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: reservation.artifactId },
        select: { state: true },
      })
    ).resolves.toEqual({ state: ImportExportPackageArtifactState.READY })
  })

  it('reports cleanup dry runs without mutation and never deletes an unrecorded sentinel', async () => {
    const artifactId = randomUUID()
    const sentinelId = randomUUID()
    const target = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId,
    })
    const sentinel = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId: sentinelId,
    })
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const now = new Date(expiresAt.getTime() + 1)
    await prisma.importExportPackageArtifact.create({
      data: {
        id: artifactId,
        ownerId,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        storageContainer: target.storageContainer,
        storageBlob: target.storageBlob,
        reservedBytes: 8,
        expiresAt,
      },
    })
    await writeLocalImportExportPackageBlob(
      target.storageBlob,
      Buffer.from('recorded')
    )
    await writeLocalImportExportPackageBlob(
      sentinel.storageBlob,
      Buffer.from('sentinel')
    )

    await expect(
      cleanupImportExportPackages({ now, prisma, dryRun: true })
    ).resolves.toMatchObject({ deletedPackages: 0, wouldDeletePackages: 1 })
    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: artifactId },
      })
    ).resolves.not.toBeNull()
    await expect(
      readLocalImportExportPackageBlob(target.storageBlob)
    ).resolves.toEqual(Buffer.from('recorded'))
    await expect(
      readLocalImportExportPackageBlob(sentinel.storageBlob)
    ).resolves.toEqual(Buffer.from('sentinel'))

    await expect(
      cleanupImportExportPackages({ now, prisma })
    ).resolves.toMatchObject({ deletedPackages: 1, wouldDeletePackages: 1 })
    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: artifactId },
      })
    ).resolves.toBeNull()
    await expect(
      readLocalImportExportPackageBlob(target.storageBlob)
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      readLocalImportExportPackageBlob(sentinel.storageBlob)
    ).resolves.toEqual(Buffer.from('sentinel'))
  })

  it('continues cleanup after a poison artifact and reports the failed record', async () => {
    const poisonId = randomUUID()
    const deletableId = randomUUID()
    const poisonTarget = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId: poisonId,
    })
    const deletableTarget = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId: deletableId,
    })
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const now = new Date(expiresAt.getTime() + 2_000)

    await prisma.importExportPackageArtifact.createMany({
      data: [
        {
          id: poisonId,
          ownerId,
          direction: ImportExportPackageArtifactDirection.IMPORT,
          storageContainer: poisonTarget.storageContainer,
          storageBlob: poisonTarget.storageBlob,
          reservedBytes: 8,
          expiresAt,
        },
        {
          id: deletableId,
          ownerId,
          direction: ImportExportPackageArtifactDirection.IMPORT,
          storageContainer: deletableTarget.storageContainer,
          storageBlob: deletableTarget.storageBlob,
          reservedBytes: 9,
          expiresAt: new Date(expiresAt.getTime() + 1_000),
        },
      ],
    })
    await mkdir(path.join(localPackageRoot, poisonTarget.storageBlob), {
      recursive: true,
    })
    await writeLocalImportExportPackageBlob(
      deletableTarget.storageBlob,
      Buffer.from('deletable')
    )

    await expect(
      cleanupImportExportPackages({ now, prisma })
    ).resolves.toMatchObject({
      deletedPackages: 1,
      failedPackageCleanups: 1,
      cleanupFailures: 1,
    })
    await expect(
      prisma.importExportPackageArtifact.findUnique({ where: { id: poisonId } })
    ).resolves.not.toBeNull()
    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: deletableId },
      })
    ).resolves.toBeNull()
    await expect(
      readLocalImportExportPackageBlob(deletableTarget.storageBlob)
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
