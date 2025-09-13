import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import type { LogLevel } from '@hatchet-dev/typescript-sdk/util/logger/logger.js'

const globalForHatchet = global as unknown as { hatchetClient: HatchetClient }

const validLogLevels = ['INFO', 'OFF', 'DEBUG', 'WARN', 'ERROR']

function setupClient() {
  const hatchet = HatchetClient.init({
    token: process.env.HATCHET_CLIENT_TOKEN,
    api_url: process.env.HATCHET_API_URL,
    tenant_id: process.env.HATCHET_TENANT_ID,
    host_port: process.env.HATCHET_HOST_PORT,
    log_level:
      typeof process.env.HATCHET_LOG_LEVEL !== 'undefined' &&
      validLogLevels.some(
        (logLevel) => logLevel === process.env.HATCHET_LOG_LEVEL
      )
        ? (process.env.HATCHET_LOG_LEVEL as LogLevel)
        : 'INFO',
  })

  return hatchet
}

export const hatchetClient = globalForHatchet.hatchetClient || setupClient()

if (process.env.NODE_ENV !== 'production') {
  globalForHatchet.hatchetClient = hatchetClient
}

export default hatchetClient
