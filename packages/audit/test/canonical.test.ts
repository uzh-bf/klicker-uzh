import { normalizedAnswerSchema } from '../src/contract/payloads/common.js'
import {
  canonicalByteLength,
  canonicalizeJson,
  deriveAuditEventIdentity,
} from '../src/index.js'

describe('RFC 8785 canonicalization', () => {
  it('matches the RFC number serialization example', () => {
    expect(
      canonicalizeJson([Number('333333333.33333329'), 1e30, 4.5, 2e-3, 1e-27])
    ).toBe('[333333333.3333333,1e+30,4.5,0.002,1e-27]')
  })

  it('sorts object properties recursively without changing array order', () => {
    expect(canonicalizeJson({ z: [3, 2, 1], a: { y: null, x: true } })).toBe(
      '{"a":{"x":true,"y":null},"z":[3,2,1]}'
    )
  })

  it('normalizes dates to UTC milliseconds and counts UTF-8 bytes', () => {
    const canonical = canonicalizeJson({
      occurredAt: new Date('2026-08-11T12:34:56.789+02:00'),
      value: 'Zürich',
    })
    expect(canonical).toBe(
      '{"occurredAt":"2026-08-11T10:34:56.789Z","value":"Zürich"}'
    )
    expect(canonicalByteLength(canonical)).toBe(Buffer.byteLength(canonical))
  })

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
  ])('rejects non-I-JSON value %s', (value) => {
    expect(() => canonicalizeJson({ value })).toThrow()
  })

  it('normalizes answer option identity order before hashing', () => {
    expect(
      normalizedAnswerSchema.parse({
        kind: 'MC',
        selectedOptionIds: [3, 1, 3, 2],
      })
    ).toEqual({
      kind: 'MC',
      selectedOptionIds: [1, 2, 3],
    })
  })
})

describe('audit event identity', () => {
  it('is deterministic across transaction retries', () => {
    const input = {
      eventType: 'ASSESSMENT_STARTED' as const,
      liveQuizId: '11111111-1111-4111-8111-111111111111',
      lifecycleEpoch: 2,
      producerOperationId: '22222222-2222-4222-8222-222222222222:0',
    }
    const first = deriveAuditEventIdentity(input)
    const second = deriveAuditEventIdentity(input)

    expect(first).toEqual(second)
    expect(first).toEqual({
      idempotencyKey:
        'dbaf347ba7623a0f525500f582ab2dc2584e869a63931e2d0ed19fb32d2bfd7a',
      eventId: '142e87b7-94ff-50d4-9e35-a85052c7a2e2',
    })
    expect(first.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
