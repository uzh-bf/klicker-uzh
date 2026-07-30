import { LiveQuizRespondentType } from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
  decryptCorrelatedResponseEvent,
  encryptCorrelatedResponseEvent,
} from '@klicker-uzh/util'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCorrelatedResponseAdmission,
  hasValidLiveQuizPin,
  prepareCorrelatedResponseSubmission,
  serializeLiveQuizRespondentCookie,
} from '../src/correlatedResponseAdmission.js'
import {
  dispatchPendingCorrelatedResponses,
  registerPendingCorrelatedResponse,
} from '../src/correlatedResponseOutbox.js'
import {
  hasJsonContentType,
  isAllowedCorsOrigin,
  resolveResponseCollectionMode,
} from '../src/liveQuizResponseRequest.js'

describe('correlated response key', () => {
  it('is stable for one identity and block execution', () => {
    const key = buildCorrelatedResponseKey({
      liveQuizId: 'quiz-1',
      instanceId: '42',
      blockExecution: '3',
      identityKey: 'respondent:abc',
    })

    assert.equal(
      key,
      'lq:quiz-1:i:42:correlatedVotes:3:085bf40ef25fbf989488342d89d5669f7bf03aca4968dc220af108593e093de4'
    )
  })
})

describe('correlated response request safeguards', () => {
  it('requires allowlisted browser origins while permitting non-browser clients', () => {
    assert.equal(
      isAllowedCorsOrigin({
        origin: undefined,
        allowedOrigins: ['https://pwa.klicker.test'],
      }),
      true
    )
    assert.equal(
      isAllowedCorsOrigin({
        origin: 'https://pwa.klicker.test',
        allowedOrigins: ['https://pwa.klicker.test'],
      }),
      true
    )
    assert.equal(
      isAllowedCorsOrigin({
        origin: 'https://attacker.test',
        allowedOrigins: ['https://pwa.klicker.test'],
      }),
      false
    )
  })

  it('accepts only JSON request content types', () => {
    assert.equal(hasJsonContentType('application/json'), true)
    assert.equal(hasJsonContentType('application/json; charset=utf-8'), true)
    assert.equal(hasJsonContentType('text/plain'), false)
    assert.equal(hasJsonContentType(undefined), false)
  })

  it('centralizes correlated quiz and PIN admission', async () => {
    const database = {
      liveQuiz: {
        findUnique: async () => ({
          isAssessmentEnabled: false,
          pinCode: 'ABC123',
          responseCollectionMode: 'CORRELATED_EXPORT',
          status: 'PUBLISHED',
        }),
      },
    } as any

    assert.equal(
      await getCorrelatedResponseAdmission({
        database,
        liveQuizId: 'quiz-1',
        cookieHeader: 'live-quiz-pin-quiz-1=ABC123',
      }),
      'ready'
    )
    assert.equal(
      await getCorrelatedResponseAdmission({
        database,
        liveQuizId: 'quiz-1',
        cookieHeader: undefined,
      }),
      'pin_required'
    )
  })

  it('durably bridges an active temporary identity before enqueue', async () => {
    const respondentId = '33333333-3333-4333-8333-333333333333'
    let respondentCreated = false
    const result = await prepareCorrelatedResponseSubmission({
      database: {
        temporaryLeaderboardEntry: {
          findUnique: async () => ({ id: respondentId }),
        },
        liveQuizRespondent: {
          upsert: async () => {
            respondentCreated = true
            return {
              id: respondentId,
              liveQuizId: 'quiz-id',
              type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
            }
          },
        },
        participant: { findUnique: async () => null },
      } as any,
      identity: {
        kind: 'temporary',
        id: respondentId,
        liveQuizId: 'quiz-id',
        token: 'signed-token',
        cookieName: 'temporary_participant_token',
      },
      liveQuizId: 'quiz-id',
      instanceId: '42',
      blockExecution: '3',
    })

    assert.equal(result.status, 'ready')
    assert.equal(respondentCreated, true)
    assert.deepEqual(
      result.status === 'ready' ? result.acceptedIdentity : undefined,
      {
        kind: 'temporary',
        id: respondentId,
      }
    )
    assert.equal(
      result.status === 'ready' ? result.responseKey : undefined,
      buildCorrelatedResponseKey({
        liveQuizId: 'quiz-id',
        instanceId: '42',
        blockExecution: '3',
        identityKey: `respondent:${respondentId}`,
      })
    )
  })

  it('registers a pending outbox entry while the correlated quiz is published', async () => {
    const createCalls: any[] = []
    const database = {
      $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
        callback({
          $queryRaw: async () => [
            {
              isAssessmentEnabled: false,
              responseCollectionMode: 'CORRELATED_EXPORT',
              status: 'PUBLISHED',
            },
          ],
          liveQuizPendingResponse: {
            create: async (args: any) => {
              createCalls.push(args)
              return args.data
            },
          },
        }),
    } as any

    assert.equal(
      await registerPendingCorrelatedResponse({
        database,
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        messageId: '22222222-2222-4222-8222-222222222222',
        responseKey: 'claim-key',
        eventPayload: 'encrypted-payload',
        nextDeliveryAt: new Date('2026-07-29T12:00:00.000Z'),
      }),
      'registered'
    )
    assert.deepEqual(createCalls, [
      {
        data: {
          id: '22222222-2222-4222-8222-222222222222',
          liveQuizId: '11111111-1111-4111-8111-111111111111',
          responseKey: 'claim-key',
          eventPayload: 'encrypted-payload',
          nextDeliveryAt: new Date('2026-07-29T12:00:00.000Z'),
        },
      },
    ])
  })

  it('does not register an outbox entry after the quiz has ended', async () => {
    let createCalled = false
    const database = {
      $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
        callback({
          $queryRaw: async () => [
            {
              isAssessmentEnabled: false,
              responseCollectionMode: 'CORRELATED_EXPORT',
              status: 'ENDED',
            },
          ],
          liveQuizPendingResponse: {
            create: async () => {
              createCalled = true
            },
          },
        }),
    } as any

    assert.equal(
      await registerPendingCorrelatedResponse({
        database,
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        messageId: '22222222-2222-4222-8222-222222222222',
        responseKey: 'claim-key',
        eventPayload: 'encrypted-payload',
      }),
      'not_found'
    )
    assert.equal(createCalled, false)
  })

  it('rejects a second pending response for the same respondent execution', async () => {
    assert.equal(
      await registerPendingCorrelatedResponse({
        database: {
          $transaction: async () => {
            throw { code: 'P2002' }
          },
        } as any,
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        messageId: '22222222-2222-4222-8222-222222222222',
        responseKey: 'claim-key',
        eventPayload: 'encrypted-payload',
      }),
      'duplicate'
    )
  })

  it('encrypts outbox events and rejects tampering', () => {
    const message = {
      messageId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      response: { value: 'private response' },
      responseTimestamp: 1_000,
      instanceInfo: { blockExecution: '1', sessionBlockId: 'block-1' },
      acceptedIdentity: {
        kind: 'anonymous' as const,
        id: '33333333-3333-4333-8333-333333333333',
      },
    }
    const eventPayload = encryptCorrelatedResponseEvent({
      message,
      secret: 'app-secret',
    })

    assert.equal(eventPayload.includes('private response'), false)
    assert.deepEqual(
      decryptCorrelatedResponseEvent({
        encryptedPayload: eventPayload,
        secret: 'app-secret',
      }),
      message
    )
    const payloadParts = eventPayload.split('.')
    const tamperedCiphertext = Buffer.from(payloadParts[3]!, 'base64url')
    tamperedCiphertext[0] ^= 1
    payloadParts[3] = tamperedCiphertext.toString('base64url')
    assert.throws(() =>
      decryptCorrelatedResponseEvent({
        encryptedPayload: payloadParts.join('.'),
        secret: 'app-secret',
      })
    )

    const invalidPayload = encryptCorrelatedResponseEvent({
      message: { ...message, response: null } as any,
      secret: 'app-secret',
    })
    assert.throws(() =>
      decryptCorrelatedResponseEvent({
        encryptedPayload: invalidPayload,
        secret: 'app-secret',
      })
    )
  })

  it('reserves and republishes outbox events by stable message id', async () => {
    const message = {
      messageId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      response: { value: 'response' },
      responseTimestamp: 1_000,
      instanceInfo: { blockExecution: '1', sessionBlockId: 'block-1' },
      acceptedIdentity: {
        kind: 'participant' as const,
        id: '33333333-3333-4333-8333-333333333333',
      },
    }
    const pushes: unknown[] = []
    const result = await dispatchPendingCorrelatedResponses({
      database: {
        $queryRaw: async () => [{ id: message.messageId }],
      } as any,
      pushEvent: async (eventName, eventMessage) => {
        pushes.push({ eventName, eventMessage })
      },
      now: new Date('2026-07-29T12:00:00.000Z'),
    })

    assert.deepEqual(result, { attempted: 1, failed: 0 })
    assert.deepEqual(pushes, [
      {
        eventName: 'response-received:correlated-v1',
        eventMessage: { messageId: message.messageId },
      },
    ])
  })

  it('retains failed outbox events for a later reservation', async () => {
    const messageId = '22222222-2222-4222-8222-222222222222'
    const result = await dispatchPendingCorrelatedResponses({
      database: {
        $queryRaw: async () => [{ id: messageId }],
      } as any,
      pushEvent: async () => {
        throw new Error('ambiguous publication failure')
      },
    })

    assert.deepEqual(result, { attempted: 1, failed: 1 })
  })
})

