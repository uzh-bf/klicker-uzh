import { describe, expect, it } from 'vitest'
import {
  LecturerMcpAuthError,
  bearerTokenFromHeaders,
  verifyLecturerSession,
} from '../src/auth.js'
import { signLecturerJwt } from '../src/jwt.js'

const TEST_SECRET = 'lecturer-mcp-secret'
const TEST_ISSUER = 'https://auth.klicker.test'

const settings = {
  jwtIssuer: TEST_ISSUER,
  jwtSecret: TEST_SECRET,
}

async function signLecturerToken(
  payload: Record<string, unknown> = {}
): Promise<string> {
  return signLecturerJwt(
    {
      sub: 'lecturer-a',
      role: 'USER',
      purpose: 'lecturer-mcp',
      scope: 'manage:read manage:draft',
      ...payload,
    },
    TEST_SECRET,
    {
      expiresIn: '300s',
      issuer: TEST_ISSUER,
    }
  )
}

describe('lecturer MCP auth', () => {
  it('extracts bearer tokens case-insensitively', () => {
    expect(
      bearerTokenFromHeaders({ authorization: 'Bearer lecturer-token' })
    ).toBe('lecturer-token')
    expect(
      bearerTokenFromHeaders({ authorization: 'bearer lecturer-token' })
    ).toBe('lecturer-token')
    expect(bearerTokenFromHeaders({ authorization: 'Basic nope' })).toBeNull()
  })

  it('verifies lecturer MCP token claims and scopes', async () => {
    const token = await signLecturerToken()

    const session = await verifyLecturerSession(token, settings)

    expect(session).toEqual({
      bearerToken: token,
      scopes: ['manage:read', 'manage:draft'],
      userId: 'lecturer-a',
    })
  })

  it('rejects participant or generic user tokens', async () => {
    const participantToken = await signLecturerToken({
      purpose: undefined,
      role: 'PARTICIPANT',
    })

    await expect(
      verifyLecturerSession(participantToken, settings)
    ).rejects.toBeInstanceOf(LecturerMcpAuthError)
  })

  it('keeps a read-only token authenticated with only its own scope', async () => {
    const token = await signLecturerToken({ scope: 'manage:read' })

    const session = await verifyLecturerSession(token, settings)

    expect(session.scopes).toEqual(['manage:read'])
  })

  it('rejects a token that carries no lecturer scope', async () => {
    const token = await signLecturerToken({ scope: 'practice:read' })

    await expect(verifyLecturerSession(token, settings)).rejects.toBeInstanceOf(
      LecturerMcpAuthError
    )
  })

  it('rejects a student MCP token', async () => {
    const token = await signLecturerToken({
      purpose: 'student-mcp',
      role: 'PARTICIPANT',
      scope: 'student:practice:read student:practice:submit',
    })

    await expect(verifyLecturerSession(token, settings)).rejects.toBeInstanceOf(
      LecturerMcpAuthError
    )
  })
})
