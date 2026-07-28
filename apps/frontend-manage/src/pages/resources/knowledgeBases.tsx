import { KnowledgeBaseManager } from '@klicker-uzh/kb-management'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'

function KnowledgeBasesPage() {
  const t = useTranslations()

  return (
    <Layout displayName={t('kb.title')}>
      <KnowledgeBaseManager />
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

export default KnowledgeBasesPage
