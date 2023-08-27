import Layout from '@theme/Layout'
import Contributions from '../components/landing/Contributions'
import Features from '../components/landing/Features'
import SellingPoints from '../components/landing/SellingPoints'
import Separator from '../components/landing/Separator'
import TitleImage from '../components/landing/TitleImage'

function Home() {
  return (
    <Layout>
      <div className="px-8 md:px-16 mb-10">
        <TitleImage />
        <SellingPoints />
        <Separator />
        <Features />
        <Separator />
        <Contributions />
      </div>
    </Layout>
  )
}

export default Home
