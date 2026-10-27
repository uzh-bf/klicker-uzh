import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useAdaptiveManageHost } from '../../../ports'
import CompetenceTreeLibrary from '../../../components/resources/competenceTrees/CompetenceTreeLibrary'

function CompetenceTreeLibraryPage() {
  const { Layout } = useAdaptiveManageHost()
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.resources.competenceTrees')}>
      <CompetenceTreeLibrary />
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

export default CompetenceTreeLibraryPage
