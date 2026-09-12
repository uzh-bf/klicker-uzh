import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  participationFindUnique: vi.fn(),
  jwtVerify: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: {
      findUnique: mocks.findUnique,
    },
    participation: {
      findUnique: mocks.participationFindUnique,
    },
  },
}))

vi.mock('jose', () => ({
  jwtVerify: mocks.jwtVerify,
}))

import {
  getChatbotOr404,
  withChatbotTokenAuth,
} from '../src/lib/server/apiGuards'

// A syntactically valid UUID so the guard proceeds to the DB lookup.
const VALID_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

describe('getChatbotOr404 publication gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: 'participant-1' } })
    mocks.participationFindUnique.mockResolvedValue({ isActive: false })
  })

  test('returns the chatbot when it is PUBLISHED', async () => {
    mocks.findUnique.mockResolvedValue({
      courseId: 'course-1',
      status: 'PUBLISHED',
    })

    const result = await getChatbotOr404(VALID_ID, { courseId: true })

    expect('chatbot' in result).toBe(true)
    if ('chatbot' in result) {
      expect(result.chatbot).toMatchObject({ courseId: 'course-1' })
      // The guard-only status field is stripped from the returned chatbot when
      // the caller did not select it, so wholesale-serialized participant
      // responses never leak owner-only lifecycle metadata (F7).
      expect(result.chatbot).not.toHaveProperty('status')
    }
    // `status` is always requested on top of the caller's projection so the one
    // guard can enforce publication for every participant route.
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ courseId: true, status: true }),
      })
    )
  })

  test('does not return guard-only status when the caller disables status', async () => {
    mocks.findUnique.mockResolvedValue({
      courseId: 'course-1',
      status: 'PUBLISHED',
    })

    const result = await getChatbotOr404(VALID_ID, {
      courseId: true,
      status: false,
    })

    expect('chatbot' in result).toBe(true)
    if ('chatbot' in result) {
      expect(result.chatbot).toMatchObject({ courseId: 'course-1' })
      expect(result.chatbot).not.toHaveProperty('status')
    }
  })

  // Every non-PUBLISHED lifecycle state must 404 exactly like a missing bot, so
  // a participant can never confirm that a draft/in-review/paused bot exists.
  test.each([
    'DRAFT',
    'PENDING_APPROVAL',
    'PAUSED',
    'REJECTED',
  ])('returns 404 for a non-PUBLISHED (%s) chatbot', async (status) => {
    mocks.findUnique.mockResolvedValue({ courseId: 'course-1', status })

    const result = await getChatbotOr404(VALID_ID, { courseId: true })

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(404)
    }
  })

  test('returns 404 when the chatbot does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null)

    const result = await getChatbotOr404(VALID_ID, { courseId: true })

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(404)
    }
  })

  test('returns 404 for a malformed chatbot id without hitting the DB', async () => {
    const result = await getChatbotOr404('not-a-uuid', { courseId: true })

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(404)
    }
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  test('authorizes an inactive participation because isActive is not access control', async () => {
    mocks.findUnique.mockResolvedValue({
      courseId: 'course-1',
      status: 'PUBLISHED',
    })

    const result = await withChatbotTokenAuth('valid-token', VALID_ID)

    expect(result).toMatchObject({
      participantId: 'participant-1',
      chatbot: { courseId: 'course-1' },
    })
    expect(mocks.participationFindUnique).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      select: { id: true },
    })
  })

  test('rejects a participant without a participation row', async () => {
    mocks.findUnique.mockResolvedValue({
      courseId: 'course-1',
      status: 'PUBLISHED',
    })
    mocks.participationFindUnique.mockResolvedValue(null)

    const result = await withChatbotTokenAuth('valid-token', VALID_ID)

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(403)
    }
  })

  test('rejects a missing participant token before database access', async () => {
    const result = await withChatbotTokenAuth(undefined, VALID_ID)

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
    }
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.participationFindUnique).not.toHaveBeenCalled()
  })

  test('rejects an invalid participant token before database access', async () => {
    mocks.jwtVerify.mockRejectedValue(new Error('invalid token'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const result = await withChatbotTokenAuth('invalid-token', VALID_ID)

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
    }
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.participationFindUnique).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
