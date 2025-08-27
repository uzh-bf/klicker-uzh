import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { toast } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import AccountDeletionForm from '../components/forms/AccountDeletionForm'
import AvatarUpdateForm from '../components/forms/AvatarUpdateForm'
import UpdateAccountInfoForm from '../components/forms/UpdateAccountInfoForm'

interface Props {
  participantToken?: string
  cookiesAvailable?: boolean
}

function EditProfile({ participantToken, cookiesAvailable }: Props) {
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
          <div className="w-full md:w-1/2">
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
  try {
    const apolloClient = initializeApollo()
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
  } catch (error) {
    console.error('Error in getServerSideProps on editProfile:', error)

    // redirect to lti error page with redirect back to this page
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/ltiError?redirectTo=${process.env.NEXT_PUBLIC_PWA_URL}/${ctx.locale}/editProfile`,
        permanent: false,
      },
    }
  }
}

export default EditProfile
