import { decodeJWT } from '@klicker-uzh/util'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  leaseFindFirst: vi.fn(),
  leaseFindMany: vi.fn(),
  discardFindMany: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    cardGenerationLease: {
      findFirst: mocks.leaseFindFirst,
      findMany: mocks.leaseFindMany,
    },
    personalElementDiscard: { findMany: mocks.discardFindMany },
  },
}))

vi.mock('@klicker-uzh/graphql/dist/client.json', () => ({
  default: {
    MPrepareCardPlan: 'test-hash-prepare',
    MSavePersonalElementCandidate: 'test-hash-save',
    MValidateCardCandidate: 'test-hash-validate',
    QPersonalElementGenerationContext: 'test-hash-context',
    QPersonalElements: 'test-hash-list',
    QSavedPersonalElementCandidateIds: 'test-hash-saved-candidates',
  },
}))

import {
  executePersonalElementOperation,
  getGenerationLeaseState,
  getPersonalElementGenerationContext,
  listCompletedGenerationLeaseAttemptTokens,
  listDiscardedCandidateIds,
  listSavedPersonalElementCandidateIds,
  mintParticipantToken,
  prepareCardPlan,
  savePersonalElementCandidate,
  validateCardCandidate,
} from '../src/lib/server/personalElements/graphqlClient'

const originalSecret = process.env.APP_SECRET
const originalApiOrigin = process.env.APP_ORIGIN_API
const originalChatOrigin = process.env.APP_ORIGIN_CHAT

