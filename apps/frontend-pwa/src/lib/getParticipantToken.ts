import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import {
  LoginParticipantWithLtiDocument,
  type LoginParticipantWithLtiMutation,
} from '@klicker-uzh/graphql/dist/ops'
import { verifyJWT } from '@klicker-uzh/util'
import {
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
  LTI_PROBE_COOKIE_NAME,
} from '@klicker-uzh/util/auth'
import type { GetServerSidePropsContext } from 'next'
import nookies from 'nookies'

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
  apolloClient,
  courseId,
  ctx,
}: {
  apolloClient: ApolloClient<NormalizedCacheObject>
  courseId?: string
  ctx: GetServerSidePropsContext
}) {
  const { query } = ctx
  const cookies = nookies.get(ctx)
  const ltiProbeAvailable = cookiesAvailableViaLtiProbe(cookies)

  // if the user already has a participant token, skip registration
  // fetch the relevant data directly
  let participantToken: string | undefined | null =
    (process.env.ASSESSMENT_MODE === 'true'
      ? cookies['next-auth.participant-session-token']
      : cookies.participant_token) ?? query.participantToken

  // TODO: only check for existing participantToken once participation issues with LTI are resolved
  if (participantToken && !ltiProbeAvailable && !query.jwt) {
    return {
      participantToken,
      cookiesAvailable:
        process.env.ASSESSMENT_MODE === 'true'
          ? !!cookies['next-auth.participant-session-token']
          : !!cookies.participant_token,
    }
  }

  try {
    let result:
      | { data?: LoginParticipantWithLtiMutation | null }
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
          result = await apolloClient.mutate<LoginParticipantWithLtiMutation>({
            mutation: LoginParticipantWithLtiDocument,
            variables: {
              signedLtiData: token,
              courseId,
            },
          })
        }
      } catch (_e) {}
    }
    const ltiParticipantToken =
      result?.data?.loginParticipantWithLti?.participantToken ?? null

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
      participant: result?.data?.loginParticipantWithLti,
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
