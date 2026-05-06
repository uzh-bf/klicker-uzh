import { describe, expect, test } from 'vitest'

import {
  getOpenAIResponsesStore,
  parseOpenAIResponsesStore,
} from '../src/lib/server/openaiResponsesOptions'

describe('OpenAI Responses options', () => {
  test.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['TRUE', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['off', false],
    ['', false],
    [undefined, false],
    ['openrouter', false],
  ])('parses CHAT_OPENAI_STORE_RESPONSES=%s as %s', (value, expected) => {
    expect(parseOpenAIResponsesStore(value)).toBe(expected)
  })

  test('reads the chat-specific store flag from the environment', () => {
    const previousValue = process.env.CHAT_OPENAI_STORE_RESPONSES
    process.env.CHAT_OPENAI_STORE_RESPONSES = 'true'

    try {
      expect(getOpenAIResponsesStore()).toBe(true)
    } finally {
      if (previousValue === undefined) {
        delete process.env.CHAT_OPENAI_STORE_RESPONSES
      } else {
        process.env.CHAT_OPENAI_STORE_RESPONSES = previousValue
      }
    }
  })
})
