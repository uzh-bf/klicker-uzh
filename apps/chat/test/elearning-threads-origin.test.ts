import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  createThread: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@/src/services/threads', () => ({
  ThreadService: {
    createThread: mocks.createThread,
  },
}))

import { POST } from '../src/app/api/chatbots/[chatbotId]/threads/route'

const CHATBOT_ID = 'chatbot-1'

function createRequest(body: Record<string, unknown>) {
  return new NextRequest(
    `http://localhost/api/chatbots/${CHATBOT_ID}/threads`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

const params = { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.withChatbotAuth.mockResolvedValue({
    participantId: 'participant-1',
    authMode: 'account',
    learnerBinding: 'binding-1',
    chatbot: { courseId: 'course-1' },
  })
  mocks.createThread.mockResolvedValue({ id: 'thread-1' })
})

describe('threads route eLearning origin', () => {
  test('tags a scoped eLearning session thread from the learner binding', async () => {
    const response = await POST(createRequest({ title: 'Intro' }), params)

    expect(response.status).toBe(200)
    expect(mocks.createThread).toHaveBeenCalledWith(
      'participant-1',
      CHATBOT_ID,
      'Intro',
      undefined,
      'elearning'
    )
  })

  test('does not let a client label claim the origin without the binding', async () => {
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      authMode: 'account',
      learnerBinding: null,
      chatbot: { courseId: 'course-1' },
    })

    await POST(createRequest({ title: 'Intro', origin: 'elearning' }), params)

    expect(mocks.createThread).toHaveBeenCalledWith(
      'participant-1',
      CHATBOT_ID,
      'Intro',
      undefined,
      undefined
    )
  })

  test('returns the guard response when the session is not authorized', async () => {
    const refusal = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
    mocks.withChatbotAuth.mockResolvedValue({ response: refusal })

    const response = await POST(createRequest({ title: 'Intro' }), params)

    expect(response.status).toBe(401)
    expect(mocks.createThread).not.toHaveBeenCalled()
  })
})
