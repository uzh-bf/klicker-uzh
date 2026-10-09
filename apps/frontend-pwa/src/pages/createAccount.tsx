import { useMutation } from '@apollo/client'
import CreateAccountForm from '@components/forms/CreateAccountForm'
import Layout from '@components/Layout'
import { CreateParticipantAccountWithDataUseDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import { setParticipantSessionToken } from '@lib/participantSession'
import { toast } from '@uzh-bf/design-system'
import generatePassword from 'generate-password'
import type { GetServerSidePropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useEffect } from 'react'

interface Props {
  participantToken?: string
  signedLtiData?: string
  ssoId?: string
  email?: string
  username: string
  dataUseDisclosureVersion: string
}

function CreateAccount({
  participantToken: linkedParticipantToken,
  signedLtiData,
  email,
  username,
  dataUseDisclosureVersion,
}: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [createParticipantAccount] = useMutation(
    CreateParticipantAccountWithDataUseDocument
  )

  useEffect(() => {
    if (!linkedParticipantToken) return
    // A launch for an already linked account continues to the profile. The
    // frame may refuse the exchanged cookie, so the tab keeps the credential.
    setParticipantSessionToken(linkedParticipantToken)
    void router.replace('/editProfile')
  }, [linkedParticipantToken, router])

  if (linkedParticipantToken) return <Loader />

  return (
    <Layout displayName={t('pwa.createAccount.signup.submit')}>
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
              dataUse: {
                disclosureVersion: dataUseDisclosureVersion,
                researchConsent: values.researchConsent,
                learningAnalyticsConsent: values.learningAnalyticsConsent,
                acknowledged: values.acknowledged,
              },
            },
          })

          const createResult = login.data?.createParticipantAccount
          const participantToken = createResult?.participantToken ?? null

          if (participantToken) {
            // The account cookie may be refused inside an LMS frame, so this
            // tab keeps the new credential instead of passing it in the URL.
            setParticipantSessionToken(participantToken)
            await router.replace('/editProfile?newAccount=true')
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
    const apolloClient = initializeApollo()
    const { participantToken, sessionState, signedLtiData, tokenSource } =
      await getParticipantToken({
        apolloClient,
        ctx,
      })

    if (participantToken && tokenSource === 'explicit') {
      return {
        props: {
          participantToken,
          sessionState,
          tokenSource,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    if (participantToken) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/editProfile`,
          permanent: false,
        },
      }
    }

    if (
      sessionState === 'rejected' ||
      sessionState === 'exchange_unavailable'
    ) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?freshLaunch=true`,
          permanent: false,
        },
      }
    }

    if (!query?.disableLti && signedLtiData) {
      return addApolloState(apolloClient, {
        props: {
          signedLtiData: signedLtiData.token,
          sessionState,
          ssoId: signedLtiData.ssoId,
          email: signedLtiData.email,
          dataUseDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
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
        sessionState,
        dataUseDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
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
  } catch (error) {
    console.error('Error in getServerSideProps on createAccount:', error)

    // remove the lti-token, if it is defined
    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
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
