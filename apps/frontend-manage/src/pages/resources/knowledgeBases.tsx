import { KnowledgeBaseManager } from '@klicker-uzh/kb-management'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import AiBetaUnavailable from '../../components/AiBetaUnavailable'
import Layout from '../../components/Layout'
import { useAiFeaturesEnabled } from '../../lib/hooks/useAiFeaturesEnabled'

function KnowledgeBasesPage() {
  const t = useTranslations()
  const aiFeaturesEnabled = useAiFeaturesEnabled()

  return (
    <Layout displayName={t('kb.title')}>
      {aiFeaturesEnabled ? <KnowledgeBaseManager /> : <AiBetaUnavailable />}
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
