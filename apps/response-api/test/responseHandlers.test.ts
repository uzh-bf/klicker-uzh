import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  CORRELATED_RESPONSE_EVENT,
  createLiveQuizRespondentToken,
  decryptCorrelatedResponseEvent,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  resolveLiveQuizResponseIdentity,
} from '@klicker-uzh/util'
import { handleAggregateResponse } from '../src/aggregateResponse.js'
import { handleCorrelatedResponse } from '../src/correlatedResponseHandler.js'
import { getCorrelatedResponseInitializationToken } from '../src/liveQuizResponseInitialization.js'
import type { LiveQuizResponseRequest } from '../src/liveQuizResponseRequest.js'

const request: LiveQuizResponseRequest = {
  messageId: '11111111-1111-4111-8111-111111111111',
  liveQuizId: '22222222-2222-4222-8222-222222222222',
  instanceId: '42',
  response: { choices: [{ ix: 0, selected: true }] },
  responseTimestamp: 1_754_000_000_000,
  cookieHeader: undefined,
}

describe('standard live quiz response handlers', () => {
  it('does not expose an existing respondent cookie token to page JavaScript', async () => {
    const secret = 'test-secret'
    const issuer = 'https://api.test'
    const token = await createLiveQuizRespondentToken({
      respondentId: '33333333-3333-4333-8333-333333333333',
      liveQuizId: request.liveQuizId,
      secret,
      issuer,
    })
    const identity = await resolveLiveQuizResponseIdentity({
      cookieHeader: `${getLiveQuizRespondentCookieName(request.liveQuizId)}=${token}`,
      liveQuizId: request.liveQuizId,
      secret,
      issuer,
    })

    assert.ok(identity)
    assert.equal(
      getCorrelatedResponseInitializationToken({
        created: false,
        identity,
        allowTokenFallback: true,
      }),
      undefined
    )
    assert.equal(
      getCorrelatedResponseInitializationToken({
        created: true,
        identity,
        allowTokenFallback: false,
      }),
      undefined
    )
    assert.equal(
      getCorrelatedResponseInitializationToken({
        created: true,
        identity,
        allowTokenFallback: true,
      }),
      token
    )
  })

  it('rejects correlated collection on the aggregate endpoint', async () => {
    let pushed = false
    const result = await handleAggregateResponse({
      request,
      responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      pushEvent: async () => {
        pushed = true
      },
    })

    assert.deepEqual(result, {
      status: 409,
      body: {
        error: 'Response endpoint does not match live quiz collection mode',
      },
    })
    assert.equal(pushed, false)
  })

  it('rejects aggregate collection on the correlated endpoint', async () => {
    let pushed = false
    const result = await handleCorrelatedResponse({
      request,
      instanceInfo: {},
      responseCollectionMode:
        LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      database: {} as any,
      getIdentityConfig: () => {
        throw new Error('Identity configuration should not be read')
      },
      pushEvent: async () => {
        pushed = true
      },
    })

    assert.deepEqual(result, {
      status: 409,
      body: {
        error: 'Response endpoint does not match live quiz collection mode',
      },
    })
    assert.equal(pushed, false)
  })

  it('forwards only participant cookies through the aggregate handler', async () => {
    let event:
      | {
          name: string
          cookie: string | undefined
        }
      | undefined
    const result = await handleAggregateResponse({
      request: {
        ...request,
        cookieHeader:
          'unrelated=value; participant_token=participant; temporary_participant_token=temporary',
      },
      responseCollectionMode:
        LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      pushEvent: async (name, message) => {
        event = { name, cookie: message.cookie }
      },
    })

    assert.deepEqual(result, {
      status: 200,
      body: { status: 'ok', responseTimestamp: request.responseTimestamp },
    })
    assert.deepEqual(event, {
      name: 'response-received:authenticated',
      cookie:
        'participant_token=participant; temporary_participant_token=temporary',
    })
  })

  it('rejects malformed restrictions before creating a pending response', async () => {
    const secret = 'test-secret'
    const issuer = 'https://api.test'
    const token = await createLiveQuizRespondentToken({
      respondentId: '33333333-3333-4333-8333-333333333333',
      liveQuizId: request.liveQuizId,
      secret,
      issuer,
    })
    let pushed = false

    const result = await handleCorrelatedResponse({
      request: {
        ...request,
        cookieHeader: `${getLiveQuizRespondentCookieName(request.liveQuizId)}=${token}`,
      },
      instanceInfo: {
        type: 'NUMERICAL',
        blockExecution: '3',
        sessionBlockId: '7',
        restrictions: '{not-json',
      },
      responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      database: {} as any,
      getIdentityConfig: () => ({ secret, issuer }),
      pushEvent: async () => {
        pushed = true
      },
    })

    assert.deepEqual(result, {
      status: 400,
      body: { error: 'Invalid correlated response metadata' },
    })
    assert.equal(pushed, false)
  })

  it('registers and publishes only an outbox id for correlated responses', async () => {
    const secret = 'test-secret'
    const issuer = 'https://api.test'
    const respondentId = '33333333-3333-4333-8333-333333333333'
    const token = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId: request.liveQuizId,
      secret,
      issuer,
    })
    const pendingResponses: any[] = []
    let pushed:
      | {
          eventName: string
          message: unknown
        }
      | undefined
    const database = {
      liveQuiz: {
        findUnique: async () => ({
          isAssessmentEnabled: false,
          pinCode: null,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
          status: PublicationStatus.PUBLISHED,
        }),
      },
      $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
        callback({
          $queryRaw: async () => [
            {
              activeBlockId: 7,
              blockExecution: 3,
              blockId: 7,
              blockStatus: 'ACTIVE',
              isAssessmentEnabled: false,
              pinCode: null,
              responseCollectionMode:
                LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
              status: PublicationStatus.PUBLISHED,
            },
          ],
          liveQuizRespondent: {
            upsert: async () => ({
              id: respondentId,
              liveQuizId: request.liveQuizId,
              type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
              verificationSecretHash: hashLiveQuizRespondentToken(token),
            }),
          },
          liveQuizPendingResponse: {
            create: async ({ data }: { data: unknown }) => {
              pendingResponses.push(data)
            },
          },
        }),
    } as any

    const result = await handleCorrelatedResponse({
      request: {
        ...request,
        respondentToken: token,
      },
      instanceInfo: {
        type: 'SC',
        blockExecution: '3',
        sessionBlockId: '7',
        choiceCount: '1',
      },
      responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      database,
      getIdentityConfig: () => ({ secret, issuer }),
      pushEvent: async (eventName, message) => {
        pushed = { eventName, message }
      },
    })

    assert.deepEqual(result, {
      status: 200,
      body: { status: 'ok', responseTimestamp: request.responseTimestamp },
    })
    assert.deepEqual(pushed, {
      eventName: CORRELATED_RESPONSE_EVENT,
      message: { messageId: request.messageId },
    })
    assert.equal(pendingResponses.length, 1)
    const pendingResponse = pendingResponses[0]
    assert.equal(pendingResponse.id, request.messageId)
    assert.equal(
      decryptCorrelatedResponseEvent({
        encryptedPayload: pendingResponse.eventPayload,
        secret,
      }).acceptedIdentity.id,
      respondentId
    )
  })
})
