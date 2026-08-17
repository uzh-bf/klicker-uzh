import { BlobServiceClient } from '@azure/storage-blob'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  KBGraphBuildStatus,
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  KBResourceType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  MAX_KB_RESOURCE_COUNT,
  MAX_KB_TOTAL_SIZE_BYTES,
} from '@klicker-uzh/types'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { readFileSync } from 'fs'
import { buildSchema, parse, validate } from 'graphql'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  attachKbToChatbot,
  confirmKbFileUpload,
  createKb,
  createKbUrlResource,
  deleteKb,
  deleteKbResource,
  deleteKbResources,
  detachKbFromChatbot,
  getKb,
  getKbChatbotBindings,
  getKbResourceIngestionRuns,
  getKbResourcesConnection,
  getUserKbsConnection,
  ingestKbResource,
  rebuildKbKnowledgeGraph,
  requestKbFileUpload,
  setKbKnowledgeGraphEnabled,
} from '../src/services/knowledge.js'
import { seedCourse, testCleanup, testInitialization } from './helpers.js'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function legacyUrlResources(kbId: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    kbId,
    type: KBResourceType.URL,
    title: `Legacy URL ${index}`,
    sourceUrl: `https://example.com/legacy-${index}`,
  }))
}

function withIngestionClaimSignal(
  ctx: ContextWithUser,
  onClaim: () => void
): ContextWithUser {
  const prisma = ctx.prisma.$extends({
    query: {
      kBResource: {
        updateMany({ args, query }) {
          onClaim()
          return query(args)
        },
      },
    },
  })
  return { ...ctx, prisma: prisma as unknown as PrismaClient }
}

function withTombstonePause(
  ctx: ContextWithUser,
  model: 'kB' | 'kBResource',
  onTombstone: () => void,
  continueTombstone: Promise<void>
): ContextWithUser {
  const queryExtension = {
    async update({
      args,
      query,
    }: {
      args: { data: { deletedAt?: unknown } }
      query: (args: unknown) => Promise<unknown>
    }) {
      if (args.data.deletedAt) {
        onTombstone()
        await continueTombstone
      }
      return query(args)
    },
  }
  const prisma = ctx.prisma.$extends({
    query: (model === 'kB'
      ? { kB: queryExtension }
      : { kBResource: queryExtension }) as never,
  })
  return { ...ctx, prisma: prisma as unknown as PrismaClient }
}

function withKbBindingSnapshotPause(
  ctx: ContextWithUser,
  kbId: string,
  onSnapshot: () => void,
  continueSnapshot: Promise<void>
): ContextWithUser {
  const prisma = ctx.prisma.$extends({
    query: {
      kBChatbot: {
        async findMany({ args, query }) {
          const result = await query(args)
          if (args.where?.kbId === kbId && args.where.isEnabled === true) {
            onSnapshot()
            await continueSnapshot
          }
          return result
        },
      },
    },
  })
  return { ...ctx, prisma: prisma as unknown as PrismaClient }
}

describe('Knowledge base GraphQL contract', () => {
  it('requires the resource id for ingestion', () => {
    const schema = buildSchema(
      readFileSync(
        new URL('../src/public/schema.graphql', import.meta.url),
        'utf8'
      )
    )
    const document = parse(`
      mutation {
        ingestKbResource {
          id
        }
      }
    `)

    expect(validate(schema, document).map(({ message }) => message)).toEqual([
      'Field "ingestKbResource" argument "id" of type "ID!" is required, but it was not provided.',
    ])
  })
})

