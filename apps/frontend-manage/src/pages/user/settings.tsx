import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2 } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import Layout from '../../components/Layout'
import BetaFeaturesSetting from '../../components/user/BetaFeaturesSetting'
import ChatAccountUsageSettings from '../../components/user/ChatAccountUsageSettings'
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
      <div className="border-uzh-grey-100 w-184 mx-auto flex max-w-full flex-col rounded border border-solid p-4">
        <H2>{t('manage.settings.userSettings')}</H2>
        <div className="mb-1">
          {`${t('manage.settings.storedEmail')}: ${user.userProfile.email}`}
        </div>
        <ShortnameSetting user={user.userProfile} />
        <LanguageSetting user={user.userProfile} />
        <EmailSetting user={user.userProfile} />
        {user.userProfile.catalyst && <BetaFeaturesSetting />}

        <Suspense fallback={<Loader />}>
          <ChatAccountUsageSettings />
        </Suspense>

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
