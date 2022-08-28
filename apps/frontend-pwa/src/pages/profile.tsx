import Layout from "../components/Layout"
import { NextPageWithLayout } from "./_app"

const Profile: NextPageWithLayout = () =>  {
  return <div className="p-4">profile...</div>
}

Profile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Profile
