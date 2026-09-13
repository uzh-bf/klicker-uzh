import { isDeepStrictEqual } from 'node:util'

/**
 * The local MCP fixture deliberately has independent parents from the
 * response-example chatbot.  These IDs are stable so the bootstrap can
 * reconcile a fixture without matching a production or generic seed row.
 */
export const LOCAL_SERVER_ID = 'b37c9d6e-2a14-4f8b-93c7-5e1d0a6f4b82'
export const LOCAL_CHATBOT_ID = 'c84f1a72-6e35-4d9b-a0c8-2f7e5b3d1a96'
export const LOCAL_COURSE_ID = 'd61e8b43-9f27-4c05-b2a6-7d3e1f8c5b90'
export const LOCAL_OWNER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
export const LOCAL_KB_ID = '35a72f62-a714-45f1-8b18-2cf5681b0c75'
export const LOCAL_COURSE_PIN = 672945813
export const LOCAL_COURSE_PIN_CODE = LOCAL_COURSE_PIN
export const LOCAL_SERVER_NAME = 'LocalSyntheticKB'
export const LOCAL_SERVER_URL = 'http://localhost:1417/mcp'
export const LOCAL_MCP_URL = LOCAL_SERVER_URL
export const LOCAL_FIXTURE_MARKER = {
  localFixture: 'authenticated-local-mcp-v2',
}
export const LOCAL_SCOPE = {
  required: true,
  toolAlias: 'doc_query',
  kb_ids: [LOCAL_KB_ID],
}

// Keep the aliases available to the bootstrap scripts while making the
// canonical names above explicit to callers that compose route data.
export const LOCAL_MCP_SERVER_ID = LOCAL_SERVER_ID

const ENCRYPTED_AUTH_SECRET_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+$/i
const LOCAL_CHAT_MODES = new Set(['tutor', 'explainer'])

/**
 * @typedef {Object} LocalChatbot
 * @property {unknown} [id]
 * @property {unknown} [ownerId]
 * @property {unknown} [courseId]
 */

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
    (server.chatbotIdHeader === null || server.chatbotIdHeader === undefined) &&
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
 * describe this fixture.  The optional parent argument lets route callers
 * validate the parent identity when configuration rows omit denormalized
 * owner/course fields.
 *
 * @param {unknown} server
 * @param {unknown} configurations
 * @param {LocalChatbot|null} [chatbot]
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

function isExactFixtureConfiguration(config, chatbot) {
  return (
    isExactConfiguration(config) &&
    isPlainObject(config.mcpServer) &&
    isExactServer(config.mcpServer) &&
    chatbot?.id === LOCAL_CHATBOT_ID &&
    chatbot.ownerId === LOCAL_OWNER_ID &&
    chatbot.courseId === LOCAL_COURSE_ID
  )
}

function getConfigurationServerId(config) {
  return config?.mcpServerId ?? config?.mcpServer?.id
}

/**
 * Normalize the dedicated local fixture to the canonical route server name.
 * This is intentionally a no-op outside the development bootstrap gate or
 * when any identity/ownership/configuration check is inconclusive.
 *
 * @template {object} T
 * @param {T[]} configurations
 * @param {LocalChatbot|null|undefined} chatbot
 * @param {Record<string, string|undefined>|undefined} env
 * @returns {T[]}
 */
export function normalizeLocalMcpConfigurations(configurations, chatbot, env) {
  if (
    !Array.isArray(configurations) ||
    env?.NODE_ENV !== 'development' ||
    env.LOCAL_MCP_BOOTSTRAPPED !== '1' ||
    chatbot?.id !== LOCAL_CHATBOT_ID ||
    chatbot.ownerId !== LOCAL_OWNER_ID ||
    chatbot.courseId !== LOCAL_COURSE_ID
  ) {
    return configurations
  }

  const fixtureConfigurations = configurations.filter(
    (config) => getConfigurationServerId(config) === LOCAL_SERVER_ID
  )
  if (
    fixtureConfigurations.length !== 2 ||
    fixtureConfigurations.some(
      (config) => !isExactFixtureConfiguration(config, chatbot)
    )
  ) {
    return configurations
  }

  try {
    const fixtureServer = fixtureConfigurations[0].mcpServer
    assertLocalSeedOwnership(fixtureServer, fixtureConfigurations, chatbot)
  } catch {
    // Route callers must retain the original records so the existing scope
    // resolver can reject a reserved scope rather than accepting a partial
    // or ambiguous fixture.
    return configurations
  }

  return configurations.map((config) => {
    if (getConfigurationServerId(config) !== LOCAL_SERVER_ID) return config
    return {
      ...config,
      mcpServer: {
        ...config.mcpServer,
        name: 'KB',
      },
    }
  })
}
