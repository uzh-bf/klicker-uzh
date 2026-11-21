import { AsyncLocalStorage } from 'node:async_hooks'
import { DefaultLogger, type Logger } from 'ltijs'

const errorCodes = new Set([
  'AUTHCONFIG_NOT_FOUND',
  'AZP_DOES_NOT_MATCH_CLIENTID',
  'INVALID_ALG',
  'INVALID_LTIK',
  'INVALID_MESSAGE_TYPE',
  'INVALID_NONCE_RECEIVED',
  'INVALID_STATE',
  'PLATFORM_NOT_ACTIVATED',
  'PLATFORM_NOT_FOUND',
  'SESSION_NOT_FOUND',
  'TOKEN_TOO_OLD',
  'UNREGISTERED_PLATFORM',
])

interface DiagnosticRequest {
  path: string
  method: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface DiagnosticResponse {
  statusCode: number
  once(event: 'finish', listener: () => void): unknown
}

function category(value: unknown, allowed: readonly string[]) {
  if (value === undefined) return 'missing'
  return typeof value === 'string' && allowed.includes(value) ? value : 'other'
}

function classifyOrigin(value: unknown, toolOrigin: string) {
  if (value === undefined) return 'missing'
  if (value === 'null') return 'null'
  if (typeof value !== 'string') return 'invalid'
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
      return 'invalid'
    }
    return value === toolOrigin ? 'same-origin' : 'cross-origin'
  } catch {
    return 'invalid'
  }
}

function requestFields(request: DiagnosticRequest, toolOrigin: string) {
  const body =
    typeof request.body === 'object' &&
    request.body !== null &&
    !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {}
  const recovered = body.ltijs_recovered_state
  return {
    origin: classifyOrigin(request.headers.origin, toolOrigin),
    originCompatibilityApplied: false,
    route: category(request.path, ['/', '/login', '/handoff', '/keys']),
    method: category(request.method, [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ]),
    secFetchSite: category(request.headers['sec-fetch-site'], [
      'same-origin',
      'same-site',
      'cross-site',
      'none',
    ]),
    secFetchMode: category(request.headers['sec-fetch-mode'], [
      'navigate',
      'same-origin',
      'no-cors',
      'cors',
      'websocket',
    ]),
    secFetchDest: category(request.headers['sec-fetch-dest'], [
      'document',
      'iframe',
      'frame',
      'empty',
    ]),
    recoveredState: !Object.hasOwn(body, 'ltijs_recovered_state')
      ? 'missing'
      : typeof recovered !== 'string'
        ? 'invalid_type'
        : recovered.length === 0
          ? 'empty'
          : 'present',
    idTokenPresent:
      typeof body.id_token === 'string' && body.id_token.length > 0,
    statePresent: typeof body.state === 'string' && body.state.length > 0,
  }
}

type RequestContext = ReturnType<typeof requestFields> & { errorCode?: string }

function write(record: Record<string, unknown>) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), ...record }))
}

export function createRequestLogging(toolOrigin: string) {
  const context = new AsyncLocalStorage<RequestContext>()
  const debugLogger = new DefaultLogger()
  const logger: Logger = {
    debug: debugLogger.debug.bind(debugLogger),
    warn: debugLogger.warn.bind(debugLogger),
    error(component, message) {
      const errorCode = errorCodes.has(message) ? message : 'UNCLASSIFIED_ERROR'
      const current = context.getStore()
      if (current) {
        current.errorCode = errorCode
        return
      }
      // Body-parser errors occur before request middleware can attach context.
      write({
        event: 'lti_provider_error',
        component:
          component === 'expressHttpHandler' ? 'http_handler' : 'provider',
        errorCode,
      })
    },
  }

  function middleware(
    request: DiagnosticRequest,
    response: DiagnosticResponse,
    next: () => void
  ) {
    const fields: RequestContext = requestFields(request, toolOrigin)
    response.once('finish', () => {
      const failed =
        response.statusCode >= 400 || fields.errorCode !== undefined
      if (!failed && !fields.originCompatibilityApplied) return
      write({
        event: failed ? 'lti_request_failed' : 'lti_origin_compatibility',
        ...fields,
        ...(failed ? { errorCode: fields.errorCode ?? 'HTTP_ERROR' } : {}),
        status: response.statusCode,
      })
    })
    context.run(fields, next)
  }

  function originCompatibility() {
    const current = context.getStore()
    if (current) current.originCompatibilityApplied = true
  }

  return { logger, middleware, originCompatibility }
}
