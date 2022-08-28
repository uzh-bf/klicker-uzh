import {
  GetCourseOverviewDataDocument,
  RegisterParticipantFromLtiDocument,
} from '@klicker-uzh/graphql/dist/ops'
import bodyParser from 'body-parser'
import getConfig from 'next/config'
import nookies from 'nookies'
import { initializeApollo } from './apollo'

const { serverRuntimeConfig } = getConfig()

export async function getParticipantToken(ctx: any) {
  const { req, res, query } = ctx

  const apolloClient = initializeApollo()

  // extract the body from the LTI request
  // TODO: verify that there is an LTI body and that it is valid
  const { request }: any = await new Promise((resolve) => {
    bodyParser.urlencoded({ extended: true })(req, res, () => {
      bodyParser.json()(req, res, () => {
        resolve({ request: req })
      })
    })
  })

  const cookies = nookies.get(ctx)

  // if the user already has a participant token, skip registration
  if (cookies['participant_token'] || !request?.body?.lis_person_sourcedid) {
    const result = await apolloClient.query({
      query: GetCourseOverviewDataDocument,
      variables: {
        courseId: query.courseId as string,
      },
      context: cookies['participant_token']
        ? {
            headers: {
              authorization: `Bearer ${cookies['participant_token']}`,
            },
          }
        : undefined,
    })

    return {
      apolloClient,
      result: result.data?.getCourseOverviewData ?? {},
    }
  }

  const result = await apolloClient.mutate({
    mutation: RegisterParticipantFromLtiDocument,
    variables: {
      courseId: query.courseId as string,
      participantId: request.body.lis_person_sourcedid,
      participantEmail: request.body.lis_person_contact_email_primary,
    },
    context: cookies['participant_token']
      ? {
          headers: {
            authorization: `Bearer ${cookies['participant_token']}`,
          },
        }
      : undefined,
  })

  // if a JWT was received from the API, set a cookie in the participant browser
  if (result.data?.registerParticipantFromLTI?.participantToken) {
    nookies.set(
      ctx,
      'participant_token',
      result.data.registerParticipantFromLTI.participantToken,
      {
        domain: serverRuntimeConfig.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 6,
        secure: process.env.NODE_ENV === 'production',
      }
    )
  }

  return {
    apolloClient,
    result: result.data?.registerParticipantFromLTI ?? {},
  }
}
