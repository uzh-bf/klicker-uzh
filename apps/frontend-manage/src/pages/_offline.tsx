import { fallback } from '@klicker-uzh/shared-components/src/OfflineFallback'
import { GetStaticPropsContext } from 'next'
import Layout from '../components/Layout'

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (
        await import(
          `@klicker-uzh/shared-components/src/intl-messages/${locale}.json`
        )
      ).default,
    },
  }
}

export default fallback({ LayoutComponent: Layout })
