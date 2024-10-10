import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import { FeatureFocusSection } from '../components/landing/FeatureFocusSection'
import FeatureSection from '../components/landing/FeatureSection'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'

function Home() {
  return (
    <Layout>
      <TitleImage />
      <FeatureSection
        title="Gamified Learning"
        description=""
        features={[
          {
            title: 'Progress Tracking',
            icon: faArrowRight,
            text: 'Students ',
            hoverImage: '/img_v3/06_live_quiz.png',
            shadow: true,
          },
          {
            title: 'Leaderboards',
            icon: faArrowRight,
            text: 'You can create Practice Quizzes that students can repeat as often as they want. Questions can be ordered by sequence or by the date of the last response, allowing for a simple way of spaced repetition.',
            hoverImage: '/img_v3/quiz_evaluation.png',
            shadow: true,
          },
          {
            title: 'Group Activities',
            icon: faArrowRight,
            text: 'You can create Group Activities to encourage collaboration on a task. Questions and clues that are distributed within each group and the group needs to communicate to find the solutions.',
            hoverImage:
              'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Filmaspectratios.svg/290px-Filmaspectratios.svg.png',
          },
        ]}
      />

      <FeatureSection
        title="Asynchronous Interaction"
        description="Foster engagement and interaction with your contents outside of class."
        features={[
          {
            title: 'Microlearning',
            icon: faArrowRight,
            text: 'You can prepare short Microlearning units that students can work through at their own pace. The units are time-restricted and can be used to combat the forgetting curve.',
            hoverImage: '/img_v3/06_live_quiz.png',
          },
          {
            title: 'Practice Quizzes',
            icon: faArrowRight,
            text: 'You can create Practice Quizzes that students can repeat as often as they want. Questions can be ordered by sequence or by the date of the last response, allowing for a simple way of spaced repetition.',
            hoverImage: '/img_v3/quiz_evaluation.png',
          },
          {
            title: 'Group Activities',
            icon: faArrowRight,
            text: 'You can create Group Activities to encourage collaboration on a task. Questions and clues that are distributed within each group and the group needs to communicate to find the solutions.',
            hoverImage: '',
          },
        ]}
      />
      <FeatureFocusSection
        title="Question Pool and Activity Management"
        description="Manage everything in one place."
        imgSrc="/img_v3/question_pool.png"
        features={[
          {
            title: 'Wide Array of Learning Activities',
            text: 'You can select from five distinct learning activities that suit specific educational objectives and adapt to various teaching methods during live lectures (synchronous learning) or outside of the traditional lecture frame (asynchronous learning). All activities are created from the central question pool.',
            icon: faArrowRight,
          },
          {
            title: 'Various Question Types',
            text: 'Question types like Single and Multiple Choice (SC/MC), Kprim (KP), Free Text (FT), and Numerical (NR) are supported and cover a wide range of use cases. Questions can be grouped and/or stacked for sequential presentation. Questions can be augmented with sample solutions and explanations, as well as choice-specific feedback.',
            icon: faArrowRight,
          },
          {
            title: 'Customization Options',
            text: 'You have the flexibility to customize quizzes, content, and challenges according to your specific course objectives, ensuring a tailored and targeted learning experience. Gamification can be optionally enabled on a live quiz and/or course-level.',
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

export default Home
