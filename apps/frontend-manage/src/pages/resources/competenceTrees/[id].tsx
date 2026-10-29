import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../../components/Layout'
import CompetenceTreeEditor from '../../../components/resources/competenceTrees/CompetenceTreeEditor'

function CompetenceTreeEditorPage({ treeId }: { treeId: string }) {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.competenceTree.editTitle')}>
      <CompetenceTreeEditor treeId={treeId} />
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
      treeId: params?.id,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default CompetenceTreeEditorPage
