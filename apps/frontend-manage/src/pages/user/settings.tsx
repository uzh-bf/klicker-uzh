import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import Layout from '../../components/Layout'
import DelegatedAccessSettings from '../../components/user/DelegatedAccessSettings'
import EmailSetting from '../../components/user/EmailSetting'
import LanguageSetting from '../../components/user/LanguageSetting'
import ShortnameSetting from '../../components/user/ShortnameSetting'
import { trpc } from '../../lib/trpc'

function Settings() {
  const t = useTranslations()
  const { data: user } = trpc.user.profile.useQuery()

  if (!user) {
    return <Loader />
  }

  return (
    <Layout displayName={t('shared.generic.settings')}>
      <div className="border-uzh-grey-100 w-184 mx-auto flex max-w-full flex-col rounded border border-solid p-4">
        <H2>{t('manage.settings.userSettings')}</H2>
        <div className="mb-1">
          {`${t('manage.settings.storedEmail')}: ${user.email}`}
        </div>
        <ShortnameSetting user={user} />
        <LanguageSetting user={user} />
        <EmailSetting user={user} />

        <Suspense fallback={<Loader />}>
          <DelegatedAccessSettings shortname={user.shortname} />
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
