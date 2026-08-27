import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  getOwnerPreviewAccess,
  withOwnerPreviewAuth,
} from '../src/lib/server/ownerPreviewAuth'

const owner = {
  catalyst: true,
  role: 'USER' as const,
  scope: 'ACCOUNT_OWNER',
  sub: 'owner-id',
}

function dependencies({
  chatbotOwnerId = owner.sub,
  chatbotStatus = ChatbotStatus.DRAFT,
  user = owner,
}: {
  chatbotOwnerId?: string
  chatbotStatus?: ChatbotStatus
  user?: typeof owner | null
} = {}) {
  return {
    getManageUser: vi.fn().mockResolvedValue(user),
    findChatbot: vi.fn().mockResolvedValue({
      ownerId: chatbotOwnerId,
      status: chatbotStatus,
    }),
  }
}

describe('withOwnerPreviewAuth', () => {
  it.each([
    'ACCOUNT_OWNER',
    'FULL_ACCESS',
  ])('allows the current owner with %s scope', async (scope) => {
    const deps = dependencies({ user: { ...owner, scope } })

    await expect(withOwnerPreviewAuth('chatbot-id', deps)).resolves.toEqual({
      userId: owner.sub,
      scope,
    })
  })

  it('rejects a missing Manage session before looking up the chatbot', async () => {
    const deps = dependencies({ user: null })

    const result = await withOwnerPreviewAuth('chatbot-id', deps)

    expect('response' in result && result.response.status).toBe(401)
    expect(deps.findChatbot).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    'READ_ONLY',
    'SESSION_EXEC',
    'OTP',
  ])('rejects non-authoring scope %s', async (scope) => {
    const deps = dependencies({
      user: { ...owner, scope } as typeof owner,
    })

    const result = await withOwnerPreviewAuth('chatbot-id', deps)

    expect('response' in result && result.response.status).toBe(403)
    expect(deps.findChatbot).not.toHaveBeenCalled()
  })

  it('rejects a different chatbot owner', async () => {
    const result = await withOwnerPreviewAuth(
      'chatbot-id',
      dependencies({ chatbotOwnerId: 'different-owner' })
    )

    expect('response' in result && result.response.status).toBe(403)
  })

  it('rejects an operator-paused chatbot', async () => {
    const result = await withOwnerPreviewAuth(
      'chatbot-id',
      dependencies({ chatbotStatus: ChatbotStatus.PAUSED })
    )

    expect('response' in result && result.response.status).toBe(403)
  })

  it('exposes a page-safe unauthorized result without a response object', async () => {
    await expect(
      getOwnerPreviewAccess('chatbot-id', dependencies({ user: null }))
    ).resolves.toEqual({ error: 'UNAUTHORIZED' })
  })
})
