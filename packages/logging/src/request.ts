export const DIAGNOSTIC_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export type DiagnosticHeader = string | string[] | null | undefined

export interface RequestContext {
  [key: string]: string | undefined
  requestId: string
  correlationId: string
  traceId?: string
  spanId?: string
}

export type OptionalRequestContext = Partial<
  Pick<RequestContext, 'requestId' | 'correlationId' | 'traceId' | 'spanId'>
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
    traceId?: DiagnosticHeader
    spanId?: DiagnosticHeader
  },
  generateId: () => string = () => globalThis.crypto.randomUUID()
): RequestContext {
  const requestId = normalizeDiagnosticId(headers.requestId) ?? generateId()
  const correlationId =
    normalizeDiagnosticId(headers.correlationId) ?? requestId
  const traceId = normalizeDiagnosticId(headers.traceId)
  const spanId = normalizeDiagnosticId(headers.spanId)

  return {
    requestId,
    correlationId,
    ...(traceId ? { traceId } : {}),
    ...(spanId ? { spanId } : {}),
  }
}

/**
 * Normalize already-propagated diagnostic IDs without inventing replacements.
 * This is for asynchronous payloads that may predate the logging envelope.
 */
export function resolveOptionalRequestContext(headers: {
  requestId?: DiagnosticHeader
  correlationId?: DiagnosticHeader
  traceId?: DiagnosticHeader
  spanId?: DiagnosticHeader
}): OptionalRequestContext {
  const requestId = normalizeDiagnosticId(headers.requestId)
  const correlationId = normalizeDiagnosticId(headers.correlationId)
  const traceId = normalizeDiagnosticId(headers.traceId)
  const spanId = normalizeDiagnosticId(headers.spanId)

  return {
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(traceId ? { traceId } : {}),
    ...(spanId ? { spanId } : {}),
  }
}

export function propagationHeaders(context: RequestContext) {
  return {
    'x-request-id': context.requestId,
    'x-correlation-id': context.correlationId,
  }
}
