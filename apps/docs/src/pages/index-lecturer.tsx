import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import { EducatorTestimonials } from '../components/landing/EducatorTestimonials'
import { HowItWorks } from '../components/landing/HowItWorks'
import { LecturerFeatures } from '../components/landing/LecturerFeatures'
import { LecturerHero } from '../components/landing/LecturerHero'
import { MinimalOSSFooter } from '../components/landing/MinimalOSSFooter'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'

function LecturerFocusedHome() {
  return (
    <Layout
      title="KlickerUZH - Engage Every Student in Your Classroom"
      description="Interactive teaching platform that gets every student participating. Anonymous mode, instant feedback, and automatic grading. Used by 100+ universities."
    >
      <LecturerHero />
      <LecturerFeatures />
      <HowItWorks />
      <EducatorTestimonials />
      <UseCaseOverview />
      <CTA />
      <MinimalOSSFooter />
    </Layout>
  )
}

export default LecturerFocusedHome
