import {
  normalizeDiagnosticId,
  propagationHeaders,
  resolveRequestContext,
} from '../src/request.js'

describe('normalizeDiagnosticId', () => {
  it('accepts the diagnostic ID character allowlist', () => {
    expect(normalizeDiagnosticId('request_01.trace-part')).toBe(
      'request_01.trace-part'
    )
  })

  it.each([
    '',
    'contains whitespace',
    'contains/slash',
    'x'.repeat(129),
    ['array-value'],
    null,
    undefined,
  ])('rejects an untrusted diagnostic ID: %j', (value) => {
    expect(normalizeDiagnosticId(value)).toBeUndefined()
  })
})

describe('resolveRequestContext', () => {
  it('replaces an invalid request ID and defaults correlation to it', () => {
    const context = resolveRequestContext(
      {
        requestId: 'invalid request id',
        correlationId: ['untrusted-array'],
      },
      () => 'generated-request'
    )

    expect(context).toEqual({
      requestId: 'generated-request',
      correlationId: 'generated-request',
    })
    expect(propagationHeaders(context)).toEqual({
      'x-request-id': 'generated-request',
      'x-correlation-id': 'generated-request',
    })
  })

  it('preserves valid request, correlation, trace, and span IDs', () => {
    expect(
      resolveRequestContext({
        requestId: 'request-1',
        correlationId: 'correlation-1',
        traceId: 'trace-1',
        spanId: 'span-1',
      })
    ).toEqual({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      traceId: 'trace-1',
      spanId: 'span-1',
    })
  })
})
