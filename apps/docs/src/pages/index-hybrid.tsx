import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import DeveloperShowcase from '../components/landing/DeveloperShowcase'
import FeatureSmartGrid from '../components/landing/FeatureSmartGrid'
import { SimplifiedOSSProof } from '../components/landing/SimplifiedOSSProof'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'

function HomeHybrid() {
  return (
    <Layout>
      <TitleImage />

      <SimplifiedOSSProof />

      <FeatureSmartGrid />

      <DeveloperShowcase />

      <div className="mx-auto max-w-7xl space-y-8 p-4">
        <UseCaseOverview />
        <CTA />
      </div>
    </Layout>
  )
}

export default HomeHybrid
