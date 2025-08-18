import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import FeatureBentoGrid from '../components/landing/FeatureBentoGrid'
import { SimplifiedSocialProof } from '../components/landing/SimplifiedSocialProof'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'

function HomeBento() {
  return (
    <Layout>
      <TitleImage />
      
      <SimplifiedSocialProof />

      <FeatureBentoGrid />

      <div className="mx-auto max-w-7xl space-y-8 p-4">
        <UseCaseOverview />
        <CTA />
      </div>
    </Layout>
  )
}

export default HomeBento