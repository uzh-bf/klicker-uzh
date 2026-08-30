import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  findMessage: vi.fn(),
  getGenerationLeaseState: vi.fn(),
  listDiscardedCandidateIds: vi.fn(),
  createPersonalElements: vi.fn(),
  discardPersonalElementCandidate: vi.fn(),
  listSavedPersonalElementCandidateIds: vi.fn(),
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatMessage: { findFirst: mocks.findMessage },
  },
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  createPersonalElements: mocks.createPersonalElements,
  discardPersonalElementCandidate: mocks.discardPersonalElementCandidate,
  listSavedPersonalElementCandidateIds:
    mocks.listSavedPersonalElementCandidateIds,
  getGenerationLeaseState: mocks.getGenerationLeaseState,
  listDiscardedCandidateIds: mocks.listDiscardedCandidateIds,
}))

import {
  DELETE,
  GET,
  POST,
} from '../src/app/api/chatbots/[chatbotId]/personal-elements/route'

const chatbotId = '00000000-0000-0000-0000-000000000001'
const messageId = '00000000-0000-0000-0000-000000000002'
const toolCallId = 'generation-tool'

const candidate = {
  type: 'FLASHCARD',
  candidateId: 'candidate-1',
  name: 'Card',
  content: 'Front',
  explanation: 'Back',
  sources: [{ sourceId: 'source-1', chunkId: 'chunk-1' }],
  sourceMessageId: messageId,
  sourceToolCallId: toolCallId,
  origin: 'AI_GENERATED',
}

function request(
  method: 'POST' | 'DELETE',
  body: Record<string, unknown> = {}
) {
  return new NextRequest(
    `http://localhost/api/chatbots/${chatbotId}/personal-elements`,
    {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messageId,
        toolCallId,
        candidateId: candidate.candidateId,
        ...body,
      }),
    }
  )
}

function candidateMessage(
  result: Record<string, unknown> = {},
  ...extraParts: unknown[]
) {
  return {
    content: [
      {
        type: 'tool-call',
        toolCallId,
        toolName: 'generate_cards',
        result: {
          status: 'completed',
          completed: 1,
          total: 1,
          candidates: [candidate],
          ...result,
        },
      },
      ...extraParts,
    ],
  }
}

function terminalPartialCandidateMessage() {
  return candidateMessage({
    status: 'partial',
    completed: 2,
    total: 2,
    failedCards: [
      { candidateId: 'failed-candidate', code: 'generation_failed' },
    ],
  })
}

