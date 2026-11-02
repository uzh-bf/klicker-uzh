import * as jose from 'jose'
import { describe, expect, it } from 'vitest'
import { signLecturerJwt, verifyLecturerJwt } from '../src/jwt.js'

const TEST_SECRET = 'lecturer-mcp-secret'

describe('lecturer JWT expiresIn handling', () => {
  it('honors an explicit expiresIn of 0 by setting an exp claim', async () => {
    const token = await signLecturerJwt({ sub: 'lecturer-1' }, TEST_SECRET, {
      expiresIn: 0,
    })

    const decoded = jose.decodeJwt(token)
    expect(decoded.exp).toBe(0)
  })

  it('omits the exp claim entirely when expiresIn is not provided', async () => {
    const token = await signLecturerJwt({ sub: 'lecturer-1' }, TEST_SECRET, {})

    const decoded = jose.decodeJwt(token)
    expect(decoded.exp).toBeUndefined()
  })

  it('rejects a token whose expiresIn: 0 has already elapsed', async () => {
    const token = await signLecturerJwt({ sub: 'lecturer-1' }, TEST_SECRET, {
      expiresIn: 0,
    })

    await expect(verifyLecturerJwt(token, TEST_SECRET)).rejects.toThrow(
      'Invalid token'
    )
  })

  it('still honors a normal string expiresIn', async () => {
    const token = await signLecturerJwt({ sub: 'lecturer-1' }, TEST_SECRET, {
      expiresIn: '15m',
    })

    const decoded = jose.decodeJwt(token)
    expect(typeof decoded.exp).toBe('number')
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})
