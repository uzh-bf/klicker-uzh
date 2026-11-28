import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  requestLearnerNotesDeletion: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({ prisma: {} }))
vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))
vi.mock('@/src/lib/server/learnerMemory', () => ({
  requestLearnerNotesDeletion: mocks.requestLearnerNotesDeletion,
}))
vi.mock('@/src/lib/server/learnerContext', () => ({
  resolveLearnerContext: vi.fn(),
}))

const { DELETE } = await import(
  '@/src/app/api/chatbots/[chatbotId]/learner-context/route'
)

const CHATBOT_ID = '8d2f0f6e-6a53-4b6c-9a0b-3a3f6f1f6a10'
const COURSE_ID = '1c3f5a7b-9d2e-4f60-8a1b-2c3d4e5f6a7b'

function deleteNotes() {
  return DELETE(
    new NextRequest(
      `https://chat.example.test/api/chatbots/${CHATBOT_ID}/learner-context`,
      { method: 'DELETE' }
    ),
    { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
  )
}

describe('deleting learning notes through the chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('stays possible while the account notice awaits a new acknowledgement', async () => {
    // The guard refuses an incomplete account unless the route opts in.
    mocks.withChatbotAuth.mockImplementation(
      async (_req: unknown, _id: string, options?: Record<string, unknown>) =>
        options?.allowIncompleteDataUse
          ? { participantId: 'participant-1', chatbot: { courseId: COURSE_ID } }
          : { response: new Response(null, { status: 403 }) }
    )
    mocks.requestLearnerNotesDeletion.mockResolvedValue('deleted')

    const response = await deleteNotes()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'deleted' })
    expect(mocks.requestLearnerNotesDeletion).toHaveBeenCalledWith({
      participantId: 'participant-1',
      courseId: COURSE_ID,
    })
  })

  test('answers the guard response and deletes nothing when access is refused', async () => {
    mocks.withChatbotAuth.mockResolvedValue({
      response: new Response(null, { status: 401 }),
    })

    const response = await deleteNotes()

    expect(response.status).toBe(401)
    expect(mocks.requestLearnerNotesDeletion).not.toHaveBeenCalled()
  })
})
