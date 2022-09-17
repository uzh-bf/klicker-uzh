import Layout from '@components/Layout'
import UserNotification from '@components/UserNotification'

const fallback = () => (
  <Layout>
    <div className='flex items-center justify-center align-middle'>
    <UserNotification notificationType='info' message="Sie scheinen im Moment offline zu sein. Verbinden Sie Ihr Gerät mit dem Internet, um die Klicker App nutzen zu können."></UserNotification>
    </div>
  </Layout>
)

export default fallback
