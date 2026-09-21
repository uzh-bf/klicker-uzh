import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  loadChatDataUseState: vi.fn(),
  completeParticipantDataUse: vi.fn(),
  updateParticipantDataUseChoice: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({ prisma: { participant: {} } }))

vi.mock('@klicker-uzh/graphql/dist/participant-data-use', () => ({
  completeParticipantDataUse: mocks.completeParticipantDataUse,
  updateParticipantDataUseChoice: mocks.updateParticipantDataUseChoice,
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
  loadChatDataUseState: mocks.loadChatDataUseState,
}))

import {
  GET,
  PATCH,
  POST,
} from '../src/app/api/chatbots/[chatbotId]/data-use/route'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const participantId = 'participant-1'

const incompleteState = {
  complete: false,
  dataUseRevision: 0,
  researchConsent: false,
  researchChoiceRecorded: false,
  learningAnalyticsConsent: false,
  learningAnalyticsChoiceRecorded: false,
}

function request(method: string, body?: unknown) {
  return new NextRequest(
    `https://chat.test/api/chatbots/${CHATBOT_ID}/data-use`,
    {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    }
  )
}

function params() {
  return Promise.resolve({ chatbotId: CHATBOT_ID })
}

function revisionError(code: string) {
  const error = new Error(code) as Error & {
    extensions?: { code: string }
  }
  error.extensions = { code }
  return error
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.withChatbotAuth.mockResolvedValue({
    participantId,
    authMode: 'account',
    chatbot: { courseId: 'course-1', knowledgeGraphVisible: true },
  })
  mocks.loadChatDataUseState.mockResolvedValue(incompleteState)
})

describe('chat participant data-use route', () => {
  test('reads the stored state while the account is still incomplete', async () => {
    const response = await GET(request('GET'), { params: params() })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.withChatbotAuth).toHaveBeenCalledWith(
      expect.anything(),
      CHATBOT_ID,
      { allowIncompleteDataUse: true }
    )
    expect(mocks.loadChatDataUseState).toHaveBeenCalledWith(participantId)
    expect(body).toMatchObject({
      state: incompleteState,
      authMode: 'account',
    })
    expect(typeof body.currentDisclosureVersion).toBe('string')
  })

  test('short-circuits when the shared guard rejects the request', async () => {
    mocks.withChatbotAuth.mockResolvedValue({
      response: Response.json({ error: 'No participation' }, { status: 403 }),
    })

    const response = await GET(request('GET'), { params: params() })

    expect(response.status).toBe(403)
    expect(mocks.loadChatDataUseState).not.toHaveBeenCalled()
  })

  test('records the acknowledgement with both choices and the server-owned version', async () => {
    mocks.completeParticipantDataUse.mockResolvedValue({ id: participantId })
    mocks.loadChatDataUseState.mockResolvedValue({
      ...incompleteState,
      complete: true,
      dataUseRevision: 1,
      researchConsent: true,
      researchChoiceRecorded: true,
      learningAnalyticsChoiceRecorded: true,
    })

    const response = await POST(
      request('POST', {
        expectedRevision: 0,
        // A client-supplied version must never reach the writer.
        disclosureVersion: '1999-01-01',
        researchConsent: true,
        learningAnalyticsConsent: false,
        acknowledged: true,
      }),
      { params: params() }
    )

    expect(response.status).toBe(200)
    const [input, context] = mocks.completeParticipantDataUse.mock.calls[0]
    expect(input).toMatchObject({
      expectedRevision: 0,
      researchConsent: true,
      learningAnalyticsConsent: false,
      acknowledged: true,
    })
    expect(input.disclosureVersion).not.toBe('1999-01-01')
    expect(context.user).toEqual({
      sub: participantId,
      role: 'PARTICIPANT',
    })
    expect((await response.json()).state.complete).toBe(true)
  })

  test('reports a conflicting revision instead of overwriting it', async () => {
    mocks.completeParticipantDataUse.mockRejectedValue(
      revisionError('PARTICIPANT_DATA_USE_STALE_REVISION')
    )

    const response = await POST(
      request('POST', {
        expectedRevision: 0,
        researchConsent: true,
        learningAnalyticsConsent: false,
        acknowledged: true,
      }),
      { params: params() }
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'PARTICIPANT_DATA_USE_STALE_REVISION',
    })
  })

  test('updates a single purpose and rejects an unknown purpose', async () => {
    mocks.updateParticipantDataUseChoice.mockResolvedValue({
      id: participantId,
    })

    const accepted = await PATCH(
      request('PATCH', {
        purpose: 'analytics',
        consent: true,
        expectedRevision: 1,
      }),
      { params: params() }
    )
    expect(accepted.status).toBe(200)
    expect(mocks.updateParticipantDataUseChoice).toHaveBeenCalledWith(
      'analytics',
      expect.objectContaining({ consent: true, expectedRevision: 1 }),
      expect.objectContaining({
        user: { sub: participantId, role: 'PARTICIPANT' },
      })
    )

    const rejected = await PATCH(
      request('PATCH', { purpose: 'marketing', consent: true }),
      { params: params() }
    )
    expect(rejected.status).toBe(400)
  })

  test('rejects a malformed body as invalid input', async () => {
    const malformed = new NextRequest(
      `https://chat.test/api/chatbots/${CHATBOT_ID}/data-use`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }
    )

    const response = await PATCH(malformed, { params: params() })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'PARTICIPANT_DATA_USE_INVALID_INPUT',
    })
    expect(mocks.updateParticipantDataUseChoice).not.toHaveBeenCalled()
  })
})
