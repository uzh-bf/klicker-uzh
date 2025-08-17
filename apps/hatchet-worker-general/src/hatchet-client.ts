import { HatchetClient } from '@hatchet-dev/typescript-sdk'

export const hatchet = HatchetClient.init({
  token: process.env.HATCHET_CLIENT_TOKEN,
  log_level: 'DEBUG',
})
