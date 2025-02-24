import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import MediaLibrary from '../components/resources/MediaLibrary'

function MediaLibraryPage() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.resources.mediaLibrary')}>
      <MediaLibrary />
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

export default MediaLibraryPage
