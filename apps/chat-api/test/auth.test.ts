import { afterEach, describe, expect, test } from 'vitest'
import { authenticateParticipant } from '../src/runtime/auth.js'

const originalAppSecret = process.env.APP_SECRET

afterEach(() => {
  if (originalAppSecret === undefined) delete process.env.APP_SECRET
  else process.env.APP_SECRET = originalAppSecret
})

describe('chat-api authentication configuration', () => {
  test('fails closed when APP_SECRET is missing', async () => {
    delete process.env.APP_SECRET

    await expect(
      authenticateParticipant('not-a-valid-token', 'not-a-chatbot-id')
    ).resolves.toEqual({
      error: 'Authentication is not configured',
      status: 500,
    })
  })
})
