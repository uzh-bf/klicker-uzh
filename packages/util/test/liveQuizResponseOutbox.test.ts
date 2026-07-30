import { describe, expect, it } from 'vitest'
import type { CorrelatedResponseEventMessage } from '../src/liveQuizResponseIdentity.js'
import {
  decryptCorrelatedResponseEvent,
  encryptCorrelatedResponseEvent,
} from '../src/liveQuizResponseOutbox.js'
import { validateStudentResponse } from '../src/liveQuizResponseValidation.js'

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

  it('rejects an unsupported admitted identity kind', () => {
    const encryptedPayload = encryptCorrelatedResponseEvent({
      message: {
        ...message,
        acceptedIdentity: {
          ...message.acceptedIdentity,
          kind: 'unsupported',
        },
      } as unknown as CorrelatedResponseEventMessage,
      secret: 'test-secret',
    })

    expect(() =>
      decryptCorrelatedResponseEvent({
        encryptedPayload,
        secret: 'test-secret',
      })
    ).toThrow('Invalid correlated response outbox message')
  })

  it('rejects incomplete question-specific metadata', () => {
    const encryptedPayload = encryptCorrelatedResponseEvent({
      message: {
        ...message,
        instanceInfo: {
          type: 'SC',
          blockExecution: '1',
          sessionBlockId: '7',
        },
      } as unknown as CorrelatedResponseEventMessage,
      secret: 'test-secret',
    })

    expect(() =>
      decryptCorrelatedResponseEvent({
        encryptedPayload,
        secret: 'test-secret',
      })
    ).toThrow('Invalid correlated response outbox message')
  })

  it('rejects a truncated authentication tag', () => {
    const encryptedPayload = encryptCorrelatedResponseEvent({
      message,
      secret: 'test-secret',
    })
    const parts = encryptedPayload.split('.')
    const tag = Buffer.from(parts[2]!, 'base64url')
    parts[2] = tag.subarray(0, tag.length - 1).toString('base64url')

    expect(() =>
      decryptCorrelatedResponseEvent({
        encryptedPayload: parts.join('.'),
        secret: 'test-secret',
      })
    ).toThrow('Invalid correlated response outbox payload')
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

  it.each(['11abc', ' ', 'Infinity', '-Infinity', 'NaN'])(
    'rejects a non-finite or partial numerical value: %s',
    (value) => {
      expect(
        validateStudentResponse({
          type: 'NUMERICAL',
          response: { value },
        }).valid
      ).toBe(false)
    }
  )

  it('accepts a finite numerical value with surrounding whitespace', () => {
    expect(
      validateStudentResponse({
        type: 'NUMERICAL',
        response: { value: ' 11.5 ' },
      }).valid
    ).toBe(true)
  })

  it('requires one unique choice entry for every configured choice', () => {
    const instanceInfo = { choiceCount: '3' }

    expect(
      validateStudentResponse({
        type: 'MC',
        response: {
          choices: [
            { ix: 0, selected: true },
            { ix: 1, selected: false },
          ],
        },
        instanceInfo,
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'MC',
        response: {
          choices: [
            { ix: 0, selected: true },
            { ix: 0, selected: false },
            { ix: 2, selected: false },
          ],
        },
        instanceInfo,
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'MC',
        response: {
          choices: [
            { ix: 0, selected: true },
            { ix: 1, selected: false },
            { ix: 3, selected: false },
          ],
        },
        instanceInfo,
      }).valid
    ).toBe(false)
  })

  it('bounds selection responses to configured inputs and answer ids', () => {
    const instanceInfo = {
      numberOfInputs: '2',
      selectionAnswerIds: JSON.stringify([11, 12, 13]),
    }

    for (const selection of [[11], [11, 11], [11, 99], [11, 12.5]]) {
      expect(
        validateStudentResponse({
          type: 'SELECTION',
          response: { selection },
          instanceInfo,
        }).valid
      ).toBe(false)
    }
    expect(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [11, -1] },
        instanceInfo,
      }).valid
    ).toBe(true)
  })

  it('requires the configured case-study dimensions and finite bounds', () => {
    const instanceInfo = {
      caseStudyResponseShape: JSON.stringify({
        cases: ['case-1'],
        items: [11],
        criteria: [{ id: 'criterion-1', min: 0, max: 5 }],
      }),
    }

    expect(
      validateStudentResponse({
        type: 'CASE_STUDY',
        response: {
          assessment: { 'case-1': { 11: { 'criterion-1': 3 } } },
        },
        instanceInfo,
      }).valid
    ).toBe(true)
    for (const assessment of [
      { 'case-2': { 11: { 'criterion-1': 3 } } },
      { 'case-1': { 12: { 'criterion-1': 3 } } },
      { 'case-1': { 11: { 'criterion-2': 3 } } },
      { 'case-1': { 11: { 'criterion-1': 6 } } },
      { 'case-1': { 11: { 'criterion-1': Number.POSITIVE_INFINITY } } },
    ]) {
      expect(
        validateStudentResponse({
          type: 'CASE_STUDY',
          response: { assessment },
          instanceInfo,
        }).valid
      ).toBe(false)
    }
  })
})
