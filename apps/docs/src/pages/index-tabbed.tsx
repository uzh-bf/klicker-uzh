import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import { FeatureFocusSection } from '../components/landing/FeatureFocusSection'
import FeatureTabExplorer from '../components/landing/FeatureTabExplorer'
import { SimplifiedSocialProof } from '../components/landing/SimplifiedSocialProof'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'

function HomeTabbed() {
  return (
    <Layout>
      <TitleImage />
      
      <SimplifiedSocialProof />

      <FeatureTabExplorer />

      <FeatureFocusSection
        title="Question Pool and Activity Management"
        description="Manage everything in one place."
        imgSrc="/img/elements/library.png"
        features={[
          {
            title: 'Wide Array of Learning Activities',
            text: 'Select from five distinct learning activities that suit specific educational objectives and adapt to various teaching methods during live lectures or outside of the traditional lecture frame.',
            icon: faArrowRight,
          },
          {
            title: 'Various Element Types',
            text: 'Element types like Content Element (CT), Flashcard (FC), Single and Multiple Choice (SC/MC), Kprim (KP), Free Text (FT), and Numerical (NR) cover a wide range of use cases.',
            icon: faArrowRight,
          },
          {
            title: 'Customization Options',
            text: 'Customize quizzes, content, and challenges according to your specific course objectives. Gamification can be optionally enabled on a live quiz and/or course-level.',
            icon: faArrowRight,
          },
        ]}
      />

      <div className="mx-auto max-w-7xl space-y-8 p-4">
        <UseCaseOverview />
        <CTA />
      </div>
    </Layout>
  )
}

export default HomeTabbed