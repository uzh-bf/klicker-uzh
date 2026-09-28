import { normalizeDiagnosticId } from '@klicker-uzh/logging/request'
import type { HatchetLoggingContext } from '@klicker-uzh/types'

export type AuditLogMessage = {
  info: string
  /** Existing business field; it must never become diagnostic correlation. */
  correlationId?: string
  loggingContext?: HatchetLoggingContext
}

export type AuditLogInput =
  | AuditLogMessage
  | {
      message: AuditLogMessage
    }

export function isAuditLogMessage(input: unknown): input is AuditLogMessage {
  return (
    input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    typeof (input as { info?: unknown }).info === 'string'
  )
}

export function getAuditLogDiagnosticBindings(
  message: Pick<AuditLogMessage, 'loggingContext' | 'correlationId'>
) {
  const requestId = normalizeDiagnosticId(message.loggingContext?.requestId)
  const correlationId = normalizeDiagnosticId(
    message.loggingContext?.correlationId
  )

  return {
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
  }
}

export function getAuditLogFields(message: AuditLogMessage) {
  return {
    event: 'audit.entry.received',
    ...getAuditLogDiagnosticBindings(message),
  }
}
