import { createHmac, randomUUID } from 'node:crypto'
import {
  assertElementImportTokenUnexpired,
  createElementImportToken,
  ELEMENT_IMPORT_TOKEN_PURPOSE,
  ELEMENT_IMPORT_TOKEN_VERSION,
  parseElementImportTokenForOwner,
} from '../src/lib/elementImportToken.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'

const SIGNING_DOMAIN = 'klicker-element-import-token'
const SECRET = 'test-element-import-token-secret'
const NOW = new Date('2026-07-13T08:00:00.000Z').getTime()
const userId = randomUUID()
const otherUserId = randomUUID()
const artifactId = randomUUID()
const jti = randomUUID()
const packageHash = 'a'.repeat(64)
const expiresAt = NOW + 60 * 60 * 1000

function signRawPayload(serializedPayload: string, secret = SECRET) {
  const encodedPayload = Buffer.from(serializedPayload, 'utf8').toString(
    'base64url'
  )
  const signature = createHmac('sha256', secret)
    .update(
      `${SIGNING_DOMAIN}\0${ELEMENT_IMPORT_TOKEN_VERSION}\0${ELEMENT_IMPORT_TOKEN_PURPOSE}\0${encodedPayload}`
    )
    .digest('base64url')
  return `${encodedPayload}.${signature}`
}

function expectTokenError(operation: () => unknown, code: string) {
  expect(operation).toThrow(expect.objectContaining({ code }))
}

