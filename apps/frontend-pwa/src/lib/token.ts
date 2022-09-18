import { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { RegisterParticipantFromLtiDocument } from '@klicker-uzh/graphql/dist/ops'
import bodyParser from 'body-parser'
import JWT from 'jsonwebtoken'
import { GetServerSidePropsContext } from 'next'
import getConfig from 'next/config'
import nookies from 'nookies'

const { serverRuntimeConfig } = getConfig()

export async function getParticipantToken({
  apolloClient,
  ctx,
}: {
  apolloClient: ApolloClient<NormalizedCacheObject>
  ctx: GetServerSidePropsContext
}) {
  const { req, res, query } = ctx

  const cookies = nookies.get(ctx)

  // if the user already has a participant token, skip registration
  // fetch the relevant data directly
  let participantToken = cookies['participant_token']

  try {
    if (!participantToken && req.method === 'POST') {
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
        const secret = process.env.APP_SECRET ?? serverRuntimeConfig.APP_SECRET

        // send along a JWT to ensure only the next server is allowed to register participants from LTI
        const token = JWT.sign(
          {
            sub: 'lti-admin',
            role: 'ADMIN',
          },
          secret,
          {
            algorithm: 'HS256',
            expiresIn: '1h',
          }
        )

        console.log('token', token)

        const result = await apolloClient.mutate({
          mutation: RegisterParticipantFromLtiDocument,
          variables: {
            courseId: query.courseId as string,
            participantId: request.body.lis_person_sourcedid,
          },
          context: {
            headers: {
              authorization: `Bearer ${token}`,
            },
          },
        })

        console.log('result', result)

        // if a JWT was received from the API, set a cookie in the participant browser
        if (result.data?.registerParticipantFromLTI?.participantToken) {
          participantToken =
            result.data.registerParticipantFromLTI.participantToken
          nookies.set(ctx, 'participant_token', participantToken, {
            domain:
              process.env.COOKIE_DOMAIN ?? serverRuntimeConfig.COOKIE_DOMAIN,
            path: '/',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 6,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
          })
        }

        return {
          participantToken,
          participant: result.data?.registerParticipantFromLTI?.participant,
        }
      }
    }
  } catch (e) {
    console.error(e)
  }

  return {
    participantToken,
  }
}
