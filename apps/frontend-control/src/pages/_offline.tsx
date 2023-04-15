import { UserNotification } from '@uzh-bf/design-system'
import Layout from '../components/Layout'

const fallback = () => (
  <Layout title="KlickerUZH">
    <div className="flex items-center justify-center align-middle">
      <UserNotification
        type="info"
        message="Sie scheinen im Moment offline zu sein. Verbinden Sie Ihr Gerät mit dem Internet, um die KlickerUZH App nutzen zu können."
      ></UserNotification>
    </div>
  </Layout>
)

export default fallback
