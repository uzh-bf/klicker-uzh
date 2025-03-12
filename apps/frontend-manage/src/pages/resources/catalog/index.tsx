import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import CatalogBrowser from '../../../components/catalog/CatalogBrowser'
import Layout from '../../../components/Layout'

function Catalog() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.general.catalog')}>
      <CatalogBrowser />
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

export default Catalog
