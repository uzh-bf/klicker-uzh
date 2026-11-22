import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ENV_KEYS = ['APP_SECRET', 'NODE_ENV'] as const

const originalEnv: Partial<
  Record<(typeof ENV_KEYS)[number], string | undefined>
> = {}

beforeAll(() => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k]
  process.env.APP_SECRET = 'test-app-secret'
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
})

afterAll(() => {
  for (const k of ENV_KEYS) {
    const env = process.env as Record<string, string | undefined>
    if (originalEnv[k] === undefined) {
      delete env[k]
    } else {
      env[k] = originalEnv[k]
    }
  }
})

describe('PWA embed auth', () => {
  it('verifies PWA exchange tokens with scoped claims', async () => {
    const { signJWT } = await import('@klicker-uzh/util')
    const { PWA_CHAT_EMBED_EXCHANGE_SCOPE } = await import(
      '@/src/lib/pwaEmbedAuth'
    )
    const { verifyPwaEmbedExchangeToken } = await import(
      '@/src/lib/server/pwaEmbed'
    )

    const token = await signJWT(
      {
        sub: 'participant-uuid',
        scope: PWA_CHAT_EMBED_EXCHANGE_SCOPE,
        chatbotId: '11111111-1111-1111-1111-111111111111',
        cookiesAvailable: false,
        courseId: '22222222-2222-2222-2222-222222222222',
      },
      process.env.APP_SECRET as string,
      { algorithm: 'HS256', expiresIn: '2m' }
    )

    const payload = await verifyPwaEmbedExchangeToken(token)
    expect(payload.sub).toBe('participant-uuid')
    expect(payload.chatbotId).toBe('11111111-1111-1111-1111-111111111111')
    expect(payload.courseId).toBe('22222222-2222-2222-2222-222222222222')
    expect(payload.cookiesAvailable).toBe(false)
  })

  it.each([
    'not-an-id',
    '11111111-1111-1111-1111-11111111111z',
  ])('rejects malformed chatbot identifiers in signed exchange tokens: %s', async (chatbotId) => {
    const { signJWT } = await import('@klicker-uzh/util')
    const { PWA_CHAT_EMBED_EXCHANGE_SCOPE } = await import(
      '@/src/lib/pwaEmbedAuth'
    )
    const { verifyPwaEmbedExchangeToken } = await import(
      '@/src/lib/server/pwaEmbed'
    )
    const token = await signJWT(
      {
        sub: 'synthetic-participant',
        scope: PWA_CHAT_EMBED_EXCHANGE_SCOPE,
        chatbotId,
        cookiesAvailable: false,
        courseId: '22222222-2222-2222-2222-222222222222',
      },
      process.env.APP_SECRET as string,
      { algorithm: 'HS256', expiresIn: '2m' }
    )
    await expect(verifyPwaEmbedExchangeToken(token)).rejects.toBeDefined()
  })

  it('rejects exchange tokens with the wrong scope', async () => {
    const { signJWT } = await import('@klicker-uzh/util')
    const { verifyPwaEmbedExchangeToken } = await import(
      '@/src/lib/server/pwaEmbed'
    )

    const token = await signJWT(
      {
        sub: 'participant-uuid',
        scope: 'CHAT_GUEST',
        chatbotId: '11111111-1111-1111-1111-111111111111',
        cookiesAvailable: false,
        courseId: '22222222-2222-2222-2222-222222222222',
      },
      process.env.APP_SECRET as string,
      { algorithm: 'HS256', expiresIn: '2m' }
    )

    await expect(verifyPwaEmbedExchangeToken(token)).rejects.toBeDefined()
  })

  it('signs and verifies scoped PWA embed session tokens', async () => {
    const { signPwaEmbedSessionToken, verifyPwaEmbedSessionToken } =
      await import('@/src/lib/server/pwaEmbed')

    const token = await signPwaEmbedSessionToken({
      participantId: 'participant-uuid',
      chatbotId: '11111111-1111-1111-1111-111111111111',
      courseId: '22222222-2222-2222-2222-222222222222',
    })
    const payload = await verifyPwaEmbedSessionToken(token)

    expect(payload.sub).toBe('participant-uuid')
    expect(payload.chatbotId).toBe('11111111-1111-1111-1111-111111111111')
    expect(payload.courseId).toBe('22222222-2222-2222-2222-222222222222')
    expect(payload.scope).toBe('PWA_CHAT_EMBED_SESSION')
  })

  it('keeps new-tab handoff tokens and session tokens apart', async () => {
    const {
      signChatTabHandoffToken,
      signPwaEmbedSessionToken,
      verifyChatTabHandoffToken,
      verifyPwaEmbedSessionToken,
    } = await import('@/src/lib/server/pwaEmbed')
    const ids = {
      participantId: 'participant-uuid',
      chatbotId: '11111111-1111-1111-1111-111111111111',
      courseId: '22222222-2222-2222-2222-222222222222',
    }

    const handoff = await signChatTabHandoffToken({ ...ids, kind: 'guest' })
    expect(await verifyChatTabHandoffToken(handoff)).toMatchObject({
      sub: ids.participantId,
      kind: 'guest',
      chatbotId: ids.chatbotId,
    })
    // A leaked handoff URL must not work as a chat session, and a session
    // token must not be replayable as a handoff.
    await expect(verifyPwaEmbedSessionToken(handoff)).rejects.toBeDefined()
    await expect(
      verifyChatTabHandoffToken(await signPwaEmbedSessionToken(ids))
    ).rejects.toBeDefined()
  })

  it('rejects expired new-tab handoff tokens', async () => {
    const { signJWT } = await import('@klicker-uzh/util')
    const { CHAT_TAB_HANDOFF_SCOPE } = await import('@/src/lib/pwaEmbedAuth')
    const { verifyChatTabHandoffToken } = await import(
      '@/src/lib/server/pwaEmbed'
    )
    const token = await signJWT(
      {
        sub: 'participant-uuid',
        scope: CHAT_TAB_HANDOFF_SCOPE,
        kind: 'account',
        chatbotId: '11111111-1111-1111-1111-111111111111',
        courseId: '22222222-2222-2222-2222-222222222222',
      },
      process.env.APP_SECRET as string,
      {
        algorithm: 'HS256',
        issuedAt: new Date(Date.now() - 5 * 60_000),
        expiresIn: Math.floor(Date.now() / 1000) - 120,
      }
    )
    await expect(verifyChatTabHandoffToken(token)).rejects.toBeDefined()
  })
})
