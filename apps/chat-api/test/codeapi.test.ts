import { createHash, generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { createCodeApiAuthorization } from '../src/runtime/codeapi.js'

const keys = generateKeyPairSync('ed25519')
const config = {
  CHAT_CODEAPI_ENABLED: 'true',
  CHAT_CODEAPI_JWT_PRIVATE_KEY: keys.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString(),
  CHAT_CODEAPI_JWT_ISSUER: 'synthetic-host',
  CHAT_CODEAPI_JWT_AUDIENCE: 'synthetic-execution',
  CHAT_CODEAPI_JWT_KEY_ID: 'synthetic-key',
  CHAT_CODEAPI_TENANT_ID: 'synthetic-tenant',
  CHAT_CODEAPI_PILOT_CHATBOT_IDS: '["synthetic-pilot"]',
}
const admission = {
  chatbot: { id: 'synthetic-pilot' },
  participantId: 'synthetic-participant',
  runId: 'synthetic-run',
  mode: 'tutor',
}

describe('host Python capability', () => {
  test('stays disabled without configuration and admits only an allowlisted Tutor', async () => {
    expect(await createCodeApiAuthorization({})(admission)).toBeNull()
    const authorize = createCodeApiAuthorization(config)
    expect(await authorize({ ...admission, mode: 'explainer' })).toBeNull()
    expect(
      await authorize({ ...admission, chatbot: { id: 'other-pilot' } })
    ).toBeNull()
  })

  test('issues verifiable, short-lived isolated scope without exposing the signing key', async () => {
    const authorize = createCodeApiAuthorization(config)
    const result = await authorize(admission)
    expect(result?.tools).toMatchObject([
      { serverId: 'catalyst-codeapi', name: 'run_python' },
    ])
    const segments = result!.executionToken.split('.')
    expect(
      verify(
        null,
        Buffer.from(`${segments[0]}.${segments[1]}`),
        keys.publicKey,
        Buffer.from(segments[2]!, 'base64url')
      )
    ).toBe(true)
    const claims = JSON.parse(Buffer.from(segments[1]!, 'base64url').toString())
    const subject = createHash('sha256')
      .update(
        JSON.stringify([
          'klicker-codeapi-sub-v1',
          config.CHAT_CODEAPI_TENANT_ID,
          admission.participantId,
        ])
      )
      .digest('hex')
    expect(claims).toMatchObject({
      iss: config.CHAT_CODEAPI_JWT_ISSUER,
      aud: config.CHAT_CODEAPI_JWT_AUDIENCE,
      sub: subject,
      chatbot_id: admission.chatbot.id,
      run_id: admission.runId,
      principal_source: 'external:klicker',
    })
    expect(claims.exp - claims.iat).toBe(120)
    expect(claims.nbf).toBe(claims.iat)
    const second = await authorize({ ...admission, runId: 'second-run' })
    const secondClaims = JSON.parse(
      Buffer.from(second!.executionToken.split('.')[1]!, 'base64url').toString()
    )
    expect(secondClaims.jti).not.toBe(claims.jti)
    expect(secondClaims.run_id).toBe('second-run')
    expect(JSON.stringify(result)).not.toContain(
      config.CHAT_CODEAPI_JWT_PRIVATE_KEY
    )
  })

  test('fails closed on an enabled misconfiguration with values-free errors', () => {
    expect(() =>
      createCodeApiAuthorization({
        ...config,
        CHAT_CODEAPI_JWT_PRIVATE_KEY: 'invalid-synthetic-key',
      })
    ).toThrow('CodeAPI host configuration is invalid')
    expect(() =>
      createCodeApiAuthorization({
        ...config,
        CHAT_CODEAPI_PILOT_CHATBOT_IDS: '[]',
      })
    ).toThrow('CodeAPI host configuration is invalid')
  })
})
