import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import { HatchetLogger } from '@hatchet-dev/typescript-sdk/clients/hatchet-client/hatchet-logger.js'
import type { LogLevel } from '@hatchet-dev/typescript-sdk/util/logger/logger.js'

const globalForHatchet = global as unknown as { hatchetClient: HatchetClient }

const validLogLevels = ['INFO', 'OFF', 'DEBUG', 'WARN', 'ERROR']

function createSafeLogger(context: string, logLevel?: LogLevel) {
  const logger = new HatchetLogger(context, logLevel)

  return new Proxy(logger, {
    get(target, property, receiver) {
      if (typeof property === 'string' && !(property in target)) {
        return target.debug.bind(target)
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

function setupClient() {
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
    logger: createSafeLogger,
  })

  return hatchet
}

export const hatchetClient = globalForHatchet.hatchetClient || setupClient()

if (process.env.NODE_ENV !== 'production') {
  globalForHatchet.hatchetClient = hatchetClient
}

export default hatchetClient
