import {
  isCookieDomainOrigin,
  participantSessionMatches,
  verifyJWT,
} from '@klicker-uzh/util'

async function jwtMiddleware(req: any, res: any, next: any) {
  let token = null
  let regularCookieRequest = false

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
      regularCookieRequest = true
      if (
        !participantSessionMatches(
          req.headers['x-participant-session'],
          req.cookies ?? {}
        )
      ) {
        return res.status(409).json({ error: 'participant_session_changed' })
      }

      token =
        req.cookies?.['participant_token'] ??
        req.cookies?.['temporary_participant_token'] ??
        req.cookies?.['next-auth.session-token']
    }
  }

  // ! DO NOT TOUCH - assessment live quiz mode relies on it
  if (!regularCookieRequest)
    token =
      token ?? req.headers['authorization']?.replace('Bearer ', '') ?? null

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
