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
})
