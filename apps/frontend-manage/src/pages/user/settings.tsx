import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import Layout from '../../components/Layout'
import DelegatedAccessSettings from '../../components/user/DelegatedAccessSettings'
import EmailSetting from '../../components/user/EmailSetting'
import LanguageSetting from '../../components/user/LanguageSetting'
import ShortnameSetting from '../../components/user/ShortnameSetting'

function Settings() {
  const t = useTranslations()
  const { data: user } = useQuery(UserProfileDocument)

  if (!user?.userProfile) {
    return <Loader />
  }

  return (
    <Layout displayName={t('shared.generic.settings')}>
      <div className="mx-auto p-4 w-[46rem] max-w-full flex flex-col border border-solid border-uzh-grey-100 rounded">
        <H1>{t('manage.settings.userSettings')}</H1>
        <ShortnameSetting user={user.userProfile} />
        <LanguageSetting user={user.userProfile} />
        <EmailSetting user={user.userProfile} />

        <Suspense fallback={<Loader />}>
          <DelegatedAccessSettings shortname={user?.userProfile?.shortname} />
        </Suspense>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Settings
