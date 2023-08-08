import { fallback } from '@klicker-uzh/shared-components/src/OfflineFallback'
import { GetStaticPropsContext } from 'next'
import Layout from '../components/Layout'

export default fallback({ LayoutComponent: Layout })

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}.json`))
        .default,
    },
  }
}
