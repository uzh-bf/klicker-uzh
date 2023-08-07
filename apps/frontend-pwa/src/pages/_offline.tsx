import { fallback } from '@klicker-uzh/shared-components/src/OfflineFallback'
import Layout from '../components/Layout'

export default fallback({ LayoutComponent: Layout })

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`@klicker-uzh/shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}
