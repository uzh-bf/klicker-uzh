import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import AnswerCollections from '../components/resources/AnswerCollections'

function AnswerCollectionsPage() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.resources.answerCollections')}>
      <AnswerCollections />
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

export default AnswerCollectionsPage
