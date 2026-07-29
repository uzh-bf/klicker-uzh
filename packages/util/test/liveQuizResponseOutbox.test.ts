import { describe, expect, it } from 'vitest'
import type { CorrelatedResponseEventMessage } from '../src/liveQuizResponseIdentity.js'
import {
  decryptCorrelatedResponseEvent,
  encryptCorrelatedResponseEvent,
  validateStudentResponse,
} from '../src/liveQuizResponseOutbox.js'

const message: CorrelatedResponseEventMessage = {
  messageId: '22222222-2222-4222-8222-222222222222',
  sessionId: '11111111-1111-4111-8111-111111111111',
  instanceId: '42',
  response: { value: 'accepted answer' },
  responseTimestamp: 1_000,
  instanceInfo: {
    type: 'FREE_TEXT',
    blockExecution: '1',
    sessionBlockId: '33333333-3333-4333-8333-333333333333',
  },
  acceptedIdentity: {
    kind: 'anonymous',
    id: '44444444-4444-4444-8444-444444444444',
    identityKey: 'respondent:44444444-4444-4444-8444-444444444444',
  },
  correlatedClaim: {
    key: 'claim-key',
    identityKey: 'respondent:44444444-4444-4444-8444-444444444444',
  },
}

describe('correlated live quiz outbox contract', () => {
  it('round-trips an accepted event without browser credentials', () => {
    const encryptedPayload = encryptCorrelatedResponseEvent({
      message,
      secret: 'test-secret',
    })

    expect(encryptedPayload).not.toContain('accepted answer')
    expect(
      decryptCorrelatedResponseEvent({
        encryptedPayload,
        secret: 'test-secret',
      })
    ).toEqual(message)
  })

  it('rejects an identity key that does not match the admitted identity', () => {
    const encryptedPayload = encryptCorrelatedResponseEvent({
      message: {
        ...message,
        acceptedIdentity: {
          ...message.acceptedIdentity,
          identityKey: 'respondent:55555555-5555-4555-8555-555555555555',
        },
      },
      secret: 'test-secret',
    })

    expect(() =>
      decryptCorrelatedResponseEvent({
        encryptedPayload,
        secret: 'test-secret',
      })
    ).toThrow('Invalid correlated response outbox message')
  })
})

describe('live quiz response validation', () => {
  it('rejects malformed responses before durable acknowledgement', () => {
    expect(
      validateStudentResponse({
        type: 'SC',
        response: { choices: [] },
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'FREE_TEXT',
        response: ['not', 'an', 'object'],
      }).valid
    ).toBe(false)
  })

  it('applies acceptance-time response restrictions', () => {
    expect(
      validateStudentResponse({
        type: 'NUMERICAL',
        response: { value: '11' },
        restrictions: { max: 10 },
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'FREE_TEXT',
        response: { value: 'valid' },
        restrictions: { maxLength: 5 },
      }).valid
    ).toBe(true)
  })
})
