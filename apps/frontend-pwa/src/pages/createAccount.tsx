import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

import { useMutation } from '@apollo/client'
import { CreateParticipantAccountDocument } from '@klicker-uzh/graphql/dist/ops'
import bodyParser from 'body-parser'
import Layout from 'src/components/Layout'
import CreateAccountForm from 'src/components/forms/CreateAccountForm'
import { addApolloState, initializeApollo } from 'src/lib/apollo'
import { getParticipantToken } from 'src/lib/token'

interface CreateAccountProps {
  signedLtiData?: string
  ssoId?: string
  email?: string
  username: string
}

function CreateAccount({ signedLtiData, email, username }: CreateAccountProps) {
  const t = useTranslations()
  const router = useRouter()

  const [createParticipantAccount] = useMutation(
    CreateParticipantAccountDocument
  )

  return (
    <Layout displayName={t('pwa.profile.createProfile')}>
      <CreateAccountForm
        initialUsername={username}
        initialEmail={email}
        handleSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)

          const login = await createParticipantAccount({
            variables: {
              email: values.email.trim().toLowerCase(),
              username: values.username.trim(),
              password: values.password.trim(),
              isProfilePublic: values.isProfilePublic,
              signedLtiData,
            },
          })

          if (login) {
            await router.replace('/login', {
              pathname: '/login',
              query: {
                newAccount: true,
              },
            })
          }

          setSubmitting(false)
        }}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { req, res, query } = ctx

  // if the user already has a participant token, skip registration
  // and redirect to the edit  profile page
  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (participantToken) {
    return {
      redirect: {
        destination: `/editProfile`,
        permanent: false,
      },
    }
  }

  if (req.method === 'POST') {
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

    if (!query?.disableLti && request?.body?.lis_person_sourcedid) {
      const signedLtiData = JWT.sign(
        {
          sub: request.body.lis_person_sourcedid,
          email: request.body.lis_person_contact_email_primary,
        },
        process.env.APP_SECRET as string,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
        }
      )

      return addApolloState(apolloClient, {
        props: {
          signedLtiData,
          ssoId: request.body.lis_person_sourcedid,
          email: request.body.lis_person_contact_email_primary,
          username: generatePassword.generate({
            length: 8,
            uppercase: true,
            symbols: false,
            numbers: true,
          }),
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      })
    }
  }

  return {
    props: {
      username: generatePassword.generate({
        length: 10,
        uppercase: true,
        symbols: false,
        numbers: true,
      }),
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  }
}

export default CreateAccount
