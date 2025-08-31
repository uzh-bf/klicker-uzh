import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import type { LogLevel } from '@hatchet-dev/typescript-sdk/util/logger/logger.js'

export const hatchet = HatchetClient.init({
  token: process.env.HATCHET_CLIENT_TOKEN,
  api_url: process.env.HATCHET_API_URL,
  tenant_id: process.env.HATCHET_TENANT_ID,
  host_port: process.env.HATCHET_HOST_PORT,
  log_level: (process.env.HATCHET_LOG_LEVEL as LogLevel) ?? 'INFO',
})
