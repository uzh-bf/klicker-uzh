import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@klicker-uzh/graphql/dist/client.json', () => ({
  default: { CaptureResponseExample: 'capture-hash' },
}))

import {
  buildResponseExampleCaptureGraphqlRequest,
  captureResponseExampleThroughManage,
  ResponseExampleCaptureRequestError,
} from '../src/services/responseExampleCapture'

describe('response-example capture GraphQL forwarding', () => {
  const input = {
    chatbotId: '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f',
    receipt: 'signed-receipt',
    question: 'Why?',
    answer: 'Because the source says so [1].',
  }

  it('builds and forwards the canonical persisted mutation', async () => {
    expect(buildResponseExampleCaptureGraphqlRequest(input)).toEqual({
      extensions: {
        persistedQuery: { sha256Hash: 'capture-hash', version: 1 },
      },
      operationName: 'CaptureResponseExample',
      variables: input,
    })
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          captureResponseExample: {
            exampleId: '33ec1c89-f892-4ab6-97cb-27ed037ec33d',
            created: true,
          },
        },
      }),
    })

    await expect(
      captureResponseExampleThroughManage({
        fetchImpl,
        graphqlEndpoint: 'https://api.test/api/graphql',
        input,
        manageOrigin: 'https://manage.test',
        sessionToken: 'session-token',
      })
    ).resolves.toEqual({
      exampleId: '33ec1c89-f892-4ab6-97cb-27ed037ec33d',
      created: true,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/graphql',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer session-token',
          cookie: 'next-auth.session-token=session-token',
          origin: 'https://manage.test',
          'x-graphql-yoga-csrf': 'true',
        }),
        method: 'POST',
      })
    )
  })

  it('preserves coded GraphQL failures for the REST route', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [
          {
            message: 'The sources changed.',
            extensions: { code: 'RESPONSE_EXAMPLE_CAPTURE_STALE' },
          },
        ],
      }),
    })

    await expect(
      captureResponseExampleThroughManage({
        fetchImpl,
        graphqlEndpoint: 'https://api.test/api/graphql',
        input,
        manageOrigin: 'https://manage.test',
        sessionToken: 'session-token',
      })
    ).rejects.toMatchObject({
      code: 'RESPONSE_EXAMPLE_CAPTURE_STALE',
      message: 'The sources changed.',
    })
  })
})

const routeMocks = vi.hoisted(() => ({
  capture: vi.fn(),
  cookies: vi.fn(),
  getManageOrigin: vi.fn(),
  rateLimitCheck: vi.fn(),
  readBoundedJson: vi.fn(),
  withOwnerPreviewAuth: vi.fn(),
}))

vi.mock('@/src/lib/server/ownerPreviewAuth', () => ({
  withOwnerPreviewAuth: routeMocks.withOwnerPreviewAuth,
}))
vi.mock('@/src/lib/server/manageChatRequest', () => ({
  readBoundedJson: routeMocks.readBoundedJson,
}))
vi.mock('@/src/services/rateLimiter', () => ({
  createRateLimiter: () => ({ check: routeMocks.rateLimitCheck }),
}))
vi.mock('@/src/services/manageProposals', () => ({
  getRequiredManageOrigin: routeMocks.getManageOrigin,
}))
vi.mock('next/headers', () => ({ cookies: routeMocks.cookies }))
vi.mock('@/src/services/responseExampleCapture', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/services/responseExampleCapture')
  >()),
  captureResponseExampleThroughManage: routeMocks.capture,
}))

import { POST } from '../src/app/api/manage/chatbots/[chatbotId]/preview/capture/route'

const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const EXAMPLE_ID = '33ec1c89-f892-4ab6-97cb-27ed037ec33d'

function captureRequest() {
  return new NextRequest(
    `https://chat.test/api/manage/chatbots/${CHATBOT_ID}/preview/capture`,
    { body: '{}', method: 'POST' }
  )
}

describe('POST owner-preview response-example capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.withOwnerPreviewAuth.mockResolvedValue({
      userId: 'owner-id',
      scope: 'FULL_ACCESS',
    })
    routeMocks.rateLimitCheck.mockReturnValue({
      allowed: true,
      remaining: 19,
      retryAfterMs: 0,
    })
    routeMocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: {
        receipt: 'signed-receipt',
        question: 'Why?',
        answer: 'Because [1].',
      },
    })
    routeMocks.cookies.mockResolvedValue({
      get: () => ({ value: 'session-token' }),
    })
    routeMocks.getManageOrigin.mockReturnValue('https://manage.test')
    routeMocks.capture.mockResolvedValue({
      exampleId: EXAMPLE_ID,
      created: true,
    })
    vi.stubEnv('APP_ORIGIN_API', 'https://api.test')
  })

  it('enforces owner authorization before reading the body', async () => {
    routeMocks.withOwnerPreviewAuth.mockResolvedValue({
      response: new Response('Forbidden', { status: 403 }),
    })

    const response = await POST(captureRequest(), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(403)
    expect(routeMocks.readBoundedJson).not.toHaveBeenCalled()
    expect(routeMocks.capture).not.toHaveBeenCalled()
  })

  it('captures the candidate and returns its Manage review deep link', async () => {
    const response = await POST(captureRequest(), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      exampleId: EXAMPLE_ID,
      created: true,
      reviewUrl: `https://manage.test/resources/chatbots/${CHATBOT_ID}?responseExampleId=${EXAMPLE_ID}`,
    })
    expect(routeMocks.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        graphqlEndpoint: 'https://api.test/api/graphql',
        manageOrigin: 'https://manage.test',
        sessionToken: 'session-token',
      })
    )
  })

  it.each([
    ['RESPONSE_EXAMPLE_RECEIPT_INVALID', 400],
    ['RESPONSE_EXAMPLE_RECEIPT_EXPIRED', 410],
    ['RESPONSE_EXAMPLE_CAPTURE_STALE', 409],
    ['RESPONSE_EXAMPLE_CAPTURE_UNAVAILABLE', 503],
  ] as const)('maps %s to HTTP %s', async (code, status) => {
    routeMocks.capture.mockRejectedValue(
      new ResponseExampleCaptureRequestError(code, 'Capture failed')
    )

    const response = await POST(captureRequest(), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toMatchObject({ code })
  })
})
