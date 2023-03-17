import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'

function BookmarkedStack() {
  const t = useTranslations()
  const router = useRouter()

  return <Layout>TEST for {router.query.id}</Layout>
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default BookmarkedStack
