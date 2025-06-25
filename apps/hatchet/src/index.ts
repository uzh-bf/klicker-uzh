import { Hatchet } from '@hatchet-dev/typescript-sdk'
import { changeUserEmailSettings } from '@klicker-uzh/graphql'

// ! Hatchet setup
const hatchet = Hatchet.init({
  token: process.env.HATCHET_CLIENT_TOKEN,
  log_level: process.env.NODE_ENV ? 'DEBUG' : 'INFO',
})

const worker = await hatchet.worker('test-worker', {
  workflows: [changeUserEmailSettings(hatchet)],
  slots: 100,
})
await worker.start()
