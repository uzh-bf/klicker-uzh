import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  participant: vi.fn(),
  chatbot: vi.fn(),
  access: vi.fn(),
  publication: vi.fn(),
  hints: vi.fn(),
  flag: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    participant: { findUnique: mocks.participant },
    chatbot: { findUnique: mocks.chatbot },
  },
}))
vi.mock('@/src/lib/server/featureFlags', () => ({
  isChatbotGraphRetrievalEnabled: mocks.flag,
}))
vi.mock('@/src/lib/server/apiGuards', () => ({
  authorizeIdentityForChatbot: mocks.access,
}))
vi.mock('@/src/lib/server/knowledgeGraphRuntime', () => ({
  getPublishedKnowledgeGraph: mocks.publication,
  readKnowledgeGraphSearchHints: mocks.hints,
}))
vi.mock('@/src/lib/server/ltiGuest', () => ({
  GUEST_ACCOUNT_TYPE: 'lti_guest',
}))

import { graphQueryDependencies } from '../src/services/graphQueryScope'

const binding = {
  kbId: '00000000-0000-4000-8000-000000000001',
  kb: { knowledgeGraphEnabled: true },
}
const context = {
  chatbotId: 'bot-1',
  courseId: 'course-1',
  participantId: 'participant-1',
  authMode: 'account' as const,
  kbIds: ['00000000-0000-4000-8000-000000000001'],
}

const sharedId = '00000000-0000-4000-8000-000000000003'
const mcpConfigurations = [
  {
    chatMode: 'tutor',
    parameters: { required: true, toolAlias: 'doc_query', kb_id: binding.kbId },
    mcpServer: { id: 'kb-server', name: 'KB' },
  },
]

describe('graph document scope', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.flag.mockResolvedValue(true)
    mocks.participant.mockResolvedValue({ isActive: true, accounts: [] })
    mocks.access.mockResolvedValue({
      participantId: context.participantId,
      chatbot: { courseId: context.courseId },
    })
    mocks.chatbot.mockResolvedValue({
      mcpConfigurations,
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      knowledgeBases: [binding],
    })
    mocks.publication.mockResolvedValue({
      kbId: '00000000-0000-4000-8000-000000000001',
      buildId: 'build-1',
      graphName: 'private-graph',
      isStale: false,
      sources: [],
    })
    mocks.hints.mockResolvedValue(['Covariance'])
  })

  it('declines graph reads when the owner rollout is disabled or revoked', async () => {
    const dependencies = graphQueryDependencies(context)
    expect((await dependencies.validateScope()).enabled).toBe(true)
    expect(mocks.flag).toHaveBeenCalledWith('owner-1')
    mocks.flag.mockResolvedValue(false)
    mocks.publication.mockClear()
    expect((await dependencies.validateScope()).enabled).toBe(false)
    expect(await dependencies.hints('risk')).toEqual([])
    expect(mocks.publication).not.toHaveBeenCalled()
  })

  it('uses the publication from the authorized binding', async () => {
    const dependencies = graphQueryDependencies(context)
    expect(await dependencies.validateScope()).toEqual({
      enabled: true,
      buildId: 'build-1',
    })
    expect(await dependencies.hints('risk')).toEqual(['Covariance'])
    expect(mocks.hints).toHaveBeenCalledWith(
      expect.objectContaining({ graphName: 'private-graph' }),
      'risk'
    )
  })

  it('rejects binding replacement instead of narrowing the original transport', async () => {
    mocks.chatbot.mockResolvedValue({
      mcpConfigurations,
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      knowledgeBases: [
        { ...binding, kbId: '00000000-0000-4000-8000-000000000002' },
      ],
    })
    await expect(
      graphQueryDependencies(context).validateScope()
    ).rejects.toThrow('Required MCP tool is unavailable')
    expect(mocks.publication).not.toHaveBeenCalled()
  })

  it('rejects a chatbot moved outside the original course scope', async () => {
    mocks.access.mockResolvedValue({ chatbot: { courseId: 'course-2' } })
    await expect(
      graphQueryDependencies(context).validateScope()
    ).rejects.toThrow()
    expect(mocks.publication).not.toHaveBeenCalled()
  })

  it.each([
    { isActive: false, accounts: [] },
    { isActive: true, accounts: [{ type: 'lti_guest' }] },
    null,
  ])('rejects deactivated or incompatible identities', async (participant) => {
    mocks.participant.mockResolvedValue(participant)
    await expect(
      graphQueryDependencies(context).validateScope()
    ).rejects.toThrow()
    expect(mocks.publication).not.toHaveBeenCalled()
  })

  it('does not use a stale or unpublished graph', async () => {
    mocks.publication.mockResolvedValue({ buildId: 'old-build', isStale: true })
    const dependencies = graphQueryDependencies(context)
    expect(await dependencies.validateScope()).toEqual({
      enabled: false,
      buildId: undefined,
    })
    expect(await dependencies.hints('risk')).toEqual([])
    mocks.publication.mockRejectedValue(new Error('unpublished'))
    expect(await dependencies.validateScope()).toEqual({
      enabled: false,
      buildId: undefined,
    })
    expect(mocks.hints).not.toHaveBeenCalled()
  })

  it('retains document-only eligibility after the graph policy is disabled', async () => {
    mocks.chatbot.mockResolvedValue({
      mcpConfigurations,
      knowledgeGraphRetrievalEnabled: false,
      knowledgeBases: [binding],
    })
    expect(await graphQueryDependencies(context).validateScope()).toEqual({
      enabled: false,
    })
    expect(mocks.publication).not.toHaveBeenCalled()
  })
})

it.each([
  true,
  false,
])('retains authorized documents with shared grants (course: %s)', async (hasCourse) => {
  vi.resetAllMocks()
  mocks.flag.mockResolvedValue(true)
  const kbIds = hasCourse ? [binding.kbId, sharedId] : [sharedId]
  const parameters = {
    required: true,
    toolAlias: 'doc_query',
    shared_kb_ids: [sharedId],
    ...(hasCourse ? { kb_ids: kbIds } : { kb_id: sharedId }),
  }
  mocks.participant.mockResolvedValue({ isActive: true, accounts: [] })
  mocks.access.mockResolvedValue({ chatbot: { courseId: context.courseId } })
  mocks.chatbot.mockResolvedValue({
    knowledgeGraphRetrievalEnabled: true,
    ownerId: 'owner-1',
    knowledgeBases: hasCourse ? [binding] : [],
    mcpConfigurations: [{ ...mcpConfigurations[0], parameters }],
  })
  mocks.publication.mockClear()
  const dependencies = graphQueryDependencies({ ...context, kbIds })
  expect((await dependencies.validateScope()).enabled).toBe(false)
  expect(await dependencies.hints('query')).toEqual([])
  expect(mocks.publication).not.toHaveBeenCalled()
  mocks.chatbot.mockResolvedValue({
    knowledgeGraphRetrievalEnabled: true,
    ownerId: 'owner-1',
    knowledgeBases: [binding],
    mcpConfigurations,
  })
  await expect(dependencies.validateScope()).rejects.toThrow()
})
