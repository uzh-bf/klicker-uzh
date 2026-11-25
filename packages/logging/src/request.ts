export const DIAGNOSTIC_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export type DiagnosticHeader = string | string[] | null | undefined

export interface RequestContext {
  [key: string]: string | undefined
  requestId: string
  correlationId: string
}

export type OptionalRequestContext = Partial<
  Pick<RequestContext, 'requestId' | 'correlationId'>
>

export function normalizeDiagnosticId(
  value: DiagnosticHeader
): string | undefined {
  return typeof value === 'string' && DIAGNOSTIC_ID_PATTERN.test(value)
    ? value
    : undefined
}

export function resolveRequestContext(
  headers: {
    requestId?: DiagnosticHeader
    correlationId?: DiagnosticHeader
  },
  generateId: () => string = () => globalThis.crypto.randomUUID()
): RequestContext {
  const requestId = normalizeDiagnosticId(headers.requestId) ?? generateId()
  const correlationId =
    normalizeDiagnosticId(headers.correlationId) ?? requestId

  return { requestId, correlationId }
}

/**
 * Normalize already-propagated diagnostic IDs without inventing replacements.
 * This is for asynchronous payloads that may predate the logging envelope.
 */
export function resolveOptionalRequestContext(headers: {
  requestId?: DiagnosticHeader
  correlationId?: DiagnosticHeader
}): OptionalRequestContext {
  const requestId = normalizeDiagnosticId(headers.requestId)
  const correlationId = normalizeDiagnosticId(headers.correlationId)

  return {
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
  }
}

export function propagationHeaders(context: RequestContext) {
  return {
    'x-request-id': context.requestId,
    'x-correlation-id': context.correlationId,
  }
}
