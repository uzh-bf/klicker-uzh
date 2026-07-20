import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ChatbotKnowledgeGraphStatus,
  KBIngestionSpeedMode,
  KBResourceType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  KBIngestionSpeedMode as APIKBIngestionSpeedMode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { validate as validateUuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'

const knowledgeGraph = vi.hoisted(() => ({
  getPublishedKnowledgeGraph: vi.fn(),
  readKnowledgeGraphNeighbors: vi.fn(),
  readKnowledgeGraphOverview: vi.fn(),
  searchKnowledgeGraph: vi.fn(),
}))

vi.mock('@klicker-uzh/knowledge-graph', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@klicker-uzh/knowledge-graph')>()
  knowledgeGraph.getPublishedKnowledgeGraph.mockImplementation(
    actual.getPublishedKnowledgeGraph
  )
  return {
    ...actual,
    getPublishedKnowledgeGraph: knowledgeGraph.getPublishedKnowledgeGraph,
    readKnowledgeGraphNeighbors: knowledgeGraph.readKnowledgeGraphNeighbors,
    readKnowledgeGraphOverview: knowledgeGraph.readKnowledgeGraphOverview,
    searchKnowledgeGraph: knowledgeGraph.searchKnowledgeGraph,
  }
})

import {
  getAvailableChatbotKnowledgeGraphResources,
  getChatbotKnowledgeGraphConfig,
  getChatbotKnowledgeGraphNeighbors,
  getChatbotKnowledgeGraphOverview,
  rebuildChatbotKnowledgeGraph,
  searchChatbotKnowledgeGraph,
  updateChatbotKnowledgeGraphResources,
} from '../src/services/chatbotKnowledgeGraphs.js'
import {
  createKb,
  createKbUrlResource,
  deleteKb,
  deleteKbResource,
} from '../src/services/knowledge.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

function createDeferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function rawQueryText(args: unknown[]) {
  const query = args[0]
  if (Array.isArray(query)) return query.join(' ')
  if (!query || typeof query !== 'object') return ''

  const sql = (query as { sql?: unknown }).sql
  if (typeof sql === 'string') return sql
  const text = (query as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

function isKbResourceLock(args: unknown[]) {
  const query = rawQueryText(args)
  return (
    query.includes('FROM "public"."KBResource" AS resource') &&
    query.includes('FOR UPDATE OF resource')
  )
}

function withResourceLockHooks(
  ctx: ContextWithUser,
  hooks: {
    before?: () => Promise<void> | void
    after?: () => Promise<void> | void
  }
): ContextWithUser {
  const prisma = new Proxy(ctx.prisma, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return async (
          callback: Parameters<typeof target.$transaction>[0],
          options?: Parameters<typeof target.$transaction>[1]
        ) =>
          target.$transaction(async (transaction) => {
            const interceptedTransaction = new Proxy(transaction, {
              get(transactionTarget, transactionProperty, transactionReceiver) {
                const value = Reflect.get(
                  transactionTarget,
                  transactionProperty,
                  transactionReceiver
                )
                if (transactionProperty !== '$queryRaw') {
                  return typeof value === 'function'
                    ? value.bind(transactionTarget)
                    : value
                }

                return async (...args: unknown[]) => {
                  const resourceLock = isKbResourceLock(args)
                  const before = resourceLock ? hooks.before?.() : undefined
                  if (before) await before
                  const result = await (
                    value as (...queryArgs: unknown[]) => Promise<unknown>
                  ).apply(transactionTarget, args)
                  const after = resourceLock ? hooks.after?.() : undefined
                  if (after) await after
                  return result
                }
              },
            })

            return callback(interceptedTransaction)
          }, options)
      }

      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  return { ...ctx, prisma }
}

function graphResponse(
  chatbotId: string,
  builtRevision: number
): KnowledgeGraphResponse {
  return {
    chatbotId,
    builtRevision,
    truncated: false,
    nodes: [
      {
        id: '12',
        labels: ['Konzept'],
        kind: 'Konzept',
        displayLabel: 'Example concept',
        summary: 'Safe summary',
        content: 'Safe content',
        degree: 2,
        sourceReferences: [
          {
            resourceId: '00000000-0000-4000-8000-000000000123',
            title: 'Example resource',
            reference: 'page 3',
          },
        ],
      },
    ],
    edges: [
      {
        id: '30',
        source: '12',
        target: '14',
        type: 'RELATED',
        label: 'RELATED',
        properties: { weight: 1 },
      },
    ],
  }
}

describe('Integration tests for chatbot knowledge graph selection', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  async function createChatbot(
    ctx: ContextWithUser,
    name: string
  ): Promise<{ id: string; name: string }> {
    const course = await seedCourse({}, ctx)
    return ctx.prisma.chatbot.create({
      data: {
        name,
        ownerId: ctx.user.sub,
        courseId: course.id,
      },
      select: { id: true, name: true },
    })
  }

  async function createUrlResource(
    ctx: ContextWithUser,
    kbName: string,
    resourceTitle: string
  ) {
    const kb = await createKb({ name: kbName }, ctx)
    const resource = await createKbUrlResource(
      {
        kbId: kb.id,
        title: resourceTitle,
        url: `https://example.test/${encodeURIComponent(resourceTitle)}`,
      },
      ctx
    )
    return { kb, resource }
  }

  async function createPublishedGraph(ctx: ContextWithUser, name: string) {
    const chatbot = await createChatbot(ctx, name)
    const { resource } = await createUrlResource(
      ctx,
      `${name} KB`,
      `${name} resource`
    )
    const config = await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [resource.id] },
      ctx
    )
    await ctx.prisma.chatbotKnowledgeGraph.update({
      where: { id: config.id! },
      data: {
        status: ChatbotKnowledgeGraphStatus.READY,
        builtRevision: config.selectionRevision,
      },
    })
    return { chatbot, config, resource }
  }

  it('returns an EMPTY revision-zero virtual configuration before first save', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')

    await expect(
      getChatbotKnowledgeGraphConfig({ chatbotId: chatbot.id }, userOneCtx)
    ).resolves.toMatchObject({
      id: null,
      chatbotId: chatbot.id,
      status: ChatbotKnowledgeGraphStatus.EMPTY,
      selectionRevision: 0,
      builtRevision: null,
      selectedResourceIds: [],
    })
    await expect(prisma.chatbotKnowledgeGraph.count()).resolves.toBe(0)
  })

  it('lazily creates one graph and selects resources from multiple owned KBs', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const first = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const second = await createUrlResource(
      userOneCtx,
      'Reading list',
      'Paper 1'
    )

    const config = await updateChatbotKnowledgeGraphResources(
      {
        chatbotId: chatbot.id,
        resourceIds: [second.resource.id, first.resource.id],
      },
      userOneCtx
    )

    expect(config).toMatchObject({
      chatbotId: chatbot.id,
      status: ChatbotKnowledgeGraphStatus.DIRTY,
      selectionRevision: 1,
    })
    expect(config.selectedResourceIds).toEqual(
      [first.resource.id, second.resource.id].sort()
    )
    await expect(prisma.chatbotKnowledgeGraph.count()).resolves.toBe(1)
    await expect(
      prisma.kBResource.count({
        where: { knowledgeGraphId: config.id },
      })
    ).resolves.toBe(2)
  })

  it('rejects duplicate IDs before creating or changing a graph', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )

    await expect(
      updateChatbotKnowledgeGraphResources(
        {
          chatbotId: chatbot.id,
          resourceIds: [resource.id, resource.id],
        },
        userOneCtx
      )
    ).rejects.toThrow('Duplicate KB resource IDs are not allowed')
    await expect(prisma.chatbotKnowledgeGraph.count()).resolves.toBe(0)
  })

  it('hides foreign chatbots and resources as not found', async () => {
    const foreignChatbot = await createChatbot(userTwoCtx, 'Foreign assistant')
    const ownedChatbot = await createChatbot(userOneCtx, 'Owned assistant')
    const { resource: foreignResource } = await createUrlResource(
      userTwoCtx,
      'Private notes',
      'Private lecture'
    )

    await expect(
      getChatbotKnowledgeGraphConfig(
        { chatbotId: foreignChatbot.id },
        userOneCtx
      )
    ).rejects.toThrow('Chatbot not found')
    await expect(
      updateChatbotKnowledgeGraphResources(
        {
          chatbotId: ownedChatbot.id,
          resourceIds: [foreignResource.id],
        },
        userOneCtx
      )
    ).rejects.toThrow('KB resource not found')
    await expect(prisma.chatbotKnowledgeGraph.count()).resolves.toBe(0)
  })

  it('rejects a resource assigned to another chatbot instead of stealing it', async () => {
    const firstChatbot = await createChatbot(userOneCtx, 'First assistant')
    const secondChatbot = await createChatbot(userOneCtx, 'Second assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const firstConfig = await updateChatbotKnowledgeGraphResources(
      { chatbotId: firstChatbot.id, resourceIds: [resource.id] },
      userOneCtx
    )

    await expect(
      updateChatbotKnowledgeGraphResources(
        { chatbotId: secondChatbot.id, resourceIds: [resource.id] },
        userOneCtx
      )
    ).rejects.toThrow('KB resource is assigned to another chatbot')
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resource.id } })
    ).resolves.toMatchObject({ knowledgeGraphId: firstConfig.id })
  })

  it('serializes concurrent assignment of one resource to two chatbots', async () => {
    const firstChatbot = await createChatbot(userOneCtx, 'First assistant')
    const secondChatbot = await createChatbot(userOneCtx, 'Second assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const firstLocked = createDeferred()
    const releaseFirst = createDeferred()
    const secondAttemptingLock = createDeferred()
    const firstCtx = withResourceLockHooks(userOneCtx, {
      after: async () => {
        firstLocked.resolve()
        await releaseFirst.promise
      },
    })
    const secondCtx = withResourceLockHooks(userOneCtx, {
      before: () => secondAttemptingLock.resolve(),
    })

    const firstAssignment = updateChatbotKnowledgeGraphResources(
      { chatbotId: firstChatbot.id, resourceIds: [resource.id] },
      firstCtx
    )
    await firstLocked.promise
    const secondAssignment = updateChatbotKnowledgeGraphResources(
      { chatbotId: secondChatbot.id, resourceIds: [resource.id] },
      secondCtx
    )
    await secondAttemptingLock.promise
    releaseFirst.resolve()

    const winningGraph = await firstAssignment
    await expect(secondAssignment).rejects.toMatchObject({
      message: 'KB resource is assigned to another chatbot',
    })

    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resource.id } })
    ).resolves.toMatchObject({ knowledgeGraphId: winningGraph.id })
    await expect(
      prisma.chatbotKnowledgeGraph.count({
        where: { chatbotId: { in: [firstChatbot.id, secondChatbot.id] } },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.chatbotKnowledgeGraph.findUnique({
        where: { chatbotId: secondChatbot.id },
      })
    ).resolves.toBeNull()
  })

  it('serializes concurrent resource assignment and deletion', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const selectionLocked = createDeferred()
    const releaseSelection = createDeferred()
    const deletionAttemptingLock = createDeferred()
    const selectionCtx = withResourceLockHooks(userOneCtx, {
      after: async () => {
        selectionLocked.resolve()
        await releaseSelection.promise
      },
    })
    const deletionCtx = withResourceLockHooks(userOneCtx, {
      before: () => deletionAttemptingLock.resolve(),
    })

    const selection = updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [resource.id] },
      selectionCtx
    )
    await selectionLocked.promise
    const deletion = deleteKbResource({ id: resource.id }, deletionCtx)
    await deletionAttemptingLock.promise
    releaseSelection.resolve()

    const graph = await selection
    await expect(deletion).rejects.toMatchObject({
      message: 'KB resource cannot be deleted',
    })
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resource.id } })
    ).resolves.toMatchObject({ knowledgeGraphId: graph.id })
    await expect(
      prisma.chatbotKnowledgeGraph.findUnique({
        where: { chatbotId: chatbot.id },
      })
    ).resolves.toMatchObject({ id: graph.id, selectionRevision: 1 })
  })

  it('does not increment the revision for the same normalized resource set', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const first = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const second = await createUrlResource(
      userOneCtx,
      'Reading list',
      'Paper 1'
    )
    await updateChatbotKnowledgeGraphResources(
      {
        chatbotId: chatbot.id,
        resourceIds: [first.resource.id, second.resource.id],
      },
      userOneCtx
    )

    const unchanged = await updateChatbotKnowledgeGraphResources(
      {
        chatbotId: chatbot.id,
        resourceIds: [second.resource.id, first.resource.id],
      },
      userOneCtx
    )

    expect(unchanged.selectionRevision).toBe(1)
  })

  it('increments a changed set once and immediately closes publication', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const first = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const second = await createUrlResource(
      userOneCtx,
      'Reading list',
      'Paper 1'
    )
    const initial = await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [first.resource.id] },
      userOneCtx
    )
    await prisma.chatbotKnowledgeGraph.update({
      where: { id: initial.id! },
      data: {
        status: ChatbotKnowledgeGraphStatus.READY,
        builtRevision: initial.selectionRevision,
      },
    })

    const changed = await updateChatbotKnowledgeGraphResources(
      {
        chatbotId: chatbot.id,
        resourceIds: [first.resource.id, second.resource.id],
      },
      userOneCtx
    )

    expect(changed).toMatchObject({
      status: ChatbotKnowledgeGraphStatus.DIRTY,
      selectionRevision: 2,
      builtRevision: 1,
    })
  })

  it.each([
    ChatbotKnowledgeGraphStatus.QUEUED,
    ChatbotKnowledgeGraphStatus.PROCESSING,
  ])(
    'preserves %s during an active build while creating a revision mismatch',
    async (status) => {
      const chatbot = await createChatbot(userOneCtx, 'Course assistant')
      const first = await createUrlResource(
        userOneCtx,
        'Lecture notes',
        'Lecture 1'
      )
      const second = await createUrlResource(
        userOneCtx,
        'Reading list',
        'Paper 1'
      )
      const initial = await updateChatbotKnowledgeGraphResources(
        { chatbotId: chatbot.id, resourceIds: [first.resource.id] },
        userOneCtx
      )
      await prisma.chatbotKnowledgeGraph.update({
        where: { id: initial.id! },
        data: {
          status,
          builtRevision: 1,
          activeAttemptId: randomUUID(),
          activeBuildRevision: 1,
        },
      })

      const changed = await updateChatbotKnowledgeGraphResources(
        {
          chatbotId: chatbot.id,
          resourceIds: [first.resource.id, second.resource.id],
        },
        userOneCtx
      )

      expect(changed).toMatchObject({
        status,
        selectionRevision: 2,
        builtRevision: 1,
        activeBuildRevision: 1,
      })
    }
  )

  it('sets an empty selection to EMPTY and disconnects only this graph', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [resource.id] },
      userOneCtx
    )

    const empty = await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [] },
      userOneCtx
    )

    expect(empty).toMatchObject({
      status: ChatbotKnowledgeGraphStatus.EMPTY,
      selectionRevision: 2,
      selectedResourceIds: [],
    })
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resource.id } })
    ).resolves.toMatchObject({ knowledgeGraphId: null })
  })

  it('groups available resources and reports another chatbot assignment', async () => {
    const target = await createChatbot(userOneCtx, 'Target assistant')
    const assignedTo = await createChatbot(userOneCtx, 'Assigned assistant')
    const first = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: assignedTo.id, resourceIds: [first.resource.id] },
      userOneCtx
    )

    const groups = await getAvailableChatbotKnowledgeGraphResources(
      { chatbotId: target.id },
      userOneCtx
    )

    expect(groups).toEqual([
      expect.objectContaining({
        id: first.kb.id,
        name: first.kb.name,
        resources: [
          expect.objectContaining({
            id: first.resource.id,
            assignmentChatbotId: assignedTo.id,
            assignmentChatbotName: assignedTo.name,
          }),
        ],
      }),
    ])
  })

  it('authorizes graph reads before checking publication or calling FalkorDB', async () => {
    const foreignChatbot = await createChatbot(
      userTwoCtx,
      'Foreign graph assistant'
    )

    await expect(
      getChatbotKnowledgeGraphOverview(
        { chatbotId: foreignChatbot.id },
        userOneCtx
      )
    ).rejects.toThrow('Chatbot not found')
    expect(knowledgeGraph.getPublishedKnowledgeGraph).not.toHaveBeenCalled()
    expect(knowledgeGraph.readKnowledgeGraphOverview).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'missing',
      status: null,
      builtRevision: null,
      publicationStatus: 'EMPTY',
    },
    {
      name: 'empty',
      status: ChatbotKnowledgeGraphStatus.EMPTY,
      builtRevision: null,
      publicationStatus: 'EMPTY',
    },
    {
      name: 'dirty',
      status: ChatbotKnowledgeGraphStatus.DIRTY,
      builtRevision: null,
      publicationStatus: 'DIRTY',
    },
    {
      name: 'queued',
      status: ChatbotKnowledgeGraphStatus.QUEUED,
      builtRevision: null,
      publicationStatus: 'QUEUED',
    },
    {
      name: 'processing',
      status: ChatbotKnowledgeGraphStatus.PROCESSING,
      builtRevision: null,
      publicationStatus: 'PROCESSING',
    },
    {
      name: 'failed',
      status: ChatbotKnowledgeGraphStatus.FAILED,
      builtRevision: null,
      publicationStatus: 'FAILED',
    },
    {
      name: 'ready with a revision mismatch',
      status: ChatbotKnowledgeGraphStatus.READY,
      builtRevision: 0,
      publicationStatus: 'DIRTY',
    },
  ])(
    'does not call FalkorDB for a $name graph',
    async ({ name, status, builtRevision, publicationStatus }) => {
      const chatbot = await createChatbot(userOneCtx, `${name} assistant`)

      if (status === ChatbotKnowledgeGraphStatus.EMPTY) {
        await updateChatbotKnowledgeGraphResources(
          { chatbotId: chatbot.id, resourceIds: [] },
          userOneCtx
        )
      } else if (status !== null) {
        const { resource } = await createUrlResource(
          userOneCtx,
          `${name} KB`,
          `${name} resource`
        )
        const config = await updateChatbotKnowledgeGraphResources(
          { chatbotId: chatbot.id, resourceIds: [resource.id] },
          userOneCtx
        )
        await prisma.chatbotKnowledgeGraph.update({
          where: { id: config.id! },
          data: { status, builtRevision },
        })
      }

      await expect(
        getChatbotKnowledgeGraphOverview({ chatbotId: chatbot.id }, userOneCtx)
      ).rejects.toMatchObject({
        message: 'Knowledge graph is not published',
        extensions: {
          code: 'KNOWLEDGE_GRAPH_NOT_PUBLISHED',
          publicationStatus,
        },
      })
      expect(knowledgeGraph.readKnowledgeGraphOverview).not.toHaveBeenCalled()
    }
  )

  it('returns the reader DTO and propagates the published revision', async () => {
    const { chatbot, config, resource } = await createPublishedGraph(
      userOneCtx,
      'Published assistant'
    )
    const response = graphResponse(chatbot.id, config.selectionRevision)
    knowledgeGraph.readKnowledgeGraphOverview.mockResolvedValue(response)

    await expect(
      getChatbotKnowledgeGraphOverview({ chatbotId: chatbot.id }, userOneCtx)
    ).resolves.toEqual(response)
    expect(knowledgeGraph.readKnowledgeGraphOverview).toHaveBeenCalledWith({
      chatbotId: chatbot.id,
      builtRevision: config.selectionRevision,
      graphName: `klickeruzh:${chatbot.id}`,
      sources: [{ resourceId: resource.id, title: resource.title }],
    })
  })

  it('passes only bounded search and neighborhood arguments to fixed readers', async () => {
    const { chatbot, config } = await createPublishedGraph(
      userOneCtx,
      'Interactive assistant'
    )
    const response = graphResponse(chatbot.id, config.selectionRevision)
    knowledgeGraph.searchKnowledgeGraph.mockResolvedValue(response)
    knowledgeGraph.readKnowledgeGraphNeighbors.mockResolvedValue(response)

    await expect(
      searchChatbotKnowledgeGraph(
        { chatbotId: chatbot.id, query: 'Android security' },
        userOneCtx
      )
    ).resolves.toEqual(response)
    await expect(
      getChatbotKnowledgeGraphNeighbors(
        { chatbotId: chatbot.id, nodeId: '12' },
        userOneCtx
      )
    ).resolves.toEqual(response)

    const publishedContext = expect.objectContaining({
      chatbotId: chatbot.id,
      builtRevision: config.selectionRevision,
      graphName: `klickeruzh:${chatbot.id}`,
    })
    expect(knowledgeGraph.searchKnowledgeGraph).toHaveBeenCalledWith(
      publishedContext,
      'Android security'
    )
    expect(knowledgeGraph.readKnowledgeGraphNeighbors).toHaveBeenCalledWith(
      publishedContext,
      '12'
    )
  })

  it('sanitizes temporary FalkorDB failures without changing publication', async () => {
    const { chatbot, config } = await createPublishedGraph(
      userOneCtx,
      'Unavailable assistant'
    )
    knowledgeGraph.readKnowledgeGraphOverview.mockRejectedValue(
      new Error('redis://reader:secret@falkordb.internal/graph')
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      await expect(
        getChatbotKnowledgeGraphOverview({ chatbotId: chatbot.id }, userOneCtx)
      ).rejects.toMatchObject({
        message: 'Knowledge graph is temporarily unavailable',
        extensions: {
          code: 'KNOWLEDGE_GRAPH_TEMPORARILY_UNAVAILABLE',
        },
      })
      expect(consoleError).toHaveBeenCalledWith('Knowledge graph read failed', {
        chatbotId: chatbot.id,
        operation: 'overview',
      })
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret')
      await expect(
        prisma.chatbotKnowledgeGraph.findUniqueOrThrow({
          where: { id: config.id! },
        })
      ).resolves.toMatchObject({
        status: ChatbotKnowledgeGraphStatus.READY,
        selectionRevision: config.selectionRevision,
        builtRevision: config.selectionRevision,
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  it('rejects a graph build without selected resources', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [] },
      userOneCtx
    )
    const runNoWait = vi.spyOn(
      userOneCtx.tasks.buildChatbotKnowledgeGraph,
      'runNoWait'
    )

    await expect(
      rebuildChatbotKnowledgeGraph(
        { chatbotId: chatbot.id, speedMode: 'balanced' },
        userOneCtx
      )
    ).rejects.toThrow('Chatbot knowledge graph has no selected resources')
    expect(runNoWait).not.toHaveBeenCalled()
  })

  it('hides a foreign chatbot when a graph build is requested', async () => {
    const chatbot = await createChatbot(userTwoCtx, 'Foreign assistant')

    await expect(
      rebuildChatbotKnowledgeGraph(
        { chatbotId: chatbot.id, speedMode: 'balanced' },
        userOneCtx
      )
    ).rejects.toThrow('Chatbot not found')
  })

  it('claims a fresh attempt and dispatches a complete immutable snapshot', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const url = await createUrlResource(
      userOneCtx,
      'Reading list',
      'Public paper'
    )
    const blobKb = await createKb({ name: 'Lecture notes' }, userOneCtx)
    const blob = await prisma.kBResource.create({
      data: {
        kbId: blobKb.id,
        type: KBResourceType.BLOB,
        title: 'Private slides',
        blobName: 'slides/private.pdf',
        originalFilename: 'private.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      },
    })
    const selected = await updateChatbotKnowledgeGraphResources(
      {
        chatbotId: chatbot.id,
        resourceIds: [url.resource.id, blob.id],
      },
      userOneCtx
    )
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.buildChatbotKnowledgeGraph, 'runNoWait')
      .mockResolvedValue({} as never)

    const claimed = await rebuildChatbotKnowledgeGraph(
      { chatbotId: chatbot.id, speedMode: 'balanced' },
      userOneCtx
    )

    expect(claimed).toMatchObject({
      id: selected.id,
      status: ChatbotKnowledgeGraphStatus.QUEUED,
      selectionRevision: 1,
      activeBuildRevision: 1,
      lastBuildSpeedMode: KBIngestionSpeedMode.BALANCED,
      externalWorkflowRunId: null,
      externalStartedAt: null,
    })
    expect(claimed.activeAttemptId).not.toBeNull()
    expect(validateUuid(claimed.activeAttemptId!)).toBe(true)
    expect(runNoWait).toHaveBeenCalledOnce()
    const payload = runNoWait.mock.calls[0]![0] as unknown as {
      graphId: string
      chatbotId: string
      attemptId: string
      selectionRevision: number
      speedMode: APIKBIngestionSpeedMode
      resources: Array<Record<string, unknown>>
    }
    expect(payload).toMatchObject({
      graphId: selected.id,
      chatbotId: chatbot.id,
      attemptId: claimed.activeAttemptId,
      selectionRevision: 1,
      speedMode: 'balanced',
    })
    expect(payload.resources).toHaveLength(2)
    expect(payload.resources).toEqual(
      expect.arrayContaining([
        {
          resourceId: blob.id,
          title: blob.title,
          type: 'BLOB',
          blobName: 'slides/private.pdf',
          containerName: `kb-${userOneCtx.user.sub}`,
        },
        {
          resourceId: url.resource.id,
          title: url.resource.title,
          type: 'URL',
          sourceUrl: url.resource.sourceUrl,
        },
      ])
    )
  })

  it.each<{
    speedMode: APIKBIngestionSpeedMode
    storedMode: KBIngestionSpeedMode
  }>([
    { speedMode: 'balanced', storedMode: KBIngestionSpeedMode.BALANCED },
    { speedMode: 'quality', storedMode: KBIngestionSpeedMode.QUALITY },
    { speedMode: 'fast', storedMode: KBIngestionSpeedMode.FAST },
  ])(
    'claims and dispatches a $speedMode build',
    async ({ speedMode, storedMode }) => {
      const chatbot = await createChatbot(userOneCtx, 'Course assistant')
      const { resource } = await createUrlResource(
        userOneCtx,
        'Lecture notes',
        'Lecture 1'
      )
      await updateChatbotKnowledgeGraphResources(
        { chatbotId: chatbot.id, resourceIds: [resource.id] },
        userOneCtx
      )
      const runNoWait = vi
        .spyOn(userOneCtx.tasks.buildChatbotKnowledgeGraph, 'runNoWait')
        .mockResolvedValue({} as never)

      const claimed = await rebuildChatbotKnowledgeGraph(
        { chatbotId: chatbot.id, speedMode },
        userOneCtx
      )

      expect(claimed.lastBuildSpeedMode).toBe(storedMode)
      expect(runNoWait).toHaveBeenCalledWith(
        expect.objectContaining({ speedMode })
      )
    }
  )

  it('rejects a duplicate build while the first dispatch is pending', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [resource.id] },
      userOneCtx
    )
    const dispatchStarted = createDeferred()
    const finishDispatch = createDeferred<any>()
    vi.spyOn(
      userOneCtx.tasks.buildChatbotKnowledgeGraph,
      'runNoWait'
    ).mockImplementation(() => {
      dispatchStarted.resolve()
      return finishDispatch.promise
    })

    const firstBuild = rebuildChatbotKnowledgeGraph(
      { chatbotId: chatbot.id, speedMode: 'balanced' },
      userOneCtx
    )
    await dispatchStarted.promise
    await expect(
      rebuildChatbotKnowledgeGraph(
        { chatbotId: chatbot.id, speedMode: 'fast' },
        userOneCtx
      )
    ).rejects.toThrow('Chatbot knowledge graph build is already active')
    finishDispatch.resolve({})
    await expect(firstBuild).resolves.toMatchObject({
      status: ChatbotKnowledgeGraphStatus.QUEUED,
    })
  })

  it('marks the current revision FAILED when local dispatch rejects', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const { resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [resource.id] },
      userOneCtx
    )
    vi.spyOn(
      userOneCtx.tasks.buildChatbotKnowledgeGraph,
      'runNoWait'
    ).mockRejectedValue(new Error('private local Hatchet failure'))

    await expect(
      rebuildChatbotKnowledgeGraph(
        { chatbotId: chatbot.id, speedMode: 'balanced' },
        userOneCtx
      )
    ).rejects.toThrow('Chatbot knowledge graph build could not be queued')
    await expect(
      prisma.chatbotKnowledgeGraph.findUniqueOrThrow({
        where: { chatbotId: chatbot.id },
      })
    ).resolves.toMatchObject({
      status: ChatbotKnowledgeGraphStatus.FAILED,
      statusMessage: 'The knowledge graph build could not be queued.',
      selectionRevision: 1,
      activeAttemptId: null,
      activeBuildRevision: null,
    })
  })

  it('marks a newer selection DIRTY when its older local dispatch rejects', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const first = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    const second = await createUrlResource(
      userOneCtx,
      'Reading list',
      'Paper 1'
    )
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [first.resource.id] },
      userOneCtx
    )
    const dispatchStarted = createDeferred()
    const finishDispatch = createDeferred<any>()
    vi.spyOn(
      userOneCtx.tasks.buildChatbotKnowledgeGraph,
      'runNoWait'
    ).mockImplementation(() => {
      dispatchStarted.resolve()
      return finishDispatch.promise
    })

    const build = rebuildChatbotKnowledgeGraph(
      { chatbotId: chatbot.id, speedMode: 'quality' },
      userOneCtx
    )
    const rejectedBuild = expect(build).rejects.toThrow(
      'Chatbot knowledge graph build could not be queued'
    )
    await dispatchStarted.promise
    await updateChatbotKnowledgeGraphResources(
      {
        chatbotId: chatbot.id,
        resourceIds: [first.resource.id, second.resource.id],
      },
      userOneCtx
    )
    finishDispatch.reject(new Error('private local Hatchet failure'))
    await rejectedBuild

    await expect(
      prisma.chatbotKnowledgeGraph.findUniqueOrThrow({
        where: { chatbotId: chatbot.id },
      })
    ).resolves.toMatchObject({
      status: ChatbotKnowledgeGraphStatus.DIRTY,
      statusMessage: null,
      selectionRevision: 2,
      activeAttemptId: null,
      activeBuildRevision: null,
    })
  })

  it('rejects deletion of an assigned resource and its containing KB', async () => {
    const chatbot = await createChatbot(userOneCtx, 'Course assistant')
    const { kb, resource } = await createUrlResource(
      userOneCtx,
      'Lecture notes',
      'Lecture 1'
    )
    await updateChatbotKnowledgeGraphResources(
      { chatbotId: chatbot.id, resourceIds: [resource.id] },
      userOneCtx
    )

    await expect(
      deleteKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB resource cannot be deleted')
    await expect(deleteKb({ id: kb.id }, userOneCtx)).rejects.toThrow(
      'KB cannot be deleted'
    )
  })
})
