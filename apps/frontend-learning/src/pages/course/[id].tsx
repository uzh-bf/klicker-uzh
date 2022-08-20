import { RegisterParticipantFromLtiDocument } from '@klicker-uzh/graphql/dist/ops'
import bodyParser from 'body-parser'
import { GetServerSideProps } from 'next'
import nookies from 'nookies'
import { addApolloState, initializeApollo } from '../../lib/apollo'

function CourseOverview({ context }: any) {
  return <div className="flex flex-row p-4"></div>
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { req, res } = ctx
  const cookies = nookies.get(ctx)

  // if the user already has a participant token, skip registration
  if (cookies['participant_token']) {
    return {
      props: {},
    }
  }

  // extract the body from the LTI request
  // TODO: verify that there is an LTI body and that it is valid
  const { request, response } = await new Promise((resolve) => {
    bodyParser.urlencoded({ extended: true })(req, res, () => {
      bodyParser.json()(req, res, () => {
        resolve({ request: req, response: res })
      })
    })
  })

  const apolloClient = initializeApollo()

  const result = await apolloClient.mutate({
    mutation: RegisterParticipantFromLtiDocument,
    variables: {
      participantId: request.body.lis_person_sourcedid,
      participantEmail: request.body.lis_person_contact_email_primary,
    },
  })

  // if a JWT was received from the API, set a cookie in the participant browser
  if (result.data?.registerParticipantFromLTI) {
    nookies.set(
      ctx,
      'participant_token',
      result.data?.registerParticipantFromLTI,
      {
        domain: process.env.API_DOMAIN ?? 'localhost',
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === 'production',
      }
    )
  }

  return addApolloState(apolloClient, {
    props: {},
  })
}

export default CourseOverview
