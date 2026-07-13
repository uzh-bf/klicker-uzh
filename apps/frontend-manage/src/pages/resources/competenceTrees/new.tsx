import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../../components/Layout'
import CompetenceTreeEditor from '../../../components/resources/competenceTrees/CompetenceTreeEditor'

function NewCompetenceTreePage() {
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
