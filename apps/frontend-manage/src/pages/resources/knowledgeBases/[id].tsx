import { KnowledgeBaseDetail } from '@klicker-uzh/kb-management'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../../components/Layout'

function KnowledgeBasePage({ kbId }: { kbId: string }) {
  const t = useTranslations()

  return (
    <Layout displayName={t('kb.title')}>
      <KnowledgeBaseDetail kbId={kbId} />
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
