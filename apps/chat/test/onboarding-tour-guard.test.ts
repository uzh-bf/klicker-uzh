import { UserRole } from '@klicker-uzh/prisma/client'
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// The guard module talks to Prisma for its chatbot lookups. The token guards
// under test never reach the database, so an empty client is enough.
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { chatbot: { findUnique: vi.fn() } },
}))

import { getTourParticipantId } from '../src/lib/server/apiGuards'

// HS256 refuses a key shorter than the digest, so this synthetic value is
// deliberately long. It exists only inside this file.
const TEST_APP_SECRET = 'chat-onboarding-tour-guard-test-signing-value'
const PARTICIPANT_ID = '3f2b1a09-8c7d-4e6f-9a5b-2c1d0e9f8a7b'

async function signParticipantToken(role: UserRole): Promise<string> {
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(PARTICIPANT_ID)
    .sign(new TextEncoder().encode(TEST_APP_SECRET))
}

function requestWithToken(token: string) {
  return new NextRequest('http://localhost/api/onboarding-tour', {
    headers: { cookie: `participant_token=${token}` },
  })
}

describe('getTourParticipantId', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', TEST_APP_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // The temporary accounts issued for anonymous live-quiz participation carry a
  // valid token and a subject, so only the role check keeps them off this
  // surface. Tour state hangs off a persistent account, so collecting it for an
  // account that disappears would store rows nobody ever reads again.
  test('rejects a valid token from a temporary participant', async () => {
    const token = await signParticipantToken(UserRole.TEMPORARY_PARTICIPANT)

    const result = await getTourParticipantId(requestWithToken(token))

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(403)
      // The same wording the GraphQL tour service uses for this refusal.
      await expect(result.response.json()).resolves.toEqual({
        error: 'This account type does not receive guided tours',
      })
    }
  })

  test('returns the participant id for a full participant', async () => {
    const token = await signParticipantToken(UserRole.PARTICIPANT)

    const result = await getTourParticipantId(requestWithToken(token))

    expect(result).toEqual({ participantId: PARTICIPANT_ID })
  })
})
