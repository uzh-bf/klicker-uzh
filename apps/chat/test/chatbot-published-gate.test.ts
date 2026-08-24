import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: {
      findUnique: mocks.findUnique,
    },
  },
}))

import { getChatbotOr404 } from '../src/lib/server/apiGuards'

// A syntactically valid UUID so the guard proceeds to the DB lookup.
const VALID_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'

describe('getChatbotOr404 publication gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
