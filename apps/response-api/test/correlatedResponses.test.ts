import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { LiveQuizRespondentType } from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
  decryptCorrelatedResponseEvent,
  encryptCorrelatedResponseEvent,
} from '@klicker-uzh/util'
import {
  admitCorrelatedResponse,
  getCorrelatedResponseAdmission,
  hasValidLiveQuizPin,
  serializeLiveQuizRespondentCookie,
} from '../src/correlatedResponseAdmission.js'
import { dispatchPendingCorrelatedResponses } from '../src/correlatedResponseOutbox.js'
import {
  adaptLiveQuizResponseInstanceInfo,
  hasJsonContentType,
  isAllowedCorsOrigin,
  loadLiveQuizResponseInstance,
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

  it('adapts the operational Redis hash before strict response validation', async () => {
    const rawInstanceInfo = {
      namespace: 'quiz-namespace',
      startedAt: '1754000000000',
      sessionBlockId: '7',
      liveQuizId: 'quiz-1',
      courseId: 'course-1',
      type: 'SELECTION',
      basePoints: 'true',
      pointsMultiplier: '1',
      defaultPoints: '10',
      defaultCorrectPoints: '5',
      maxBonusPoints: '45',
      timeToZeroBonus: '20',
      blockExecution: '3',
      blockStartedAt: '1754000000000',
      responseCollectionMode: 'CORRELATED_EXPORT',
      numberOfInputs: '2',
      selectionAnswerIds: '[11,12]',
      solutions: '[11]',
    }

    const loaded = await loadLiveQuizResponseInstance({
      database: {
        liveQuiz: {
          findUnique: async () => {
            throw new Error('database mode lookup should not be needed')
          },
        },
      } as any,
      redis: {
        hgetall: async () => rawInstanceInfo,
      },
      request: {
        messageId: 'message-1',
        liveQuizId: 'quiz-1',
        instanceId: '42',
        response: { selection: [11, 12] },
        responseTimestamp: 1_000,
        cookieHeader: undefined,
      },
    })

    assert.equal(loaded.responseCollectionMode, 'CORRELATED_EXPORT')
    assert.deepEqual(loaded.instanceInfo, {
      type: 'SELECTION',
      blockExecution: '3',
      sessionBlockId: '7',
      basePoints: 'true',
      defaultCorrectPoints: '5',
      defaultPoints: '10',
      maxBonusPoints: '45',
      pointsMultiplier: '1',
      selectionAnswerIds: '[11,12]',
      solutions: '[11]',
      timeToZeroBonus: '20',
      numberOfInputs: '2',
    })

    const caseStudyInfo = adaptLiveQuizResponseInstanceInfo({
      type: 'CASE_STUDY',
      blockExecution: '3',
      sessionBlockId: '7',
      solutions: JSON.stringify([
        {
          caseId: 'case-a',
          itemSolutions: [
            {
              itemId: 11,
              criteriaSolutions: [
                { criterionId: 'criterion-a', min: 0, max: 5 },
              ],
            },
          ],
        },
      ]),
    })
    assert.deepEqual(JSON.parse(caseStudyInfo.caseStudyResponseShape!), {
      cases: ['case-a'],
      items: [11],
      criteria: [{ id: 'criterion-a', min: 0, max: 5 }],
    })
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

  it('atomically bridges an active temporary identity and registers its outbox event', async () => {
    const respondentId = '33333333-3333-4333-8333-333333333333'
    let respondentCreated = false
    const createCalls: any[] = []
    let lockQuery = ''
    const result = await admitCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async (strings: TemplateStringsArray) => {
              lockQuery = strings.join('?')
              return [
                {
                  activeBlockId: 7,
                  blockExecution: 3,
                  blockId: 7,
                  blockStatus: 'ACTIVE',
                  isAssessmentEnabled: false,
                  pinCode: null,
                  responseCollectionMode: 'CORRELATED_EXPORT',
                  status: 'PUBLISHED',
                },
              ]
            },
            temporaryLeaderboardEntry: {
              findUnique: async () => ({ id: respondentId }),
            },
            liveQuizRespondent: {
              upsert: async () => {
                respondentCreated = true
                return {
                  id: respondentId,
                  liveQuizId: '11111111-1111-4111-8111-111111111111',
                  type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
                }
              },
            },
            liveQuizPendingResponse: {
              create: async (args: any) => {
                createCalls.push(args)
                return args.data
              },
            },
          }),
      } as any,
      identity: {
        kind: 'temporary',
        id: respondentId,
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        token: 'signed-token',
        cookieName: 'temporary_participant_token',
      },
      liveQuizId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      messageId: '22222222-2222-4222-8222-222222222222',
      response: { value: 'private response' },
      responseTimestamp: 1_000,
      instanceInfo: {
        type: 'FREE_TEXT',
        blockExecution: '3',
        sessionBlockId: '7',
      },
      cookieHeader: undefined,
      secret: 'app-secret',
      nextDeliveryAt: new Date('2026-07-29T12:00:00.000Z'),
    })

    assert.equal(result.status, 'registered')
    assert.equal(respondentCreated, true)
    assert.match(lockQuery, /FOR SHARE OF quiz, block/)
    assert.equal(createCalls.length, 1)
    assert.deepEqual(
      decryptCorrelatedResponseEvent({
        encryptedPayload: createCalls[0].data.eventPayload,
        secret: 'app-secret',
      }),
      {
        messageId: '22222222-2222-4222-8222-222222222222',
        sessionId: '11111111-1111-4111-8111-111111111111',
        instanceId: '42',
        response: { value: 'private response' },
        responseTimestamp: 1_000,
        acceptedIdentity: { kind: 'temporary', id: respondentId },
        instanceInfo: {
          type: 'FREE_TEXT',
          blockExecution: '3',
          sessionBlockId: '7',
        },
      }
    )
    assert.equal(
      createCalls[0].data.responseKey,
      buildCorrelatedResponseKey({
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        instanceId: '42',
        blockExecution: '3',
        identityKey: `respondent:${respondentId}`,
      })
    )
  })

  it('does not create identities or outbox entries after the quiz has ended', async () => {
    let respondentCreated = false
    let createCalled = false
    const result = await admitCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                activeBlockId: null,
                blockExecution: 3,
                blockId: 7,
                blockStatus: 'EXECUTED',
                isAssessmentEnabled: false,
                pinCode: null,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'ENDED',
              },
            ],
            liveQuizRespondent: {
              upsert: async () => {
                respondentCreated = true
              },
            },
            liveQuizPendingResponse: {
              create: async () => {
                createCalled = true
              },
            },
          }),
      } as any,
      identity: {
        kind: 'anonymous',
        id: '33333333-3333-4333-8333-333333333333',
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        token: 'signed-token',
        cookieName:
          'live_quiz_respondent_token_11111111-1111-4111-8111-111111111111',
      },
      liveQuizId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      messageId: '22222222-2222-4222-8222-222222222222',
      response: { value: 'private response' },
      responseTimestamp: 1_000,
      instanceInfo: {
        type: 'FREE_TEXT',
        blockExecution: '3',
        sessionBlockId: '7',
      },
      cookieHeader: undefined,
      secret: 'app-secret',
    })

    assert.equal(result.status, 'not_found')
    assert.equal(respondentCreated, false)
    assert.equal(createCalled, false)
  })

  it('rejects empty correlated metadata identifiers before persistence', async () => {
    const result = await admitCorrelatedResponse({
      database: {} as any,
      identity: {
        kind: 'anonymous',
        id: '33333333-3333-4333-8333-333333333333',
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        token: 'signed-token',
        cookieName:
          'live_quiz_respondent_token_11111111-1111-4111-8111-111111111111',
      },
      liveQuizId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      messageId: '22222222-2222-4222-8222-222222222222',
      response: { value: 'private response' },
      responseTimestamp: 1_000,
      instanceInfo: {
        type: 'FREE_TEXT',
        blockExecution: '',
        sessionBlockId: '7',
      },
      cookieHeader: undefined,
      secret: 'app-secret',
    })

    assert.equal(result.status, 'invalid_metadata')
  })

  it('rejects a second pending response for the same respondent execution', async () => {
    assert.equal(
      (
        await admitCorrelatedResponse({
          identity: {
            kind: 'participant',
            id: '33333333-3333-4333-8333-333333333333',
            token: 'signed-token',
            cookieName: 'participant_token',
          },
          database: {
            $transaction: async () => {
              throw { code: 'P2002' }
            },
          } as any,
          liveQuizId: '11111111-1111-4111-8111-111111111111',
          instanceId: '42',
          messageId: '22222222-2222-4222-8222-222222222222',
          response: { value: 'private response' },
          responseTimestamp: 1_000,
          instanceInfo: {
            type: 'FREE_TEXT',
            blockExecution: '3',
            sessionBlockId: '7',
          },
          cookieHeader: undefined,
          secret: 'app-secret',
        })
      ).status,
      'duplicate'
    )
  })

  it('checks PIN access inside the locked admission transaction', async () => {
    let identityCreated = false
    let outboxCreated = false
    const result = await admitCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                activeBlockId: 7,
                blockExecution: 3,
                blockId: 7,
                blockStatus: 'ACTIVE',
                isAssessmentEnabled: false,
                pinCode: 'ABC123',
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'PUBLISHED',
              },
            ],
            liveQuizRespondent: {
              upsert: async () => {
                identityCreated = true
              },
            },
            liveQuizPendingResponse: {
              create: async () => {
                outboxCreated = true
              },
            },
          }),
      } as any,
      identity: {
        kind: 'anonymous',
        id: '33333333-3333-4333-8333-333333333333',
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        token: 'signed-token',
        cookieName:
          'live_quiz_respondent_token_11111111-1111-4111-8111-111111111111',
      },
      liveQuizId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      messageId: '22222222-2222-4222-8222-222222222222',
      response: { value: 'private response' },
      responseTimestamp: 1_000,
      instanceInfo: {
        type: 'FREE_TEXT',
        blockExecution: '3',
        sessionBlockId: '7',
      },
      cookieHeader: 'live-quiz-pin-11111111-1111-4111-8111-111111111111=WRONG',
      secret: 'app-secret',
    })

    assert.deepEqual(result, { status: 'pin_required' })
    assert.equal(identityCreated, false)
    assert.equal(outboxCreated, false)
  })

  it('encrypts outbox events and rejects tampering', () => {
    const message = {
      messageId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      instanceId: '42',
      response: { value: 'private response' },
      responseTimestamp: 1_000,
      instanceInfo: {
        type: 'FREE_TEXT' as const,
        blockExecution: '1',
        sessionBlockId: '7',
      },
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

    assert.throws(() =>
      encryptCorrelatedResponseEvent({
        message: { ...message, response: null } as any,
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
      instanceInfo: {
        type: 'FREE_TEXT' as const,
        blockExecution: '1',
        sessionBlockId: '7',
      },
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
