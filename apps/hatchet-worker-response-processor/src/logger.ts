import { createLogger } from '@klicker-uzh/logging/node'
import { normalizeDiagnosticId } from '@klicker-uzh/logging/request'
import type { HatchetLoggingContext } from '@klicker-uzh/types'

export const logger = createLogger({
  service:
    process.env.ASSESSMENT_MODE === 'true'
      ? 'hatchet-worker-response-processor-assessment'
      : 'hatchet-worker-response-processor',
})

export function loggerForInput(input: {
  loggingContext?: HatchetLoggingContext
}) {
  const requestId = normalizeDiagnosticId(input.loggingContext?.requestId)
  const correlationId = normalizeDiagnosticId(
    input.loggingContext?.correlationId
  )

  return logger.child({
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
  })
}
