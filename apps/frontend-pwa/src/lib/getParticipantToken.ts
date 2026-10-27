import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import {
  LoginParticipantWithLtiDocument,
  type LoginParticipantWithLtiMutation,
} from '@klicker-uzh/graphql/dist/ops'
import { COOKIE_NAMES, cookieName, verifyJWT } from '@klicker-uzh/util'
import {
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
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
      ? cookies[cookieName(COOKIE_NAMES.NEXT_AUTH_PARTICIPANT_SESSION)]
      : cookies[cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN)]) ??
    query.participantToken

  // TODO: only check for existing participantToken once participation issues with LTI are resolved
  if (participantToken && !ltiProbeAvailable && !query.jwt) {
    return {
      participantToken,
      cookiesAvailable:
        process.env.ASSESSMENT_MODE === 'true'
          ? !!cookies[cookieName(COOKIE_NAMES.NEXT_AUTH_PARTICIPANT_SESSION)]
          : !!cookies[cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN)],
    }
  }

  try {
    let result: { data?: LoginParticipantWithLtiMutation | null } | undefined

    const cookiesAvailable = ltiProbeAvailable

    // LTI 1.3 authentication flow
    if (ltiProbeAvailable || query.jwt) {
      const token = cookies[cookieName(COOKIE_NAMES.LTI_TOKEN)] ?? query.jwt

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
      const participantCookieName = cookieName(COOKIE_NAMES.PARTICIPANT_TOKEN)
      nookies.set(ctx, participantCookieName, participantToken, {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 13,
        ...securityOptions,
      })

      // remove the lti-token cookie since we now have a proper participant_token
      nookies.destroy(ctx, cookieName(COOKIE_NAMES.LTI_TOKEN), {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
      if (partitioned) {
        appendCookieAttribute(ctx, participantCookieName, 'Partitioned')
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
