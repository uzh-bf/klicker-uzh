import { fileURLToPath } from 'node:url'

process.env.KLICKER_HOST_ROOT ??= fileURLToPath(
  new URL('../../../../', import.meta.url)
)
await import(
  '@klicker-uzh/adaptive-persistence/scripts/verifyAdaptiveIrtV2Migration'
)