describe('live quiz respondent cookie', () => {
  it('uses a host-only cookie with the same lifetime as the signed token', () => {
    assert.equal(
      serializeLiveQuizRespondentCookie({
        token: 'signed-token',
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        secure: true,
      }),
      'live_quiz_respondent_token_11111111-1111-4111-8111-111111111111=signed-token; Max-Age=1209600; Path=/; HttpOnly; Secure; SameSite=Lax'
    )
  })
})

describe('live quiz PIN access', () => {
  it('allows quizzes without PIN protection', () => {
    assert.equal(
      hasValidLiveQuizPin({
        cookieHeader: undefined,
        liveQuizId: 'quiz-1',
        pinCode: null,
      }),
      true
    )
  })

  it('requires the quiz-scoped PIN cookie', () => {
    assert.equal(
      hasValidLiveQuizPin({
        cookieHeader: 'live-quiz-pin-other=ABC123; live-quiz-pin-quiz-1=DEF456',
        liveQuizId: 'quiz-1',
        pinCode: 'DEF456',
      }),
      true
    )
    assert.equal(
      hasValidLiveQuizPin({
        cookieHeader: 'live-quiz-pin-quiz-1=WRONG1',
        liveQuizId: 'quiz-1',
        pinCode: 'DEF456',
      }),
      false
    )
  })
})

describe('response collection mode', () => {
  it('uses cached correlated mode without a database lookup', async () => {
    let lookupCalled = false

    assert.equal(
      await resolveResponseCollectionMode({
        cachedMode: 'CORRELATED_EXPORT',
        liveQuizId: 'quiz-1',
        lookupMode: async () => {
          lookupCalled = true
          return 'AGGREGATED_ANONYMOUS'
        },
      }),
      'CORRELATED_EXPORT'
    )
    assert.equal(lookupCalled, false)
  })

  it('falls back to the stored mode for rolling deployments', async () => {
    assert.equal(
      await resolveResponseCollectionMode({
        cachedMode: undefined,
        liveQuizId: 'quiz-1',
        lookupMode: async () => 'CORRELATED_EXPORT',
      }),
      'CORRELATED_EXPORT'
    )
  })
})
