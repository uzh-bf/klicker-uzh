import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useAdaptiveManageHost } from '../../../ports'
import CompetenceTreeEditor from '../../../components/resources/competenceTrees/CompetenceTreeEditor'

function NewCompetenceTreePage() {
  const { Layout } = useAdaptiveManageHost()
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.competenceTree.newTitle')}>
      <CompetenceTreeEditor />
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

export default NewCompetenceTreePage