describe('Integration tests for knowledge base CRUD', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let nonPreviewCtx: ContextWithUser
  let previousBlobAccountName: string | undefined
  let previousBlobAccessKey: string | undefined
  let previousBlobAccountUrl: string | undefined
  let previousBlobInternalAccountUrl: string | undefined
  let containerName: string
  let requestedBlobName: string
  let createIfNotExists: ReturnType<typeof vi.fn>
  let blobExists: ReturnType<typeof vi.fn>
  let getBlobProperties: ReturnType<typeof vi.fn>
  let deleteBlobIfExists: ReturnType<typeof vi.fn>
  let getBlobClient: ReturnType<typeof vi.fn>
  let blobServiceUrl: string
  const graphCostEnvironmentKeys = [
    'KB_GRAPH_DISABLED',
    'KB_GRAPH_COST_CURRENCY',
    'KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS',
    'KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS',
    'KB_GRAPH_MAX_COST_MINOR_UNITS',
    'KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS',
    'KB_GRAPH_COST_PRICING_VERSION',
    'KB_GRAPH_SEMESTER_KEY',
  ] as const
  let previousGraphCostEnvironment: Partial<
    Record<(typeof graphCostEnvironmentKeys)[number], string | undefined>
  >

  beforeAll(async () => {
    prisma = prismaClient
    await testCleanup(prisma)
    hatchet = {
      task: vi.fn(() => ({ runNoWait: vi.fn() })),
    } as unknown as Hatchet
    emitter = new EventEmitter()
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
    nonPreviewCtx = initialized.userThreeCtx
    // the shared fixture users default to privatePreview: false; the KB workspace
    // gate requires preview access, so opt both active owners in explicitly and
    // leave nonPreviewCtx's backing user at the default (privatePreview: false)
    await prisma.user.updateMany({
      where: { id: { in: [userOneCtx.user.sub, userTwoCtx.user.sub] } },
      data: { privatePreview: true },
    })
    await prisma.chatbotMCPServer.upsert({
      where: { name: 'KB' },
      create: {
        name: 'KB',
        description: 'Knowledge base retrieval',
        url: 'http://localhost:1417/mcp',
        authType: 'scope_token',
        isActive: true,
      },
      update: {
        authType: 'scope_token',
        isActive: true,
      },
    })

    previousBlobAccountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
    previousBlobAccessKey = process.env.BLOB_STORAGE_ACCESS_KEY
    previousBlobAccountUrl = process.env.BLOB_STORAGE_ACCOUNT_URL
    previousBlobInternalAccountUrl =
      process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'kbtestaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = Buffer.alloc(32).toString('base64')
    delete process.env.BLOB_STORAGE_ACCOUNT_URL
    delete process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL

    previousGraphCostEnvironment = Object.fromEntries(
      graphCostEnvironmentKeys.map((key) => [key, process.env[key]])
    )
    Object.assign(process.env, {
      KB_GRAPH_COST_CURRENCY: 'CHF',
      KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '100',
      KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '200',
      KB_GRAPH_MAX_COST_MINOR_UNITS: '200',
      KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '500',
      KB_GRAPH_COST_PRICING_VERSION: 'test-v1',
      KB_GRAPH_SEMESTER_KEY: '2026-H2',
    })

    containerName = ''
    requestedBlobName = ''
    blobServiceUrl = ''
    createIfNotExists = vi.fn().mockResolvedValue({ succeeded: true })
    blobExists = vi.fn().mockResolvedValue(true)
    getBlobProperties = vi.fn().mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf',
    })
    deleteBlobIfExists = vi.fn().mockResolvedValue({ succeeded: true })
    const blobClient = {
      get url() {
        return `https://kbtestaccount.blob.core.windows.net/${containerName}/${requestedBlobName}`
      },
      exists: blobExists,
      getProperties: getBlobProperties,
      deleteIfExists: deleteBlobIfExists,
    }
    getBlobClient = vi.fn().mockImplementation((blobName: string) => {
      requestedBlobName = blobName
      return blobClient
    })
    const containerClient = {
      get containerName() {
        return containerName
      },
      createIfNotExists,
      getBlobClient,
    }
    vi.spyOn(
      BlobServiceClient.prototype,
      'getContainerClient'
    ).mockImplementation(function (this: BlobServiceClient, name: string) {
      blobServiceUrl = this.url
      containerName = name
      return containerClient as never
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (previousBlobAccountName === undefined) {
      delete process.env.BLOB_STORAGE_ACCOUNT_NAME
    } else {
      process.env.BLOB_STORAGE_ACCOUNT_NAME = previousBlobAccountName
    }
    if (previousBlobAccessKey === undefined) {
      delete process.env.BLOB_STORAGE_ACCESS_KEY
    } else {
      process.env.BLOB_STORAGE_ACCESS_KEY = previousBlobAccessKey
    }
    if (previousBlobAccountUrl === undefined) {
      delete process.env.BLOB_STORAGE_ACCOUNT_URL
    } else {
      process.env.BLOB_STORAGE_ACCOUNT_URL = previousBlobAccountUrl
    }
    if (previousBlobInternalAccountUrl === undefined) {
      delete process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL
    } else {
      process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL =
        previousBlobInternalAccountUrl
    }
    for (const key of graphCostEnvironmentKeys) {
      const value = previousGraphCostEnvironment[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await testCleanup(prisma)
  })

  it('requires graph opt-in and the kill switch before dispatching a build', async () => {
    const kb = await createKb({ name: 'Graph controls' }, userOneCtx)

    await expect(
      rebuildKbKnowledgeGraph({ kbId: kb.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'KB_GRAPH_NOT_ENABLED' },
    })

    process.env.KB_GRAPH_DISABLED = 'true'
    await expect(
      setKbKnowledgeGraphEnabled({ kbId: kb.id, enabled: true }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'KB_GRAPH_DISABLED' },
    })

    process.env.KB_GRAPH_DISABLED = 'false'
    await setKbKnowledgeGraphEnabled({ kbId: kb.id, enabled: true }, userOneCtx)
    await prisma.kBResource.create({
      data: {
        kbId: kb.id,
        type: KBResourceType.URL,
        title: 'Graph source',
        sourceUrl: 'https://example.com/graph-source',
        status: KBResourceStatus.READY,
        activeResourceVersion: 1,
        activeContentSha256: 'a'.repeat(64),
      },
    })

    const config = await rebuildKbKnowledgeGraph({ kbId: kb.id }, userOneCtx)

    expect(config).toMatchObject({
      status: KBGraphBuildStatus.QUEUED,
      costConfigurationReady: true,
      estimatedCostMinorUnits: 100,
      semesterReservedMinorUnits: 100,
    })
  })

  it('fences rebuilds after an accepted but uncorrelated graph dispatch', async () => {
    const kb = await createKb({ name: 'Ambiguous graph dispatch' }, userOneCtx)
    await setKbKnowledgeGraphEnabled({ kbId: kb.id, enabled: true }, userOneCtx)
    await prisma.kBResource.create({
      data: {
        kbId: kb.id,
        type: KBResourceType.URL,
        title: 'Graph source',
        sourceUrl: 'https://example.com/ambiguous-graph-source',
        status: KBResourceStatus.READY,
        activeResourceVersion: 1,
        activeContentSha256: 'b'.repeat(64),
      },
    })

    const initial = await rebuildKbKnowledgeGraph({ kbId: kb.id }, userOneCtx)
    expect(initial.buildId).not.toBeNull()
    await prisma.kBGraphBuild.update({
      where: { id: initial.buildId! },
      data: {
        status: KBGraphBuildStatus.FAILED,
        errorCode: 'KB_GRAPH_DISPATCH_AMBIGUOUS',
        statusMessage:
          'The external KB graph workflow may have been accepted but could not be correlated; manual review is required.',
        finishedAt: new Date(),
      },
    })

    await expect(
      rebuildKbKnowledgeGraph({ kbId: kb.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'KB_GRAPH_DISPATCH_AMBIGUOUS' },
    })
    await expect(
      prisma.kB.findUniqueOrThrow({ where: { id: kb.id } })
    ).resolves.toMatchObject({ activeGraphBuildId: initial.buildId })
    await expect(
      prisma.kBGraphBuild.count({ where: { kbId: kb.id } })
    ).resolves.toBe(1)
  })

  it('creates and lists only the current users knowledge bases', async () => {
    const created = await createKb(
      { name: 'Finance notes', description: 'Course material' },
      userOneCtx
    )
    await createKb({ name: 'Other owner' }, userTwoCtx)

    const userKbs = (await getUserKbsConnection({}, userOneCtx)).items

    expect(userKbs).toHaveLength(1)
    expect(userKbs[0]).toMatchObject({
      id: created.id,
      name: 'Finance notes',
      description: 'Course material',
      ownerId: userOneCtx.user.sub,
    })
  })

  it('returns owned knowledge base metadata without an unbounded child list', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    const kb = await getKb({ id: created.id }, userOneCtx)

    expect(kb.id).toBe(created.id)
  })

  it('lists owned chatbots with their enabled knowledge base', async () => {
    const kb = await createKb({ name: 'Finance notes' }, userOneCtx)
    const otherKb = await createKb({ name: 'Other notes' }, userTwoCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    const otherCourse = await seedCourse({}, userTwoCtx)
    const otherChatbot = await prisma.chatbot.create({
      data: {
        name: 'Other tutor',
        ownerId: userTwoCtx.user.sub,
        courseId: otherCourse.id,
      },
    })
    await prisma.kBChatbot.create({
      data: { kbId: otherKb.id, chatbotId: otherChatbot.id },
    })

    await attachKbToChatbot({ kbId: kb.id, chatbotId: chatbot.id }, userOneCtx)
    const bindings = await getKbChatbotBindings({ kbId: kb.id }, userOneCtx)

    expect(bindings).toEqual([
      {
        chatbotId: chatbot.id,
        chatbotName: 'Finance tutor',
        enabledKbId: kb.id,
        enabledKbName: 'Finance notes',
      },
    ])
  })

  it('replaces the enabled binding and provisions only doc_query', async () => {
    const firstKb = await createKb({ name: 'First KB' }, userOneCtx)
    const secondKb = await createKb({ name: 'Second KB' }, userOneCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })

    await attachKbToChatbot(
      { kbId: firstKb.id, chatbotId: chatbot.id },
      userOneCtx
    )
    await attachKbToChatbot(
      { kbId: secondKb.id, chatbotId: chatbot.id },
      userOneCtx
    )

    const links = await prisma.kBChatbot.findMany({
      where: { chatbotId: chatbot.id },
      orderBy: { kbId: 'asc' },
    })
    expect(links).toHaveLength(2)
    expect(links.filter(({ isEnabled }) => isEnabled)).toEqual([
      expect.objectContaining({ kbId: secondKb.id }),
    ])

    const configurations = await prisma.chatbotMCPConfig.findMany({
      where: { chatbotId: chatbot.id, mcpServer: { name: 'KB' } },
      orderBy: { chatMode: 'asc' },
    })
    expect(configurations).toHaveLength(2)
    expect(configurations).toEqual([
      expect.objectContaining({
        chatMode: 'explainer',
        allowedTools: ['doc_query'],
        isEnabled: true,
      }),
      expect.objectContaining({
        chatMode: 'tutor',
        allowedTools: ['doc_query'],
        isEnabled: true,
      }),
    ])
  })

  it('serializes concurrent replacements to one enabled binding', async () => {
    const firstKb = await createKb({ name: 'First KB' }, userOneCtx)
    const secondKb = await createKb({ name: 'Second KB' }, userOneCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })

    await Promise.all([
      attachKbToChatbot(
        { kbId: firstKb.id, chatbotId: chatbot.id },
        userOneCtx
      ),
      attachKbToChatbot(
        { kbId: secondKb.id, chatbotId: chatbot.id },
        userOneCtx
      ),
    ])

    await expect(
      prisma.kBChatbot.count({
        where: { chatbotId: chatbot.id, isEnabled: true },
      })
    ).resolves.toBe(1)
  })

  it('rejects bindings across ownership boundaries', async () => {
    const kb = await createKb({ name: 'Finance notes' }, userOneCtx)
    const otherKb = await createKb({ name: 'Other notes' }, userTwoCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    const otherCourse = await seedCourse({}, userTwoCtx)
    const otherChatbot = await prisma.chatbot.create({
      data: {
        name: 'Other tutor',
        ownerId: userTwoCtx.user.sub,
        courseId: otherCourse.id,
      },
    })

    await expect(
      attachKbToChatbot({ kbId: otherKb.id, chatbotId: chatbot.id }, userOneCtx)
    ).rejects.toThrow('KB not found')
    await expect(
      attachKbToChatbot({ kbId: kb.id, chatbotId: otherChatbot.id }, userOneCtx)
    ).rejects.toThrow('Chatbot not found')
  })

  it('fails closed when scoped retrieval is not configured', async () => {
    const kb = await createKb({ name: 'Finance notes' }, userOneCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    await prisma.chatbotMCPServer.update({
      where: { name: 'KB' },
      data: { authType: 'none' },
    })

    await expect(
      attachKbToChatbot({ kbId: kb.id, chatbotId: chatbot.id }, userOneCtx)
    ).rejects.toThrow('Knowledge base retrieval is not configured')
    await expect(
      prisma.kBChatbot.count({ where: { chatbotId: chatbot.id } })
    ).resolves.toBe(0)
  })

  it('detaches the binding and disables KB MCP configurations', async () => {
    const kb = await createKb({ name: 'Finance notes' }, userOneCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    await attachKbToChatbot({ kbId: kb.id, chatbotId: chatbot.id }, userOneCtx)

    await detachKbFromChatbot(
      { kbId: kb.id, chatbotId: chatbot.id },
      userOneCtx
    )

    await expect(
      prisma.kBChatbot.count({ where: { chatbotId: chatbot.id } })
    ).resolves.toBe(0)
    const configurations = await prisma.chatbotMCPConfig.findMany({
      where: { chatbotId: chatbot.id, mcpServer: { name: 'KB' } },
    })
    expect(configurations).toHaveLength(2)
    expect(configurations.every(({ isEnabled }) => !isEnabled)).toBe(true)
  })

  it('disables chatbot retrieval when its knowledge base is tombstoned', async () => {
    const kb = await createKb({ name: 'Finance notes' }, userOneCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    await attachKbToChatbot({ kbId: kb.id, chatbotId: chatbot.id }, userOneCtx)

    await deleteKb({ id: kb.id }, userOneCtx)

    await expect(
      prisma.kBChatbot.findUnique({
        where: { kbId_chatbotId: { kbId: kb.id, chatbotId: chatbot.id } },
      })
    ).resolves.toMatchObject({ isEnabled: false })
    const configurations = await prisma.chatbotMCPConfig.findMany({
      where: { chatbotId: chatbot.id, mcpServer: { name: 'KB' } },
    })
    expect(configurations).toHaveLength(2)
    expect(configurations.every(({ isEnabled }) => !isEnabled)).toBe(true)
  })

  it('preserves retrieval when another knowledge base is attached during deletion', async () => {
    const firstKb = await createKb({ name: 'First KB' }, userOneCtx)
    const secondKb = await createKb({ name: 'Second KB' }, userOneCtx)
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Finance tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    await attachKbToChatbot(
      { kbId: firstKb.id, chatbotId: chatbot.id },
      userOneCtx
    )
    const bindingSnapshotted = createDeferred<void>()
    const finishDeletion = createDeferred<void>()
    const deleteCtx = withKbBindingSnapshotPause(
      userOneCtx,
      firstKb.id,
      () => bindingSnapshotted.resolve(undefined),
      finishDeletion.promise
    )

    const deletion = deleteKb({ id: firstKb.id }, deleteCtx)
    await bindingSnapshotted.promise
    await attachKbToChatbot(
      { kbId: secondKb.id, chatbotId: chatbot.id },
      userOneCtx
    )
    finishDeletion.resolve(undefined)
    await deletion

    await expect(
      prisma.kBChatbot.findFirst({
        where: { chatbotId: chatbot.id, isEnabled: true },
        select: { kbId: true },
      })
    ).resolves.toEqual({ kbId: secondKb.id })
    const configurations = await prisma.chatbotMCPConfig.findMany({
      where: { chatbotId: chatbot.id, mcpServer: { name: 'KB' } },
    })
    expect(configurations).toHaveLength(2)
    expect(configurations.every(({ isEnabled }) => isEnabled)).toBe(true)
  })

  it('rejects an empty knowledge base name', async () => {
    await expect(createKb({ name: '   ' }, userOneCtx)).rejects.toThrow(
      'KB name is required'
    )

    await expect(getUserKbsConnection({}, userOneCtx)).resolves.toMatchObject({
      items: [],
    })
  })

  it('hides an owned knowledge base behind a durable tombstone', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    await deleteKb({ id: created.id }, userOneCtx)

    await expect(getUserKbsConnection({}, userOneCtx)).resolves.toMatchObject({
      items: [],
    })
    await expect(getKb({ id: created.id }, userOneCtx)).rejects.toThrow(
      'KB not found'
    )
    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toMatchObject({
      deletedById: userOneCtx.user.sub,
      deletedAt: expect.any(Date),
    })
  })

  it('tombstones blob resources without deleting storage synchronously', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: 'd6c22240-7380-4bbf-8c7a-2f907b8e2677.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
      },
    })
    const runNoWait = vi.spyOn(userOneCtx.tasks.deleteKBResource, 'runNoWait')

    await deleteKb({ id: created.id }, userOneCtx)

    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    expect(runNoWait).toHaveBeenCalledOnce()
    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toMatchObject({ deletedAt: expect.any(Date) })
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      deletedAt: expect.any(Date),
      ingestionOperation: KBIngestionOperation.DELETE,
      status: KBResourceStatus.QUEUED,
      resourceVersion: 1,
    })
  })

  it.each([
    KBResourceStatus.QUEUED,
    KBResourceStatus.PROCESSING,
  ])('does not delete a knowledge base with a %s resource', async (status) => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: '83fa9dfa-d796-4f8e-868f-b87a220127b3.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
        status,
      },
    })

    await expect(deleteKb({ id: created.id }, userOneCtx)).rejects.toThrow(
      'KB cannot be deleted'
    )

    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toBeTruthy()
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toBeTruthy()
  })

  it('denies reads and deletion to a foreign owner without revealing existence', async () => {
    const created = await createKb({ name: 'Private notes' }, userOneCtx)

    await expect(getKb({ id: created.id }, userTwoCtx)).rejects.toThrow(
      'KB not found'
    )
    await expect(deleteKb({ id: created.id }, userTwoCtx)).rejects.toThrow(
      'KB not found'
    )
    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toBeTruthy()
  })

  it('rejects invalid file uploads and foreign knowledge bases before storage access', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'malware.exe',
          contentType: 'application/octet-stream',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    ).rejects.toThrow('KB file type is not supported')
    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'slides.pptx',
          contentType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          sizeBytes: 25 * 1024 * 1024 + 1,
        },
        userOneCtx
      )
    ).rejects.toThrow('KB file size is invalid')
    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'slides.pptx',
          contentType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    ).rejects.toThrow('KB file type is not supported')
    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'notes.md',
          contentType: 'text/plain',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    ).resolves.toMatchObject({ blobName: expect.stringMatching(/\.md$/) })
    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'notes.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
        },
        userTwoCtx
      )
    ).rejects.toThrow('KB not found')
  })

  it('issues a private blob-scoped upload ticket without creating a resource', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    process.env.BLOB_STORAGE_ACCOUNT_URL =
      'https://blob.klicker.localhost/kbtestaccount/'
    process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL =
      'http://kb-poc-azurite:10000/kbtestaccount/'

    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )

    expect(containerName).toBe(`kb-${userOneCtx.user.sub}`)
    expect(blobServiceUrl).toBe('http://kb-poc-azurite:10000/kbtestaccount')
    expect(createIfNotExists).toHaveBeenCalledWith()
    expect(ticket.containerName).toBe(containerName)
    expect(ticket.blobName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/
    )
    const uploadUrl = new URL(ticket.uploadSasURL)
    expect(uploadUrl.origin).toBe('https://blob.klicker.localhost')
    expect(uploadUrl.pathname).toBe('/kbtestaccount')
    expect(uploadUrl.searchParams.get('sp')).toBe('cw')
    expect(uploadUrl.searchParams.get('sr')).toBe('b')
    const expiry = Date.parse(uploadUrl.searchParams.get('se') ?? '')
    expect(expiry).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
    expect(expiry).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000 + 1000)
    await expect(
      prisma.kBResource.count({ where: { kbId: created.id } })
    ).resolves.toBe(0)
    const persistedTicket = await prisma.kBUploadTicket.findUniqueOrThrow({
      where: { id: ticket.blobName.slice(0, -4) },
    })
    expect(persistedTicket).toMatchObject({
      kbId: created.id,
      blobName: ticket.blobName,
      sizeBytes: 1024,
    })
    expect(Math.abs(persistedTicket.expiresAt.getTime() - expiry)).toBeLessThan(
      1000
    )
  })

  it('does not issue an upload ticket after whole-KB deletion wins the lock', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const deletionStarted = createDeferred<void>()
    const finishDeletion = createDeferred<void>()
    const storageReady = createDeferred<void>()
    const deleteCtx = withTombstonePause(
      userOneCtx,
      'kB',
      () => deletionStarted.resolve(undefined),
      finishDeletion.promise
    )
    createIfNotExists.mockImplementationOnce(async () => {
      storageReady.resolve(undefined)
      return { succeeded: true }
    })

    const deletion = deleteKb({ id: created.id }, deleteCtx)
    await deletionStarted.promise
    const uploadRequest = requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    await storageReady.promise
    finishDeletion.resolve(undefined)

    await expect(deletion).resolves.toMatchObject({ id: created.id })
    await expect(uploadRequest).rejects.toThrow('KB not found')
    await expect(
      prisma.kBUploadTicket.count({ where: { kbId: created.id } })
    ).resolves.toBe(0)
  })

  it('reserves the final resource slot and rejects concurrent claims beyond it', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    await prisma.kBResource.createMany({
      data: Array.from({ length: MAX_KB_RESOURCE_COUNT - 1 }, (_, index) => ({
        kbId: created.id,
        type: KBResourceType.URL,
        title: `Resource ${index}`,
        sourceUrl: `https://example.com/resource-${index}`,
        sizeBytes: 1,
      })),
    })

    const requests = await Promise.allSettled([
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'first.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      ),
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'second.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      ),
    ])

    expect(
      requests.filter(({ status }) => status === 'fulfilled')
    ).toHaveLength(1)
    const rejected = requests.find(({ status }) => status === 'rejected')
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({
        extensions: { code: 'KB_RESOURCE_LIMIT_REACHED' },
      }),
    })
    await expect(
      prisma.kBUploadTicket.count({ where: { kbId: created.id } })
    ).resolves.toBe(1)
  })

  it('reserves the final byte-quota placeholder and rejects concurrent URL claims beyond it', async () => {
    const created = await createKb({ name: 'Legacy URLs' }, userOneCtx)
    await prisma.kBResource.createMany({
      data: legacyUrlResources(created.id, 19),
    })

    const requests = await Promise.allSettled([
      createKbUrlResource(
        {
          kbId: created.id,
          title: 'First',
          url: 'https://example.com/concurrent-first',
        },
        userOneCtx
      ),
      createKbUrlResource(
        {
          kbId: created.id,
          title: 'Second',
          url: 'https://example.com/concurrent-second',
        },
        userOneCtx
      ),
    ])

    expect(
      requests.filter(({ status }) => status === 'fulfilled')
    ).toHaveLength(1)
    const rejected = requests.find(({ status }) => status === 'rejected')
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({
        extensions: { code: 'KB_STORAGE_LIMIT_REACHED' },
      }),
    })
    await expect(
      prisma.kBResource.count({
        where: {
          kbId: created.id,
          sourceUrl: { startsWith: 'https://example.com/concurrent' },
        },
      })
    ).resolves.toBe(1)
  })

  it('retains tombstones in quota usage until hard cleanup removes them', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const rows = Array.from({ length: MAX_KB_RESOURCE_COUNT }, (_, index) => ({
      kbId: created.id,
      type: KBResourceType.URL,
      title: `Resource ${index}`,
      sourceUrl: `https://example.com/resource-${index}`,
      sizeBytes: 1,
      ...(index === 0
        ? { deletedAt: new Date(), deletedById: userOneCtx.user.sub }
        : {}),
    }))
    await prisma.kBResource.createMany({ data: rows })

    const request = () =>
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'notes.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    await expect(request()).rejects.toMatchObject({
      extensions: { code: 'KB_RESOURCE_LIMIT_REACHED' },
    })

    await prisma.kBResource.deleteMany({
      where: { kbId: created.id, deletedAt: { not: null } },
    })
    await expect(request()).resolves.toMatchObject({
      blobName: expect.stringMatching(/\.pdf$/),
    })
  })

  it('conservatively reserves 25 MiB for retained resources with unknown size', async () => {
    const created = await createKb({ name: 'Legacy URLs' }, userOneCtx)
    await prisma.kBResource.createMany({
      data: legacyUrlResources(created.id, 20),
    })

    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'notes.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'KB_STORAGE_LIMIT_REACHED' },
    })
  })

  it('charges a URL resource its unknown-size placeholder against the byte quota', async () => {
    const atCap = await createKb({ name: 'Legacy URLs at cap' }, userOneCtx)
    await prisma.kBResource.createMany({
      data: legacyUrlResources(atCap.id, 20),
    })

    await expect(
      createKbUrlResource(
        {
          kbId: atCap.id,
          title: 'One too many',
          url: 'https://example.com/one-too-many',
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'KB_STORAGE_LIMIT_REACHED' },
    })

    const underCap = await createKb(
      { name: 'Legacy URLs under cap' },
      userOneCtx
    )
    await prisma.kBResource.createMany({
      data: legacyUrlResources(underCap.id, 19),
    })

    await expect(
      createKbUrlResource(
        {
          kbId: underCap.id,
          title: 'Fits under cap',
          url: 'https://example.com/fits-under-cap',
        },
        userOneCtx
      )
    ).resolves.toMatchObject({
      kbId: underCap.id,
      type: KBResourceType.URL,
    })
  })

  it('counts upload reservations toward the byte quota without double counting confirmation', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.URL,
        title: 'Large resource',
        sourceUrl: 'https://example.com/large',
        sizeBytes: MAX_KB_TOTAL_SIZE_BYTES - 1024,
      },
    })
    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )

    await expect(
      requestKbFileUpload(
        {
          kbId: created.id,
          fileName: 'extra.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'KB_STORAGE_LIMIT_REACHED' },
    })

    await expect(
      confirmKbFileUpload(
        {
          kbId: created.id,
          blobName: ticket.blobName,
          title: 'Notes',
          originalFilename: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    ).resolves.toMatchObject({ sizeBytes: 1024 })
    await expect(
      prisma.kBResource.aggregate({
        where: { kbId: created.id },
        _sum: { sizeBytes: true },
      })
    ).resolves.toMatchObject({
      _sum: { sizeBytes: MAX_KB_TOTAL_SIZE_BYTES },
    })
  })

  it('rejects confirmation metadata that differs from the reserved upload size', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    getBlobProperties.mockResolvedValue({
      contentLength: 2048,
      contentType: 'application/pdf',
    })

    await expect(
      confirmKbFileUpload(
        {
          kbId: created.id,
          blobName: ticket.blobName,
          title: 'Notes',
          originalFilename: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'KB_UPLOAD_TICKET_MISMATCH' },
    })
    await expect(
      prisma.kBUploadTicket.findUnique({
        where: { id: ticket.blobName.slice(0, -4) },
      })
    ).resolves.toBeTruthy()
  })

  it('confirms a matching blob idempotently', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    process.env.BLOB_STORAGE_ACCOUNT_URL =
      'https://blob.klicker.localhost/kbtestaccount'
    process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL =
      'http://kb-poc-azurite:10000/kbtestaccount'
    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    const args = {
      kbId: created.id,
      blobName: ticket.blobName,
      title: 'Finance notes',
      originalFilename: 'notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }

    const first = await confirmKbFileUpload(args, userOneCtx)
    const second = await confirmKbFileUpload(args, userOneCtx)
    await expect(
      confirmKbFileUpload({ ...args, title: 'Changed title' }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'KB_UPLOAD_TICKET_MISMATCH' },
    })

    expect(first.id).toBe(ticket.blobName.slice(0, -4))
    expect(first.blobHref).toBe(
      `https://blob.klicker.localhost/kbtestaccount/${containerName}/${ticket.blobName}`
    )
    expect(second.id).toBe(first.id)
    expect(blobExists).toHaveBeenCalledOnce()
    expect(getBlobProperties).toHaveBeenCalledOnce()
    await expect(
      prisma.kBResource.count({ where: { blobName: ticket.blobName } })
    ).resolves.toBe(1)
    await expect(
      prisma.kBUploadTicket.findUnique({ where: { id: first.id } })
    ).resolves.toBeNull()
  })

  it('safely converts a legacy zero-size upload ticket under the KB quota lock', async () => {
    const created = await createKb({ name: 'Legacy upload' }, userOneCtx)
    const blobId = randomUUID()
    const blobName = `${blobId}.pdf`
    await prisma.kBUploadTicket.create({
      data: {
        id: blobId,
        kbId: created.id,
        blobName,
        sizeBytes: 0,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    await expect(
      confirmKbFileUpload(
        {
          kbId: created.id,
          blobName,
          title: 'Legacy notes',
          originalFilename: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    ).resolves.toMatchObject({
      id: blobId,
      sizeBytes: 1024,
    })
    await expect(
      prisma.kBUploadTicket.findUnique({ where: { id: blobId } })
    ).resolves.toBeNull()
  })

  it('rejects an expired upload ticket while preserving its blob for cleanup', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    await prisma.kBUploadTicket.update({
      where: { id: ticket.blobName.slice(0, -4) },
      data: { expiresAt: new Date(Date.now() - 1) },
    })

    await expect(
      confirmKbFileUpload(
        {
          kbId: created.id,
          blobName: ticket.blobName,
          title: 'Finance notes',
          originalFilename: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      )
    ).rejects.toThrow('KB upload ticket is invalid')
    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    await expect(
      prisma.kBUploadTicket.findUnique({
        where: { id: ticket.blobName.slice(0, -4) },
      })
    ).resolves.toBeTruthy()
  })

  it('does not reveal a foreign resource through blob confirmation', async () => {
    const ownedKb = await createKb({ name: 'Owned notes' }, userOneCtx)
    const foreignKb = await createKb({ name: 'Foreign notes' }, userTwoCtx)
    const foreignBlobId = 'a38eec07-5125-40b2-a245-019d58eab5d1'
    await prisma.kBResource.create({
      data: {
        id: foreignBlobId,
        kbId: foreignKb.id,
        type: KBResourceType.BLOB,
        title: 'Foreign file',
        originalFilename: 'foreign.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: `${foreignBlobId}.pdf`,
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/foreign/foreign.pdf',
      },
    })
    blobExists.mockResolvedValue(false)

    const confirm = (blobName: string) =>
      confirmKbFileUpload(
        {
          kbId: ownedKb.id,
          blobName,
          title: 'Probe',
          originalFilename: 'probe.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      )

    await expect(confirm(`${foreignBlobId}.pdf`)).rejects.toThrow(
      'KB blob was not found'
    )
    await expect(
      confirm('b151cb31-064b-49c0-b53b-fe732171660f.pdf')
    ).rejects.toThrow('KB blob was not found')
  })

  it('does not delete the winning blob during concurrent cross-KB confirmation', async () => {
    const firstKb = await createKb({ name: 'First notes' }, userOneCtx)
    const secondKb = await createKb({ name: 'Second notes' }, userOneCtx)
    const ticket = await requestKbFileUpload(
      {
        kbId: firstKb.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    const confirm = (kbId: string) =>
      confirmKbFileUpload(
        {
          kbId,
          blobName: ticket.blobName,
          title: 'Finance notes',
          originalFilename: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        userOneCtx
      )

    const results = await Promise.allSettled([
      confirm(firstKb.id),
      confirm(secondKb.id),
    ])

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1
    )
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1
    )
    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    await expect(
      prisma.kBResource.count({ where: { blobName: ticket.blobName } })
    ).resolves.toBe(1)
  })

  it('does not delete an existing blob on cross-KB metadata mismatch', async () => {
    const firstKb = await createKb({ name: 'First notes' }, userOneCtx)
    const secondKb = await createKb({ name: 'Second notes' }, userOneCtx)
    const ticket = await requestKbFileUpload(
      {
        kbId: firstKb.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    const args = {
      blobName: ticket.blobName,
      title: 'Finance notes',
      originalFilename: 'notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }

    const resource = await confirmKbFileUpload(
      { ...args, kbId: firstKb.id },
      userOneCtx
    )
    getBlobProperties.mockClear()
    deleteBlobIfExists.mockClear()

    await expect(
      confirmKbFileUpload(
        { ...args, kbId: secondKb.id, sizeBytes: 1025 },
        userOneCtx
      )
    ).rejects.toThrow('KB blob name is invalid')
    expect(getBlobProperties).not.toHaveBeenCalled()
    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      kbId: firstKb.id,
      blobName: ticket.blobName,
      sizeBytes: 1024,
    })
  })

  it('returns one resource for concurrent confirmation retries', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    const args = {
      kbId: created.id,
      blobName: ticket.blobName,
      title: 'Finance notes',
      originalFilename: 'notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }

    const [first, second] = await Promise.all([
      confirmKbFileUpload(args, userOneCtx),
      confirmKbFileUpload(args, userOneCtx),
    ])

    expect(second.id).toBe(first.id)
    await expect(
      prisma.kBResource.count({ where: { blobName: ticket.blobName } })
    ).resolves.toBe(1)
  })

  it('rejects absent blobs and deletes mismatched uploads', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const ticket = await requestKbFileUpload(
      {
        kbId: created.id,
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
      userOneCtx
    )
    const args = {
      kbId: created.id,
      blobName: ticket.blobName,
      title: 'Finance notes',
      originalFilename: 'notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }
    blobExists.mockResolvedValueOnce(false)
    await expect(confirmKbFileUpload(args, userOneCtx)).rejects.toThrow(
      'KB blob was not found'
    )

    getBlobProperties.mockResolvedValue({
      contentLength: 1025,
      contentType: 'application/pdf',
    })

    await expect(confirmKbFileUpload(args, userOneCtx)).rejects.toThrow(
      'KB blob metadata is invalid'
    )
    expect(deleteBlobIfExists).toHaveBeenCalledOnce()
    await expect(
      prisma.kBResource.count({ where: { kbId: created.id } })
    ).resolves.toBe(0)
  })

  it('validates URL resources and denies foreign knowledge bases', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    await expect(
      createKbUrlResource(
        { kbId: created.id, title: 'Invalid', url: 'not-a-url' },
        userOneCtx
      )
    ).rejects.toThrow('KB resource URL is invalid')
    await expect(
      createKbUrlResource(
        { kbId: created.id, title: 'FTP', url: 'ftp://example.com/file' },
        userOneCtx
      )
    ).rejects.toThrow('KB resource URL is invalid')
    await expect(
      createKbUrlResource(
        {
          kbId: created.id,
          title: 'Private',
          url: 'http://169.254.169.254/latest/meta-data',
        },
        userOneCtx
      )
    ).rejects.toThrow('KB resource URL is invalid')
    await expect(
      createKbUrlResource(
        {
          kbId: created.id,
          title: 'Credentials',
          url: 'https://user:password@example.com/file',
        },
        userOneCtx
      )
    ).rejects.toThrow('KB resource URL is invalid')
    await expect(
      createKbUrlResource(
        {
          kbId: created.id,
          title: 'Foreign',
          url: 'https://example.com',
        },
        userTwoCtx
      )
    ).rejects.toThrow('KB not found')
  })

  it('creates and deletes an owned URL resource', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/watch?id=123',
      },
      userOneCtx
    )

    expect(resource).toMatchObject({
      kbId: created.id,
      title: 'Lecture recording',
      type: KBResourceType.URL,
      sourceUrl: 'https://video.example.com/watch?id=123',
    })
    await expect(
      deleteKbResource({ id: resource.id }, userTwoCtx)
    ).rejects.toThrow('KB resource not found')

    await deleteKbResource({ id: resource.id }, userOneCtx)
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      deletedById: userOneCtx.user.sub,
      deletedAt: expect.any(Date),
      ingestionOperation: KBIngestionOperation.DELETE,
      status: KBResourceStatus.QUEUED,
      resourceVersion: 1,
    })
    await expect(
      getKbResourcesConnection({ kbId: created.id }, userOneCtx)
    ).resolves.toMatchObject({ items: [] })
  })

  it('keeps a tombstone hidden when queueing its delete task fails', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/watch?id=123',
      },
      userOneCtx
    )
    vi.spyOn(
      userOneCtx.tasks.deleteKBResource,
      'runNoWait'
    ).mockRejectedValueOnce(new Error('queue unavailable'))

    await expect(
      deleteKbResource({ id: resource.id }, userOneCtx)
    ).resolves.toMatchObject({ id: resource.id })

    const tombstone = await prisma.kBResource.findUniqueOrThrow({
      where: { id: resource.id },
    })
    expect(tombstone).toMatchObject({
      deletedAt: expect.any(Date),
      status: KBResourceStatus.QUEUED,
      errorCode: 'DELETION_QUEUE_FAILED',
    })
    await expect(
      prisma.kBIngestionRun.findUniqueOrThrow({
        where: { id: tombstone.ingestionAttemptId! },
      })
    ).resolves.toMatchObject({
      operation: KBIngestionOperation.DELETE,
      status: KBIngestionStatus.QUEUED,
      errorCode: 'DELETION_QUEUE_FAILED',
    })
    await expect(
      getKbResourcesConnection({ kbId: created.id }, userOneCtx)
    ).resolves.toMatchObject({ items: [] })
  })

  it('returns only the five newest ingestion runs to the resource owner', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/watch?id=123',
      },
      userOneCtx
    )
    const runIds = Array.from({ length: 6 }, () => randomUUID())

    for (const [index, id] of runIds.entries()) {
      await prisma.kBIngestionRun.create({
        data: {
          id,
          resourceId: resource.id,
          resourceVersion: index + 1,
          status: KBIngestionStatus.SUCCEEDED,
          createdAt: new Date(Date.UTC(2026, 6, 27, 10, index)),
        },
      })
    }

    await expect(
      getKbResourceIngestionRuns({ resourceId: resource.id }, userTwoCtx)
    ).rejects.toThrow('KB resource not found')
    await expect(
      getKbResourceIngestionRuns({ resourceId: resource.id }, userOneCtx)
    ).resolves.toMatchObject(
      runIds
        .slice(1)
        .reverse()
        .map((id, index) => ({
          id,
          resourceVersion: 6 - index,
        }))
    )
  })

  it('keeps the current lecturer attempt visible after a platform refresh', async () => {
    const kb = await createKb({ name: 'Refresh projection test' }, userOneCtx)
    const lecturerAttemptId = randomUUID()
    const platformRefreshId = randomUUID()
    const resource = await prisma.kBResource.create({
      data: {
        kbId: kb.id,
        type: KBResourceType.URL,
        title: 'Refreshable resource',
        sourceUrl: 'https://example.com/refreshable-resource',
        status: KBResourceStatus.PROCESSING,
        ingestionAttemptId: lecturerAttemptId,
        resourceVersion: 2,
      },
    })
    await prisma.kBIngestionRun.createMany({
      data: [
        {
          id: lecturerAttemptId,
          resourceId: resource.id,
          resourceVersion: 2,
          status: KBIngestionStatus.PROCESSING,
          createdAt: new Date('2026-08-01T08:00:00.000Z'),
        },
        {
          id: platformRefreshId,
          resourceId: resource.id,
          resourceVersion: 1,
          status: KBIngestionStatus.SUCCEEDED,
          externalOperationId: 'platform-refresh-operation',
          createdAt: new Date('2026-08-01T08:01:00.000Z'),
        },
      ],
    })

    await expect(
      getKbResourcesConnection({ kbId: kb.id }, userOneCtx)
    ).resolves.toMatchObject({
      items: [
        {
          id: resource.id,
          ingestionRuns: [
            { id: lecturerAttemptId, status: KBIngestionStatus.PROCESSING },
          ],
        },
      ],
    })
    await expect(
      getKbResourcesConnection(
        { kbId: kb.id, status: KBIngestionStatus.PROCESSING },
        userOneCtx
      )
    ).resolves.toMatchObject({ items: [{ id: resource.id }] })
    await expect(
      getKbResourcesConnection(
        { kbId: kb.id, status: KBIngestionStatus.SUCCEEDED },
        userOneCtx
      )
    ).resolves.toMatchObject({ items: [] })
  })

  it('defers blob storage deletion to asynchronous cleanup', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: '8d2140ef-04b4-41cb-a5a9-ff25381f9fdb.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
      },
    })
    await expect(
      deleteKbResource({ id: resource.id }, userOneCtx)
    ).resolves.toMatchObject({ id: resource.id })
    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({ deletedAt: expect.any(Date) })
  })

  it.each([
    KBResourceStatus.QUEUED,
    KBResourceStatus.PROCESSING,
  ])('does not delete a %s blob resource', async (status) => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: 'bc1b27e4-b616-4403-8223-e6e8b3136c7e.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
        status,
      },
    })

    await expect(
      deleteKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB resource cannot be deleted')

    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toBeTruthy()
  })

  it('serializes resource deletion against a concurrent ingestion claim', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: 'ad135b54-bc2a-4888-b356-631e5a76627c.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
      },
    })
    const deletionStarted = createDeferred<void>()
    const finishDeletion = createDeferred<void>()
    const deleteCtx = withTombstonePause(
      userOneCtx,
      'kBResource',
      () => deletionStarted.resolve(undefined),
      finishDeletion.promise
    )
    const claimStarted = createDeferred<void>()
    const ingestCtx = withIngestionClaimSignal(userOneCtx, () =>
      claimStarted.resolve(undefined)
    )
    const runNoWait = vi
      .spyOn(ingestCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const deletion = deleteKbResource({ id: resource.id }, deleteCtx)
    await deletionStarted.promise
    const ingestion = expect(
      ingestKbResource({ id: resource.id }, ingestCtx)
    ).rejects.toThrow('KB resource cannot be ingested')
    await claimStarted.promise

    expect(runNoWait).not.toHaveBeenCalled()
    finishDeletion.resolve(undefined)
    await expect(deletion).resolves.toMatchObject({ id: resource.id })
    await ingestion

    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    expect(runNoWait).not.toHaveBeenCalled()
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({ deletedAt: expect.any(Date) })
  })

  it('serializes knowledge base deletion against a concurrent ingestion claim', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: '0f1320e3-0458-4874-a949-bc093be069fb.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
      },
    })
    const deletionStarted = createDeferred<void>()
    const finishDeletion = createDeferred<void>()
    const deleteCtx = withTombstonePause(
      userOneCtx,
      'kB',
      () => deletionStarted.resolve(undefined),
      finishDeletion.promise
    )
    const claimStarted = createDeferred<void>()
    const ingestCtx = withIngestionClaimSignal(userOneCtx, () =>
      claimStarted.resolve(undefined)
    )
    const runNoWait = vi
      .spyOn(ingestCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const deletion = deleteKb({ id: created.id }, deleteCtx)
    await deletionStarted.promise
    const ingestion = expect(
      ingestKbResource({ id: resource.id }, ingestCtx)
    ).rejects.toThrow('KB resource cannot be ingested')
    await claimStarted.promise

    expect(runNoWait).not.toHaveBeenCalled()
    finishDeletion.resolve(undefined)
    await expect(deletion).resolves.toMatchObject({ id: created.id })
    await ingestion

    expect(deleteBlobIfExists).not.toHaveBeenCalled()
    expect(runNoWait).not.toHaveBeenCalled()
    await expect(
      prisma.kB.findUnique({ where: { id: created.id } })
    ).resolves.toMatchObject({ deletedAt: expect.any(Date) })
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({ deletedAt: expect.any(Date) })
  })

  it('paginates owned knowledge bases with tied timestamps and filter-bound cursors', async () => {
    const timestamp = new Date('2026-07-28T12:00:00.000Z')
    const ids = Array.from({ length: 4 }, () => randomUUID())
      .sort()
      .reverse()
    await prisma.kB.createMany({
      data: ids.map((id, index) => ({
        id,
        ownerId: userOneCtx.user.sub,
        name: index === 0 ? 'Finance handbook' : `Course notes ${index}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    })
    await createKb({ name: 'Other owner' }, userTwoCtx)

    const firstPage = await getUserKbsConnection({ first: 2 }, userOneCtx)
    expect(firstPage.items.map(({ id }) => id)).toEqual(ids.slice(0, 2))
    expect(firstPage).toMatchObject({
      totalCount: 4,
      pageInfo: { hasNextPage: true },
    })
    expect(firstPage.pageInfo.endCursor).toBeTruthy()

    const secondPage = await getUserKbsConnection(
      { first: 2, after: firstPage.pageInfo.endCursor },
      userOneCtx
    )
    expect(secondPage.items.map(({ id }) => id)).toEqual(ids.slice(2))
    expect(secondPage).toMatchObject({
      totalCount: 4,
      pageInfo: { hasNextPage: false },
    })
    await expect(
      getUserKbsConnection(
        {
          first: 2,
          after: firstPage.pageInfo.endCursor,
          search: 'finance',
        },
        userOneCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    await expect(
      getUserKbsConnection(
        { first: 2, after: firstPage.pageInfo.endCursor },
        userTwoCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    await expect(
      getUserKbsConnection({ after: 'not+a+cursor' }, userOneCtx)
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

    const searchResult = await getUserKbsConnection(
      { search: '  FINANCE  ' },
      userOneCtx
    )
    expect(searchResult.items.map(({ name }) => name)).toEqual([
      'Finance handbook',
    ])
    expect(searchResult.totalCount).toBe(1)
  })

  it('keeps resource pagination stable across status updates and hides tombstones', async () => {
    const kb = await createKb({ name: 'Scale test' }, userOneCtx)
    const timestamp = new Date('2026-07-28T13:00:00.000Z')
    const ids = Array.from({ length: 5 }, () => randomUUID())
      .sort()
      .reverse()
    await prisma.kBResource.createMany({
      data: ids.map((id, index) => ({
        id,
        kbId: kb.id,
        type: index % 2 === 0 ? KBResourceType.URL : KBResourceType.BLOB,
        title: index === 0 ? 'Finance syllabus' : `Resource ${index}`,
        sourceUrl:
          index % 2 === 0 ? `https://example.com/resource-${index}` : null,
        originalFilename: index % 2 === 1 ? `resource-${index}.pdf` : null,
        mimeType: index % 2 === 1 ? 'application/pdf' : null,
        sizeBytes: index % 2 === 1 ? 100 + index : null,
        blobName: index % 2 === 1 ? `${id}.pdf` : null,
        blobHref:
          index % 2 === 1
            ? `https://kbtestaccount.blob.core.windows.net/container/${id}.pdf`
            : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    })
    await prisma.kBResource.update({
      where: { id: ids[4] },
      data: {
        deletedAt: new Date(),
        deletedById: userOneCtx.user.sub,
      },
    })

    const firstPage = await getKbResourcesConnection(
      { kbId: kb.id, first: 2 },
      userOneCtx
    )
    expect(firstPage.items.map(({ id }) => id)).toEqual(ids.slice(0, 2))
    expect(firstPage.totalCount).toBe(4)

    const currentAttemptId = randomUUID()
    await prisma.kBResource.update({
      where: { id: ids[0] },
      data: {
        status: KBResourceStatus.PROCESSING,
        ingestionAttemptId: currentAttemptId,
      },
    })
    await prisma.kBIngestionRun.createMany({
      data: [
        {
          id: randomUUID(),
          resourceId: ids[0]!,
          resourceVersion: 1,
          status: KBIngestionStatus.FAILED,
          createdAt: new Date('2026-07-28T13:01:00.000Z'),
        },
        {
          id: currentAttemptId,
          resourceId: ids[0]!,
          resourceVersion: 2,
          status: KBIngestionStatus.PROCESSING,
          createdAt: new Date('2026-07-28T13:02:00.000Z'),
        },
        {
          id: randomUUID(),
          resourceId: ids[1]!,
          resourceVersion: 1,
          status: KBIngestionStatus.SUCCEEDED,
          createdAt: new Date('2026-07-28T13:02:00.000Z'),
        },
      ],
    })
    const secondPage = await getKbResourcesConnection(
      {
        kbId: kb.id,
        first: 2,
        after: firstPage.pageInfo.endCursor,
      },
      userOneCtx
    )
    expect(secondPage.items.map(({ id }) => id)).toEqual(ids.slice(2, 4))
    expect(
      new Set([
        ...firstPage.items.map(({ id }) => id),
        ...secondPage.items.map(({ id }) => id),
      ]).size
    ).toBe(4)
    expect(secondPage.pageInfo.hasNextPage).toBe(false)

    await expect(
      getKbResourcesConnection(
        {
          kbId: kb.id,
          after: firstPage.pageInfo.endCursor,
          type: KBResourceType.BLOB,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    await expect(
      getKbResourcesConnection(
        { kbId: kb.id, after: firstPage.pageInfo.endCursor },
        userTwoCtx
      )
    ).rejects.toThrow('KB not found')

    const filtered = await getKbResourcesConnection(
      {
        kbId: kb.id,
        search: 'finance',
        type: KBResourceType.URL,
        status: KBIngestionStatus.PROCESSING,
      },
      userOneCtx
    )
    expect(filtered.items.map(({ id }) => id)).toEqual([ids[0]])
    expect(filtered.totalCount).toBe(1)
  })

  it('returns exact visible, retained, reserved, cleanup, and limit metrics', async () => {
    const kb = await createKb({ name: 'Metrics test' }, userOneCtx)
    await prisma.kBResource.createMany({
      data: [
        {
          kbId: kb.id,
          type: KBResourceType.BLOB,
          title: 'Visible file',
          sizeBytes: 100,
        },
        {
          kbId: kb.id,
          type: KBResourceType.URL,
          title: 'Visible URL',
        },
        {
          kbId: kb.id,
          type: KBResourceType.BLOB,
          title: 'Pending cleanup',
          sizeBytes: 50,
          deletedAt: new Date(),
          deletedById: userOneCtx.user.sub,
        },
      ],
    })
    await prisma.kBUploadTicket.create({
      data: {
        id: randomUUID(),
        kbId: kb.id,
        blobName: `${randomUUID()}.pdf`,
        sizeBytes: 25,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    const result = await getKb({ id: kb.id }, userOneCtx)
    expect(result.metrics).toEqual({
      visibleResourceCount: 2,
      visibleSizeBytes: 100,
      unknownSizeResourceCount: 1,
      quotaResourceCount: 4,
      quotaSizeBytes: 25 * 1024 * 1024 + 175,
      resourceLimit: MAX_KB_RESOURCE_COUNT,
      storageLimitBytes: MAX_KB_TOTAL_SIZE_BYTES,
      pendingCleanupCount: 1,
      pendingCleanupSizeBytes: 50,
      reservedResourceCount: 1,
      reservedSizeBytes: 25,
      linkedConsumerCount: 0,
    })
  })

  it('attributes the six-grouped-query metrics to each KB independently when multiple KBs share one connection page', async () => {
    // Three KBs for the same owner, each with a deliberately distinct
    // composition, to prove getKbMetricsMap's per-kbId groupBy attribution
    // doesn't bleed a sibling KB's rows into another's metrics.
    const kbA = await createKb({ name: 'Alpha KB' }, userOneCtx)
    const kbB = await createKb({ name: 'Beta KB' }, userOneCtx)
    const kbC = await createKb({ name: 'Gamma KB' }, userOneCtx)

    await prisma.kBResource.createMany({
      data: [
        // Alpha: 2 visible resources (one unknown-size), 1 tombstone, 1 reservation, 1 linked consumer
        {
          kbId: kbA.id,
          type: KBResourceType.BLOB,
          title: 'Alpha visible blob',
          sizeBytes: 100,
        },
        {
          kbId: kbA.id,
          type: KBResourceType.URL,
          title: 'Alpha visible url (unknown size)',
        },
        {
          kbId: kbA.id,
          type: KBResourceType.BLOB,
          title: 'Alpha tombstone',
          sizeBytes: 30,
          deletedAt: new Date(),
          deletedById: userOneCtx.user.sub,
        },
        // Beta: 1 visible resource, 2 unknown-size tombstones, no reservation, no consumer
        {
          kbId: kbB.id,
          type: KBResourceType.BLOB,
          title: 'Beta visible blob',
          sizeBytes: 200,
        },
        {
          kbId: kbB.id,
          type: KBResourceType.BLOB,
          title: 'Beta tombstone (unknown size) 1',
          deletedAt: new Date(),
          deletedById: userOneCtx.user.sub,
        },
        {
          kbId: kbB.id,
          type: KBResourceType.BLOB,
          title: 'Beta tombstone (unknown size) 2',
          deletedAt: new Date(),
          deletedById: userOneCtx.user.sub,
        },
        // Gamma: no resources at all, only an upload reservation
      ],
    })
    await prisma.kBUploadTicket.createMany({
      data: [
        {
          id: randomUUID(),
          kbId: kbA.id,
          blobName: `${randomUUID()}.pdf`,
          sizeBytes: 10,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          id: randomUUID(),
          kbId: kbC.id,
          blobName: `${randomUUID()}.pdf`,
          sizeBytes: 5,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    })
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Alpha tutor',
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
      },
    })
    await prisma.kBChatbot.create({
      data: { kbId: kbA.id, chatbotId: chatbot.id, isEnabled: true },
    })

    const page = await getUserKbsConnection({ first: 20 }, userOneCtx)
    const byId = new Map(page.items.map((item) => [item.id, item]))
    expect(byId.has(kbA.id)).toBe(true)
    expect(byId.has(kbB.id)).toBe(true)
    expect(byId.has(kbC.id)).toBe(true)

    expect(byId.get(kbA.id)?.metrics).toEqual({
      visibleResourceCount: 2,
      visibleSizeBytes: 100,
      unknownSizeResourceCount: 1,
      quotaResourceCount: 4,
      quotaSizeBytes: 25 * 1024 * 1024 + 140,
      resourceLimit: MAX_KB_RESOURCE_COUNT,
      storageLimitBytes: MAX_KB_TOTAL_SIZE_BYTES,
      pendingCleanupCount: 1,
      pendingCleanupSizeBytes: 30,
      reservedResourceCount: 1,
      reservedSizeBytes: 10,
      linkedConsumerCount: 1,
    })
    expect(byId.get(kbB.id)?.metrics).toEqual({
      visibleResourceCount: 1,
      visibleSizeBytes: 200,
      unknownSizeResourceCount: 0,
      quotaResourceCount: 3,
      quotaSizeBytes: 25 * 1024 * 1024 * 2 + 200,
      resourceLimit: MAX_KB_RESOURCE_COUNT,
      storageLimitBytes: MAX_KB_TOTAL_SIZE_BYTES,
      pendingCleanupCount: 2,
      pendingCleanupSizeBytes: 25 * 1024 * 1024 * 2,
      reservedResourceCount: 0,
      reservedSizeBytes: 0,
      linkedConsumerCount: 0,
    })
    expect(byId.get(kbC.id)?.metrics).toEqual({
      visibleResourceCount: 0,
      visibleSizeBytes: 0,
      unknownSizeResourceCount: 0,
      quotaResourceCount: 1,
      quotaSizeBytes: 5,
      resourceLimit: MAX_KB_RESOURCE_COUNT,
      storageLimitBytes: MAX_KB_TOTAL_SIZE_BYTES,
      pendingCleanupCount: 0,
      pendingCleanupSizeBytes: 0,
      reservedResourceCount: 1,
      reservedSizeBytes: 5,
      linkedConsumerCount: 0,
    })

    // cross-check the single-KB detail path against the multi-KB catalog
    // path: both call the same getKbMetricsMap, so a KB's metrics must be
    // identical however many sibling KBs are aggregated alongside it.
    expect((await getKb({ id: kbB.id }, userOneCtx)).metrics).toEqual(
      byId.get(kbB.id)?.metrics
    )
  })

  it('bulk deletes a bounded selection with one independently queued attempt per resource', async () => {
    const kb = await createKb({ name: 'Bulk delete' }, userOneCtx)
    const resources = await Promise.all(
      ['First', 'Second'].map((title) =>
        createKbUrlResource(
          {
            kbId: kb.id,
            title,
            url: `https://example.com/${title.toLowerCase()}`,
          },
          userOneCtx
        )
      )
    )
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.deleteKBResource, 'runNoWait')
      .mockRejectedValueOnce(new Error('queue unavailable'))
      .mockResolvedValueOnce({} as never)

    const deleted = await deleteKbResources(
      { kbId: kb.id, ids: resources.map(({ id }) => id).reverse() },
      userOneCtx
    )

    expect(deleted).toHaveLength(2)
    expect(runNoWait).toHaveBeenCalledTimes(2)
    const persisted = await prisma.kBResource.findMany({
      where: { id: { in: resources.map(({ id }) => id) } },
      orderBy: { id: 'asc' },
    })
    expect(persisted.every(({ deletedAt }) => deletedAt !== null)).toBe(true)
    expect(
      persisted.filter(({ errorCode }) => errorCode === 'DELETION_QUEUE_FAILED')
    ).toHaveLength(1)
    expect(
      await prisma.kBIngestionRun.count({
        where: {
          resourceId: { in: resources.map(({ id }) => id) },
          operation: KBIngestionOperation.DELETE,
        },
      })
    ).toBe(2)
  })

  it('rejects an invalid or unsafe bulk deletion atomically', async () => {
    const kb = await createKb({ name: 'Bulk guards' }, userOneCtx)
    const foreignKb = await createKb({ name: 'Foreign' }, userTwoCtx)
    const safe = await createKbUrlResource(
      {
        kbId: kb.id,
        title: 'Safe',
        url: 'https://example.com/safe',
      },
      userOneCtx
    )
    const active = await createKbUrlResource(
      {
        kbId: kb.id,
        title: 'Active',
        url: 'https://example.com/active',
      },
      userOneCtx
    )
    await prisma.kBResource.update({
      where: { id: active.id },
      data: { status: KBResourceStatus.PROCESSING },
    })
    const foreign = await createKbUrlResource(
      {
        kbId: foreignKb.id,
        title: 'Foreign',
        url: 'https://example.com/foreign',
      },
      userTwoCtx
    )

    await expect(
      deleteKbResources({ kbId: kb.id, ids: [safe.id, active.id] }, userOneCtx)
    ).rejects.toMatchObject({ extensions: { code: 'KB_RESOURCE_ACTIVE' } })
    await expect(
      deleteKbResources({ kbId: kb.id, ids: [safe.id, foreign.id] }, userOneCtx)
    ).rejects.toThrow('KB resource not found')
    await expect(
      deleteKbResources({ kbId: kb.id, ids: [safe.id, safe.id] }, userOneCtx)
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    await expect(
      deleteKbResources(
        {
          kbId: kb.id,
          ids: Array.from({ length: 51 }, () => randomUUID()),
        },
        userOneCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    await expect(
      prisma.kBResource.findUnique({ where: { id: safe.id } })
    ).resolves.toMatchObject({ deletedAt: null })
  })

  it('rejects every KB entry point for a non-preview user', async () => {
    const nonPreviewUser = await prisma.user.findUnique({
      where: { id: nonPreviewCtx.user.sub },
    })
    expect(nonPreviewUser?.privatePreview).toBe(false)

    const kbId = randomUUID()
    const resourceId = randomUUID()
    const chatbotId = randomUUID()

    const entryPoints: Array<() => Promise<unknown>> = [
      () => createKb({ name: 'Blocked KB' }, nonPreviewCtx),
      () => deleteKb({ id: kbId }, nonPreviewCtx),
      () =>
        createKbUrlResource(
          { kbId, url: 'https://example.com/blocked', title: 'Blocked' },
          nonPreviewCtx
        ),
      () => deleteKbResource({ id: resourceId }, nonPreviewCtx),
      () => deleteKbResources({ kbId, ids: [resourceId] }, nonPreviewCtx),
      () => ingestKbResource({ id: resourceId }, nonPreviewCtx),
      () =>
        requestKbFileUpload(
          {
            kbId,
            fileName: 'blocked.pdf',
            contentType: 'application/pdf',
            sizeBytes: 1024,
          },
          nonPreviewCtx
        ),
      () =>
        confirmKbFileUpload(
          {
            kbId,
            blobName: `${randomUUID()}.pdf`,
            title: 'Blocked',
            originalFilename: 'blocked.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
          },
          nonPreviewCtx
        ),
      () => attachKbToChatbot({ kbId, chatbotId }, nonPreviewCtx),
      () => detachKbFromChatbot({ kbId, chatbotId }, nonPreviewCtx),
      () => getUserKbsConnection({}, nonPreviewCtx),
      () => getKb({ id: kbId }, nonPreviewCtx),
      () => getKbResourcesConnection({ kbId }, nonPreviewCtx),
      () => getKbChatbotBindings({ kbId }, nonPreviewCtx),
      () => getKbResourceIngestionRuns({ resourceId }, nonPreviewCtx),
    ]

    expect(entryPoints).toHaveLength(15)
    for (const callEntryPoint of entryPoints) {
      await expect(callEntryPoint()).rejects.toMatchObject({
        extensions: { code: 'KB_PREVIEW_ACCESS_REQUIRED' },
      })
    }
  })

  it('refuses new KB content dispatch while the ingestion kill switch is enabled', async () => {
    const kb = await createKb({ name: 'Kill switch KB' }, userOneCtx)
    const existingResource = await createKbUrlResource(
      { kbId: kb.id, title: 'Existing', url: 'https://example.com/existing' },
      userOneCtx
    )

    vi.stubEnv('KB_INGESTION_DISABLED', 'true')
    try {
      const blockedCalls: Array<() => Promise<unknown>> = [
        () =>
          createKbUrlResource(
            {
              kbId: kb.id,
              title: 'Blocked',
              url: 'https://example.com/blocked',
            },
            userOneCtx
          ),
        () =>
          requestKbFileUpload(
            {
              kbId: kb.id,
              fileName: 'blocked.pdf',
              contentType: 'application/pdf',
              sizeBytes: 1024,
            },
            userOneCtx
          ),
        () => ingestKbResource({ id: existingResource.id }, userOneCtx),
      ]
      for (const callBlockedEntryPoint of blockedCalls) {
        await expect(callBlockedEntryPoint()).rejects.toMatchObject({
          extensions: { code: 'KB_INGESTION_DISABLED' },
        })
      }

      // reads and deletion of already-registered content stay live
      await expect(getKb({ id: kb.id }, userOneCtx)).resolves.toMatchObject({
        id: kb.id,
      })
      const deleted = await deleteKbResource(
        { id: existingResource.id },
        userOneCtx
      )
      expect(deleted.id).toBe(existingResource.id)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
