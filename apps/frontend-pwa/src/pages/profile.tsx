import { useQuery } from "@apollo/client"
import { SelfDocument } from "@klicker-uzh/graphql/dist/ops"
import Layout from "../components/Layout"
import { NextPageWithLayout } from "./_app"

const Profile: NextPageWithLayout = () =>  {
  const { data, error, loading } = useQuery(SelfDocument)

  return <div className="p-4">{data?.self?.id}</div>
}

Profile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Profile
