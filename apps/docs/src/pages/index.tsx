import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import { FeatureFocusSection } from '../components/landing/FeatureFocusSection'
import FeatureSection from '../components/landing/FeatureSection'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'

function Home() {
  return (
    <Layout description="Engage students in class and support independent practice with live quizzes, Q&A, microlearning and group activities.">
      <TitleImage />
      <FeatureSection
        title={'Interaction During Class'}
        description={
          'Ask questions, discuss responses and hear what your students need.'
        }
        features={[
          {
            title: 'Live Quizzes',
            icon: faArrowRight,
            text: 'Prepare questions before class and launch a Live Quiz when you need it. Students answer on their phones or laptops, and you can discuss the results together.',
            hoverImage: '/img/live_quiz/lq_student_view.png',
          },
          {
            title: 'Live Q&A',
            icon: faArrowRight,
            text: 'Let students ask and upvote questions during a Live Quiz. Answer in writing or discuss them in class. Enable Live Feedback separately to hear how students find the pace and difficulty.',
            hoverImage: '/img/landing/live_qa.png',
          },
        ]}
      />

      <FeatureSection
        title="Learning Between Classes"
        description="Give students opportunities to practise, revisit material and work together."
        features={[
          {
            title: 'Microlearning',
            icon: faArrowRight,
            text: 'Set short Microlearning units with a completion window. Students work through them at their own pace and revisit material between classes.',
            hoverImage: '/img/microlearning/ml_mobile_views.png',
          },
          {
            title: 'Practice Quizzes',
            icon: faArrowRight,
            text: 'Create Practice Quizzes that students can repeat as often as they need. Offer questions in sequence or use spaced repetition to guide revision.',
            hoverImage: '/img/practice_quiz/pq_olat_view.png',
          },
          {
            title: 'Group Activities',
            icon: faArrowRight,
            text: 'Set tasks that students solve together in groups, with points and feedback to support their progress.',
            hoverImage: '/img/group_activity/ga_graded_students.png',
          },
        ]}
      />

      <FeatureSection
        title="Gamified Learning"
        description="Use points, progress and group activities to encourage participation."
        features={[
          {
            title: 'Points and Leaderboards',
            icon: faArrowRight,
            text: 'Show individual and group rankings on course leaderboards to add friendly competition to learning activities.',
            hoverImage: '/img/leaderboard/course_leaderboard.png',
            shadow: false,
          },
          {
            title: 'Group Formation',
            icon: faArrowRight,
            text: 'Let students choose a group or assign groups randomly. Groups can collaborate on tasks and compete with one another.',
            hoverImage: '/img/group/group_student_view.png',
          },
        ]}
      />

      {/* <FeatureFocusSection
        title={'Coming Soon'}
        description={
          'Enhancing Learning Through Insightful Tracking for Lecturers and Personalized Progress Overviews for Students'
        }
        features={[
          {
            title: 'Learning Analytics',
            icon: faArrowRight,
            text: 'Track student activity, behavior, performance, and quiz results via aggregated, anonymized analytics.',
            hoverImage:
              '/img_v3/landing_page/feature/learning_analytics_lecturer.png',
          },
          {
            title: 'Integrated AI',
            icon: faArrowRight,
            text:
              'View insights into personal learning behavior and track completed course elements.\n' +
              'Access an overview of strengths and weaknesses within predefined competency frameworks (if provided by lecturers).',
            hoverImage:
              '/img_v3/landing_page/feature/learning_analytics_students.png',
          },
        ]}
      /> */}

      <FeatureFocusSection
        title="Question Pool and Activity Management"
        description="Build learning activities from a shared question pool."
        imgSrc="/img/elements/library.png"
        features={[
          {
            title: 'Activities for Different Teaching Goals',
            text: 'Reuse questions across activities for class and independent study. Choose the format that fits your teaching goal and create each activity from the central question pool.',
            icon: faArrowRight,
          },
          {
            title: 'Various Element Types',
            text: 'Combine content elements, flashcards and questions: single or multiple choice, Kprim, free text and numerical answers. Group elements for sequential presentation and add sample solutions, explanations or answer-specific feedback.',
            icon: faArrowRight,
          },
          {
            title: 'Customization Options',
            text: 'Adapt quizzes, content and challenges to your course objectives. Enable gamification for a Live Quiz or course when it supports your teaching.',
            icon: faArrowRight,
          },
        ]}
      />
      {/* <Team
        teamMembers={[
          {
            imgSrc:
              'https://www.df.uzh.ch/contacts/df/student-assistants/jschlapbach/photo/20220504_Schlapbach-Julius-019.jpg.jpg',
            name: 'Julius Schlapbach',
            position: '123',
          },
          {
            imgSrc:
              'https://www.df.uzh.ch/contacts/df/admin/teaching-center/rschl%C3%A4fli/photo/Schl%C3%A4fli-Roland.jpg.jpg',
            name: 'Roland Schläfli',
            position: '123',
          },
        ]}
      /> */}
      <div className="mx-auto max-w-7xl space-y-8 p-4">
        <UseCaseOverview />
        <CTA />
      </div>
    </Layout>
  )
}

export default Home
