import { GetStaticPropsContext } from 'next'
import Layout from '~/components/Layout'

function Analytics() {
  return <Layout displayName="Analytics">Analytics</Layout>
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Analytics