describe('personal-element GraphQL client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalSecret === undefined) delete process.env.APP_SECRET
    else process.env.APP_SECRET = originalSecret
    if (originalApiOrigin === undefined) delete process.env.APP_ORIGIN_API
    else process.env.APP_ORIGIN_API = originalApiOrigin
    if (originalChatOrigin === undefined) delete process.env.APP_ORIGIN_CHAT
    else process.env.APP_ORIGIN_CHAT = originalChatOrigin
  })

  test('mints a participant token that expires in five minutes', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'

    const token = await mintParticipantToken('participant-1')
    const payload = decodeJWT(token)

    expect(payload.sub).toBe('participant-1')
    expect(payload.role).toBe('PARTICIPANT')
    expect(payload.iss).toBe('https://api.example.test')
    expect(payload.exp! - payload.iat!).toBe(300)
  })

  test('fails closed when APP_SECRET is missing', async () => {
    delete process.env.APP_SECRET

    await expect(mintParticipantToken('participant-1')).rejects.toThrow(
      'APP_SECRET is not set'
    )
  })

  test('never returns, persists, or logs the minted token', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { personalElements: [] } }),
    })

    const result = await executePersonalElementOperation({
      operationName: 'QPersonalElements',
      variables: { courseId: 'course-1' },
      participantId: 'participant-1',
      fetchImpl,
    })

    const request = fetchImpl.mock.calls[0]?.[1] as {
      body: string
      headers: Record<string, string>
    }
    const token = request.headers.authorization.replace(/^Bearer /, '')
    expect(JSON.stringify(result)).not.toContain(token)
    expect(request.body).not.toContain(token)
    for (const spy of [logSpy, warnSpy, errorSpy]) {
      expect(spy).not.toHaveBeenCalledWith(expect.stringContaining(token))
    }

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  test('propagates GraphQL errors with their extensions', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [
          {
            message: 'A candidate has already been discarded',
            extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED' },
          },
        ],
      }),
    })

    await expect(
      executePersonalElementOperation({
        operationName: 'MSavePersonalElementCandidate',
        variables: {
          input: {
            courseId: 'course-1',
            messageId: 'message-1',
            toolCallId: 'tool-1',
            candidateId: 'candidate-1',
          },
        },
        participantId: 'participant-1',
        fetchImpl,
      })
    ).rejects.toMatchObject({
      message: 'A candidate has already been discarded',
      extensions: { code: 'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED' },
    })
  })

  test('sends the persisted-query hash with CSRF and origin headers', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'
    process.env.APP_ORIGIN_CHAT = 'https://chat.example.test'
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { personalElements: [] } }),
    })

    await executePersonalElementOperation({
      operationName: 'QPersonalElements',
      variables: { courseId: 'course-1' },
      participantId: 'participant-1',
      fetchImpl,
    })

    const request = fetchImpl.mock.calls[0]?.[1] as {
      body: string
      headers: Record<string, string>
      method: string
    }
    expect(request.method).toBe('POST')
    expect(request.headers.origin).toBe('https://chat.example.test')
    expect(request.headers['x-graphql-yoga-csrf']).toBe('true')
    expect(request.headers['content-type']).toBe('application/json')
    const body = JSON.parse(request.body)
    expect(body.extensions.persistedQuery).toEqual({
      sha256Hash: 'test-hash-list',
      version: 1,
    })
    expect(body).not.toHaveProperty('query')
  })

  test('routes plan preparation and candidate validation through generated operations', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            prepareCardPlan: {
              planId: '00000000-0000-0000-0000-000000000001',
              courseLanguage: 'en',
              existingTitles: [],
              cards: [
                {
                  type: 'FLASHCARD',
                  candidateId: '00000000-0000-0000-0000-000000000001:card-1',
                  title: 'CAPM',
                  intent: 'Define CAPM',
                  query: 'CAPM',
                },
              ],
              discardedDuplicates: [],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { validateCardCandidate: true } }),
      })
    vi.stubGlobal('fetch', fetchImpl)

    await expect(
      prepareCardPlan(
        {
          courseId: 'course-1',
          topic: 'CAPM',
          cards: [
            {
              type: 'FLASHCARD',
              title: 'CAPM',
              intent: 'Define CAPM',
              query: 'CAPM',
            },
          ],
        },
        'participant-1'
      )
    ).resolves.toMatchObject({
      planId: '00000000-0000-0000-0000-000000000001',
    })
    await expect(
      validateCardCandidate(
        {
          courseId: 'course-1',
          candidateId: 'candidate-1',
          title: 'CAPM',
          front: 'What is CAPM?',
          back: 'The capital asset pricing model.',
          sources: [
            {
              sourceId: 'course-script',
              kind: 'DOCUMENT',
              title: 'Course script',
              chunkIds: ['chunk-1'],
              locators: [{ type: 'PAGE_RANGE', pageFrom: 1, pageTo: 1 }],
            },
          ],
          sourceMessageId: 'assistant-1',
          sourceToolCallId: 'generate-1',
        },
        'participant-1'
      )
    ).resolves.toBe(true)

    const requests = fetchImpl.mock.calls.map(([, request]) =>
      JSON.parse((request as { body: string }).body)
    )
    expect(requests.map(({ operationName }) => operationName)).toEqual([
      'MPrepareCardPlan',
      'MValidateCardCandidate',
    ])
    expect(requests.map(({ extensions }) => extensions.persistedQuery)).toEqual(
      [
        { sha256Hash: 'test-hash-prepare', version: 1 },
        { sha256Hash: 'test-hash-validate', version: 1 },
      ]
    )
  })

  test('loads only the requested saved candidate identities', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { savedPersonalElementCandidateIds: ['candidate-1'] },
      }),
    })
    vi.stubGlobal('fetch', fetchImpl)

    await expect(
      listSavedPersonalElementCandidateIds(
        'course-1',
        ['candidate-1', 'candidate-2'],
        'participant-1'
      )
    ).resolves.toEqual(['candidate-1'])
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1].body)
    expect(body).toMatchObject({
      operationName: 'QSavedPersonalElementCandidateIds',
      variables: {
        courseId: 'course-1',
        candidateIds: ['candidate-1', 'candidate-2'],
      },
      extensions: {
        persistedQuery: {
          sha256Hash: 'test-hash-saved-candidates',
          version: 1,
        },
      },
    })
  })

  test('loads narrow generation context and saves by linkage only', async () => {
    process.env.APP_SECRET = 'test-secret'
    process.env.APP_ORIGIN_API = 'https://api.example.test'
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            personalElementGenerationContext: {
              courseLanguage: 'de',
              existingTitles: ['Existing card'],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            savePersonalElementCandidate: { id: 'element-1' },
          },
        }),
      })
    vi.stubGlobal('fetch', fetchImpl)

    await expect(
      getPersonalElementGenerationContext('course-1', 'participant-1')
    ).resolves.toEqual({
      courseLanguage: 'de',
      existingTitles: ['Existing card'],
    })
    await expect(
      savePersonalElementCandidate(
        {
          courseId: 'course-1',
          messageId: '00000000-0000-0000-0000-000000000001',
          toolCallId: 'generate-1',
          candidateId: 'candidate-1',
        },
        'participant-1'
      )
    ).resolves.toEqual({ id: 'element-1' })

    const requests = fetchImpl.mock.calls.map(([, request]) =>
      JSON.parse((request as { body: string }).body)
    )
    expect(requests).toEqual([
      expect.objectContaining({
        operationName: 'QPersonalElementGenerationContext',
        variables: { courseId: 'course-1' },
        extensions: {
          persistedQuery: {
            sha256Hash: 'test-hash-context',
            version: 1,
          },
        },
      }),
      expect.objectContaining({
        operationName: 'MSavePersonalElementCandidate',
        variables: {
          input: {
            courseId: 'course-1',
            messageId: '00000000-0000-0000-0000-000000000001',
            toolCallId: 'generate-1',
            candidateId: 'candidate-1',
          },
        },
        extensions: {
          persistedQuery: {
            sha256Hash: 'test-hash-save',
            version: 1,
          },
        },
      }),
    ])
  })

  test('scopes lease and discard reads to the participant', async () => {
    mocks.leaseFindFirst.mockResolvedValue({ completedAt: null })
    mocks.discardFindMany.mockResolvedValue([{ candidateId: 'candidate-1' }])
    mocks.leaseFindMany.mockResolvedValue([{ attemptToken: 'attempt-1' }])

    await expect(
      getGenerationLeaseState({
        participantId: 'participant-1',
        attemptToken: 'attempt-1',
      })
    ).resolves.toEqual({ completedAt: null })
    expect(mocks.leaseFindFirst).toHaveBeenCalledWith({
      where: { participantId: 'participant-1', attemptToken: 'attempt-1' },
      select: { completedAt: true },
    })

    await expect(
      listDiscardedCandidateIds({
        participantId: 'participant-1',
        courseId: 'course-1',
        candidateIds: ['candidate-1'],
      })
    ).resolves.toEqual(['candidate-1'])
    expect(mocks.discardFindMany).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-1',
        courseId: 'course-1',
        candidateId: { in: ['candidate-1'] },
      },
      select: { candidateId: true },
    })

    await expect(
      listCompletedGenerationLeaseAttemptTokens({
        participantId: 'participant-1',
        attemptTokens: ['attempt-1'],
      })
    ).resolves.toEqual(['attempt-1'])
    expect(mocks.leaseFindMany).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-1',
        attemptToken: { in: ['attempt-1'] },
        completedAt: { not: null },
      },
      select: { attemptToken: true },
    })
  })
})
