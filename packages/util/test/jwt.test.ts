import { beforeAll, describe, expect, it } from 'vitest'
import { decodeJWT, signJWT, verifyJWT, type JWTPayload } from '../src/jwt.js'

describe('JWT Utilities', () => {
  const testSecret = 'test-secret-key-for-jwt-testing'
  const testPayload: JWTPayload = {
    sub: 'test-user-123',
    role: 'USER',
    email: 'test@example.com',
    catalystInstitutional: true,
    catalystIndividual: false,
  }

  describe('signJWT', () => {
    it('should create a valid JWT token', async () => {
      const token = await signJWT(testPayload, testSecret)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // Header.Payload.Signature
    })

    it('should create a token with expiration', async () => {
      const token = await signJWT(testPayload, testSecret, {
        expiresIn: '1h',
      })

      const decoded = decodeJWT(token)
      expect(decoded.exp).toBeDefined()
      expect(typeof decoded.exp).toBe('number')
    })

    it('should use HS256 algorithm by default', async () => {
      const token = await signJWT(testPayload, testSecret)
      const parts = token.split('.')
      const header = JSON.parse(Buffer.from(parts[0]!, 'base64').toString())

      expect(header.alg).toBe('HS256')
      expect(header.typ).toBe('JWT')
    })

    it('should include issued at timestamp', async () => {
      const beforeSign = Math.floor(Date.now() / 1000)
      const token = await signJWT(testPayload, testSecret)
      const afterSign = Math.floor(Date.now() / 1000)

      const decoded = decodeJWT(token)
      expect(decoded.iat).toBeDefined()
      expect(decoded.iat).toBeGreaterThanOrEqual(beforeSign)
      expect(decoded.iat).toBeLessThanOrEqual(afterSign)
    })

    it('should set issuer (iss) when provided', async () => {
      const issuer = 'klicker-uzh'
      const token = await signJWT(testPayload, testSecret, { issuer })

      const decoded = decodeJWT<JWTPayload & { iss: string }>(token)
      expect(decoded.iss).toBe(issuer)
    })
  })

  describe('verifyJWT', () => {
    let validToken: string

    beforeAll(async () => {
      validToken = await signJWT(testPayload, testSecret)
    })

    it('should verify a valid token', async () => {
      const payload = await verifyJWT(validToken, testSecret)

      expect(payload.sub).toBe(testPayload.sub)
      expect(payload.role).toBe(testPayload.role)
      expect(payload.email).toBe(testPayload.email)
      expect(payload.catalystInstitutional).toBe(
        testPayload.catalystInstitutional
      )
      expect(payload.catalystIndividual).toBe(testPayload.catalystIndividual)
    })

    it('should reject token with wrong secret', async () => {
      await expect(verifyJWT(validToken, 'wrong-secret')).rejects.toThrow()
    })

    it('should reject malformed token', async () => {
      await expect(
        verifyJWT('invalid.token.here', testSecret)
      ).rejects.toThrow()
    })

    it('should reject expired token', async () => {
      // Create a token that expires in 1 second
      const expiredToken = await signJWT(testPayload, testSecret, {
        expiresIn: '1s',
      })

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Now it should be expired (use zero clock tolerance)
      await expect(
        verifyJWT(expiredToken, testSecret, {
          clockTolerance: 0,
        })
      ).rejects.toThrow()
    })

    it('should respect clock tolerance', async () => {
      // Create a token that expires in 1 second
      const almostExpiredToken = await signJWT(testPayload, testSecret, {
        expiresIn: '1s',
      })

      // Wait for it to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Should still be valid with 5s clock tolerance (default)
      const payload = await verifyJWT(almostExpiredToken, testSecret, {
        clockTolerance: '5s',
      })
      expect(payload.sub).toBe(testPayload.sub)
    })

    it('should only accept HS256 algorithm', async () => {
      const payload = await verifyJWT(validToken, testSecret, {
        algorithms: ['HS256'],
      })
      expect(payload.sub).toBe(testPayload.sub)
    })

    it('should verify when issuer matches', async () => {
      const issuer = 'expected-issuer'
      const token = await signJWT(testPayload, testSecret, { issuer })

      const payload = await verifyJWT(token, testSecret, { issuer })
      expect(payload.sub).toBe(testPayload.sub)

      // Double-check the claim is present
      const decoded = decodeJWT<JWTPayload & { iss: string }>(token)
      expect(decoded.iss).toBe(issuer)
    })

    it('should reject when issuer does not match', async () => {
      const token = await signJWT(testPayload, testSecret, {
        issuer: 'issuer-a',
      })

      await expect(
        verifyJWT(token, testSecret, { issuer: 'issuer-b' })
      ).rejects.toThrow()
    })

    it('should reject when issuer is required but missing', async () => {
      const tokenWithoutIssuer = await signJWT(testPayload, testSecret)

      await expect(
        verifyJWT(tokenWithoutIssuer, testSecret, { issuer: 'some-issuer' })
      ).rejects.toThrow()
    })

    it('should verify without requiring issuer even if present', async () => {
      const token = await signJWT(testPayload, testSecret, {
        issuer: 'optional-issuer',
      })

      const payload = await verifyJWT(token, testSecret)
      expect(payload.sub).toBe(testPayload.sub)
    })
  })

  describe('decodeJWT', () => {
    let testToken: string

    beforeAll(async () => {
      testToken = await signJWT(testPayload, testSecret)
    })

    it('should decode token without verification', () => {
      const decoded = decodeJWT(testToken)

      expect(decoded.sub).toBe(testPayload.sub)
      expect(decoded.role).toBe(testPayload.role)
      expect(decoded.email).toBe(testPayload.email)
    })

    it('should decode token with custom type', () => {
      interface CustomPayload extends Record<string, unknown> {
        sub: string
        customField: string
      }

      const customToken = testToken // Using existing token for decode test
      const decoded = decodeJWT<CustomPayload>(customToken)

      expect(decoded.sub).toBe(testPayload.sub)
      expect(typeof decoded).toBe('object')
    })

    it('should throw on malformed token', () => {
      expect(() => decodeJWT('invalid.token')).toThrow()
    })
  })

  describe('Integration with real scenarios', () => {
    it('should handle participant token payload', async () => {
      const participantPayload: JWTPayload = {
        sub: 'participant-456',
        role: 'PARTICIPANT',
      }

      const token = await signJWT(participantPayload, testSecret, {
        expiresIn: '2w',
      })

      const verified = await verifyJWT(token, testSecret)
      expect(verified.sub).toBe('participant-456')
      expect(verified.role).toBe('PARTICIPANT')
    })

    it('should handle temporary participant token payload', async () => {
      const tempPayload: JWTPayload = {
        sub: 'temp-participant-789',
        role: 'TEMPORARY_PARTICIPANT',
      }

      const token = await signJWT(tempPayload, testSecret, {
        expiresIn: '2w',
      })

      const verified = await verifyJWT(token, testSecret)
      expect(verified.sub).toBe('temp-participant-789')
      expect(verified.role).toBe('TEMPORARY_PARTICIPANT')
    })

    it('should handle LTI token payload', async () => {
      const ltiPayload: JWTPayload = {
        sub: 'lti-user-123',
        email: 'lti@example.com',
        scope: 'LTI1.3',
      }

      const token = await signJWT(ltiPayload, testSecret, {
        expiresIn: '5m',
      })

      const verified = await verifyJWT(token, testSecret)
      expect(verified.sub).toBe('lti-user-123')
      expect(verified.email).toBe('lti@example.com')
      expect(verified.scope).toBe('LTI1.3')
    })
  })
})
