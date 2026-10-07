import { verifyJWT } from '@klicker-uzh/util'

const EXPLICIT_BEARER_PATTERN = /^Bearer\s+(\S+)$/i

// Explicit bearer credentials must carry participant claims: a nonempty
// subject, a finite future expiration, a participant role and no scope.
async function verifyExplicitBearer(token: string) {
  try {
    const payload = await verifyJWT(token, process.env.APP_SECRET as string, {
      algorithms: ['HS256'],
    })

    const expiresAt = payload.exp
    if (
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0 ||
      typeof expiresAt !== 'number' ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() / 1000 ||
      (payload.role !== 'PARTICIPANT' &&
        payload.role !== 'TEMPORARY_PARTICIPANT') ||
      payload.scope !== undefined
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

// Regular participant cookies are SameSite=None so embedded LMS launches work,
// and CORS reflects any origin. Only an origin inside the cookie domain may
// select them; a foreign host that merely contains the subdomain cannot.
function isCookieDomainOrigin(origin: unknown) {
  const cookieDomain = process.env.COOKIE_DOMAIN?.replace(/^\./, '')
  if (!cookieDomain) return true
  if (typeof origin !== 'string') return false
  try {
    const { hostname } = new URL(origin)
    return hostname === cookieDomain || hostname.endsWith(`.${cookieDomain}`)
  } catch {
    return false
  }
}

async function jwtMiddleware(req: any, res: any, next: any) {
  let token = null

  // Assessment mode: only check for student NextAuth cookie
  if (process.env.ASSESSMENT_MODE === 'true') {
    if (
      req.headers.origin?.includes(
        process.env.APP_MANAGE_SUBDOMAIN ?? 'manage'
      ) ||
      req.headers.origin?.includes(
        process.env.APP_CONTROL_SUBDOMAIN ?? 'control'
      )
    ) {
      token = req.cookies?.['next-auth.session-token']
    } else if (
      req.headers.origin?.includes(
        process.env.APP_ASSESSMENT_SUBDOMAIN ?? 'assessment'
      )
    ) {
      token = req.cookies?.['next-auth.participant-session-token']
    }
  } else {
    if (
      req.headers.origin?.includes(
        process.env.APP_MANAGE_SUBDOMAIN ?? 'manage'
      ) ||
      req.headers.origin?.includes(
        process.env.APP_CONTROL_SUBDOMAIN ?? 'control'
      )
    ) {
      token = req.cookies?.['next-auth.session-token']
    } else if (
      req.headers.origin?.includes(
        process.env.APP_STUDENT_SUBDOMAIN ?? 'pwa'
      ) &&
      isCookieDomainOrigin(req.headers.origin)
    ) {
      const authorization = req.headers['authorization']

      // A present authorization is authoritative: a value that is not a
      // usable explicit bearer fails closed instead of falling back to
      // ambient cookies.
      if (authorization !== undefined && authorization !== '') {
        const bearerToken =
          typeof authorization === 'string'
            ? EXPLICIT_BEARER_PATTERN.exec(authorization.trim())?.[1]
            : undefined
        req.locals = {
          user: bearerToken ? await verifyExplicitBearer(bearerToken) : null,
        }
        return next()
      }

      token =
        req.cookies?.['participant_token'] ??
        req.cookies?.['temporary_participant_token'] ??
        req.cookies?.['next-auth.session-token']
    }
  }

  // ! DO NOT TOUCH - assessment live quiz mode relies on it
  token = token ?? req.headers['authorization']?.replace('Bearer ', '') ?? null

  let user = null
  if (token) {
    try {
      user = await verifyJWT(token, process.env.APP_SECRET as string)
    } catch (error) {
      // JWT verification failed, continue with user = null
      console.log('JWT verification failed:', error)
    }
  }

  req.locals = { user }
  next()
}

export default jwtMiddleware
