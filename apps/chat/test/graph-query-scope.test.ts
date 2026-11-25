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

const KB_ID = '35a72f62-a714-45f1-8b18-2cf5681b0c75'
const KB_ID_2 = '0b6c4c1a-9d3e-4f1e-9b0c-1d2e3f4a5b6c'
const LINK_ID = '4c1f2f0e-6d1a-4a56-9a2f-7d2b6f2f6f01'
const binding = {
  id: LINK_ID,
  kbId: KB_ID,
  isEnabled: true,
  isDefault: true,
  kb: {
    deletedAt: null,
    ownerId: 'owner-1',
    knowledgeGraphEnabled: true,
    name: 'Casebook',
  },
}
const configuration = {
  chatMode: 'tutor',
  isEnabled: true,
  allowedTools: ['doc_query'],
  parameters: { required: true, toolAlias: 'doc_query', kb_id: KB_ID },
  priority: 0,
  mcpServer: { id: 'kb-server', name: 'KB' },
}
const context = {
  chatbotId: 'bot-1',
  courseId: 'course-1',
  participantId: 'participant-1',
  authMode: 'account' as const,
  chatMode: 'tutor',
  kbIds: [KB_ID],
  kbLinkId: LINK_ID,
}

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
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      customModeConfig: null,
      knowledgeBases: [binding],
      mcpConfigurations: [configuration],
    })
    mocks.publication.mockResolvedValue({
      kbId: KB_ID,
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
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      customModeConfig: null,
      knowledgeBases: [{ ...binding, kbId: KB_ID_2 }],
      mcpConfigurations: [configuration],
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

  it('admits only the owner of an active chatbot in owner preview', async () => {
    const preview = {
      chatbotId: 'bot-1',
      authMode: 'account' as const,
      ownerPreviewUserId: 'owner-1',
      chatMode: 'tutor',
      kbIds: [KB_ID],
      kbLinkId: LINK_ID,
    }
    mocks.chatbot.mockResolvedValue({
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      status: 'PUBLISHED',
      customModeConfig: null,
      knowledgeBases: [binding],
      mcpConfigurations: [configuration],
    })
    expect(
      (await graphQueryDependencies(preview).validateScope()).enabled
    ).toBe(true)
    expect(mocks.participant).not.toHaveBeenCalled()
    expect(mocks.access).not.toHaveBeenCalled()

    for (const chatbot of [
      { ownerId: 'owner-2', status: 'PUBLISHED' },
      { ownerId: 'owner-1', status: 'PAUSED' },
    ]) {
      mocks.chatbot.mockResolvedValue({
        knowledgeGraphRetrievalEnabled: true,
        customModeConfig: null,
        knowledgeBases: [binding],
        mcpConfigurations: [configuration],
        ...chatbot,
      })
      await expect(
        graphQueryDependencies(preview).validateScope()
      ).rejects.toThrow()
    }
    await expect(
      graphQueryDependencies({
        ...preview,
        participantId: 'participant-1',
      }).validateScope()
    ).rejects.toThrow()
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
      knowledgeGraphRetrievalEnabled: false,
      ownerId: 'owner-1',
      customModeConfig: null,
      knowledgeBases: [binding],
      mcpConfigurations: [configuration],
    })
    expect(await graphQueryDependencies(context).validateScope()).toEqual({
      enabled: false,
    })
    expect(mocks.publication).not.toHaveBeenCalled()
  })
})
