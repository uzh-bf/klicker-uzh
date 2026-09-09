import { timingSafeEqual } from 'node:crypto'
import { importSPKI, jwtVerify } from 'jose'

export const LOCAL_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
export const LOCAL_KB_ID = '35a72f62-a714-45f1-8b18-2cf5681b0c75'
export const LOCAL_SCOPE = {
  required: true,
  toolAlias: 'doc_query',
  kb_id: LOCAL_KB_ID,
}
export const LOCAL_FIXTURE_MARKER = { localFixture: 'authenticated-benibot-v1' }

export async function createLocalAuthenticator(env) {
  for (const name of [
    'LOCAL_MCP_TRANSPORT_TOKEN',
    'LOCAL_MCP_PUBLIC_KEY',
    'LOCAL_MCP_GENERATION',
    'DOC_QUERY_SCOPE_KID',
    'DOC_QUERY_SCOPE_ISSUER',
    'DOC_QUERY_SCOPE_AUDIENCE',
  ]) {
    if (!env[name])
      throw new Error('Local MCP authentication is not configured')
  }
  const expected = Buffer.from(`Bearer ${env.LOCAL_MCP_TRANSPORT_TOKEN}`)
  const publicKey = await importSPKI(env.LOCAL_MCP_PUBLIC_KEY, 'ES256')
  return async (headers) => {
    try {
      if (typeof headers.authorization !== 'string') return false
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

function exactObject(actual, expected) {
  return (
    actual !== null &&
    typeof actual === 'object' &&
    !Array.isArray(actual) &&
    Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => actual[key] === value)
  )
}

export function assertLocalSeedOwnership(server, configs) {
  const legacy =
    server?.authType === 'none' &&
    server.passChatbotId === true &&
    !server.authSecret &&
    (server.parameters === null || exactObject(server.parameters, {}))
  // The current seed leaves retrieval disabled until its KB binding is ready.
  // Authenticate that owned fixture without changing its activation state.
  const scopedSeed =
    server?.authType === 'scope_token' &&
    server.passChatbotId === false &&
    !server.authSecret &&
    (server.parameters === null || exactObject(server.parameters, {}))
  const authenticated =
    server?.authType === 'bearer' &&
    typeof server.authSecret === 'string' &&
    /^[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+$/i.test(server.authSecret) &&
    exactObject(server.parameters, LOCAL_FIXTURE_MARKER)
  if (
    server?.name !== 'KB' ||
    server.url !== 'http://localhost:1417/mcp' ||
    !server.isActive ||
    typeof server.passChatbotId !== 'boolean' ||
    server.chatbotIdHeader !== null ||
    (!legacy && !scopedSeed && !authenticated) ||
    configs.length !== 2 ||
    new Set(configs.map((config) => config.chatMode)).size !== 2 ||
    configs.some(
      (config) =>
        config.chatbotId !== LOCAL_CHATBOT_ID ||
        config.ownerId !== '76047345-3801-4628-ae7b-adbebcfe8821' ||
        config.courseId !== '7c12e44e-d083-4acf-845e-4c34aaff6b49' ||
        !['tutor', 'explainer'].includes(config.chatMode) ||
        (legacy
          ? config.isEnabled !== true
          : typeof config.isEnabled !== 'boolean') ||
        config.priority !== 0 ||
        !Array.isArray(config.allowedTools) ||
        config.allowedTools.length !== 1 ||
        config.allowedTools[0] !== 'doc_query' ||
        !(legacy || scopedSeed
          ? config.parameters === null || exactObject(config.parameters, {})
          : exactObject(config.parameters, LOCAL_SCOPE))
    )
  )
    throw new Error('Local MCP seed ownership conflict')
}
