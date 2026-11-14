import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { LoginParticipantWithLtiDocument } from '@klicker-uzh/graphql/dist/ops'
import { previewCookieName, verifyJWT } from '@klicker-uzh/util'
import type { GetServerSidePropsContext } from 'next'
import nookies from 'nookies'

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
  let participantToken: string | undefined | null =
    (process.env.ASSESSMENT_MODE === 'true'
      ? cookies[previewCookieName('next-auth.participant-session-token')]
      : cookies[previewCookieName('participant_token')]) ??
    query.participantToken

  // TODO: only check for existing participantToken once participation issues with LTI are resolved
  if (
    participantToken &&
    !cookies[previewCookieName('lti-token')] &&
    !query.jwt
  ) {
    return {
      participantToken,
      cookiesAvailable:
        process.env.ASSESSMENT_MODE === 'true'
          ? !!cookies[previewCookieName('next-auth.participant-session-token')]
          : !!cookies[previewCookieName('participant_token')],
    }
  }

  try {
    let result

    const cookiesAvailable = !!cookies[previewCookieName('lti-token')]

    // LTI 1.3 authentication flow
    if (cookies[previewCookieName('lti-token')] || query.jwt) {
      const token = cookies[previewCookieName('lti-token')] ?? query.jwt

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
      nookies.set(
        ctx,
        previewCookieName('participant_token'),
        participantToken,
        {
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
        }
      )

      // remove the lti-token cookie since we now have a proper participant_token
      nookies.destroy(ctx, previewCookieName('lti-token'), {
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
    }
  } catch (e) {
    console.error(e)
  }

  return {
    participantToken: null,
    cookiesAvailable: true,
  }
}
