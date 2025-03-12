import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import CatalogBrowser from '../../../components/catalog/CatalogBrowser'
import Layout from '../../../components/Layout'

function Catalog({ catalogId }: { catalogId: string }) {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.general.catalog')}>
      <CatalogBrowser catalogCollectionId={catalogId} />
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
      catalogId: params?.id,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default Catalog
