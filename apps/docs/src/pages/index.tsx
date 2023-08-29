import Layout from '@theme/Layout'
import Contributions from '../components/landing/Contributions'
import Features from '../components/landing/Features'
import SellingPoints from '../components/landing/SellingPoints'
import Separator from '../components/landing/Separator'
import TitleImage from '../components/landing/TitleImage'

function Home() {
  return (
    <Layout>
      <TitleImage />
      <div className="max-w-[1500px] mx-auto w-full">
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
