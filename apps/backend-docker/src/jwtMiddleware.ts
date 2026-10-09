import {
  isCookieDomainOrigin,
  verifyExplicitParticipantBearer,
  verifyJWT,
} from '@klicker-uzh/util'

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
      // Regular participant cookies are SameSite=None so embedded LMS
      // launches work, and CORS reflects any origin. Only an origin inside
      // the cookie domain may select them.
      isCookieDomainOrigin(req.headers.origin)
    ) {
      const authorization = req.headers['authorization']

      // A present authorization is authoritative: a value that is not a
      // usable explicit bearer fails closed instead of falling back to
      // ambient cookies.
      if (authorization !== undefined && authorization !== '') {
        const bearer = await verifyExplicitParticipantBearer(
          authorization,
          process.env.APP_SECRET as string
        )
        req.locals = { user: bearer?.payload ?? null }
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