describe('artifact-bound element import tokens', () => {
  const originalSecret = process.env.IMPORT_EXPORT_TOKEN_SECRET

  beforeEach(() => {
    process.env.IMPORT_EXPORT_TOKEN_SECRET = SECRET
  })

  afterAll(() => {
    if (typeof originalSecret === 'undefined') {
      delete process.env.IMPORT_EXPORT_TOKEN_SECRET
    } else {
      process.env.IMPORT_EXPORT_TOKEN_SECRET = originalSecret
    }
  })

  it('creates a canonical token and verifies owner separately from expiry', () => {
    const expectedPayload = {
      v: 1,
      purpose: 'element-import',
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    }
    const token = createElementImportToken({
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    })

    // Preserve the established byte-level format across codec refactors.
    expect(token).toBe(signRawPayload(JSON.stringify(expectedPayload)))
    const payload = parseElementImportTokenForOwner({ token, userId })
    expect(payload).toEqual(expectedPayload)
    expect(() => assertElementImportTokenUnexpired(payload, NOW)).not.toThrow()
    expectTokenError(
      () => assertElementImportTokenUnexpired(payload, expiresAt),
      ImportExportErrorCode.TOKEN_EXPIRED
    )

    // Parsing intentionally remains valid after expiry so receipt replay can be
    // resolved before the caller decides whether new work is still allowed.
    expect(parseElementImportTokenForOwner({ token, userId })).toStrictEqual(
      payload
    )
  })

  it('binds the signed token to its owner and signing secret', () => {
    const token = createElementImportToken({
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    })

    expectTokenError(
      () => parseElementImportTokenForOwner({ token, userId: otherUserId }),
      ImportExportErrorCode.TOKEN_INVALID
    )

    process.env.IMPORT_EXPORT_TOKEN_SECRET = 'rotated-secret'
    expectTokenError(
      () => parseElementImportTokenForOwner({ token, userId }),
      ImportExportErrorCode.TOKEN_INVALID
    )
  })

  it('rejects tampering and signatures with non-exact lengths', () => {
    const token = createElementImportToken({
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    })
    const separator = token.indexOf('.')
    const encodedPayload = token.slice(0, separator)
    const signature = token.slice(separator + 1)
    const tamperedPayload = `${encodedPayload.slice(0, -1)}${
      encodedPayload.endsWith('A') ? 'B' : 'A'
    }`

    for (const invalidToken of [
      `${tamperedPayload}.${signature}`,
      `${encodedPayload}.${signature.slice(1)}`,
      `${encodedPayload}.${signature}A`,
      `${encodedPayload}.${'A'.repeat(129)}`,
    ]) {
      expectTokenError(
        () =>
          parseElementImportTokenForOwner({
            token: invalidToken,
            userId,
          }),
        ImportExportErrorCode.TOKEN_INVALID
      )
    }
  })

  it('requires exactly two canonical base64url segments', () => {
    const token = createElementImportToken({
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    })
    const separator = token.indexOf('.')
    const encodedPayload = token.slice(0, separator)
    const signature = token.slice(separator + 1)

    for (const invalidToken of [
      '',
      token.replace('.', ''),
      `.${signature}`,
      `${encodedPayload}.`,
      `${token}.extra`,
      `${encodedPayload}=.${signature}`,
      `${encodedPayload}.${signature}=`,
      `${encodedPayload}.${signature}.`,
    ]) {
      expectTokenError(
        () =>
          parseElementImportTokenForOwner({
            token: invalidToken,
            userId,
          }),
        ImportExportErrorCode.TOKEN_INVALID
      )
    }
  })

  it.each([
    ['wrong version', { v: 2 }],
    ['wrong purpose', { purpose: 'import-upload' }],
    ['invalid user id', { userId: 'not-a-uuid' }],
    ['invalid artifact id', { artifactId: 'not-a-uuid' }],
    ['uppercase package hash', { packageHash: 'A'.repeat(64) }],
    ['invalid package hash', { packageHash: 'a'.repeat(63) }],
    ['invalid expiry', { expiresAt: 0 }],
    ['invalid jti', { jti: 'not-a-uuid' }],
  ])('rejects a validly signed payload with %s', (_, override) => {
    const token = signRawPayload(
      JSON.stringify({
        v: 1,
        purpose: 'element-import',
        userId,
        artifactId,
        packageHash,
        expiresAt,
        jti,
        ...override,
      })
    )

    expectTokenError(
      () => parseElementImportTokenForOwner({ token, userId }),
      ImportExportErrorCode.TOKEN_INVALID
    )
  })

  it('rejects unknown, reordered, duplicated, and non-canonical JSON fields', () => {
    const canonicalFields = {
      v: 1,
      purpose: 'element-import',
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    }
    const reordered = JSON.stringify({
      purpose: 'element-import',
      v: 1,
      userId,
      artifactId,
      packageHash,
      expiresAt,
      jti,
    })
    const duplicated = `{"v":1,"v":1,"purpose":"element-import","userId":"${userId}","artifactId":"${artifactId}","packageHash":"${packageHash}","expiresAt":${expiresAt},"jti":"${jti}"}`

    for (const serialized of [
      JSON.stringify({ ...canonicalFields, extra: true }),
      reordered,
      duplicated,
      ` ${JSON.stringify(canonicalFields)}`,
    ]) {
      const token = signRawPayload(serialized)
      expectTokenError(
        () => parseElementImportTokenForOwner({ token, userId }),
        ImportExportErrorCode.TOKEN_INVALID
      )
    }
  })

  it('preserves parser failures as the cause of the invalid-token error', () => {
    expect.assertions(2)

    try {
      parseElementImportTokenForOwner({
        token: signRawPayload('not-json'),
        userId,
      })
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({ code: ImportExportErrorCode.TOKEN_INVALID })
      )
      expect((error as Error).cause).toBeInstanceOf(SyntaxError)
    }
  })

  it('bounds the encoded payload and complete token before decoding', () => {
    const oversizedPayload = 'A'.repeat(2049)
    const signature = createHmac('sha256', SECRET)
      .update(
        `${SIGNING_DOMAIN}\0${ELEMENT_IMPORT_TOKEN_VERSION}\0${ELEMENT_IMPORT_TOKEN_PURPOSE}\0${oversizedPayload}`
      )
      .digest('base64url')

    for (const token of [
      `${oversizedPayload}.${signature}`,
      `${'A'.repeat(2200)}.${'A'.repeat(128)}`,
    ]) {
      expectTokenError(
        () => parseElementImportTokenForOwner({ token, userId }),
        ImportExportErrorCode.TOKEN_INVALID
      )
    }
  })

  it('rejects invalid signing identities before producing a token', () => {
    expect(() =>
      createElementImportToken({
        userId,
        artifactId,
        packageHash: 'A'.repeat(64),
        expiresAt,
        jti,
      })
    ).toThrow(TypeError)
  })
})
