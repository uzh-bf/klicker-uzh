import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'

import { useMutation } from '@apollo/client'
import { CreateParticipantAccountDocument } from '@klicker-uzh/graphql/dist/ops'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import bodyParser from 'body-parser'
import Layout from 'src/components/Layout'
import CreateAccountForm from 'src/components/forms/CreateAccountForm'
import { addApolloState, initializeApollo } from 'src/lib/apollo'

interface Props {
  signedLtiData?: string
  ssoId?: string
  email?: string
  username: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function CreateAccount({
  signedLtiData,
  email,
  username,
  participantToken,
  cookiesAvailable,
}: Props) {
  const t = useTranslations()
  const router = useRouter()

  const [createParticipantAccount] = useMutation(
    CreateParticipantAccountDocument
  )

  useParticipantToken({
    participantToken,
    cookiesAvailable,
    redirectTo: '/editProfile',
  })

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

  const apolloClient = initializeApollo()

  const { participantToken, jwt } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (participantToken) {
    return {
      redirect: {
        destination: `/editProfile?jwt=${jwt}`,
        permanent: false,
        query: { jwt },
      },
    }
  }

  const cookies = nookies.get(ctx)

  const signedLtiData = {
    token: '',
    ssoId: '',
    email: '',
  }

  // LTI 1.3 authentication flow
  if (cookies['lti-token'] || query.jwt) {
    const token = cookies['lti-token'] ?? query.jwt

    const parsedToken = JWT.verify(token, process.env.APP_SECRET as string) as {
      sub: string
      email: string
      scope: string
    }

    if (parsedToken.scope === 'LTI1.3') {
      signedLtiData.token = token
      signedLtiData.ssoId = parsedToken.sub
      signedLtiData.email = parsedToken.email
    }
  }
  // LTI 1.1 authentication flow
  else if (req.method === 'POST') {
    const { request }: any = await new Promise((resolve) => {
      bodyParser.urlencoded({ extended: true })(req, res, () => {
        bodyParser.json()(req, res, () => {
          resolve({ request: req })
        })
      })
    })

    if (request?.body?.lis_person_sourcedid) {
      signedLtiData.token = JWT.sign(
        {
          sub: request.body.lis_person_sourcedid,
          email: request.body.lis_person_contact_email_primary,
          scope: 'LTI1.1',
        },
        process.env.APP_SECRET as string,
        {
          algorithm: 'HS256',
          expiresIn: '5m',
        }
      )
      signedLtiData.ssoId = request.body.lis_person_sourcedid
      signedLtiData.email = request.body.lis_person_contact_email_primary
    }
  }

  if (!query?.disableLti && signedLtiData.token !== '') {
    return addApolloState(apolloClient, {
      props: {
        signedLtiData: signedLtiData.token,
        ssoId: signedLtiData.ssoId,
        email: signedLtiData.email,
        username: generatePassword.generate({
          length: 10,
          uppercase: true,
          symbols: false,
          numbers: true,
        }),
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
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
