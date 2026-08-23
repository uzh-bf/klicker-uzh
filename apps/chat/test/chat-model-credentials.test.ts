import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  getModel,
  resolveModelCredential,
} from '@/src/lib/server/chatModelCredentials'
import type { ChatModelConfig } from '@/src/lib/server/chatModelRegistry'

const modelConfig = {
  deploymentId: 'gpt-test',
  usesResponsesApi: false,
} as ChatModelConfig

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('chat model credential resolution', () => {
  test('a platform credential cannot be sent to a chatbot-controlled endpoint', () => {
    vi.stubEnv('OPENAI_API_KEY', 'platform-key')
    vi.stubEnv('OPENAI_BASE_URL', 'https://platform.example/v1')

    expect(() =>
      resolveModelCredential({
        id: 'chatbot-1',
        openaiApiKey: null,
        openaiBaseUrl: 'https://attacker.example/v1',
      })
    ).toThrowError(/custom base URL without its own API key/)
  })

  test('a custom key uses its own endpoint or the platform endpoint only', () => {
    vi.stubEnv('OPENAI_API_KEY', 'platform-key')
    vi.stubEnv('OPENAI_BASE_URL', 'https://platform.example/v1')

    const withOwnEndpoint = resolveModelCredential({
      id: 'chatbot-2',
      openaiApiKey: 'encrypted-custom-key',
      openaiBaseUrl: 'https://custom.example/v1',
    })
    expect(withOwnEndpoint).toEqual({
      kind: 'custom',
      // safeDecrypt passes through values without an encrypted-format prefix
      apiKey: 'encrypted-custom-key',
      baseUrl: 'https://custom.example/v1',
    })

    const withPlatformEndpoint = resolveModelCredential({
      id: 'chatbot-3',
      openaiApiKey: 'encrypted-custom-key',
      openaiBaseUrl: null,
    })
    expect(withPlatformEndpoint).toEqual({
      kind: 'custom',
      apiKey: 'encrypted-custom-key',
      baseUrl: 'https://platform.example/v1',
    })
  })

  test('the default path uses only platform state', () => {
    vi.stubEnv('OPENAI_API_KEY', 'platform-key')
    vi.stubEnv('OPENAI_BASE_URL', 'https://platform.example/v1')

    expect(
      resolveModelCredential({
        id: 'chatbot-4',
        openaiApiKey: null,
        openaiBaseUrl: null,
      })
    ).toEqual({
      kind: 'default',
      baseUrl: 'https://platform.example/v1',
    })
  })

  test('getModel preserves the routing contract after credential extraction', () => {
    vi.stubEnv('OPENAI_API_KEY', 'platform-key')
    vi.stubEnv('OPENAI_BASE_URL', 'https://platform.example/v1')

    const { routing } = getModel(
      {
        id: 'chatbot-5',
        openaiApiKey: null,
        openaiBaseUrl: null,
      } as never,
      modelConfig
    )
    expect(routing.source).toBe('default')
    expect(routing.hasCustomKey).toBe(false)
    expect(routing.baseUrl).toBe('https://platform.example/v1')
  })
})
