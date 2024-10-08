import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Toast } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const [showError, setShowError] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const { data, loading, refetch } = useQuery(SelfDocument)

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
              setShowError={setShowError}
              setShowSuccess={setShowSuccess}
            />
          </div>
          <div className="w-full md:h-full md:w-1/2">
            <AvatarUpdateForm
              user={data.self}
              setShowError={setShowError}
              setShowSuccess={setShowSuccess}
            />
          </div>
        </div>
        <AccountDeletionForm />
      </div>
      <Toast
        dismissible
        type="error"
        openExternal={showError}
        setOpenExternal={setShowError}
        duration={8000}
      >
        {t('pwa.profile.editProfileFailed')}
      </Toast>
      <Toast
        dismissible
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

  const { participantToken, cookiesAvailable } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (!participantToken) {
    return {
      redirect: {
        destination: `/createAccount`,
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
}

export default EditProfile
