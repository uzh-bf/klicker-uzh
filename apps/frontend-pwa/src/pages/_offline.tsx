import { fallback } from 'shared-components/src/OfflineFallback'
import Layout from '../components/Layout'

export default fallback({ LayoutComponent: Layout })

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}
