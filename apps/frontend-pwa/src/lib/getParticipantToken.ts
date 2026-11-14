import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { LoginParticipantWithLtiDocument } from '@klicker-uzh/graphql/dist/ops'
import { verifyJWT } from '@klicker-uzh/util'
import type { GetServerSidePropsContext } from 'next'
import nookies from 'nookies'

// Provenance of a resolved participant token. Only a freshly verified LTI
// handoff ('lti') may replace a participant session the browser has already
// established; a raw ?participantToken= relay ('query') must not, otherwise
// an induced link performs a login-CSRF session substitution.
export type ParticipantTokenSource = 'session' | 'query' | 'lti'

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

  // if the user already has a participant token, skip registration
  // fetch the relevant data directly
  const sessionCookie =
    process.env.ASSESSMENT_MODE === 'true'
      ? cookies['next-auth.participant-session-token']
      : cookies['participant_token']
  let participantToken: string | undefined | null =
    sessionCookie ?? query.participantToken

  // TODO: only check for existing participantToken once participation issues with LTI are resolved
  if (participantToken && !cookies['lti-token'] && !query.jwt) {
    const cookiesAvailable = !!sessionCookie
    const tokenSource: ParticipantTokenSource = cookiesAvailable
      ? 'session'
      : 'query'
    return {
      participantToken,
      cookiesAvailable,
      tokenSource,
    }
  }

  try {
    let result

    const cookiesAvailable = !!cookies['lti-token']

    // LTI 1.3 authentication flow
    if (cookies['lti-token'] || query.jwt) {
      const token = cookies['lti-token'] ?? query.jwt

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
          result = await apolloClient.mutate({
            mutation: LoginParticipantWithLtiDocument,
            variables: {
              signedLtiData: token,
              courseId,
            },
          })
        }
      } catch (e) {}
    }

    const ltiParticipantToken =
      result?.data?.loginParticipantWithLti?.participantToken ?? null

    if (ltiParticipantToken) {
      participantToken = ltiParticipantToken

      // set a proper participant_token
      nookies.set(ctx, 'participant_token', participantToken, {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 13,
        secure:
          process.env.NODE_ENV === 'production' &&
          process.env.COOKIE_DOMAIN !== '127.0.0.1',
        sameSite:
          process.env.NODE_ENV === 'development' ||
          process.env.COOKIE_DOMAIN === '127.0.0.1'
            ? 'lax'
            : 'none',
      })

      // remove the lti-token cookie since we now have a proper participant_token
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } else {
      // LTI auth attempted but failed -- clear stale token to prevent session leakage
      participantToken = null
    }

    return {
      participantToken,
      participant: result?.data?.loginParticipantWithLti,
      cookiesAvailable,
      tokenSource: ltiParticipantToken ? ('lti' as const) : undefined,
    }
  } catch (e) {
    console.error(e)
  }

  return {
    participantToken: null,
    cookiesAvailable: true,
  }
}
