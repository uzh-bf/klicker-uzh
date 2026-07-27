import { BlobServiceClient } from '@azure/storage-blob'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  KBResourceType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
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
  detachKbFromChatbot,
  getKb,
  getKbChatbotBindings,
  getKbResourceIngestionRuns,
  getUserKbs,
  ingestKbResource,
  requestKbFileUpload,
} from '../src/services/knowledge.js'
import { seedCourse, testCleanup, testInitialization } from './helpers.js'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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
  let previousBlobAccountName: string | undefined
  let previousBlobAccessKey: string | undefined
  let containerName: string
  let requestedBlobName: string
  let createIfNotExists: ReturnType<typeof vi.fn>
  let blobExists: ReturnType<typeof vi.fn>
  let getBlobProperties: ReturnType<typeof vi.fn>
  let deleteBlobIfExists: ReturnType<typeof vi.fn>
  let getBlobClient: ReturnType<typeof vi.fn>

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
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'kbtestaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = Buffer.alloc(32).toString('base64')

    containerName = ''
    requestedBlobName = ''
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
    ).mockImplementation((name: string) => {
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
    await testCleanup(prisma)
  })

  it('creates and lists only the current users knowledge bases', async () => {
    const created = await createKb(
      { name: 'Finance notes', description: 'Course material' },
      userOneCtx
    )
    await createKb({ name: 'Other owner' }, userTwoCtx)

    const userKbs = await getUserKbs(userOneCtx)

    expect(userKbs).toHaveLength(1)
    expect(userKbs[0]).toMatchObject({
      id: created.id,
      name: 'Finance notes',
      description: 'Course material',
      ownerId: userOneCtx.user.sub,
    })
  })

  it('returns an owned knowledge base with its resources', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    const kb = await getKb({ id: created.id }, userOneCtx)

    expect(kb.id).toBe(created.id)
    expect(kb.resources).toEqual([])
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

  it('rejects an empty knowledge base name', async () => {
    await expect(createKb({ name: '   ' }, userOneCtx)).rejects.toThrow(
      'KB name is required'
    )

    await expect(getUserKbs(userOneCtx)).resolves.toEqual([])
  })

  it('hides an owned knowledge base behind a durable tombstone', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)

    await deleteKb({ id: created.id }, userOneCtx)

    await expect(getUserKbs(userOneCtx)).resolves.toEqual([])
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

  it.each([KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING])(
    'does not delete a knowledge base with a %s resource',
    async (status) => {
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
    }
  )

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
    expect(createIfNotExists).toHaveBeenCalledWith()
    expect(ticket.containerName).toBe(containerName)
    expect(ticket.blobName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/
    )
    const uploadUrl = new URL(ticket.uploadSasURL)
    expect(uploadUrl.searchParams.get('sp')).toBe('cw')
    expect(uploadUrl.searchParams.get('sr')).toBe('b')
    const expiry = Date.parse(uploadUrl.searchParams.get('se') ?? '')
    expect(expiry).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
    expect(expiry).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000 + 1000)
    await expect(
      prisma.kBResource.count({ where: { kbId: created.id } })
    ).resolves.toBe(0)
  })

  it('confirms a matching blob idempotently', async () => {
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

    const first = await confirmKbFileUpload(args, userOneCtx)
    const second = await confirmKbFileUpload(args, userOneCtx)

    expect(first.id).toBe(ticket.blobName.slice(0, -4))
    expect(second.id).toBe(first.id)
    expect(blobExists).toHaveBeenCalledOnce()
    expect(getBlobProperties).toHaveBeenCalledOnce()
    await expect(
      prisma.kBResource.count({ where: { blobName: ticket.blobName } })
    ).resolves.toBe(1)
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
    await expect(getKb({ id: created.id }, userOneCtx)).resolves.toMatchObject({
      resources: [],
    })
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
    await expect(getKb({ id: created.id }, userOneCtx)).resolves.toMatchObject({
      resources: [],
    })
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

  it.each([KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING])(
    'does not delete a %s blob resource',
    async (status) => {
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
    }
  )

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
})
