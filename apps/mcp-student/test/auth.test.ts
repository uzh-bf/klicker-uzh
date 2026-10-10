import { signJWT } from '@klicker-uzh/util'
import { describe, expect, it } from 'vitest'
import {
  StudentMcpAuthError,
  bearerTokenFromHeaders,
  verifyParticipantSession,
} from '../src/auth.js'

const TEST_SECRET = 'student-mcp-secret'
const TEST_ISSUER = 'https://auth.klicker.test'
const ALL_SCOPES = 'student:practice:read student:practice:submit'

const settings = {
  jwtIssuer: TEST_ISSUER,
  jwtSecret: TEST_SECRET,
}

async function signParticipantToken(
  payload: Record<string, unknown> = {},
  secret = TEST_SECRET
): Promise<string> {
  return signJWT(
    {
      sub: 'participant-a',
      role: 'PARTICIPANT',
      purpose: 'student-mcp',
      scope: ALL_SCOPES,
      actor: 'account',
      ...payload,
    },
    secret,
    {
      expiresIn: '300s',
      issuer: TEST_ISSUER,
    }
  )
}

async function expectRejected(token: string) {
  const error = await verifyParticipantSession(token, settings).catch(
    (caught: unknown) => caught
  )

  expect(error).toBeInstanceOf(StudentMcpAuthError)
  expect((error as StudentMcpAuthError).message).toMatch(
    /^Authentication failed:/
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
    expect(bearerTokenFromHeaders({})).toBeNull()
  })

  it('verifies a participant token and returns its session', async () => {
    const token = await signParticipantToken()

    const session = await verifyParticipantSession(token, settings)

    expect(session).toEqual({
      actor: 'account',
      bearerToken: token,
      participantId: 'participant-a',
      scopes: ['student:practice:read', 'student:practice:submit'],
    })
  })

  it('keeps the LTI guest actor kind visible to tool policy', async () => {
    const token = await signParticipantToken({ actor: 'anonymous' })

    const session = await verifyParticipantSession(token, settings)

    expect(session.actor).toBe('anonymous')
  })

  it('rejects an unverifiable token', async () => {
    await expectRejected('not-a-jwt')
  })

  it('rejects a non-participant token', async () => {
    await expectRejected(await signParticipantToken({ role: 'USER' }))
  })

  // An ordinary participant session token carries the same subject and role
  // and is signed for the same participant. Only the purpose claim keeps it
  // out of the MCP service, so this case must stay red if that check goes.
  it('rejects a participant session token that was not minted for MCP', async () => {
    await expectRejected(
      await signParticipantToken({
        actor: undefined,
        purpose: undefined,
        scope: undefined,
      })
    )
  })

  it('rejects a lecturer MCP token', async () => {
    await expectRejected(
      await signParticipantToken({
        purpose: 'lecturer-mcp',
        role: 'USER',
        scope: 'manage:read manage:draft',
      })
    )
  })

  it('rejects a token without a known actor kind', async () => {
    await expectRejected(await signParticipantToken({ actor: 'root' }))
  })

  it('rejects a token that carries no student scope', async () => {
    await expectRejected(await signParticipantToken({ scope: 'manage:read' }))
  })

  it('rejects a token signed with another secret', async () => {
    await expectRejected(await signParticipantToken({}, 'other-secret'))
  })
})
