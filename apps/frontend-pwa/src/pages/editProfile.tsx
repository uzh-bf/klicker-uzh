import Loader from '@klicker-uzh/shared-components/src/Loader'
import getParticipantToken from '@lib/getParticipantToken'
import { trpc } from '@lib/trpc'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification, toast } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import Layout from '../components/Layout'
import AccountDeletionForm from '../components/forms/AccountDeletionForm'
import AvatarUpdateForm from '../components/forms/AvatarUpdateForm'
import UpdateAccountInfoForm from '../components/forms/UpdateAccountInfoForm'

function EditProfile({
  participantToken,
  cookiesAvailable,
}: {
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()
  const { data, error, isLoading, refetch } = trpc.participant.self.useQuery()
  const self = data?.self

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
  const onRefreshError = (error?: unknown) => {
    if (error) console.error(error)
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 6000 },
    })
  }
  const onProfileMutationSuccess = async () => {
    const result = await refetch().catch((error) => {
      onRefreshError(error)
      return null
    })

    if (!result) return

    if (result.error) {
      onRefreshError(result.error)
      return
    }

    onSuccess()
  }

  useParticipantToken({
    participantToken,
    cookiesAvailable,
    callback: () => void refetch().catch(console.error),
  })

  if (isLoading && !self) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <Loader />
      </Layout>
    )
  }

  if (error && !self) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  if (!self) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      course={{ displayName: t('shared.generic.title') }}
      displayName={t('pwa.profile.editProfile')}
    >
      <div className="flex flex-col gap-8 md:mx-auto md:w-full md:max-w-5xl md:gap-4">
        {error && self ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
        <div className="flex w-full flex-col gap-8 md:flex-row md:gap-4">
          <div className="w-full md:h-full md:w-1/2">
            <UpdateAccountInfoForm
              user={self}
              onError={onError}
              onSuccess={onProfileMutationSuccess}
            />
          </div>
          <div className="w-full md:h-full md:w-1/2">
            <AvatarUpdateForm
              user={self}
              onError={onError}
              onSuccess={onProfileMutationSuccess}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <AccountDeletionForm />
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    const { participantToken, cookiesAvailable } = await getParticipantToken({
      ctx,
    })

    if (!participantToken) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/createAccount`,
          permanent: false,
        },
      }
    }

    if (participantToken) {
      return {
        props: {
          participantToken,
          cookiesAvailable,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return {
      props: {
        cookiesAvailable,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
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
