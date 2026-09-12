import { describe, expect, test } from 'vitest'

import { parseElearningAuthQuery } from '../src/app/auth/elearning/route'

const grant = 'eyJhbGciOiJIUzI1NiJ9.test.signature'
const courseId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const chatbotId = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const threadId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'

describe('eLearning auth query', () => {
  test('preserves the remembered thread for full-reload continuity', () => {
    const result = parseElearningAuthQuery(
      new URLSearchParams({
        grant,
        courseId,
        chatbotId,
        locale: 'de',
        threadId,
      })
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locale).toBe('de')
      expect(result.data.threadId).toBe(threadId)
    }
  })

  test('keeps threadId optional for a new conversation', () => {
    const result = parseElearningAuthQuery(
      new URLSearchParams({ grant, courseId, chatbotId })
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.threadId).toBeUndefined()
  })
})
