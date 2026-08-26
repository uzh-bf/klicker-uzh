import { KnowledgeBaseDetail } from '@klicker-uzh/kb-management'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import AiBetaUnavailable from '../../../components/AiBetaUnavailable'
import Layout from '../../../components/Layout'
import { useAiFeaturesEnabled } from '../../../lib/hooks/useAiFeaturesEnabled'

function KnowledgeBasePage({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const aiFeaturesEnabled = useAiFeaturesEnabled()

  return (
    <Layout displayName={t('kb.title')}>
      {aiFeaturesEnabled ? (
        <KnowledgeBaseDetail kbId={kbId} />
      ) : (
        <AiBetaUnavailable />
      )}
    </Layout>
  )
}

export async function getStaticProps({
  locale,
  params,
}: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
      kbId: params?.id,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default KnowledgeBasePage
