import { verifyJWT } from '@klicker-uzh/util'
import { toast } from '@uzh-bf/design-system'
import generatePassword from 'generate-password'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'

import { useMutation } from '@apollo/client'
import Layout from '@components/Layout'
import CreateAccountForm from '@components/forms/CreateAccountForm'
import { CreateParticipantAccountDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'

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

          const createResult = login.data?.createParticipantAccount
          const participantToken = createResult?.participantToken ?? null

          if (participantToken) {
            await router.replace(
              `/editProfile?newAccount=true&participantToken=${participantToken}`,
              {
                pathname: '/editProfile',
                query: {
                  newAccount: true,
                  participantToken,
                },
              }
            )
            return
          }

          // keep legacy non-LTI behavior for direct /createAccount usage
          if (!signedLtiData && createResult?.participant) {
            await router.push({
              pathname: '/login',
              query: { newAccount: true },
            })
            return
          }

          toast({
            type: 'error',
            message: t('pwa.profile.createProfileFailed'),
            options: { duration: 6000 },
          })

          setSubmitting(false)
        }}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { createSsrRequestLogging } = await import('@lib/server/logger')
  const { logFailure, requestContext } = createSsrRequestLogging(
    ctx.req.headers,
    '/createAccount'
  )

  // in assessment application, redirect to assessment home page
  if (process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true') {
    return {
      redirect: {
        destination: process.env.APP_ORIGIN_ASSESSMENT_PWA,
        permanent: false,
      },
    }
  }

  try {
    const { query } = ctx
    const apolloClient = initializeApollo(undefined, ctx, requestContext)
    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      ctx,
    })

    if (participantToken) {
      if (!cookiesAvailable) {
        return {
          redirect: {
            destination: `${ctx.locale ? `/${ctx.locale}` : ''}/editProfile?participantToken=${participantToken}`,
            permanent: false,
            query: { participantToken },
          },
        }
      }

      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/editProfile`,
          permanent: false,
        },
      }
    }

    const cookies = nookies.get(ctx)
    const signedLtiData = { token: '', ssoId: '', email: '' }

    // LTI 1.3 authentication flow
    if (cookies['lti-token'] || query.jwt) {
      const token = cookies['lti-token'] ?? query.jwt

      const parsedToken = (await verifyJWT(
        token,
        process.env.APP_SECRET as string
      )) as {
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
  } catch {
    logFailure('data_load_failed')

    // remove the lti-token, if it is defined
    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch {
      logFailure('cookie_cleanup_failed')
    }

    // redirect to lti error page with redirect back to this page
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/createAccount`)}`,
        permanent: false,
      },
    }
  }
}

export default CreateAccount
