import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  participant: vi.fn(),
  chatbot: vi.fn(),
  access: vi.fn(),
  publication: vi.fn(),
  hints: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    participant: { findUnique: mocks.participant },
    chatbot: { findUnique: mocks.chatbot },
  },
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

const binding = { kbId: 'kb-1', kb: { knowledgeGraphEnabled: true } }
const context = {
  chatbotId: 'bot-1',
  courseId: 'course-1',
  participantId: 'participant-1',
  authMode: 'account' as const,
  kbIds: ['kb-1'],
}

describe('graph document scope', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.participant.mockResolvedValue({ isActive: true, accounts: [] })
    mocks.access.mockResolvedValue({
      participantId: context.participantId,
      chatbot: { courseId: context.courseId },
    })
    mocks.chatbot.mockResolvedValue({
      knowledgeGraphRetrievalEnabled: true,
      knowledgeBases: [binding],
    })
    mocks.publication.mockResolvedValue({
      kbId: 'kb-1',
      buildId: 'build-1',
      graphName: 'private-graph',
      isStale: false,
      sources: [],
    })
    mocks.hints.mockResolvedValue(['Covariance'])
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
      knowledgeBases: [{ ...binding, kbId: 'kb-2' }],
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
      knowledgeGraphRetrievalEnabled: false,
      knowledgeBases: [binding],
    })
    expect(await graphQueryDependencies(context).validateScope()).toEqual({
      enabled: false,
    })
    expect(mocks.publication).not.toHaveBeenCalled()
  })
})
