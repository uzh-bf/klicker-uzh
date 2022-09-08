import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { ThreeDots } from 'react-loader-spinner'

const Profile = () => {
  const { data, error, loading } = useQuery(SelfDocument)

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
      )}
      {data && <div className="p-4">{data?.self?.id}</div>}
    </Layout>
  )
}

export default Profile
