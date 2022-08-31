import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { H1 } from '@uzh-bf/design-system'
import { ThreeDots } from 'react-loader-spinner'
import Avatar, { genConfig } from 'react-nice-avatar'

const Profile = () => {
  const [pageInIframe, setPageInIframe] = useState(false)
  const { data, error, loading } = useQuery(SelfDocument)
  const config = genConfig({ sex: 'man', mouthStyle: 'laugh' })

  // detect if the page is currently shown as an iframe (i.e. in OLAT) -> hide the logout button in this case
  useEffect(() => {
    if (window.location !== window.parent.location) {
      setPageInIframe(true)
    } else {
      setPageInIframe(false)
    }
  }, [])

  return (
    <Layout>
      {loading && (
        <ThreeDots
          height="80"
          width="80"
          radius="9"
          color="#4fa94d"
          ariaLabel="three-dots-loading"
          visible={true}
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <div className="m-auto">
        <Avatar className="w-32 h-32" {...config} />
        <H1>Test</H1>
      </div>
    </div>
  )
}

Profile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Profile
