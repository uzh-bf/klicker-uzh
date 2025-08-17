import { HatchetClient } from '@hatchet-dev/typescript-sdk'

export const hatchet = HatchetClient.init({
  token: process.env.HATCHET_CLIENT_TOKEN,
  token: process.env.HATCHET_CLIENT_TOKEN,
  api_url: process.env.HATCHET_API_URL,
  tenant_id: process.env.HATCHET_TENANT_ID,
  host_port: process.env.HATCHET_HOST_PORT,
  log_level: 'DEBUG',
})
