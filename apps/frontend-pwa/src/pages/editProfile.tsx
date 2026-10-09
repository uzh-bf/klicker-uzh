import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, toast } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import { useEffect, useState } from 'react'
import AccountDeletionForm from '../components/forms/AccountDeletionForm'
import AvatarUpdateForm from '../components/forms/AvatarUpdateForm'
import UpdateAccountInfoForm from '../components/forms/UpdateAccountInfoForm'
import Layout from '../components/Layout'
import DataUseSettings from '../components/participant/DataUseSettings'

function EditProfile({
  participantToken,
  cookiesAvailable,
}: {
  participantToken?: string | null
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const { data, loading, error, refetch } = useQuery(SelfDocument)
  const [retrying, setRetrying] = useState(false)
  const [embedded, setEmbedded] = useState(false)

  // Frame detection only selects recovery guidance; it never grants identity.
  useEffect(() => {
    setEmbedded(window.self !== window.top)
  }, [])

  const onError = () =>
    toast({
      type: 'error',
      message: t('pwa.profile.editProfileFailed'),
      options: { duration: 6000 },
    })
  const onSuccess = () =>
    toast({
      type: 'success',
      message: t('pwa.profile.editProfileSuccess'),
      options: { duration: 3500 },
    })

  useParticipantToken({
    participantToken: participantToken ?? undefined,
    cookiesAvailable,
    callback: () => refetch(),
  })

  const retryProfileQuery = async () => {
    setRetrying(true)
    try {
      await refetch()
    } catch {
      // The settled error state stays visible for another manual retry.
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <Loader />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <div
          className="flex h-full flex-col items-center justify-center gap-4 text-center"
          data-cy="participant-session-error"
        >
          <p className="max-w-140 text-gray-600">
            {t('pwa.profile.sessionError')}
          </p>
          <Button
            disabled={retrying}
            onClick={() => void retryProfileQuery()}
            className={{ root: 'h-8' }}
            data={{ cy: 'participant-session-retry' }}
          >
            <Button.Label>{t('pwa.profile.sessionErrorRetry')}</Button.Label>
          </Button>
        </div>
      </Layout>
    )
  }

  if (!data?.self) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <div
          className="flex h-full flex-col items-center justify-center gap-4 text-center"
          data-cy="participant-session-recovery"
        >
          <p className="max-w-140 text-gray-600">
            {t('pwa.profile.sessionRecovery')}
          </p>
          {embedded ? (
            <p className="max-w-140 text-gray-600">
              {t('pwa.profile.sessionRecoveryEmbedded')}
            </p>
          ) : null}
          <Button
            onClick={() =>
              void router.push(
                `/login?redirect_to=${encodeURIComponent('/editProfile')}`
              )
            }
            className={{ root: 'h-8' }}
            data={{ cy: 'participant-session-login' }}
          >
            <Button.Label>{t('shared.generic.signin')}</Button.Label>
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      course={{ displayName: t('shared.generic.title') }}
      displayName={t('pwa.profile.editProfile')}
    >
      <div className="flex flex-col gap-8 md:mx-auto md:w-full md:max-w-5xl md:gap-4">
        <div className="flex w-full flex-col gap-8 md:flex-row md:gap-4">
          <div className="w-full md:h-full md:w-1/2">
            <UpdateAccountInfoForm
              user={data.self}
              onError={onError}
              onSuccess={onSuccess}
            />
          </div>
          <div className="w-full md:h-full md:w-1/2">
            <AvatarUpdateForm
              user={data.self}
              onError={onError}
              onSuccess={onSuccess}
            />
          </div>
        </div>
        <DataUseSettings />
        <div className="flex flex-col gap-4 md:flex-row">
          <AccountDeletionForm />
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    const apolloClient = initializeApollo()
    const {
      participantToken,
      cookiesAvailable,
      sessionState,
      tokenSource,
      signedLtiData,
    } = await getParticipantToken({
      apolloClient,
      ctx,
    })

    if (
      sessionState === 'registration_required' ||
      (process.env.ASSESSMENT_MODE === 'true' && !participantToken)
    ) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/createAccount${
            sessionState === 'registration_required' && signedLtiData
              ? `?jwt=${encodeURIComponent(signedLtiData.token)}`
              : ''
          }`,
          permanent: false,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        participantToken,
        cookiesAvailable,
        sessionState,
        tokenSource,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
  } catch (error) {
    console.error('Error in getServerSideProps on editProfile:', error)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/editProfile`)}`,
        permanent: false,
      },
    }
  }
}

export default EditProfile
