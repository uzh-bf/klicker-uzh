import { describe, expect, test } from 'vitest'
import { sanitizeChatLogContext } from '../src/lib/server/chatLogging'

describe('Chat diagnostic logging', () => {
  test('keeps allowlisted counts while dropping content-derived fields', () => {
    expect(
      sanitizeChatLogContext({
        requestId: 'request-1',
        messageCount: 2,
        userPromptLengthTotal: 42,
        userPromptHash: 'prompt-hash-canary',
        systemPromptHash: 'system-hash-canary',
        providerMessageHash: 'provider-hash-canary',
        raw: 'raw-provider-error-canary',
      })
    ).toEqual({
      requestId: 'request-1',
      messageCount: 2,
      userPromptLengthTotal: 42,
    })
  })

  test('limits nested diagnostics to sizes and token counts', () => {
    expect(
      sanitizeChatLogContext({
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          prompt: 'private-prompt',
        },
        toolDiagnostics: [
          {
            inputBytes: 12,
            outputBytes: 34,
            inputHash: 'input-hash-canary',
            outputHash: 'output-hash-canary',
          },
        ],
      })
    ).toEqual({
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      toolDiagnostics: [{ inputBytes: 12, outputBytes: 34 }],
    })
  })
})
