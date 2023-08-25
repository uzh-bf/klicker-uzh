import { useQuery } from '@apollo/client'
import DelegatedAccessSettings from '@components/user/DelegatedAccessSettings'
import SettingHeader from '@components/user/SettingHeader'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import Layout from '../../components/Layout'

function Settings() {
  const t = useTranslations()

  const [shortnameVisible, setShortnameVisible] = useState(true)
  const [delegatedAccessVisible, setDelegatedAccessVisible] = useState(true)
  const [languageSettingsVisible, setLanguageSettingsVisible] = useState(false)

  const { data: user } = useQuery(UserProfileDocument)

  return (
    <Layout displayName={t('shared.generic.settings')}>
      <div className="mx-auto p-4 w-[42rem] max-w-full flex flex-col border border-solid border-uzh-grey-100 rounded">
        <H1>{t('manage.settings.userSettings')}</H1>
        <SettingHeader
          text={t('shared.generic.shortname')}
          state={shortnameVisible}
          setState={setShortnameVisible}
        />
        {shortnameVisible && (
          <div className="mb-3">Shortname: {user?.userProfile?.shortname}</div>
        )}

        <SettingHeader
          text={t('auth.delegatedAccess')}
          state={delegatedAccessVisible}
          setState={setDelegatedAccessVisible}
        />
        {delegatedAccessVisible && (
          <Suspense fallback={<Loader />}>
            <DelegatedAccessSettings shortname={user?.userProfile?.shortname} />
          </Suspense>
        )}

        <SettingHeader
          text={t('manage.settings.languageSettings')}
          state={languageSettingsVisible}
          setState={setLanguageSettingsVisible}
        />
        {languageSettingsVisible && <div>Language Settings</div>}
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
