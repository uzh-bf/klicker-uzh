import { Hatchet } from '@hatchet-dev/typescript-sdk'
import { publishScheduledMicroLearning } from '@klicker-uzh/graphql'

// ! Hatchet setup
const validLogLevels = ['INFO', 'OFF', 'DEBUG', 'WARN', 'ERROR']
const hatchet = Hatchet.init({
  token: process.env.HATCHET_CLIENT_TOKEN,
  log_level:
    typeof process.env.HATCHET_LOG_LEVEL !== 'undefined' &&
    validLogLevels.some(
      (logLevel) => logLevel === process.env.HATCHET_LOG_LEVEL
    )
      ? (process.env.HATCHET_LOG_LEVEL as
          | 'INFO'
          | 'OFF'
          | 'DEBUG'
          | 'WARN'
          | 'ERROR')
      : 'INFO',
})

const worker = await hatchet.worker('activity-publications', {
  workflows: [publishScheduledMicroLearning(hatchet)],
  slots: 100,
})
await worker.start()
