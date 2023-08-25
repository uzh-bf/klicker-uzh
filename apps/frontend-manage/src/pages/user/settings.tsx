import { useMutation, useQuery } from '@apollo/client'
import DelegatedAccessSettings from '@components/user/DelegatedAccessSettings'
import Setting from '@components/user/Setting'
import SimpleSetting from '@components/user/SimpleSetting'
import {
  ChangeUserLocaleDocument,
  LocaleType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, Select } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense } from 'react'
import Layout from '../../components/Layout'

function Settings() {
  const t = useTranslations()
  const router = useRouter()
  const { pathname, asPath, query } = router

  const { data: user } = useQuery(UserProfileDocument)
  const [changeUserLocale] = useMutation(ChangeUserLocaleDocument)

  return (
    <Layout displayName={t('shared.generic.settings')}>
      <div className="mx-auto p-4 w-[42rem] max-w-full flex flex-col border border-solid border-uzh-grey-100 rounded">
        <H1>{t('manage.settings.userSettings')}</H1>
        {/* // TODO: introduce shortname with possibility to change it directly
        <SettingHeader
          text={t('shared.generic.shortname')}
          state={shortnameVisible}
          setState={setShortnameVisible}
        />
        {shortnameVisible && (
          <div className="mb-3">Shortname: {user?.userProfile?.shortname}</div>
        )} */}

        <SimpleSetting
          label={t('manage.settings.languageSettings')}
          tooltip={t('manage.settings.languageTooltip')}
        >
          <Select
            value={user?.userProfile?.locale || 'en'}
            onChange={(newLocale: string) => {
              changeUserLocale({
                variables: { locale: newLocale as LocaleType },
              })
              router.push({ pathname, query }, asPath, {
                locale: newLocale,
              })
            }}
            items={[
              { label: t('shared.generic.english'), value: 'en' },
              { label: t('shared.generic.german'), value: 'de' },
            ]}
            className={{
              content: 'font-normal text-black',
              trigger: 'font-normal text-black',
            }}
          />
        </SimpleSetting>

        <Setting title={t('auth.delegatedAccess')}>
          <Suspense fallback={<Loader />}>
            <DelegatedAccessSettings shortname={user?.userProfile?.shortname} />
          </Suspense>
        </Setting>
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
