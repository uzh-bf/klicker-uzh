import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import type { LogLevel } from '@hatchet-dev/typescript-sdk/util/logger/logger.js'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { createHatchetLoggerFactory } from './logging.js'

const globalForHatchet = global as unknown as {
  hatchetClient?: HatchetClient
}

const validLogLevels = ['INFO', 'OFF', 'DEBUG', 'WARN', 'ERROR']
let defaultClient = globalForHatchet.hatchetClient

export function createHatchetClient(options: { logger?: AppLogger } = {}) {
  const hatchet = HatchetClient.init({
    token: process.env.HATCHET_CLIENT_TOKEN,
    // Use SDK-standard HATCHET_CLIENT_HOST_PORT, fallback to old HATCHET_HOST_PORT
    host_port:
      process.env.HATCHET_CLIENT_HOST_PORT || process.env.HATCHET_HOST_PORT,
    // API URL and tenant ID are deprecated - they're now embedded in the token
    // But keep for backward compatibility if needed
    api_url: process.env.HATCHET_API_URL,
    tenant_id: process.env.HATCHET_TENANT_ID,
    log_level:
      typeof process.env.HATCHET_LOG_LEVEL !== 'undefined' &&
      validLogLevels.some(
        (logLevel) => logLevel === process.env.HATCHET_LOG_LEVEL
      )
        ? (process.env.HATCHET_LOG_LEVEL as LogLevel)
        : 'INFO',
    ...(options.logger
      ? { logger: createHatchetLoggerFactory(options.logger) }
      : {}),
  })

  return hatchet
}

function setupClient() {
  if (defaultClient) return defaultClient
  defaultClient = createHatchetClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForHatchet.hatchetClient = defaultClient
  }
  return defaultClient
}

/**
 * Backwards-compatible lazy facade for callers that still import the default
 * client. Worker applications should use `createHatchetClient({ logger })` so
 * their process logger is configured before the client is initialized.
 */
export const hatchetClient = new Proxy({} as HatchetClient, {
  get(_target, property) {
    const client = setupClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
  set(_target, property, value) {
    return Reflect.set(setupClient(), property, value)
  },
})

export default hatchetClient
