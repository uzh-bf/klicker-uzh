import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { ThreeDots } from 'react-loader-spinner'

const Profile: NextPageWithLayout = () => {
  const { data, error, loading } = useQuery(SelfDocument)

  if (loading) {
    return (
      <div className="grid items-center justify-center">
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

  return <div className="p-4">{data?.self?.id}</div>
}

Profile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Profile