describe('personal-element candidate decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      chatbot: { courseId: 'course-1' },
    })
    mocks.findMessage.mockResolvedValue(candidateMessage())
    mocks.getGenerationLeaseState.mockResolvedValue({
      completedAt: new Date('2026-08-24T10:02:00.000Z'),
    })
    mocks.createPersonalElements.mockResolvedValue([
      { id: 'element-1', candidateId: candidate.candidateId },
    ])
    mocks.discardPersonalElementCandidate.mockResolvedValue({})
    mocks.listSavedPersonalElementCandidateIds.mockResolvedValue([])
    mocks.listDiscardedCandidateIds.mockResolvedValue([])
  })

  test.each([
    ['save', POST, 'POST' as const, 'saveable'],
    ['discard', DELETE, 'DELETE' as const, 'discardable'],
  ])('rejects %s after the persisted attempt failed', async (_, handler, method, adjective) => {
    mocks.findMessage.mockResolvedValue(
      candidateMessage({}, { type: 'data', name: 'chat-stopped', data: {} })
    )

    const response = await handler(request(method), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: `Candidate attempt is not ${adjective}`,
    })
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
    expect(mocks.discardPersonalElementCandidate).not.toHaveBeenCalled()
  })

  test('serializes one Save decision through the participant-scoped service', async () => {
    const response = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(200)
    expect(mocks.createPersonalElements).toHaveBeenCalledWith(
      {
        courseId: 'course-1',
        candidates: [
          expect.objectContaining({
            candidateId: candidate.candidateId,
            sourceMessageId: messageId,
            sourceToolCallId: toolCallId,
          }),
        ],
      },
      'participant-1'
    )
    expect(
      mocks.createPersonalElements.mock.calls[0]?.[0].candidates[0]
    ).not.toHaveProperty('type')
    expect(mocks.createPersonalElements.mock.calls[0]?.[1]).toBe(
      'participant-1'
    )
  })

  test('rejects the removed bulk Save payload', async () => {
    const response = await POST(
      request('POST', {
        candidateId: undefined,
        candidates: [{ candidateId: candidate.candidateId }],
      }),
      { params: Promise.resolve({ chatbotId }) }
    )

    expect(response.status).toBe(400)
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
  })

  test('serializes one Discard decision through the same service boundary', async () => {
    const response = await DELETE(request('DELETE'), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      courseId: 'course-1',
      candidateId: candidate.candidateId,
      discarded: true,
    })
    expect(mocks.discardPersonalElementCandidate).toHaveBeenCalledWith(
      { courseId: 'course-1', candidateId: candidate.candidateId },
      'participant-1'
    )
  })

  test.each([
    ['save', POST, 'POST' as const],
    ['discard', DELETE, 'DELETE' as const],
  ])('allows %s for a successful card from a terminal partial run', async (_, handler, method) => {
    mocks.findMessage.mockResolvedValue(terminalPartialCandidateMessage())
    mocks.getGenerationLeaseState.mockResolvedValue({ completedAt: null })

    const response = await handler(request(method), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(200)
  })

  test.each([
    ['save', POST, 'POST' as const],
    ['discard', DELETE, 'DELETE' as const],
  ])('allows %s for a partial card after a retry reclaims the lease', async (_, handler, method) => {
    mocks.findMessage.mockResolvedValue(
      candidateMessage({
        status: 'partial',
        completed: 2,
        total: 2,
        failedCards: [
          { candidateId: 'failed-candidate', code: 'generation_failed' },
        ],
        settlement: 'partial',
      })
    )
    mocks.getGenerationLeaseState.mockResolvedValue(null)

    const response = await handler(request(method), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getGenerationLeaseState).not.toHaveBeenCalled()
  })

  test('rejects a pending generation and an unsupported future type', async () => {
    mocks.findMessage.mockResolvedValueOnce(
      candidateMessage({ status: 'partial', completed: 1, total: 2 })
    )
    const pendingResponse = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })
    expect(pendingResponse.status).toBe(400)

    mocks.findMessage.mockResolvedValueOnce(
      candidateMessage({
        candidates: [{ ...candidate, type: 'MULTIPLE_CHOICE' }],
      })
    )
    const unsupportedResponse = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })
    expect(unsupportedResponse.status).toBe(400)
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
  })

  test('rejects persisted generation results above the shared card limit', async () => {
    mocks.findMessage.mockResolvedValue(
      candidateMessage({
        total: 6,
        candidates: Array.from({ length: 6 }, (_, index) => ({
          ...candidate,
          candidateId: `oversized-${index + 1}`,
        })),
      })
    )

    const response = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Candidate is not part of a completed generated result',
    })
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
  })

  test('rejects a retained candidate when its generation lease is incomplete', async () => {
    mocks.getGenerationLeaseState.mockResolvedValue(null)

    const response = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Candidate is not part of a completed generated result',
    })
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
    expect(mocks.getGenerationLeaseState).toHaveBeenCalledWith({
      participantId: 'participant-1',
      attemptToken: messageId,
    })
  })

  test.each([
    ['save', POST, 'POST' as const],
    ['discard', DELETE, 'DELETE' as const],
  ])('rejects %s when persisted candidate linkage differs', async (_, handler, method) => {
    mocks.findMessage.mockResolvedValue(
      candidateMessage({
        candidates: [
          { ...candidate, sourceToolCallId: 'different-generation-tool' },
        ],
      })
    )

    const response = await handler(request(method), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Candidate linkage does not match the generated message',
    })
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
    expect(mocks.discardPersonalElementCandidate).not.toHaveBeenCalled()
  })

  test('reloads decisions by stable course candidate identity', async () => {
    mocks.findMessage.mockResolvedValue(
      candidateMessage({
        candidates: [
          {
            candidateId: candidate.candidateId,
            sourceMessageId: messageId,
            sourceToolCallId: toolCallId,
            legacyPresentation: 'historical-card-shape',
          },
        ],
      })
    )
    mocks.listSavedPersonalElementCandidateIds.mockResolvedValue([
      candidate.candidateId,
    ])
    mocks.listDiscardedCandidateIds.mockResolvedValue([candidate.candidateId])

    const response = await GET(
      new NextRequest(
        `http://localhost/api/chatbots/${chatbotId}/personal-elements?messageId=${messageId}&toolCallId=${toolCallId}`
      ),
      { params: Promise.resolve({ chatbotId }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      courseId: 'course-1',
      elements: [{ candidateId: candidate.candidateId }],
      discardedCandidateIds: [candidate.candidateId],
    })
    expect(mocks.listSavedPersonalElementCandidateIds).toHaveBeenCalledWith(
      'course-1',
      [candidate.candidateId],
      'participant-1'
    )
    expect(mocks.listDiscardedCandidateIds).toHaveBeenCalledWith({
      participantId: 'participant-1',
      courseId: 'course-1',
      candidateIds: [candidate.candidateId],
    })
    expect(mocks.findMessage).toHaveBeenCalledWith({
      where: {
        id: messageId,
        role: 'assistant',
        thread: { participantId: 'participant-1', chatbotId },
      },
      select: { content: true },
    })
  })

  test('keeps GET pending until the generation attempt is durable', async () => {
    mocks.findMessage.mockResolvedValue(
      candidateMessage({ status: 'partial', completed: 0, total: 1 })
    )

    const response = await GET(
      new NextRequest(
        `http://localhost/api/chatbots/${chatbotId}/personal-elements?messageId=${messageId}&toolCallId=${toolCallId}`
      ),
      { params: Promise.resolve({ chatbotId }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Candidate decision state is not ready',
    })
    expect(mocks.listSavedPersonalElementCandidateIds).not.toHaveBeenCalled()
    expect(mocks.listDiscardedCandidateIds).not.toHaveBeenCalled()
  })

  test('maps the shared Save and Discard race conflicts', async () => {
    mocks.createPersonalElements.mockRejectedValueOnce(
      Object.assign(new Error('discarded'), {
        extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED' },
      })
    )
    const saveResponse = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })
    expect(saveResponse.status).toBe(409)

    mocks.discardPersonalElementCandidate.mockRejectedValueOnce(
      Object.assign(new Error('saved'), {
        extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_SAVED' },
      })
    )
    const discardResponse = await DELETE(request('DELETE'), {
      params: Promise.resolve({ chatbotId }),
    })
    expect(discardResponse.status).toBe(409)
  })

  test('returns authentication responses before participant data access', async () => {
    const authResponse = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
    mocks.withChatbotAuth.mockResolvedValueOnce({ response: authResponse })

    const response = await POST(request('POST'), {
      params: Promise.resolve({ chatbotId }),
    })

    expect(response).toBe(authResponse)
    expect(mocks.findMessage).not.toHaveBeenCalled()
    expect(mocks.createPersonalElements).not.toHaveBeenCalled()
  })
})
