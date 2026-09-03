import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { toast } from '@uzh-bf/design-system'
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
  const { data, loading, refetch } = useQuery(SelfDocument)

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
    participantToken,
    cookiesAvailable,
    callback: () => refetch(),
  })

  if (loading || !data?.self) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <Loader />
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
        <div className="flex flex-col gap-4 md:flex-row">
          <AccountDeletionForm />
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { createSsrRequestLogging } = await import('@lib/server/logger')
  const { logFailure, requestContext } = createSsrRequestLogging(
    ctx.req.headers,
    '/editProfile'
  )

  try {
    const apolloClient = initializeApollo(undefined, ctx, requestContext)
    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
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

    return addApolloState(apolloClient, {
      props: {
        cookiesAvailable,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/editProfile`)}`,
        permanent: false,
      },
    }
  }
}

export default EditProfile
