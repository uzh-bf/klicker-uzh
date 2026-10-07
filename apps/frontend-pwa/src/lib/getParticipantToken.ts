import type {
  ApolloClient,
  FetchResult,
  NormalizedCacheObject,
} from '@apollo/client'
import {
  LoginParticipantWithLtiDocument,
  type LoginParticipantWithLtiMutation,
} from '@klicker-uzh/graphql/dist/ops'
import { verifyJWT } from '@klicker-uzh/util'
import type { GetServerSidePropsContext } from 'next'
import nookies from 'nookies'

export interface ParticipantSessionResult {
  participantToken: string | null
  cookiesAvailable: boolean
  sessionState:
    | 'no_launch'
    | 'authenticated'
    | 'registration_required'
    | 'rejected'
    | 'exchange_unavailable'
  tokenSource: 'explicit' | 'ambient' | null
  signedLtiData?: { token: string; ssoId: string; email: string }
}

function participantCookieOptions() {
  const secure =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'
  return {
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
    httpOnly: true,
    secure,
    sameSite: secure ? ('none' as const) : ('lax' as const),
  }
}

function expirePartitionedParticipantCookie(ctx: GetServerSidePropsContext) {
  const options = participantCookieOptions()
  // Append after nookies serialization, which drops the Partitioned attribute.
  // Send the expiration first so older browsers cannot erase the new cookie.
  const domain = options.domain ? `; Domain=${options.domain}` : ''
  const existing = ctx.res.getHeader('Set-Cookie') ?? []
  ctx.res.setHeader('Set-Cookie', [
    `participant_token=; Max-Age=0; Path=/${domain}; HttpOnly; Secure; SameSite=None; Partitioned`,
    ...(Array.isArray(existing) ? existing : [String(existing)]),
  ])
}

function clearParticipantCookie(ctx: GetServerSidePropsContext) {
  nookies.destroy(ctx, 'participant_token', participantCookieOptions())
}

function setParticipantCookie(
  ctx: GetServerSidePropsContext,
  token: string,
  maxAge: number
) {
  clearParticipantCookie(ctx)
  // set a proper participant_token
  nookies.set(ctx, 'participant_token', token, {
    ...participantCookieOptions(),
    maxAge,
  })
  // remove the lti-token cookie since we now have a proper participant_token
  nookies.destroy(ctx, 'lti-token', {
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
  })
  expirePartitionedParticipantCookie(ctx)
}

export default async function getParticipantToken({
  apolloClient,
  courseId,
  ctx,
}: {
  apolloClient: ApolloClient<NormalizedCacheObject>
  courseId?: string
  ctx: GetServerSidePropsContext
}): Promise<ParticipantSessionResult> {
  if (process.env.ASSESSMENT_MODE === 'true') {
    const result = await getAssessmentParticipantToken({
      apolloClient,
      courseId,
      ctx,
    })
    return {
      ...result,
      tokenSource: 'ambient',
      sessionState: result.participantToken ? 'authenticated' : 'no_launch',
    } as ParticipantSessionResult
  }
  const { query } = ctx
  const cookies = nookies.get(ctx)
  const ambient = cookies.participant_token
  const hasLtiHandoff = Object.hasOwn(query, 'jwt')
  const base = {
    participantToken: null,
    cookiesAvailable: !!ambient,
    tokenSource: null,
  } as const
  const reject = (): ParticipantSessionResult => {
    clearParticipantCookie(ctx)
    nookies.destroy(ctx, 'lti-token', {
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
    })
    expirePartitionedParticipantCookie(ctx)
    return { ...base, sessionState: 'rejected' }
  }
  const verifyParticipant = async (token: string) => {
    const claims = await verifyJWT(token, process.env.APP_SECRET as string)
    if (
      typeof claims.sub !== 'string' ||
      !claims.sub.trim() ||
      claims.role !== 'PARTICIPANT' ||
      claims.scope !== undefined ||
      !Number.isFinite(claims.exp) ||
      claims.exp! <= Date.now() / 1000
    ) {
      throw new Error('Invalid participant session')
    }
    return Math.min(
      60 * 60 * 24 * 13,
      Math.floor(claims.exp! - Date.now() / 1000)
    )
  }

  const ltiToken = hasLtiHandoff ? query.jwt : cookies['lti-token']
  if (!ltiToken && !hasLtiHandoff) {
    const token = ambient
    if (!token) return { ...base, sessionState: 'no_launch' }
    try {
      if (typeof token !== 'string') return reject()
      await verifyParticipant(token)
      return {
        participantToken: token,
        cookiesAvailable: !!ambient,
        tokenSource: 'ambient',
        sessionState: 'authenticated',
      }
    } catch {
      return reject()
    }
  }

  let signedLtiData: NonNullable<ParticipantSessionResult['signedLtiData']>
  try {
    if (typeof ltiToken !== 'string' || !ltiToken) return reject()
    const claims = await verifyJWT(ltiToken, process.env.APP_SECRET as string)
    if (
      claims.scope !== 'LTI1.3' ||
      typeof claims.sub !== 'string' ||
      !claims.sub.trim() ||
      (claims.email !== undefined && typeof claims.email !== 'string') ||
      !Number.isFinite(claims.exp) ||
      claims.exp! <= Date.now() / 1000
    )
      return reject()
    signedLtiData = {
      token: ltiToken,
      ssoId: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : '',
    }
  } catch {
    return reject()
  }

  try {
    const result = await apolloClient.mutate({
      mutation: LoginParticipantWithLtiDocument,
      variables: { signedLtiData: signedLtiData.token, courseId },
    })
    if (result.errors?.length) throw new Error('Participant exchange failed')
    const token = result.data?.loginParticipantWithLti?.participantToken
    if (!token) {
      if (!signedLtiData.email.trim()) return reject()
      clearParticipantCookie(ctx)
      expirePartitionedParticipantCookie(ctx)
      return { ...base, sessionState: 'registration_required', signedLtiData }
    }
    const maxAge = await verifyParticipant(token)
    setParticipantCookie(ctx, token, maxAge)
    return {
      participantToken: token,
      cookiesAvailable: !!cookies['lti-token'],
      tokenSource: 'explicit',
      sessionState: 'authenticated',
    }
  } catch {
    clearParticipantCookie(ctx)
    expirePartitionedParticipantCookie(ctx)
    return { ...base, sessionState: 'exchange_unavailable' }
  }
}

async function getAssessmentParticipantToken({
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
      ? cookies['next-auth.participant-session-token']
      : cookies['participant_token']) ?? query.participantToken

  // TODO: only check for existing participantToken once participation issues with LTI are resolved
  if (participantToken && !cookies['lti-token'] && !query.jwt) {
    return {
      participantToken,
      cookiesAvailable:
        process.env.ASSESSMENT_MODE === 'true'
          ? !!cookies['next-auth.participant-session-token']
          : !!cookies['participant_token'],
    }
  }

  try {
    let result: FetchResult<LoginParticipantWithLtiMutation> | undefined

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
    }
  } catch (e) {
    console.error(e)
  }

  return {
    participantToken: null,
    cookiesAvailable: true,
  }
}
