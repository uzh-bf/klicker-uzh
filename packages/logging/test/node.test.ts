import { Writable } from 'node:stream'
import { createLogger, toSafeError } from '../src/node.js'

function captureDestination() {
  let output = ''
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString()
      callback()
    },
  })

  return {
    destination,
    records: () =>
      output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  }
}

function withLogLevelEnv<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.LOG_LEVEL
  if (value === undefined) {
    delete process.env.LOG_LEVEL
  } else {
    process.env.LOG_LEVEL = value
  }
  try {
    return run()
  } finally {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = previous
    }
  }
}

describe('createLogger', () => {
  it('emits the production record contract through child bindings', () => {
    const capture = captureDestination()
    const logger = createLogger(
      { service: 'logging-test', environment: 'production' },
      capture.destination
    )

    logger.child({ requestId: 'request-1' }).info(
      {
        event: 'logging.contract.verified',
      },
      'Logging contract verified'
    )

    expect(capture.records()).toEqual([
      expect.objectContaining({
        time: expect.any(Number),
        level: 'info',
        service: 'logging-test',
        event: 'logging.contract.verified',
        requestId: 'request-1',
        msg: 'Logging contract verified',
      }),
    ])
    expect(capture.records()[0]).not.toHaveProperty('pid')
    expect(capture.records()[0]).not.toHaveProperty('hostname')
    expect(
      Math.abs((capture.records()[0].time as number) - Date.now())
    ).toBeLessThan(60_000)
  })

  it('serializes owned errors and redacts prohibited credential paths', () => {
    const capture = captureDestination()
    const logger = createLogger(
      { service: 'logging-test', environment: 'production' },
      capture.destination
    )
    const secret = 'fake-secret-canary-20260805'

    logger.error(
      {
        event: 'logging.privacy.verified',
        err: toSafeError('Safe application error'),
        authorization: secret,
        headers: { cookie: secret },
        req: { body: { answer: secret } },
        payload: { token: secret },
      },
      'Logging privacy verified'
    )

    const [record] = capture.records()
    expect(record).toEqual(
      expect.objectContaining({
        level: 'error',
        err: expect.objectContaining({
          type: 'Error',
          message: 'Safe application error',
          stack: expect.any(String),
        }),
      })
    )
    expect(JSON.stringify(record)).not.toContain(secret)
  })

  it.each([
    ['authorization', { authorization: 'canary-redact-value' }],
    ['cookie', { cookie: 'canary-redact-value' }],
    ['headers', { headers: { 'x-canary': 'canary-redact-value' } }],
    [
      'req.headers',
      { req: { headers: { 'x-canary': 'canary-redact-value' } } },
    ],
    [
      'request.headers',
      { request: { headers: { 'x-canary': 'canary-redact-value' } } },
    ],
    ['body', { body: { field: 'canary-redact-value' } }],
    ['req.body', { req: { body: { field: 'canary-redact-value' } } }],
    ['request.body', { request: { body: { field: 'canary-redact-value' } } }],
    ['payload', { payload: { field: 'canary-redact-value' } }],
    ['accessToken', { accessToken: 'canary-redact-value' }],
    ['refreshToken', { refreshToken: 'canary-redact-value' }],
    ['idToken', { idToken: 'canary-redact-value' }],
    ['token', { token: 'canary-redact-value' }],
    ['password', { password: 'canary-redact-value' }],
    ['secret', { secret: 'canary-redact-value' }],
    ['connectionString', { connectionString: 'canary-redact-value' }],
  ])('redacts the configured %s path', (path, payload) => {
    const capture = captureDestination()
    const logger = createLogger(
      { service: 'logging-test', environment: 'production' },
      capture.destination
    )

    logger.info(
      { event: 'logging.redaction.verified', ...payload },
      'Redaction verified'
    )

    expect(JSON.stringify(capture.records()[0])).not.toContain(
      'canary-redact-value'
    )
  })

  it('is silent by default in tests', () => {
    const capture = captureDestination()
    const logger = createLogger(
      { service: 'logging-test', environment: 'test' },
      capture.destination
    )

    logger.fatal(
      { event: 'logging.test.should_be_silent' },
      'This record should be silent'
    )

    expect(capture.records()).toEqual([])
  })

  it('keeps test silence when LOG_LEVEL is set in the environment', () => {
    withLogLevelEnv('info', () => {
      const capture = captureDestination()
      const logger = createLogger(
        { service: 'logging-test', environment: 'test' },
        capture.destination
      )

      logger.fatal(
        { event: 'logging.test.should_be_silent' },
        'This record should be silent'
      )

      expect(capture.records()).toEqual([])
    })
  })

  it('applies the LOG_LEVEL environment variable outside tests', () => {
    withLogLevelEnv('error', () => {
      const capture = captureDestination()
      const logger = createLogger(
        { service: 'logging-test', environment: 'production' },
        capture.destination
      )

      logger.info({ event: 'logging.level.hidden' }, 'Below threshold')
      logger.error({ event: 'logging.level.emitted' }, 'At threshold')

      expect(capture.records()).toHaveLength(1)
      expect(capture.records()[0]).toMatchObject({
        level: 'error',
        event: 'logging.level.emitted',
      })
    })
  })

  it('prefers an explicit level option over LOG_LEVEL', () => {
    withLogLevelEnv('error', () => {
      const capture = captureDestination()
      const logger = createLogger(
        {
          service: 'logging-test',
          environment: 'production',
          level: 'debug',
        },
        capture.destination
      )

      logger.debug({ event: 'logging.level.explicit' }, 'Explicit option wins')

      expect(capture.records()).toHaveLength(1)
      expect(capture.records()[0]).toMatchObject({ level: 'debug' })
    })
  })

  it('safely defaults an invalid level to info', () => {
    const capture = captureDestination()
    const logger = createLogger(
      { service: 'logging-test', environment: 'production', level: 'invalid' },
      capture.destination
    )

    expect(() =>
      logger.info({ event: 'logging.level.defaulted' }, 'Level defaulted')
    ).not.toThrow()
    expect(capture.records()[0]).toMatchObject({
      level: 'info',
      event: 'logging.level.defaulted',
    })
  })
})
