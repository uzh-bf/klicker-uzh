import { signJWT, verifyJWT } from '@klicker-uzh/util'
import {
  LTI_PROBE_COOKIE_NAME,
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
} from '@klicker-uzh/util/auth'
import bodyParser from 'body-parser'
import { GetServerSidePropsContext } from 'next'
import nookies from 'nookies'
import { createTRPCSSRClient } from './trpc'

function appendCookieAttribute(
  ctx: GetServerSidePropsContext,
  cookieName: string,
  attribute: string
) {
  const currentHeader = ctx.res.getHeader('Set-Cookie')
  const cookies = Array.isArray(currentHeader)
    ? currentHeader
    : typeof currentHeader === 'string'
      ? [currentHeader]
      : []

  if (cookies.length === 0) return

  const normalizedAttribute = attribute.toLowerCase()
  const cookiePrefix = `${cookieName}=`
  ctx.res.setHeader(
    'Set-Cookie',
    cookies.map((cookie) => {
      if (!cookie.startsWith(cookiePrefix)) return cookie
      const hasAttribute = cookie
        .split(';')
        .some((part) => part.trim().toLowerCase() === normalizedAttribute)
      return hasAttribute ? cookie : `${cookie}; ${attribute}`
    })
  )
}

export default async function getParticipantToken({
  courseId,
  ctx,
}: {
  courseId?: string
  ctx: GetServerSidePropsContext
}) {
  const { req, res, query } = ctx
  const cookies = nookies.get(ctx)
  const trpcClient = createTRPCSSRClient(ctx)
  const ltiProbeAvailable = cookiesAvailableViaLtiProbe(cookies)

  // if the user already has a participant token, skip registration
  // fetch the relevant data directly
  let participantToken: string | undefined | null =
    (process.env.ASSESSMENT_MODE === 'true'
      ? cookies['next-auth.participant-session-token']
      : cookies['participant_token']) ?? query.participantToken

  // TODO: only check for existing participantToken once participation issues with LTI are resolved
  if (
    participantToken &&
    !ltiProbeAvailable &&
    !query.jwt &&
    !(req.method === 'POST')
  ) {
    return {
      participantToken,
      cookiesAvailable:
        process.env.ASSESSMENT_MODE === 'true'
          ? !!cookies['next-auth.participant-session-token']
          : !!cookies['participant_token'],
    }
  }

  try {
    let result:
      | {
          participant: { id: string } | null
          participantToken: string | null
        }
      | null
      | undefined

    const cookiesAvailable = ltiProbeAvailable

    // LTI 1.3 authentication flow
    if (ltiProbeAvailable || query.jwt) {
      const token = cookies[LTI_PROBE_COOKIE_NAME] ?? query.jwt

      if (!token) {
        return {
          participantToken: null,
          cookiesAvailable,
        }
      }

      try {
        const signedLtiData = (await verifyJWT(
          token,
          process.env.APP_SECRET as string
        )) as { sub: string; email: string; scope: string }

        if (signedLtiData.scope === 'LTI1.3') {
          result = await trpcClient.participant.loginWithLti.mutate({
            signedLtiData: token,
            courseId,
          })
        }
      } catch (e) {}
    }
    // LTI 1.1 authentication flow
    else if (req.method === 'POST') {
      // extract the body from the LTI request
      // if there is a body, request a participant token
      // TODO: verify that there is an LTI body and that it is valid
      const { request }: any = await new Promise((resolve) => {
        bodyParser.urlencoded({ extended: true })(req, res, () => {
          bodyParser.json()(req, res, () => {
            resolve({ request: req })
          })
        })
      })

      if (request?.body?.lis_person_sourcedid) {
        const pwaOrigin =
          process.env.ASSESSMENT_MODE === 'true'
            ? process.env.APP_ORIGIN_ASSESSMENT_PWA
            : process.env.APP_ORIGIN_PWA
        if (!pwaOrigin) {
          throw new Error(
            'APP_ORIGIN_PWA and APP_ORIGIN_ASSESSMENT_PWA are required but not defined'
          )
        }

        // send along a JWT to ensure only the next server is allowed to register participants from LTI
        const signedLtiData = await signJWT(
          {
            sub: request?.body?.lis_person_sourcedid,
            email: request?.body?.lis_person_contact_email_primary,
            scope: 'LTI1.1',
          },
          process.env.APP_SECRET as string,
          {
            algorithm: 'HS256',
            expiresIn: '5m',
            issuer:
              process.env.ASSESSMENT_MODE === 'true'
                ? process.env.APP_ORIGIN_ASSESSMENT_PWA
                : process.env.APP_ORIGIN_PWA,
          }
        )

        result = await trpcClient.participant.loginWithLti.mutate({
          signedLtiData,
          courseId,
        })
      }
    }

    const ltiParticipantToken = result?.participantToken ?? null

    if (ltiParticipantToken) {
      participantToken = ltiParticipantToken
      const isProduction =
        process.env.NODE_ENV === 'production' &&
        process.env.COOKIE_DOMAIN !== '127.0.0.1'
      const { partitioned, ...securityOptions } = cookieSecurityOptions({
        isProduction,
      })

      // set a proper participant_token
      nookies.set(ctx, 'participant_token', participantToken, {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 13,
        ...securityOptions,
      })

      // remove the lti-token cookie since we now have a proper participant_token
      nookies.destroy(ctx, LTI_PROBE_COOKIE_NAME, {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
      if (partitioned) {
        appendCookieAttribute(ctx, 'participant_token', 'Partitioned')
      }
    } else {
      // LTI auth attempted but failed -- clear stale token to prevent session leakage
      participantToken = null
    }

    return {
      participantToken,
      participant: result,
      cookiesAvailable,
    }
  } catch (e) {
    console.error(e)
  }

  return {
    participantToken: null,
    cookiesAvailable: true,
  }
}
