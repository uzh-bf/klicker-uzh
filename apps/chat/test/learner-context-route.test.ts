import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  chatbotFindUnique: vi.fn(),
  resolveLearnerContext: vi.fn(),
  isLearnerMemoryConfigured: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { chatbot: { findUnique: mocks.chatbotFindUnique } },
}))
vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))
vi.mock('@/src/lib/server/learnerContext', () => ({
  resolveLearnerContext: mocks.resolveLearnerContext,
}))
vi.mock('@klicker-uzh/util/learner-memory', () => ({
  isLearnerMemoryConfigured: mocks.isLearnerMemoryConfigured,
}))
vi.mock('@/src/lib/server/learnerMemory', () => ({
  requestLearnerNotesDeletion: vi.fn(),
}))

const { GET } = await import(
  '@/src/app/api/chatbots/[chatbotId]/learner-context/route'
)

const CHATBOT_ID = '8d2f0f6e-6a53-4b6c-9a0b-3a3f6f1f6a10'
const COURSE_ID = '1c3f5a7b-9d2e-4f60-8a1b-2c3d4e5f6a7b'

function readView() {
  return GET(
    new NextRequest(
      `https://chat.example.test/api/chatbots/${CHATBOT_ID}/learner-context`
    ),
    { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
  )
}

describe("the student's view of the learner context", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      chatbot: { courseId: COURSE_ID },
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      personalizationEnabled: true,
      ownerId: 'owner-1',
    })
  })

  test('answers the guard response and resolves nothing when access is refused', async () => {
    mocks.withChatbotAuth.mockResolvedValue({
      response: new Response(null, { status: 403 }),
    })

    const response = await readView()

    expect(response.status).toBe(403)
    expect(mocks.resolveLearnerContext).not.toHaveBeenCalled()
  })

  test('resolves for the signed-in participant and the chatbot course in Tutor mode', async () => {
    mocks.resolveLearnerContext.mockResolvedValue({
      eligible: true,
      text: 'Synthetic summary',
      notes: 'not-available',
    })

    const response = await readView()

    expect(await response.json()).toMatchObject({
      active: true,
      text: 'Synthetic summary',
    })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.resolveLearnerContext).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'tutor',
        chatbotPersonalizationEnabled: true,
        chatbotOwnerId: 'owner-1',
        participantId: 'participant-1',
        courseId: COURSE_ID,
      }),
      'view'
    )
  })

  test('answers not found and resolves nothing for a missing chatbot', async () => {
    mocks.chatbotFindUnique.mockResolvedValue(null)

    const response = await readView()

    expect(response.status).toBe(404)
    expect(mocks.resolveLearnerContext).not.toHaveBeenCalled()
  })

  test('treats a switched off chatbot as not personalized', async () => {
    mocks.chatbotFindUnique.mockResolvedValue({
      personalizationEnabled: false,
      ownerId: 'owner-1',
    })
    mocks.resolveLearnerContext.mockResolvedValue({
      eligible: false,
      reason: 'chatbot-disabled',
    })

    const response = await readView()

    expect(await response.json()).toMatchObject({
      active: false,
      reason: 'chatbot-disabled',
    })
    expect(mocks.resolveLearnerContext).toHaveBeenCalledWith(
      expect.objectContaining({ chatbotPersonalizationEnabled: false }),
      'view'
    )
  })

  test.each([
    ['the lecturer switched personalization off', 'chatbot-disabled'],
    ['the student withdrew', 'no-consent'],
    ['the account notice awaits acknowledgement', 'notice-incomplete'],
  ])('keeps notes deletable when %s', async (_label, reason) => {
    mocks.isLearnerMemoryConfigured.mockReturnValue(true)
    mocks.resolveLearnerContext.mockResolvedValue({ eligible: false, reason })

    const response = await readView()

    expect(await response.json()).toMatchObject({
      active: false,
      notesDeletable: true,
    })
  })

  test('offers no deletion on a deployment without learner memory', async () => {
    mocks.isLearnerMemoryConfigured.mockReturnValue(false)
    mocks.resolveLearnerContext.mockResolvedValue({
      eligible: false,
      reason: 'chatbot-disabled',
    })

    const response = await readView()

    expect(await response.json()).toMatchObject({ notesDeletable: false })
  })

  test('answers a bounded error when the resolution fails', async () => {
    mocks.resolveLearnerContext.mockRejectedValue(new Error('synthetic'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await readView()

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'LEARNER_CONTEXT_UNAVAILABLE',
    })
  })
})
