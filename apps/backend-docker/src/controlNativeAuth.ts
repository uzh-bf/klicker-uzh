import {
  CONTROL_NATIVE_ORIGINS,
  type ControlNativeClaims,
  type ControlNativeDatabase,
  controlNativePrincipal,
  isControlNativeToken,
  verifyControlNativeToken,
} from '@klicker-uzh/util'
import type { Request, RequestHandler, Response } from 'express'

const CONTROL_GRAPHQL_PATH = '/api/graphql'
const ALLOWED_METHODS = 'GET,POST,OPTIONS'
const ALLOWED_HEADERS = 'content-type,authorization,x-graphql-yoga-csrf'

export interface ControlNativeAuthDependencies {
  prisma: ControlNativeDatabase
  appSecret?: string
  authOrigin?: string
}

type CredentialSelection =
  | { native: false }
  | { native: true; token: string | null }

function requestPath(req: Request): string {
  const url = req.originalUrl || req.url || ''
  const queryStart = url.indexOf('?')
  return queryStart === -1 ? url : url.slice(0, queryStart)
}

function isAllowedOrigin(origin: string | undefined): origin is string {
  return (
    origin !== undefined &&
    CONTROL_NATIVE_ORIGINS.some((allowedOrigin) => allowedOrigin === origin)
  )
}

function isNativeGraphqlTransport(req: Request): boolean {
  return (
    isAllowedOrigin(req.get('origin')) &&
    requestPath(req) === CONTROL_GRAPHQL_PATH
  )
}

function nativeCredential(req: Request): CredentialSelection {
  const authorization = req.headers.authorization
  const token =
    typeof authorization === 'string'
      ? (/^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]?.trim() ?? null)
      : null
  if (
    (isAllowedOrigin(req.get('origin')) && req.method !== 'OPTIONS') ||
    (token && isControlNativeToken(token))
  )
    return { native: true, token }
  return { native: false }
}

function sendDenied(res: Response): void {
  res
    .status(401)
    .set('Cache-Control', 'no-store')
    .json({ error: 'Unauthorized' })
}
function sendUnavailable(res: Response): void {
  res
    .status(503)
    .set('Cache-Control', 'no-store')
    .json({ error: 'Service unavailable' })
}

export function createControlNativeAuth({
  prisma,
  appSecret,
  authOrigin,
}: ControlNativeAuthDependencies) {
  const authenticatedRequests = new WeakSet<Request>()
  function withCredentialedCors(
    credentialedCors: RequestHandler
  ): RequestHandler {
    return (req, res, next) => {
      if (!isNativeGraphqlTransport(req)) {
        credentialedCors(req, res, next)
        return
      }

      res.set('Access-Control-Allow-Origin', req.get('origin') as string)
      res.vary('Origin')

      if (req.method === 'OPTIONS') {
        res
          .set('Access-Control-Allow-Methods', ALLOWED_METHODS)
          .set('Access-Control-Allow-Headers', ALLOWED_HEADERS)
          .status(204)
          .end()
        return
      }

      next()
    }
  }

  async function resolvePrincipal(token: string) {
    if (!appSecret || !authOrigin)
      throw new Error('Native authentication unavailable')
    let claims: ControlNativeClaims
    try {
      claims = await verifyControlNativeToken(token, appSecret, authOrigin)
    } catch {
      return null
    }
    const principal = await controlNativePrincipal(prisma, appSecret, {
      ...claims,
      controlNativeSource: claims.source,
    })
    if (!principal) return null
    return {
      sub: principal.sub,
      role: principal.role,
      scope: principal.scope,
      catalystInstitutional: principal.catalystInstitutional,
      catalystIndividual: principal.catalystIndividual,
    }
  }

  const authenticateNative: RequestHandler = (req, res, next) => {
    const credential = nativeCredential(req)
    if (!credential.native) {
      next()
      return
    }

    if (isNativeGraphqlTransport(req)) {
      res.set('Access-Control-Allow-Origin', req.get('origin') as string)
      res.vary('Origin')
    }
    const origin = req.get('origin')
    const method = req.method.toUpperCase()
    if (
      process.env.ASSESSMENT_MODE === 'true' ||
      !isAllowedOrigin(origin) ||
      requestPath(req) !== CONTROL_GRAPHQL_PATH ||
      (method !== 'GET' && method !== 'POST')
    ) {
      sendDenied(res)
      return
    }

    if (!credential.token) {
      sendDenied(res)
      return
    }

    void resolvePrincipal(credential.token)
      .then((principal) => {
        if (!principal) {
          sendDenied(res)
          return
        }

        const nativeRequest = req as Request & {
          locals?: Record<string, unknown>
        }
        nativeRequest.locals = {
          ...(nativeRequest.locals ?? {}),
          user: principal,
        }
        authenticatedRequests.add(req)
        next()
      })
      .catch(() => sendUnavailable(res))
  }

  function withLegacyAuthentication(
    legacyAuthentication: RequestHandler
  ): RequestHandler {
    return (req, res, next) => {
      if (authenticatedRequests.has(req)) {
        next()
        return
      }

      if (nativeCredential(req).native) {
        sendDenied(res)
        return
      }

      legacyAuthentication(req, res, next)
    }
  }

  return {
    authenticateNative,
    withCredentialedCors,
    withLegacyAuthentication,
  }
}
