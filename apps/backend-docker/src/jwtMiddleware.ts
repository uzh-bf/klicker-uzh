import { verifyJWT } from '@klicker-uzh/util'

const EXPLICIT_BEARER_PATTERN = /^Bearer\s+(\S+)$/i

type ExplicitAuthorization =
  | { kind: 'absent' }
  | { kind: 'malformed' }
  | { kind: 'bearer'; token: string }

// The regular PWA sends an empty Authorization header when it only carries
// cookies; every other present authorization must be a usable explicit bearer
// and fails closed otherwise.
function selectExplicitAuthorization(
  authorization: unknown
): ExplicitAuthorization {
  if (authorization === undefined || authorization === '') {
    return { kind: 'absent' }
  }

  if (typeof authorization !== 'string') {
    return { kind: 'malformed' }
  }

  const bearerToken = EXPLICIT_BEARER_PATTERN.exec(authorization.trim())?.[1]
  if (bearerToken) {
    return { kind: 'bearer', token: bearerToken }
  }

  return { kind: 'malformed' }
}

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
      req.headers.origin?.includes(process.env.APP_STUDENT_SUBDOMAIN ?? 'pwa')
    ) {
      const authorization = selectExplicitAuthorization(
        req.headers['authorization']
      )

      // A present authorization is authoritative: a value that is not a
      // usable explicit bearer fails closed instead of falling back to
      // ambient cookies.
      if (authorization.kind === 'malformed') {
        req.locals = { user: null }
        return next()
      }

      if (authorization.kind === 'bearer') {
        req.locals = { user: await verifyExplicitBearer(authorization.token) }
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
