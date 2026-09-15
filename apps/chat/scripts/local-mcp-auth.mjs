import { timingSafeEqual } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { importSPKI, jwtVerify } from 'jose'

export const LOCAL_SERVER_ID = 'b37c9d6e-2a14-4f8b-93c7-5e1d0a6f4b82'
export const LOCAL_CHATBOT_ID = 'c84f1a72-6e35-4d9b-a0c8-2f7e5b3d1a96'
export const LOCAL_COURSE_ID = 'd61e8b43-9f27-4c05-b2a6-7d3e1f8c5b90'
export const LOCAL_OWNER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
export const LOCAL_KB_ID = '35a72f62-a714-45f1-8b18-2cf5681b0c75'
export const LOCAL_COURSE_PIN = 672945813
export const LOCAL_COURSE_PIN_CODE = LOCAL_COURSE_PIN
export const LOCAL_SERVER_NAME = 'KB'
export const LOCAL_SERVER_URL = 'http://localhost:1417/mcp'
export const LOCAL_MCP_URL = LOCAL_SERVER_URL
export const LOCAL_FIXTURE_MARKER = {
  localFixture: 'authenticated-local-mcp',
}
export const LOCAL_SCOPE = {
  required: true,
  toolAlias: 'doc_query',
  kb_ids: [LOCAL_KB_ID],
}
export const LOCAL_MCP_SERVER_ID = LOCAL_SERVER_ID

const ENCRYPTED_AUTH_SECRET_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+$/i
const LOCAL_CHAT_MODES = new Set(['tutor', 'explainer'])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isEncryptedAuthSecret(value) {
  return typeof value === 'string' && ENCRYPTED_AUTH_SECRET_PATTERN.test(value)
}

function isExactServer(server) {
  return (
    isPlainObject(server) &&
    server.id === LOCAL_SERVER_ID &&
    server.name === LOCAL_SERVER_NAME &&
    server.url === LOCAL_SERVER_URL &&
    server.authType === 'bearer' &&
    isEncryptedAuthSecret(server.authSecret) &&
    server.isActive === true &&
    server.passChatbotId === false &&
    server.chatbotIdHeader === null &&
    isDeepStrictEqual(server.parameters, LOCAL_FIXTURE_MARKER)
  )
}

function isExactConfiguration(config) {
  if (!isPlainObject(config)) return false

  if (config.mcpServer !== undefined && !isExactServer(config.mcpServer)) {
    return false
  }

  const nestedServerId = config.mcpServer?.id
  if (
    (config.mcpServerId !== undefined &&
      config.mcpServerId !== LOCAL_SERVER_ID) ||
    (nestedServerId !== undefined && nestedServerId !== LOCAL_SERVER_ID) ||
    (config.mcpServerId === undefined && nestedServerId !== LOCAL_SERVER_ID)
  ) {
    return false
  }

  return (
    config.chatbotId === LOCAL_CHATBOT_ID &&
    (config.ownerId === undefined || config.ownerId === LOCAL_OWNER_ID) &&
    (config.courseId === undefined || config.courseId === LOCAL_COURSE_ID) &&
    LOCAL_CHAT_MODES.has(config.chatMode) &&
    typeof config.isEnabled === 'boolean' &&
    config.priority === 0 &&
    isDeepStrictEqual(config.allowedTools, ['doc_query']) &&
    isDeepStrictEqual(config.parameters, LOCAL_SCOPE)
  )
}

/**
 * Assert that a persisted server and its dedicated configurations still
 * describe this fixture.  The optional parent argument validates the parent
 * identity when configuration rows omit denormalized owner/course fields.
 *
 * @param {unknown} server
 * @param {unknown} configurations
 * @param {{id?: unknown, ownerId?: unknown, courseId?: unknown}|null} [chatbot]
 * @returns {true}
 */
export function assertLocalSeedOwnership(server, configurations, chatbot) {
  if (
    !isExactServer(server) ||
    !Array.isArray(configurations) ||
    configurations.length !== 2 ||
    (chatbot !== undefined &&
      (chatbot === null ||
        chatbot.id !== LOCAL_CHATBOT_ID ||
        chatbot.ownerId !== LOCAL_OWNER_ID ||
        chatbot.courseId !== LOCAL_COURSE_ID)) ||
    configurations.some((config) => !isExactConfiguration(config))
  ) {
    throw new Error('Local MCP seed ownership conflict')
  }

  const modes = new Set(configurations.map((config) => config.chatMode))
  if (
    modes.size !== 2 ||
    [...modes].some((mode) => !LOCAL_CHAT_MODES.has(mode))
  ) {
    throw new Error('Local MCP seed ownership conflict')
  }

  return true
}

/**
 * The scope stored on the optional additional identity's binding.  Every
 * configuration this seed owns uses the multi-knowledge-base form; the
 * scope-token boundary keeps carrying the single `kb_id` claim.
 *
 * @param {string} kbId
 * @returns {{required: true, toolAlias: string, kb_ids: string[]}}
 */
export function localFixtureScope(kbId) {
  return { required: true, toolAlias: 'doc_query', kb_ids: [kbId] }
}

/**
 * Assert that one persisted configuration is exactly the binding described by
 * the local fixture file.  The dedicated identity is validated separately by
 * assertLocalSeedOwnership, and an absent fixture never permits a binding.
 *
 * @param {unknown} configuration
 * @param {{chatbotId?: unknown, kbId?: unknown, chatMode?: unknown}|null} fixture
 * @returns {true}
 */
export function assertLocalFixtureConfiguration(configuration, fixture) {
  if (
    fixture === null ||
    !isPlainObject(fixture) ||
    !isPlainObject(configuration) ||
    configuration.mcpServerId !== LOCAL_SERVER_ID ||
    configuration.chatbotId !== fixture.chatbotId ||
    configuration.chatMode !== fixture.chatMode ||
    configuration.isEnabled !== true ||
    configuration.priority !== 0 ||
    !isDeepStrictEqual(configuration.allowedTools, ['doc_query']) ||
    !isDeepStrictEqual(
      configuration.parameters,
      localFixtureScope(fixture.kbId)
    )
  ) {
    throw new Error('Local MCP fixture configuration conflict')
  }

  return true
}

/**
 * The optional additional identity from the local fixture file is a second
 * accepted chatbot/knowledge-base pair, so the returned authenticator resolves
 * the caller's identity instead of a boolean when asked to.
 *
 * @overload
 * @param {Record<string, string>} env
 * @param {{chatbotId?: unknown, kbId?: unknown}|null} [fixture]
 * @param {{returnIdentity?: false}} [options]
 * @returns {Promise<(headers: Record<string, string>) => Promise<boolean>>}
 */
/**
 * @overload
 * @param {Record<string, string>} env
 * @param {{chatbotId?: unknown, kbId?: unknown}|null} fixture
 * @param {{returnIdentity: true}} options
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
      const valid =
        protectedHeader.kid === env.DOC_QUERY_SCOPE_KID &&
        ((payload.chatbot_id === LOCAL_CHATBOT_ID &&
          payload.kb_id === LOCAL_KB_ID) ||
          (isPlainObject(fixture) &&
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
