import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  grade: vi.fn(),
  verifyJWT: vi.fn(),
  push: vi.fn(),
  findInstance: vi.fn(),
  findInstances: vi.fn(),
  findAttempt: vi.fn(),
  updateAttempt: vi.fn(),
  updateAttempts: vi.fn(),
}))

vi.mock('@klicker-uzh/grading', () => ({
  gradeQuestionSC: mocks.grade,
  gradeQuestionMC: mocks.grade,
  gradeQuestionKPRIM: mocks.grade,
  gradeQuestionNumerical: mocks.grade,
  gradeQuestionFreeText: mocks.grade,
}))
vi.mock('@klicker-uzh/hatchet', () => ({
  hatchetClient: { events: { push: mocks.push } },
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    elementInstance: {
      findUnique: mocks.findInstance,
      findMany: mocks.findInstances,
    },
    escapeRoomAttempt: {
      findUnique: mocks.findAttempt,
      update: mocks.updateAttempt,
      updateMany: mocks.updateAttempts,
    },
  },
}))
vi.mock('@klicker-uzh/util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@klicker-uzh/util')>()),
  verifyJWT: mocks.verifyJWT,
}))

import { handleEscapeRoomValidation } from './escapeRoom.js'

function responseRecorder() {
  const result = {
    statusCode: 0,
    body: '',
    headers: new Map<string, unknown>(),
  }
  return {
    result,
    response: {
      setHeader: (key: string, value: unknown) =>
        result.headers.set(key, value),
      end: (body: string) => {
        result.body = body
      },
      get statusCode() {
        return result.statusCode
      },
      set statusCode(value: number) {
        result.statusCode = value
      },
    } as any,
  }
}

function redisMock() {
  const sets = new Map<string, Set<string>>()
  const claims = new Map<string, string>()
  const sortedSets = new Map<string, Set<string>>()
  const transaction = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    zadd: vi.fn((key: string, _score: number, value: string) => {
      const values = sortedSets.get(key) ?? new Set<string>()
      values.add(value)
      sortedSets.set(key, values)
      return transaction
    }),
    exec: vi.fn().mockResolvedValue([
      [null, 1],
      [null, 1],
    ]),
  }
  return {
    hgetall: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn(async (key: string) => {
      const removed =
        claims.delete(key) || sets.delete(key) || sortedSets.delete(key)
      return removed ? 1 : 0
    }),
    eval: vi.fn(
      async (
        script: string,
        _keys: number,
        key: string,
        token: string,
        ...args: string[]
      ) => {
        if (script.includes('escape-room-response-acquire')) {
          const gateKey = key
          const inFlightKey = token
          const responseSlotToken = args[2]!
          if (claims.has(gateKey)) return 0
          const values = sortedSets.get(inFlightKey) ?? new Set<string>()
          values.add(responseSlotToken)
          sortedSets.set(inFlightKey, values)
          return 1
        }
        if (claims.get(key) !== token) return 0
        claims.delete(key)
        return 1
      }
    ),
    incr: vi.fn().mockResolvedValue(1),
    set: vi.fn(async (key: string, value: string) => {
      if (claims.has(key)) return null
      claims.set(key, value)
      return 'OK'
    }),
    sismember: vi.fn(async (key: string, value: string) =>
      sets.get(key)?.has(value) ? 1 : 0
    ),
    sadd: vi.fn(async (key: string, value: string) => {
      const values = sets.get(key) ?? new Set<string>()
      const size = values.size
      values.add(value)
      sets.set(key, values)
      return values.size - size
    }),
    smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),
    zrem: vi.fn(async (key: string, value: string) =>
      sortedSets.get(key)?.delete(value) ? 1 : 0
    ),
    multi: vi.fn(() => transaction),
    transaction,
    expire: vi.fn().mockResolvedValue(1),
  } as any
}

const info = {
  isEscapeRoom: 'true',
  sessionBlockId: '7',
  type: 'SC',
  choiceCount: '2',
  solutions: '[]',
  escapeRoomLockoutSeconds: '5',
}

const payload = {
  response: { choices: [] },
  liveQuizId: 'quiz-1',
  instanceId: 11,
}

function activeInstanceState() {
  return {
    elementBlockId: 7,
    elementBlock: {
      liveQuizId: 'quiz-1',
      status: 'ACTIVE',
      liveQuiz: { activeBlockId: 7 },
    },
    element: { qrScanCode: null },
  }
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    timeLimit: 300,
    penaltySeconds: 0,
    lockoutUntil: null,
    ...overrides,
  }
}

