import { UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { decodeJWT, signJWT } from '../src/jwt.js'
import {
  buildLiveQuizResponseIdentityKey,
  createLiveQuizRespondentToken,
  getLiveQuizRespondentCookieName,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  resolveLiveQuizResponseIdentity,
} from '../src/liveQuizResponseIdentity.js'

const secret = 'live-quiz-response-test-secret'
const issuer = 'https://api.klicker.test'
const liveQuizId = '11111111-1111-4111-8111-111111111111'
const respondentId = '22222222-2222-4222-8222-222222222222'

describe('live quiz response identity', () => {
  it('resolves a signed anonymous respondent only for its quiz', async () => {
    const token = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })
    const cookieHeader = `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`
    const payload = decodeJWT(token)

    expect(payload.exp! - payload.iat!).toBe(
      LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS
    )
    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader,
        liveQuizId,
        secret,
        issuer,
      })
    ).resolves.toMatchObject({
      kind: 'anonymous',
      id: respondentId,
      liveQuizId,
      token,
    })

    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader,
        liveQuizId: '33333333-3333-4333-8333-333333333333',
        secret,
        issuer,
      })
    ).resolves.toBeNull()
  })

  it('rejects an anonymous respondent id without a valid signature', async () => {
    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader: `${getLiveQuizRespondentCookieName(liveQuizId)}=${respondentId}`,
        liveQuizId,
        secret,
        issuer,
      })
    ).resolves.toBeNull()
  })

  it('resolves a signed respondent token when cookies are unavailable', async () => {
    const respondentToken = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })

    const identity = await resolveLiveQuizResponseIdentity({
      cookieHeader: `${getLiveQuizRespondentCookieName(liveQuizId)}=expired`,
      respondentToken,
      liveQuizId,
      secret,
      issuer,
    })

    expect(identity).toMatchObject({
      kind: 'anonymous',
      id: respondentId,
      token: respondentToken,
    })
    expect(buildLiveQuizResponseIdentityKey(identity!)).toBe(
      `respondent:${respondentId}`
    )
  })

  it('accepts quiz-scoped and legacy temporary participant tokens', async () => {
    const scopedToken = await signJWT(
      {
        sub: respondentId,
        role: UserRole.TEMPORARY_PARTICIPANT,
        scopeQuizId: liveQuizId,
      },
      secret,
      { issuer }
    )
    const legacyToken = await signJWT(
      {
        sub: respondentId,
        role: UserRole.TEMPORARY_PARTICIPANT,
      },
      secret,
      { issuer }
    )

    for (const token of [scopedToken, legacyToken]) {
      await expect(
        resolveLiveQuizResponseIdentity({
          cookieHeader: `temporary_participant_token=${token}`,
          liveQuizId,
          secret,
          issuer,
        })
      ).resolves.toMatchObject({
        kind: 'temporary',
        id: respondentId,
        liveQuizId,
        token,
      })
    }
  })

  it('rejects a temporary participant token scoped to another quiz', async () => {
    const token = await signJWT(
      {
        sub: respondentId,
        role: UserRole.TEMPORARY_PARTICIPANT,
        scopeQuizId: '33333333-3333-4333-8333-333333333333',
      },
      secret,
      { issuer }
    )

    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader: `temporary_participant_token=${token}`,
        liveQuizId,
        secret,
        issuer,
      })
    ).resolves.toBeNull()
  })

  it('falls back from an invalid participant cookie to a valid respondent', async () => {
    const respondentToken = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })

    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader: [
          'participant_token=invalid-token',
          `${getLiveQuizRespondentCookieName(liveQuizId)}=${respondentToken}`,
        ].join('; '),
        liveQuizId,
        secret,
        issuer,
      })
    ).resolves.toMatchObject({
      kind: 'anonymous',
      id: respondentId,
    })
  })

  it('prefers a valid account participant over respondent cookies', async () => {
    const participantId = '44444444-4444-4444-8444-444444444444'
    const participantToken = await signJWT(
      { sub: participantId, role: UserRole.PARTICIPANT },
      secret,
      { issuer }
    )
    const respondentToken = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })

    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader: [
          `${getLiveQuizRespondentCookieName(liveQuizId)}=${respondentToken}`,
          `participant_token=${participantToken}`,
        ].join('; '),
        liveQuizId,
        secret,
        issuer,
      })
    ).resolves.toMatchObject({
      kind: 'participant',
      id: participantId,
      token: participantToken,
    })
  })

  it('keeps anonymous respondent cookies separate across quizzes', async () => {
    const otherQuizId = '33333333-3333-4333-8333-333333333333'
    const otherRespondentId = '55555555-5555-4555-8555-555555555555'
    const [token, otherToken] = await Promise.all([
      createLiveQuizRespondentToken({
        respondentId,
        liveQuizId,
        secret,
        issuer,
      }),
      createLiveQuizRespondentToken({
        respondentId: otherRespondentId,
        liveQuizId: otherQuizId,
        secret,
        issuer,
      }),
    ])
    const cookieHeader = [
      `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
      `${getLiveQuizRespondentCookieName(otherQuizId)}=${otherToken}`,
    ].join('; ')

    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader,
        liveQuizId,
        secret,
        issuer,
      })
    ).resolves.toMatchObject({ id: respondentId })
    await expect(
      resolveLiveQuizResponseIdentity({
        cookieHeader,
        liveQuizId: otherQuizId,
        secret,
        issuer,
      })
    ).resolves.toMatchObject({ id: otherRespondentId })
  })
})
