import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { Toast } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Layout from '../components/Layout'
import AccountDeletionForm from '../components/forms/AccountDeletionForm'
import AvatarUpdateForm from '../components/forms/AvatarUpdateForm'
import UpdateAccountInfoForm from '../components/forms/UpdateAccountInfoForm'

function EditProfile() {
  const t = useTranslations()
  const { data, loading } = useQuery(SelfDocument)
  const [showError, setShowError] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

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
      <div className="flex flex-col gap-8 md:gap-4 md:w-full md:max-w-5xl md:mx-auto">
        <div className="flex flex-col w-full gap-8 md:gap-4 md:flex-row">
          <div className="w-full md:w-1/2">
            <UpdateAccountInfoForm
              user={data.self}
              setShowError={setShowError}
              setShowSuccess={setShowSuccess}
            />
          </div>
          <div className="w-full md:w-1/2">
            <AccountDeletionForm />
          </div>
        </div>
        <AvatarUpdateForm
          user={data.self}
          setShowError={setShowError}
          setShowSuccess={setShowSuccess}
        />
      </div>
      <Toast
        type="error"
        openExternal={showError}
        setOpenExternal={setShowError}
        duration={8000}
      >
        {t('pwa.profile.editProfileFailed')}
      </Toast>
      <Toast
        type="success"
        openExternal={showSuccess}
        setOpenExternal={setShowSuccess}
        duration={4000}
      >
        {t('pwa.profile.editProfileSuccess')}
      </Toast>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (typeof participantToken !== 'string') {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  const result = await apolloClient.query({
    query: SelfDocument,
    context: participantToken
      ? {
          headers: {
            authorization: `Bearer ${participantToken}`,
          },
        }
      : undefined,
  })

  if (!result.data.self) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default EditProfile
