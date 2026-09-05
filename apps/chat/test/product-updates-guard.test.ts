import { UserRole } from '@klicker-uzh/prisma/client'
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// The guard module talks to Prisma for its chatbot lookups. The token guards
// under test never reach the database, so an empty client is enough.
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { chatbot: { findUnique: vi.fn() } },
}))

import {
  getParticipantId,
  getProductUpdateParticipantId,
} from '../src/lib/server/apiGuards'

// HS256 refuses a key shorter than the digest, so this synthetic value is
// deliberately long. It exists only inside this file.
const TEST_APP_SECRET = 'chat-product-updates-guard-test-signing-value'
const PARTICIPANT_ID = '3f2b1a09-8c7d-4e6f-9a5b-2c1d0e9f8a7b'

async function signParticipantToken(role: UserRole): Promise<string> {
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(PARTICIPANT_ID)
    .sign(new TextEncoder().encode(TEST_APP_SECRET))
}

function requestWithToken(token?: string) {
  return new NextRequest('http://localhost/api/product-updates', {
    headers: token ? { cookie: `participant_token=${token}` } : {},
  })
}

describe('getProductUpdateParticipantId', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', TEST_APP_SECRET)
    // The invalid-token path logs the verification failure on purpose.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  test('rejects a request without a participant token', async () => {
    const result = await getProductUpdateParticipantId(requestWithToken())

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({
        error: 'No authentication token found',
      })
    }
  })

  test('rejects a token that does not verify', async () => {
    const result = await getProductUpdateParticipantId(
      requestWithToken('not-a-signed-token')
    )

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Invalid authentication token',
      })
    }
  })

  // The temporary accounts issued for anonymous live-quiz participation carry a
  // valid token and a subject, so only the role check keeps them off this
  // surface. Loosening it would silently open product updates to them.
  test('rejects a valid token from a temporary participant', async () => {
    const token = await signParticipantToken(UserRole.TEMPORARY_PARTICIPANT)

    const result = await getProductUpdateParticipantId(requestWithToken(token))

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(403)
      await expect(result.response.json()).resolves.toEqual({
        error: 'This account type does not receive product updates',
      })
    }
  })

  test('returns the participant id for a full participant', async () => {
    const token = await signParticipantToken(UserRole.PARTICIPANT)

    const result = await getProductUpdateParticipantId(requestWithToken(token))

    expect(result).toEqual({ participantId: PARTICIPANT_ID })
  })

  // The shared token check is the same for both guards, so this is the one
  // behaviour that must stay different: the general participant guard still
  // accepts the account types the product-update guard turns away.
  test('leaves the general participant guard open to temporary accounts', async () => {
    const token = await signParticipantToken(UserRole.TEMPORARY_PARTICIPANT)

    const result = await getParticipantId(requestWithToken(token))

    expect(result).toEqual({ participantId: PARTICIPANT_ID })
  })
})
