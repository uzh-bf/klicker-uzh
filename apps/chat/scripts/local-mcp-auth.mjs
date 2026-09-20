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

/**
 * @overload
 * @param {Record<string, string>} env
 * @param {object | null} [fixture]
 * @param {{ returnIdentity?: false }} [options]
 * @returns {Promise<(headers: Record<string, string>) => Promise<boolean>>}
 */
/**
 * @overload
 * @param {Record<string, string>} env
 * @param {object | null} fixture
 * @param {{ returnIdentity: true }} options
 * @returns {Promise<(headers: Record<string, string>) => Promise<string | false>>}
 */
export async function createLocalAuthenticator(
  env,
  fixture = null,
  { returnIdentity = false } = {}
) {
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
      const valid =
        protectedHeader.kid === env.DOC_QUERY_SCOPE_KID &&
        ((payload.chatbot_id === LOCAL_CHATBOT_ID &&
          payload.kb_id === LOCAL_KB_ID) ||
          (fixture !== null &&
            payload.chatbot_id === fixture.chatbotId &&
            payload.kb_id === fixture.kbId)) &&
        Number.isInteger(payload.iat) &&
        Number.isInteger(payload.exp) &&
        payload.exp > payload.iat &&
        payload.exp - payload.iat <= 300 &&
        boundedIdentifier(payload.sub) &&
        boundedIdentifier(payload.jti)
      return valid && (returnIdentity ? payload.chatbot_id : true)
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

export function assertLocalSeedOwnership(server, configs, fixture = null) {
  const additional = configs.filter(
    (config) => config.chatbotId !== LOCAL_CHATBOT_ID
  )
  configs = configs.filter((config) => config.chatbotId === LOCAL_CHATBOT_ID)
  if (
    additional.length > 0 &&
    (!fixture ||
      additional.length !== 1 ||
      additional.some(
        (config) =>
          config.chatbotId !== fixture.chatbotId ||
          config.ownerId !== fixture.ownerId ||
          config.courseId !== fixture.courseId ||
          config.chatMode !== fixture.chatMode ||
          !config.isEnabled ||
          config.priority !== 0 ||
          !Array.isArray(config.allowedTools) ||
          config.allowedTools.length !== 1 ||
          config.allowedTools[0] !== 'doc_query' ||
          !exactObject(config.parameters, {
            ...LOCAL_SCOPE,
            kb_id: fixture.kbId,
          })
      ))
  )
    throw new Error('Local MCP seed ownership conflict')
  const legacy =
    server?.authType === 'none' &&
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
    !server.passChatbotId ||
    server.chatbotIdHeader !== null ||
    (!legacy && !authenticated) ||
    configs.length !== 2 ||
    new Set(configs.map((config) => config.chatMode)).size !== 2 ||
    configs.some(
      (config) =>
        config.chatbotId !== LOCAL_CHATBOT_ID ||
        config.ownerId !== '76047345-3801-4628-ae7b-adbebcfe8821' ||
        config.courseId !== '7c12e44e-d083-4acf-845e-4c34aaff6b49' ||
        !['tutor', 'explainer'].includes(config.chatMode) ||
        !config.isEnabled ||
        config.priority !== 0 ||
        !Array.isArray(config.allowedTools) ||
        config.allowedTools.length !== 1 ||
        config.allowedTools[0] !== 'doc_query' ||
        !(legacy
          ? config.parameters === null || exactObject(config.parameters, {})
          : exactObject(config.parameters, LOCAL_SCOPE))
    )
  )
    throw new Error('Local MCP seed ownership conflict')
}
