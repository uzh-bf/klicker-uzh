import { timingSafeEqual } from 'node:crypto'
import { importSPKI, jwtVerify } from 'jose'

export {
  assertLocalSeedOwnership,
  LOCAL_CHATBOT_ID,
  LOCAL_COURSE_ID,
  LOCAL_COURSE_PIN,
  LOCAL_COURSE_PIN_CODE,
  LOCAL_FIXTURE_MARKER,
  LOCAL_KB_ID,
  LOCAL_MCP_SERVER_ID,
  LOCAL_MCP_URL,
  LOCAL_OWNER_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
  LOCAL_SERVER_NAME,
  LOCAL_SERVER_URL,
  normalizeLocalMcpConfigurations,
} from '../src/lib/server/localMcpFixture.mjs'

import {
  LOCAL_CHATBOT_ID,
  LOCAL_KB_ID,
} from '../src/lib/server/localMcpFixture.mjs'

export async function createLocalAuthenticator(env) {
  for (const name of [
    'LOCAL_MCP_TRANSPORT_TOKEN',
    'LOCAL_MCP_PUBLIC_KEY',
    'LOCAL_MCP_GENERATION',
    'DOC_QUERY_SCOPE_KID',
    'DOC_QUERY_SCOPE_ISSUER',
    'DOC_QUERY_SCOPE_AUDIENCE',
  ]) {
    if (!env?.[name])
      throw new Error('Local MCP authentication is not configured')
  }

  const expected = Buffer.from(`Bearer ${env.LOCAL_MCP_TRANSPORT_TOKEN}`)
  const publicKey = await importSPKI(env.LOCAL_MCP_PUBLIC_KEY, 'ES256')

  return async (headers) => {
    try {
      if (!headers || typeof headers.authorization !== 'string') return false

      const actual = Buffer.from(headers.authorization)
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        return false
      }

      const scoped = headers['x-doc-query-scope-token']
      if (typeof scoped !== 'string' || !scoped.startsWith('Bearer '))
        return false

      const { payload, protectedHeader } = await jwtVerify(
        scoped.slice(7),
        publicKey,
        {
          algorithms: ['ES256'],
          typ: 'JWT',
          issuer: env.DOC_QUERY_SCOPE_ISSUER,
          audience: env.DOC_QUERY_SCOPE_AUDIENCE,
          requiredClaims: ['exp', 'iat', 'sub', 'jti', 'chatbot_id', 'kb_id'],
          maxTokenAge: 300,
        }
      )
      const boundedIdentifier = (value) =>
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= 256
      return (
        protectedHeader.kid === env.DOC_QUERY_SCOPE_KID &&
        payload.chatbot_id === LOCAL_CHATBOT_ID &&
        payload.kb_id === LOCAL_KB_ID &&
        Number.isInteger(payload.iat) &&
        Number.isInteger(payload.exp) &&
        payload.exp > payload.iat &&
        payload.exp - payload.iat <= 300 &&
        boundedIdentifier(payload.sub) &&
        boundedIdentifier(payload.jti)
      )
    } catch {
      return false
    }
  }
}