describe('response-api escape-room validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyJWT.mockResolvedValue({
      sub: 'participant-1',
      role: 'PARTICIPANT',
    })
    mocks.findInstance.mockResolvedValue(activeInstanceState())
    mocks.findAttempt.mockResolvedValue(attempt())
    mocks.findInstances.mockResolvedValue([{ id: 11 }])
    mocks.updateAttempt.mockResolvedValue(attempt())
    mocks.updateAttempts.mockResolvedValue({ count: 1 })
    mocks.grade.mockReturnValue(0)
    mocks.push.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns credentialed CORS headers for an allowed participant origin', async () => {
    const origin = 'https://pwa.klicker.localhost'
    vi.stubEnv('CORS_ALLOWED_ORIGINS', origin)
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      { headers: { origin } } as any,
      response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )

    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(result.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(result.headers.get('Vary')).toBe('Origin')
  })

  it('rejects temporary participants before reading escape-room state', async () => {
    mocks.verifyJWT.mockResolvedValue({
      sub: 'temporary-1',
      role: 'TEMPORARY_PARTICIPANT',
    })
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'temporary_participant_token=token',
      info,
      redisMock()
    )

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'unauthorized_participant',
    })
    expect(mocks.findAttempt).not.toHaveBeenCalled()
  })

  it('requires an explicitly started attempt', async () => {
    mocks.findAttempt.mockResolvedValue(null)
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'escape_room_attempt_not_started',
    })
  })

  it('rejects an instance outside the declared block and quiz', async () => {
    mocks.findInstance.mockResolvedValue({
      elementBlockId: 8,
      elementBlock: { liveQuizId: 'quiz-2' },
    })
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'escape_room_instance_block_mismatch',
    })
    expect(mocks.findAttempt).not.toHaveBeenCalled()
  })

  it('rejects a response when the block closes before the claimed recheck', async () => {
    mocks.findInstance
      .mockResolvedValueOnce(activeInstanceState())
      .mockResolvedValueOnce({
        ...activeInstanceState(),
        elementBlock: {
          ...activeInstanceState().elementBlock,
          status: 'INACTIVE',
          liveQuiz: { activeBlockId: null },
        },
      })
    mocks.grade.mockReturnValue(1)
    const redis = redisMock()
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redis
    )

    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body)).toEqual({
      error: 'escape_room_block_closed',
    })
    expect(mocks.grade).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(redis.sadd).not.toHaveBeenCalled()
    expect(mocks.updateAttempts).not.toHaveBeenCalled()
    expect(redis.eval).toHaveBeenCalledTimes(2)
  })

  it('rejects a response when block closure wins the response-slot race', async () => {
    const redis = redisMock()
    redis.eval.mockResolvedValueOnce(0)
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redis
    )

    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body)).toEqual({
      error: 'escape_room_block_closed',
    })
    expect(mocks.grade).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('releases the participant claim when response-slot acquisition fails', async () => {
    const redis = redisMock()
    redis.eval.mockRejectedValueOnce(new Error('redis unavailable'))

    await expect(
      handleEscapeRoomValidation(
        {} as any,
        responseRecorder().response,
        payload,
        'participant_token=token',
        info,
        redis
      )
    ).rejects.toThrow('redis unavailable')

    const retry = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      retry.response,
      payload,
      'participant_token=token',
      info,
      redis
    )
    expect(retry.result.statusCode).toBe(200)
  })

  it('rejects cached instance metadata already marked as closed', async () => {
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      { ...info, blockClosedAt: String(Date.now()) },
      redisMock()
    )

    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body)).toEqual({
      error: 'escape_room_block_closed',
    })
    expect(mocks.findInstance).not.toHaveBeenCalled()
    expect(mocks.grade).not.toHaveBeenCalled()
  })

  it('returns the active lockout without grading', async () => {
    const lockoutUntil = new Date(Date.now() + 5_000)
    mocks.findAttempt.mockResolvedValue(attempt({ lockoutUntil }))
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )

    expect(result.statusCode).toBe(429)
    expect(JSON.parse(result.body).status).toBe('lockout')
    expect(mocks.grade).not.toHaveBeenCalled()
  })

  it('rechecks lockout after acquiring the submission claim', async () => {
    const lockoutUntil = new Date(Date.now() + 5_000)
    mocks.findAttempt
      .mockResolvedValueOnce(attempt())
      .mockResolvedValueOnce(attempt({ lockoutUntil }))
    const redis = redisMock()
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redis
    )

    expect(result.statusCode).toBe(429)
    expect(JSON.parse(result.body).status).toBe('lockout')
    expect(mocks.grade).not.toHaveBeenCalled()
    expect(redis.eval).toHaveBeenCalledTimes(2)
  })

  it('accepts the five-second grace boundary and expires beyond it', async () => {
    mocks.findAttempt.mockResolvedValue(
      attempt({ startedAt: new Date(Date.now() - 4_000), timeLimit: 0 })
    )
    const within = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      within.response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )
    expect(within.result.statusCode).toBe(200)
    expect(JSON.parse(within.result.body).status).toBe('incorrect')

    mocks.findAttempt.mockResolvedValue(
      attempt({ startedAt: new Date(Date.now() - 6_000), timeLimit: 0 })
    )
    const beyond = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      beyond.response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )
    expect(beyond.result.statusCode).toBe(400)
    expect(JSON.parse(beyond.result.body)).toEqual({
      error: 'escape_room_expired',
    })
    expect(mocks.updateAttempt).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: { status: 'EXPIRED' },
    })
  })

  it('expires incorrect-response attempt counters', async () => {
    const redis = redisMock()
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redis
    )

    const triesKey = 'lq:quiz-1:i:11:tries:participant-1'
    expect(result.statusCode).toBe(200)
    expect(redis.multi).toHaveBeenCalledOnce()
    expect(redis.transaction.incr).toHaveBeenCalledWith(triesKey)
    expect(redis.transaction.expire).toHaveBeenCalledWith(
      triesKey,
      60 * 60 * 24 * 30
    )
    expect(redis.transaction.exec).toHaveBeenCalledOnce()
    expect(redis.incr).not.toHaveBeenCalled()
    expect(redis.expire).not.toHaveBeenCalled()
  })

  it('publishes a regular participant response and completes the block attempt', async () => {
    mocks.grade.mockReturnValue(1)
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      payload,
      'participant_token=token',
      info,
      redisMock()
    )

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual(
      expect.objectContaining({ status: 'correct', completed: true })
    )
    expect(mocks.push).toHaveBeenCalledWith(
      'response-received:authenticated',
      expect.objectContaining({ sessionId: 'quiz-1', instanceId: '11' })
    )
    expect(mocks.updateAttempts).toHaveBeenCalledWith({
      where: { id: 'attempt-1', status: 'IN_PROGRESS' },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        lockoutUntil: null,
      },
    })
  })

  it('accepts an exact QR code and rejects a well-formed decoy', async () => {
    mocks.findInstance.mockResolvedValue({
      ...activeInstanceState(),
      element: { qrScanCode: 'AbCdEf12_-34' },
    })
    const qrInfo = { ...info, type: 'QR_SCAN', solutions: '' }

    const correct = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      correct.response,
      { ...payload, response: { value: 'AbCdEf12_-34' } },
      'participant_token=token',
      qrInfo,
      redisMock()
    )
    expect(JSON.parse(correct.result.body)).toEqual(
      expect.objectContaining({ status: 'correct', completed: true })
    )

    mocks.findAttempt.mockResolvedValue(attempt({ id: 'attempt-2' }))
    const decoy = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      decoy.response,
      { ...payload, response: { value: 'ZbCdEf12_-34' } },
      'participant_token=token',
      qrInfo,
      redisMock()
    )
    expect(JSON.parse(decoy.result.body).status).toBe('incorrect')
  })

  it('rejects malformed QR codes before publishing a response', async () => {
    mocks.findInstance.mockResolvedValue({
      ...activeInstanceState(),
      element: { qrScanCode: 'AbCdEf12_-34' },
    })
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      { ...payload, response: { value: 'not-a-code' } },
      'participant_token=token',
      { ...info, type: 'QR_SCAN', solutions: '' },
      redisMock()
    )

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({ error: 'invalid_qr_code' })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('completes only after every answerable block instance is cleared', async () => {
    mocks.grade.mockReturnValue(1)
    mocks.findInstances.mockResolvedValue([{ id: 11 }, { id: 12 }])
    const redis = redisMock()

    const first = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      first.response,
      payload,
      'participant_token=token',
      info,
      redis
    )
    expect(JSON.parse(first.result.body).completed).toBe(false)
    expect(mocks.updateAttempts).not.toHaveBeenCalled()

    const second = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      second.response,
      { ...payload, instanceId: 12 },
      'participant_token=token',
      info,
      redis
    )
    expect(JSON.parse(second.result.body).completed).toBe(true)
    expect(mocks.updateAttempts).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledTimes(2)
  })

  it('rejects a future escape-room stage before grading or publishing it', async () => {
    mocks.findInstances.mockResolvedValue([{ id: 11 }, { id: 12 }])
    const { response, result } = responseRecorder()

    await handleEscapeRoomValidation(
      {} as any,
      response,
      { ...payload, instanceId: 12 },
      'participant_token=token',
      info,
      redisMock()
    )

    expect(result.statusCode).toBe(409)
    expect(JSON.parse(result.body)).toEqual({
      error: 'escape_room_stage_locked',
    })
    expect(mocks.grade).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('retries final persistence without republishing an accepted response', async () => {
    mocks.grade.mockReturnValue(1)
    mocks.updateAttempts.mockRejectedValueOnce(
      new Error('database unavailable')
    )
    const redis = redisMock()
    const first = responseRecorder()

    await expect(
      handleEscapeRoomValidation(
        {} as any,
        first.response,
        payload,
        'participant_token=token',
        info,
        redis
      )
    ).rejects.toThrow('database unavailable')

    const retry = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      retry.response,
      payload,
      'participant_token=token',
      info,
      redis
    )
    expect(JSON.parse(retry.result.body).completed).toBe(true)
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.updateAttempts).toHaveBeenCalledTimes(2)
  })

  it('does not inherit cleared instances after a reset starts a new attempt', async () => {
    mocks.grade.mockReturnValue(1)
    mocks.findInstances.mockResolvedValue([{ id: 11 }, { id: 12 }])
    const redis = redisMock()
    const first = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      first.response,
      payload,
      'participant_token=token',
      info,
      redis
    )
    expect(JSON.parse(first.result.body).completed).toBe(false)

    mocks.findAttempt.mockResolvedValue(attempt({ id: 'attempt-2' }))
    const afterReset = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      afterReset.response,
      { ...payload, instanceId: 12 },
      'participant_token=token',
      info,
      redis
    )
    expect(afterReset.result.statusCode).toBe(409)
    expect(JSON.parse(afterReset.result.body)).toEqual({
      error: 'escape_room_stage_locked',
    })
    expect(mocks.updateAttempts).not.toHaveBeenCalled()
  })

  it('publishes only once for concurrent correct responses to one instance', async () => {
    mocks.grade.mockReturnValue(1)
    const redis = redisMock()
    const responses = [responseRecorder(), responseRecorder()]

    await Promise.all(
      responses.map(({ response }) =>
        handleEscapeRoomValidation(
          {} as any,
          response,
          payload,
          'participant_token=token',
          info,
          redis
        )
      )
    )

    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(responses.map(({ result }) => result.statusCode).sort()).toEqual([
      200, 409,
    ])
  })

  it('grades only one of concurrent correct and incorrect responses', async () => {
    mocks.grade.mockImplementation(({ response }) =>
      response[0] === 0 ? 1 : 0
    )
    const redis = redisMock()
    const responses = [responseRecorder(), responseRecorder()]

    await Promise.all([
      handleEscapeRoomValidation(
        {} as any,
        responses[0]!.response,
        { ...payload, response: { choices: [0] } },
        'participant_token=token',
        info,
        redis
      ),
      handleEscapeRoomValidation(
        {} as any,
        responses[1]!.response,
        { ...payload, response: { choices: [1] } },
        'participant_token=token',
        info,
        redis
      ),
    ])

    expect(mocks.grade).toHaveBeenCalledTimes(1)
    expect(responses.map(({ result }) => result.statusCode).sort()).toEqual([
      200, 409,
    ])
  })

  it('releases the response claim when event publication fails', async () => {
    mocks.grade.mockReturnValue(1)
    mocks.push.mockRejectedValueOnce(new Error('hatchet unavailable'))
    const redis = redisMock()
    const first = responseRecorder()

    await expect(
      handleEscapeRoomValidation(
        {} as any,
        first.response,
        payload,
        'participant_token=token',
        info,
        redis
      )
    ).rejects.toThrow('hatchet unavailable')

    mocks.push.mockResolvedValue(undefined)
    const retry = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      retry.response,
      payload,
      'participant_token=token',
      info,
      redis
    )
    expect(JSON.parse(retry.result.body).completed).toBe(true)
    expect(mocks.push).toHaveBeenCalledTimes(2)
  })

  it('reuses the deterministic event identity when acceptance marking fails', async () => {
    mocks.grade.mockReturnValue(1)
    const redis = redisMock()
    redis.sadd.mockRejectedValueOnce(new Error('redis marker unavailable'))
    const first = responseRecorder()

    await expect(
      handleEscapeRoomValidation(
        {} as any,
        first.response,
        payload,
        'participant_token=token',
        info,
        redis
      )
    ).rejects.toThrow('redis marker unavailable')

    const retry = responseRecorder()
    await handleEscapeRoomValidation(
      {} as any,
      retry.response,
      payload,
      'participant_token=token',
      info,
      redis
    )
    expect(mocks.push).toHaveBeenCalledTimes(2)
    expect(mocks.push.mock.calls.map((call) => call[1].messageId)).toEqual([
      'escape:attempt-1:11',
      'escape:attempt-1:11',
    ])
  })
})
