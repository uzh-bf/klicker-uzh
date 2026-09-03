import { createEdgeLogger } from '../src/edge.js'

describe('createEdgeLogger', () => {
  it('emits the same record contract without leaking unknown fields', () => {
    const lines: string[] = []
    const logger = createEdgeLogger({
      service: 'edge-test',
      sink: (_level, line) => lines.push(line),
    })

    logger.child({ requestId: 'request-1' }).info(
      {
        event: 'edge.contract.verified',
        outcome: 'accepted',
        headers: { authorization: 'fake-edge-token-canary-20260805' },
      } as never,
      'Edge contract verified'
    )

    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toEqual({
      time: expect.any(Number),
      level: 'info',
      service: 'edge-test',
      requestId: 'request-1',
      event: 'edge.contract.verified',
      outcome: 'accepted',
      msg: 'Edge contract verified',
    })
  })

  it('honors thresholds and omits Edge error stacks', () => {
    const lines: string[] = []
    const logger = createEdgeLogger({
      service: 'edge-test',
      level: 'warn',
      sink: (_level, line) => lines.push(line),
    })

    logger.debug(
      { event: 'edge.debug.suppressed' },
      'This record is below the threshold'
    )
    logger.error(
      {
        event: 'edge.operation.failed',
        err: new Error('Safe Edge error'),
      },
      'Edge operation failed'
    )

    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toEqual(
      expect.objectContaining({
        level: 'error',
        err: {
          type: 'Error',
          message: 'Safe Edge error',
        },
      })
    )
  })

  it('normalizes environment-style levels and safely defaults invalid values', () => {
    const lines: string[] = []
    const warnLogger = createEdgeLogger({
      service: 'edge-test',
      level: 'WARN',
      sink: (_level, line) => lines.push(line),
    })
    const fallbackLogger = createEdgeLogger({
      service: 'edge-test',
      level: 'invalid',
      sink: (_level, line) => lines.push(line),
    })

    warnLogger.info({ event: 'edge.info.suppressed' }, 'Suppressed')
    fallbackLogger.info({ event: 'edge.info.defaulted' }, 'Defaulted')

    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toEqual(
      expect.objectContaining({ event: 'edge.info.defaulted', level: 'info' })
    )
  })
})
