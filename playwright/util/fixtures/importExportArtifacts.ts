import { UserRole } from '@klicker-uzh/prisma/client'
import type { Download, Page, Request, Response } from '@playwright/test'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPrisma } from '../../global-setup.js'
import {
  getGraphqlOperationNames,
  isGraphqlOperation,
} from '../graphqlRequest.js'

const PACKAGE_CONTAINER = 'klicker-import-export'
const PACKAGE_ROUTE =
  /\/api\/import-export-packages\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(?:upload|download)(?:\/|$)/i
const LOCAL_MEDIA_ROUTE = /^\/api\/import-export-media\/([0-9a-f-]+)\/([^/]+)$/i
const ARTIFACT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMPORTED_MEDIA_BLOB =
  /^imported\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,12}$/i
const IMPORT_EXPORT_GRAPHQL_OPERATION =
  /(?:ElementImportPackage|ImportElementPackage|ElementExportPackage|ImportExportPackage)/

const RATE_LIMIT_OPERATIONS = [
  'preview',
  'export',
  'upload',
  'validate',
  'import',
] as const
const CONCURRENCY_OPERATIONS = [
  'preview',
  'upload',
  'validate',
  'export',
  'import',
] as const
// Durable imports can wait 10s for a Prisma transaction and then execute for
// up to 60s. Teardown must not delete the owner or exact blob ledgers while a
// timed-out browser test still has that server-side operation in flight.
const IMPORT_EXPORT_REQUEST_SETTLE_TIMEOUT_MS = 75_000

export function getImportExportConcurrencyLeaseCleanupKeys(userId: string) {
  return CONCURRENCY_OPERATIONS.map((operation) => ({
    operation,
    userKey: `concurrency:{import-export-package}:${operation}:user:${userId}`,
    globalKey: `concurrency:{import-export-package}:${operation}:global`,
  }))
}

export type ImportExportTestUser = {
  id: string
  email: string
  shortname: string
  role: 'ADMIN' | 'USER'
}

export type ImportExportTestUsers = {
  owner: ImportExportTestUser
  shared: ImportExportTestUser
  importer: ImportExportTestUser
}

export type ImportExportIsolation = {
  users: ImportExportTestUsers
  trackArtifactId: (artifactId: string) => void
  markRequestAbortedBeforeServer: (request: Request) => void
}

type ImportExportGraphQLResponse = {
  data?: {
    prepareElementImportPackageUpload?: {
      artifactId?: unknown
    } | null
    getElementExportPackageLink?: {
      downloadLink?: unknown
    } | null
  }
}

function getPackageRoot() {
  return path.resolve(
    process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR ??
      path.join(tmpdir(), 'klicker-import-export-packages')
  )
}

function isPathWithinRoot(filePath: string, root: string) {
  return filePath.startsWith(`${root}${path.sep}`)
}

function collectArtifactIdFromUrl(url: string, artifactIds: Set<string>) {
  try {
    const match = new URL(url).pathname.match(PACKAGE_ROUTE)
    if (match?.[1]) artifactIds.add(match[1])
  } catch {
    // A malformed/synthetic URL cannot name a durable artifact. The browser
    // request itself will fail, while owner-scoped cleanup remains authoritative.
  }
}

function isImportExportRequest(request: Request) {
  if (PACKAGE_ROUTE.test(new URL(request.url()).pathname)) return true
  return [...getGraphqlOperationNames(request)].some((operationName) =>
    IMPORT_EXPORT_GRAPHQL_OPERATION.test(operationName)
  )
}

function isLocalPackageDownloadRequest(request: Request) {
  try {
    return /\/api\/import-export-packages\/[0-9a-f-]+\/download(?:\/|$)/i.test(
      new URL(request.url()).pathname
    )
  } catch {
    return false
  }
}

