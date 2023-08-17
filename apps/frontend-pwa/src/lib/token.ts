import { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { LoginParticipantWithLtiDocument } from '@klicker-uzh/graphql/dist/ops'
import bodyParser from 'body-parser'
import JWT from 'jsonwebtoken'
import { GetServerSidePropsContext } from 'next'
import nookies from 'nookies'

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
  let participantToken =
    cookies['participant_token'] || cookies['next-auth.session-token']

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
        // send along a JWT to ensure only the next server is allowed to register participants from LTI
        const signedLtiData = JWT.sign(
          {
            sub: request?.body?.lis_person_sourcedid,
          },
          process.env.APP_SECRET as string,
          {
            algorithm: 'HS256',
            expiresIn: '1h',
          }
        )

        const result = await apolloClient.mutate({
          mutation: LoginParticipantWithLtiDocument,
          variables: {
            signedLtiData,
          },
        })

        return {
          participantToken:
            result.data?.loginParticipantWithLti?.participantToken ??
            participantToken,
          participant: result.data?.loginParticipantWithLti,
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
