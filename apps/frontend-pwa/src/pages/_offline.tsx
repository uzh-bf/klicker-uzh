import { UserNotification } from '@uzh-bf/design-system'
import Layout from '../components/Layout'

const fallback = () => (
  <Layout>
    <div className="flex items-center justify-center align-middle">
      <UserNotification
        notificationType="info"
        message="Sie scheinen im Moment offline zu sein. Verbinden Sie Ihr Gerät mit dem Internet, um die KlickerUZH App nutzen zu können."
      ></UserNotification>
    </div>
  </Layout>
)

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default fallback
