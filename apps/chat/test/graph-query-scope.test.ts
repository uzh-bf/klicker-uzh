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

const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2bf63'
const binding = {
  kbId: KB_ID,
  kb: { ownerId: 'owner-1', knowledgeGraphEnabled: true },
}
const context = {
  chatbotId: 'bot-1',
  courseId: 'course-1',
  participantId: 'participant-1',
  authMode: 'account' as const,
  kbIds: [KB_ID],
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
      courseId: context.courseId,
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      knowledgeBases: [binding],
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
      courseId: context.courseId,
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      knowledgeBases: [
        { ...binding, kbId: 'd34fc8c9-c798-4805-b9e1-f5420e6dad4d' },
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

  it('admits only the owner of an active chatbot in owner preview', async () => {
    const preview = {
      chatbotId: 'bot-1',
      authMode: 'account' as const,
      ownerPreviewUserId: 'owner-1',
      kbIds: [KB_ID],
    }
    mocks.chatbot.mockResolvedValue({
      courseId: context.courseId,
      knowledgeGraphRetrievalEnabled: true,
      ownerId: 'owner-1',
      status: 'PUBLISHED',
      knowledgeBases: [binding],
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
        courseId: context.courseId,
        knowledgeGraphRetrievalEnabled: true,
        knowledgeBases: [binding],
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
      courseId: context.courseId,
      ownerId: 'owner-1',
      knowledgeGraphRetrievalEnabled: false,
      knowledgeBases: [binding],
    })
    expect(await graphQueryDependencies(context).validateScope()).toEqual({
      enabled: false,
    })
    expect(mocks.publication).not.toHaveBeenCalled()
  })
})