function describeImportExportRequest(request: Request) {
  const pathname = new URL(request.url()).pathname
  const packageMatch = pathname.match(PACKAGE_ROUTE)
  if (packageMatch) {
    const action = pathname.includes('/download') ? 'download' : 'upload'
    return `package:${action}:${request.failure()?.errorText ?? 'pending'}`
  }

  const operationName =
    [...getGraphqlOperationNames(request)].find((name) =>
      IMPORT_EXPORT_GRAPHQL_OPERATION.test(name)
    ) ?? 'unknown'
  return `graphql:${operationName}:${request.failure()?.errorText ?? 'pending'}`
}

async function settleImportExportRequests(
  page: Page,
  activeRequests: Set<Request>
) {
  const deadline = Date.now() + IMPORT_EXPORT_REQUEST_SETTLE_TIMEOUT_MS
  while (activeRequests.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  if (activeRequests.size > 0) {
    // A request that exceeds every service-side bound is a broken test/runtime
    // condition. Close the page before cleanup; bounded production requests
    // have already had enough time to commit or roll back.
    await page.close({ runBeforeUnload: false }).catch(() => undefined)
    throw new Error(
      `Playwright import/export request exceeded the server-side settlement bound (${[...activeRequests].map(describeImportExportRequest).join(', ')}).`
    )
  }
}

async function collectArtifactIdsFromGraphQLResponse(
  response: Response,
  artifactIds: Set<string>
) {
  const request = response.request()
  if (
    !isGraphqlOperation(request, 'PrepareElementImportPackageUpload') &&
    !isGraphqlOperation(request, 'GetElementExportPackageLink')
  ) {
    return
  }

  const body = (await response
    .json()
    .catch(() => null)) as ImportExportGraphQLResponse | null
  const preparedArtifactId =
    body?.data?.prepareElementImportPackageUpload?.artifactId
  if (
    typeof preparedArtifactId === 'string' &&
    ARTIFACT_ID.test(preparedArtifactId)
  ) {
    artifactIds.add(preparedArtifactId)
  }

  const downloadLink = body?.data?.getElementExportPackageLink?.downloadLink
  if (typeof downloadLink === 'string') {
    collectArtifactIdFromUrl(downloadLink, artifactIds)
  }
}

function assertLocalPackageStorage() {
  const storage = process.env.IMPORT_EXPORT_PACKAGE_STORAGE
  const localRuntime =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

  if (storage === 'azure' || (storage !== 'local' && !localRuntime)) {
    throw new Error(
      'Playwright import/export isolation is restricted to local test storage.'
    )
  }
}

function makeTestUser(role: 'ADMIN' | 'USER'): ImportExportTestUser {
  const id = randomUUID()
  const token = id.replaceAll('-', '')
  return {
    id,
    email: `pw-import-export-${token}@example.invalid`,
    shortname: `pw-ie-${token.slice(0, 20)}`,
    role,
  }
}

async function createIsolatedUsers(): Promise<ImportExportTestUsers> {
  const users = {
    owner: makeTestUser('ADMIN'),
    shared: makeTestUser('USER'),
    importer: makeTestUser('USER'),
  }
  const prisma = await getPrisma()

  await prisma.user.createMany({
    data: Object.values(users).map((user) => ({
      id: user.id,
      name: `Playwright import/export ${user.shortname}`,
      email: user.email,
      shortname: user.shortname,
      role: user.role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER,
      catalystIndividual: user.role === 'ADMIN',
      catalystInstitutional: true,
      publicPreview: true,
      privatePreview: true,
      firstLogin: false,
    })),
  })

  return users
}

function readReceiptIds(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Playwright import receipt ${label} is not an array.`)
  }

  return value.map((id) => {
    if (!Number.isSafeInteger(id) || Number(id) <= 0) {
      throw new Error(
        `Playwright import receipt ${label} contains a noncanonical id.`
      )
    }
    return Number(id)
  })
}

function getPackageArtifactPath({
  id,
  direction,
  ownerId,
  storageContainer,
  storageBlob,
}: {
  id: string
  direction: 'IMPORT' | 'EXPORT'
  ownerId: string
  storageContainer: string
  storageBlob: string
}) {
  const packageRoot = getPackageRoot()
  const prefix = direction === 'IMPORT' ? 'imports' : 'exports'
  const expectedBlob = `${prefix}/${ownerId}/${id}.zip`
  const filePath = path.resolve(packageRoot, storageBlob)

  if (
    storageContainer !== PACKAGE_CONTAINER ||
    storageBlob !== expectedBlob ||
    !filePath.startsWith(`${packageRoot}${path.sep}`)
  ) {
    throw new Error(
      `Refusing to clean a noncanonical Playwright package target (${id}).`
    )
  }

  return filePath
}

function getImportedMediaPath({
  ownerId,
  storageContainer,
  storageBlob,
}: {
  ownerId: string
  storageContainer: string
  storageBlob: string
}) {
  const mediaRoot = path.resolve(getPackageRoot(), 'imported-media')
  const filePath = path.resolve(mediaRoot, ownerId, storageBlob)
  if (
    storageContainer !== ownerId ||
    !ARTIFACT_ID.test(ownerId) ||
    !IMPORTED_MEDIA_BLOB.test(storageBlob) ||
    !isPathWithinRoot(filePath, mediaRoot)
  ) {
    throw new Error(
      `Refusing to clean a noncanonical Playwright imported-media target (${ownerId}/${storageBlob}).`
    )
  }

  return filePath
}

function getImportedMediaPathFromHref(ownerId: string, href: string) {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }

  const match = url.pathname.match(LOCAL_MEDIA_ROUTE)
  if (!match) return null
  const hrefOwnerId = match[1]!
  const filename = match[2]!
  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  if (
    url.origin !== new URL(apiOrigin).origin ||
    url.search ||
    url.hash ||
    hrefOwnerId !== ownerId
  ) {
    throw new Error(
      `Refusing to clean a noncanonical Playwright imported-media href (${href}).`
    )
  }

  return getImportedMediaPath({
    ownerId,
    storageContainer: ownerId,
    storageBlob: `imported/${filename}`,
  })
}

async function unlinkExactFiles(filePaths: Set<string>) {
  for (const filePath of filePaths) {
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}

async function assertFilesAbsent(filePaths: Set<string>) {
  for (const filePath of filePaths) {
    const exists = await stat(filePath)
      .then(() => true)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false
        throw error
      })
    if (exists) {
      throw new Error(
        `Playwright import/export cleanup left a local blob (${filePath}).`
      )
    }
  }
}

function createRedisClient() {
  return new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT ?? 6379),
    tls: process.env.REDIS_TLS ? {} : undefined,
    connectTimeout: 5_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    reconnectOnError: () => false,
    retryStrategy: () => null,
  })
}

async function cleanupRedisForUsers(userIds: string[]) {
  const redis = createRedisClient()
  let leakedLeases = 0

  try {
    await redis.connect()
    await redis.ping()
    for (const userId of userIds) {
      for (const {
        operation,
        userKey,
        globalKey,
      } of getImportExportConcurrencyLeaseCleanupKeys(userId)) {
        const members = await redis.zrange(userKey, 0, -1)
        leakedLeases += members.length
        if (members.length > 0) {
          await redis.zrem(globalKey, ...members)
        }
        await redis.del(userKey)
        if ((await redis.zcard(userKey)) !== 0) {
          throw new Error(
            `Playwright import/export cleanup left a ${operation} user lease.`
          )
        }
        for (const member of members) {
          if ((await redis.zscore(globalKey, member)) !== null) {
            throw new Error(
              `Playwright import/export cleanup left a ${operation} global lease.`
            )
          }
        }
      }

      const rateLimitKeys = RATE_LIMIT_OPERATIONS.map(
        (operation) => `rate-limit:import-export-package:${operation}:${userId}`
      )
      await redis.del(...rateLimitKeys)
      for (const key of rateLimitKeys) {
        if ((await redis.exists(key)) !== 0) {
          throw new Error(
            'Playwright import/export cleanup left a rate-limit key.'
          )
        }
      }
    }
  } finally {
    redis.disconnect()
  }

  if (leakedLeases > 0) {
    throw new Error(
      `Playwright import/export operations leaked ${leakedLeases} Redis concurrency lease(s).`
    )
  }
}

async function cleanupDatabaseAndFiles({
  userIds,
  observedArtifactIds,
}: {
  userIds: string[]
  observedArtifactIds: Set<string>
}) {
  const prisma = await getPrisma()
  const [
    artifacts,
    receipts,
    stagingRecords,
    mediaFiles,
    elements,
    collections,
  ] = await Promise.all([
    prisma.importExportPackageArtifact.findMany({
      where: { ownerId: { in: userIds } },
    }),
    prisma.elementImportReceipt.findMany({
      where: { ownerId: { in: userIds } },
    }),
    prisma.importMediaStaging.findMany({
      where: { ownerId: { in: userIds } },
    }),
    prisma.mediaFile.findMany({
      where: { ownerId: { in: userIds } },
      select: { id: true, ownerId: true, href: true },
    }),
    prisma.element.findMany({
      where: { ownerId: { in: userIds } },
      select: { id: true },
    }),
    prisma.answerCollection.findMany({
      where: { ownerId: { in: userIds } },
      select: { id: true },
    }),
  ])

  if (observedArtifactIds.size > 0) {
    const observedRecords = await prisma.importExportPackageArtifact.findMany({
      where: { id: { in: [...observedArtifactIds] } },
      select: { id: true, ownerId: true },
    })
    const foreign = observedRecords.find(
      (record) => !userIds.includes(record.ownerId)
    )
    if (foreign) {
      throw new Error(
        `Refusing to clean an artifact owned outside the isolated Playwright actors (${foreign.id}).`
      )
    }
  }

  const receiptElementIds = receipts.flatMap((receipt) =>
    readReceiptIds(receipt.createdElementIds, 'createdElementIds')
  )
  const receiptCollectionIds = receipts.flatMap((receipt) =>
    readReceiptIds(
      receipt.createdAnswerCollectionIds,
      'createdAnswerCollectionIds'
    )
  )
  const elementIds = [...new Set(elements.map(({ id }) => id))]
  const collectionIds = [...new Set(collections.map(({ id }) => id))]
  const foreignReceiptElementIds = receiptElementIds.filter(
    (id) => !elementIds.includes(id)
  )
  const foreignReceiptCollectionIds = receiptCollectionIds.filter(
    (id) => !collectionIds.includes(id)
  )
  if (
    foreignReceiptElementIds.length > 0 ||
    foreignReceiptCollectionIds.length > 0
  ) {
    throw new Error(
      'Refusing to clean an import receipt whose result ids are not owned by the isolated Playwright actor.'
    )
  }

  const mediaIds = mediaFiles.map(({ id }) => id)
  const foreignStagingMedia = stagingRecords.find(
    (record) => record.mediaFileId && !mediaIds.includes(record.mediaFileId)
  )
  if (foreignStagingMedia) {
    throw new Error(
      `Refusing to clean imported-media staging linked outside the isolated Playwright actor (${foreignStagingMedia.id}).`
    )
  }

  const filePaths = new Set<string>()
  for (const artifactId of observedArtifactIds) {
    for (const ownerId of userIds) {
      for (const direction of ['IMPORT', 'EXPORT'] as const) {
        const prefix = direction === 'IMPORT' ? 'imports' : 'exports'
        filePaths.add(
          getPackageArtifactPath({
            id: artifactId,
            direction,
            ownerId,
            storageContainer: PACKAGE_CONTAINER,
            storageBlob: `${prefix}/${ownerId}/${artifactId}.zip`,
          })
        )
      }
    }
  }
  for (const artifact of artifacts) {
    filePaths.add(
      getPackageArtifactPath({
        ...artifact,
        direction: artifact.direction as 'IMPORT' | 'EXPORT',
      })
    )
  }
  for (const staging of stagingRecords) {
    filePaths.add(getImportedMediaPath(staging))
  }
  for (const media of mediaFiles) {
    const filePath = getImportedMediaPathFromHref(media.ownerId, media.href)
    if (filePath) filePaths.add(filePath)
  }

  const [activityIds, auditIds] = await Promise.all([
    prisma.activityLogEntry.findMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          ...(elementIds.length > 0 ? [{ elementId: { in: elementIds } }] : []),
          ...(collectionIds.length > 0
            ? [{ answerCollectionId: { in: collectionIds } }]
            : []),
        ],
      },
      select: { id: true },
    }),
    prisma.auditLogEntry.findMany({
      where: {
        OR: [
          { sourceUserId: { in: userIds } },
          { targetUserId: { in: userIds } },
        ],
      },
      select: { id: true },
    }),
  ])

  await unlinkExactFiles(filePaths)

  await prisma.$transaction(async (tx) => {
    await tx.importMediaStaging.deleteMany({
      where: { ownerId: { in: userIds } },
    })
    await tx.elementImportReceipt.deleteMany({
      where: { ownerId: { in: userIds } },
    })
    await tx.importExportPackageArtifact.deleteMany({
      where: { ownerId: { in: userIds } },
    })
    if (activityIds.length > 0) {
      await tx.activityLogEntry.deleteMany({
        where: { id: { in: activityIds.map(({ id }) => id) } },
      })
    }
    if (auditIds.length > 0) {
      await tx.auditLogEntry.deleteMany({
        where: { id: { in: auditIds.map(({ id }) => id) } },
      })
    }
    const deletedUsers = await tx.user.deleteMany({
      where: { id: { in: userIds } },
    })
    if (deletedUsers.count !== userIds.length) {
      throw new Error(
        'Playwright import/export cleanup did not delete every isolated actor.'
      )
    }
  })

  const [
    remainingUsers,
    remainingElements,
    remainingCollections,
    remainingMedia,
    remainingPermissions,
    remainingDerivedPermissions,
    remainingActivity,
    remainingAudit,
    remainingArtifacts,
    remainingReceipts,
    remainingStaging,
  ] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.element.count({ where: { id: { in: elementIds } } }),
    prisma.answerCollection.count({
      where: { id: { in: collectionIds } },
    }),
    prisma.mediaFile.count({ where: { id: { in: mediaIds } } }),
    prisma.permission.count({
      where: {
        OR: [
          { userId: { in: userIds } },
          ...(elementIds.length > 0 ? [{ elementId: { in: elementIds } }] : []),
          ...(collectionIds.length > 0
            ? [{ answerCollectionId: { in: collectionIds } }]
            : []),
        ],
      },
    }),
    prisma.derivedPermission.count({
      where: {
        OR: [
          { userId: { in: userIds } },
          ...(elementIds.length > 0 ? [{ elementId: { in: elementIds } }] : []),
          ...(collectionIds.length > 0
            ? [{ answerCollectionId: { in: collectionIds } }]
            : []),
        ],
      },
    }),
    prisma.activityLogEntry.count({
      where: { id: { in: activityIds.map(({ id }) => id) } },
    }),
    prisma.auditLogEntry.count({
      where: { id: { in: auditIds.map(({ id }) => id) } },
    }),
    prisma.importExportPackageArtifact.count({
      where: { ownerId: { in: userIds } },
    }),
    prisma.elementImportReceipt.count({
      where: { ownerId: { in: userIds } },
    }),
    prisma.importMediaStaging.count({
      where: { ownerId: { in: userIds } },
    }),
  ])
  const remaining = {
    users: remainingUsers,
    elements: remainingElements,
    collections: remainingCollections,
    media: remainingMedia,
    permissions: remainingPermissions,
    derivedPermissions: remainingDerivedPermissions,
    activity: remainingActivity,
    audit: remainingAudit,
    artifacts: remainingArtifacts,
    receipts: remainingReceipts,
    staging: remainingStaging,
  }
  const nonzero = Object.entries(remaining).filter(([, count]) => count !== 0)
  if (nonzero.length > 0) {
    throw new Error(
      `Playwright import/export cleanup left database residue (${JSON.stringify(Object.fromEntries(nonzero))}).`
    )
  }

  await assertFilesAbsent(filePaths)
}

async function cleanupIsolation(
  users: ImportExportTestUsers,
  observedArtifactIds: Set<string>
) {
  const userIds = Object.values(users).map(({ id }) => id)
  const errors: unknown[] = []

  await cleanupRedisForUsers(userIds).catch((error) => errors.push(error))
  await cleanupDatabaseAndFiles({ userIds, observedArtifactIds }).catch(
    (error) => errors.push(error)
  )

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      'Playwright import/export isolated cleanup failed.'
    )
  }
}

export async function useIsolatedImportExportEnvironment(
  page: Page,
  use: (isolation: ImportExportIsolation) => Promise<void>
) {
  assertLocalPackageStorage()
  const users = await createIsolatedUsers()
  const artifactIds = new Set<string>()
  const activeRequests = new Set<Request>()
  const requestsAbortedBeforeServer = new WeakSet<Request>()
  const failedRequests = new WeakSet<Request>()
  const respondedRequests = new WeakSet<Request>()
  const responseTasks: Promise<void>[] = []
  const onRequest = (request: Request) => {
    collectArtifactIdFromUrl(request.url(), artifactIds)
    if (isImportExportRequest(request)) activeRequests.add(request)
  }
  const onRequestFinished = (request: Request) => activeRequests.delete(request)
  const onRequestFailed = (request: Request) => {
    // A browser failure is not proof that a request which reached the backend
    // stopped executing. Only a test-owned route that never continued to the
    // server may explicitly clear that uncertainty.
    failedRequests.add(request)
    if (
      requestsAbortedBeforeServer.has(request) ||
      respondedRequests.has(request)
    ) {
      activeRequests.delete(request)
    }
  }
  const onResponse = (response: Response) => {
    if (isImportExportRequest(response.request())) {
      // Import/export GraphQL execution and local-storage reads/writes finish
      // before response headers are emitted, so the response is authoritative
      // service-side settlement even if Chromium never emits requestfinished.
      respondedRequests.add(response.request())
      activeRequests.delete(response.request())
    }
    responseTasks.push(
      collectArtifactIdsFromGraphQLResponse(response, artifactIds)
    )
  }
  const onDownload = (download: Download) => {
    // Playwright does not guarantee requestfinished/requestfailed for browser
    // attachment handoff. The local route has already materialized the file
    // before the download event, so exact fixture cleanup cannot interrupt it.
    for (const request of activeRequests) {
      if (
        isLocalPackageDownloadRequest(request) &&
        request.url() === download.url()
      ) {
        activeRequests.delete(request)
        break
      }
    }
  }

  page.on('request', onRequest)
  page.on('requestfailed', onRequestFailed)
  page.on('requestfinished', onRequestFinished)
  page.on('response', onResponse)
  page.on('download', onDownload)

  try {
    await use({
      users,
      trackArtifactId: (artifactId) => {
        if (!ARTIFACT_ID.test(artifactId)) {
          throw new Error(
            `Cannot track a noncanonical Playwright import/export artifact id (${artifactId}).`
          )
        }
        artifactIds.add(artifactId)
      },
      markRequestAbortedBeforeServer: (request) => {
        if (!isImportExportRequest(request)) {
          throw new Error(
            'Cannot mark a non-import/export request as aborted before the server.'
          )
        }
        requestsAbortedBeforeServer.add(request)
        if (failedRequests.has(request)) activeRequests.delete(request)
      },
    })
  } finally {
    // `page.request` uses a Node-side APIRequestContext and does not emit Page
    // network events. Dispose it first so a timed-out direct upload cannot
    // continue while its database row or local blob is being removed.
    await page.request.dispose({
      reason: 'Import/export isolation teardown',
    })
    let settlementError: unknown
    await settleImportExportRequests(page, activeRequests).catch((error) => {
      settlementError = error
    })
    page.off('request', onRequest)
    page.off('requestfailed', onRequestFailed)
    page.off('requestfinished', onRequestFinished)
    page.off('response', onResponse)
    page.off('download', onDownload)
    await Promise.all(responseTasks)
    await cleanupIsolation(users, artifactIds)
    if (settlementError) throw settlementError
  }
}
