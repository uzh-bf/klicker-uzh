import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import AnswerCollections from '../components/resources/AnswerCollections'
import MediaLibrary from '../components/resources/MediaLibrary'

function ResourcesPage() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.general.resources')}>
      <div className="flex h-max flex-col gap-4 lg:flex-row">
        <div className="h-full w-full border-b border-solid border-gray-400 pb-4 lg:w-1/2 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
          <MediaLibrary />
        </div>
        <div className="w-full lg:w-1/2">
          <AnswerCollections />
        </div>
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

export default ResourcesPage
