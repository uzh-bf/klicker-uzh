import { describe, expect, it, vi } from 'vitest'
import { PersistedGraphQLClient } from '../src/graphqlClient.js'

describe('PersistedGraphQLClient', () => {
  it('sends generated hash-only persisted operations', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ data: { studentMcpCoursePracticeQuiz: null } }),
        { status: 200 }
      )
    })

    const client = new PersistedGraphQLClient(
      'http://localhost:3000/api/graphql',
      fetchImpl as unknown as typeof fetch
    )

    await client.getCoursePracticeQuiz(
      { chatbotId: 'chatbot-1', courseId: 'course-1' },
      'participant-token'
    )

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]!
    const body = JSON.parse(String(init?.body))

    expect(body.operationName).toBe('GetCoursePracticeQuizWithoutSolutions')
    expect(body.query).toBeUndefined()
    expect(body.extensions.persistedQuery.sha256Hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
