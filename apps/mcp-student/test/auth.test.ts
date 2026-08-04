import { signJWT } from '@klicker-uzh/util'
import { describe, expect, it } from 'vitest'
import {
  StudentMcpAuthError,
  bearerTokenFromHeaders,
  verifyParticipantSession,
} from '../src/auth.js'

const TEST_SECRET = 'student-mcp-secret'
const TEST_ISSUER = 'https://auth.klicker.test'

const settings = {
  appSecret: TEST_SECRET,
  jwtIssuer: TEST_ISSUER,
}

async function signParticipantToken(
  payload: Record<string, unknown> = {}
): Promise<string> {
  return signJWT(
    {
      sub: 'participant-a',
      role: 'PARTICIPANT',
      ...payload,
    },
    TEST_SECRET,
    {
      expiresIn: '300s',
      issuer: TEST_ISSUER,
    }
  )
}

describe('student MCP auth', () => {
  it('extracts bearer tokens case-insensitively', () => {
    expect(
      bearerTokenFromHeaders({ authorization: 'Bearer student-token' })
    ).toBe('student-token')
    expect(
      bearerTokenFromHeaders({ authorization: 'bearer student-token' })
    ).toBe('student-token')
    expect(bearerTokenFromHeaders({ authorization: 'Basic nope' })).toBeNull()
  })

  it('verifies a participant token and returns its session', async () => {
    const token = await signParticipantToken()

    const session = await verifyParticipantSession(token, settings)

    expect(session).toEqual({
      bearerToken: token,
      participantId: 'participant-a',
    })
  })

  it('rejects an unverifiable token with an Authentication-failed message', async () => {
    await expect(
      verifyParticipantSession('not-a-jwt', settings)
    ).rejects.toMatchObject({
      name: 'StudentMcpAuthError',
      message: expect.stringMatching(/^Authentication failed:/),
    })
  })

  it('rejects a non-participant token with an Authentication-failed message', async () => {
    const lecturerToken = await signParticipantToken({ role: 'USER' })

    const error = await verifyParticipantSession(lecturerToken, settings).catch(
      (caught: unknown) => caught
    )

    expect(error).toBeInstanceOf(StudentMcpAuthError)
    expect((error as StudentMcpAuthError).message).toMatch(
      /^Authentication failed:/
    )
  })
})
