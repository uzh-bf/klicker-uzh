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
        title={'Synchronous Interaction'}
        description={
          'Interact with your students during class and drive engagement with your lecture.'
        }
        features={[
          {
            title: 'Live Quizzes',
            icon: faArrowRight,
            text: 'You can prepare Live Quizzes and launch them during class. Students can answer questions using their mobile devices or laptops. The results are displayed in real-time.',
            hoverImage: '/img/live_quiz/lq_student_view.png',
          },
          {
            title: 'Live Q&A',
            icon: faArrowRight,
            text: 'You can launch a Live Q&A session during your lecture. Students can ask and upvote questions from other students and give real-time feedback. You can answer questions live in writing or orally.',
            hoverImage: '/img/landing/live_qa.png',
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
            hoverImage: '/img/microlearning/ml_mobile_views.png',
          },
          {
            title: 'Practice Quizzes',
            icon: faArrowRight,
            text: 'You can create Practice Quizzes that students can repeat as often as they want. Questions can be ordered by sequence or using a spaced repetition algorithm.',
            hoverImage: '/img/practice_quiz/pq_olat_view.png',
          },
          {
            title: 'Group Activities',
            icon: faArrowRight,
            text: 'Students form groups and engage in collaborative tasks, encouraging teamwork and collective problem-solving within a gamified context.',
            hoverImage: '/img/group_activity/ga_graded_students.png',
          },
        ]}
      />

      <FeatureSection
        title="Gamified Learning"
        description="Engage your students with gamified learning activities."
        features={[
          {
            title: 'Points and Leaderboards',
            icon: faArrowRight,
            text: 'Individual and group leaderboards display rankings, inspiring a sense of friendly competition and prompting students to stay engaged.',
            hoverImage: '/img/leaderboard/course_leaderboard.png',
            shadow: false,
          },
          {
            title: 'Group Formation',
            icon: faArrowRight,
            text: 'Students can form groups with their peers by choice or randomly and collaborate and compete against other groups.',
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
        description="Manage everything in one place."
        imgSrc="/img/elements/library.png"
        features={[
          {
            title: 'Wide Array of Learning Activities',
            text: 'You can select from five distinct learning activities that suit specific educational objectives and adapt to various teaching methods during live lectures (synchronous learning) or outside of the traditional lecture frame (asynchronous learning). All activities are created from the central question pool.',
            icon: faArrowRight,
          },
          {
            title: 'Various Element Types',
            text: 'Element types like Content Element (CT), Flashcard (FC), Single and Multiple Choice (SC/MC), Kprim (KP), Free Text (FT), and Numerical (NR) are supported and cover a wide range of use cases. Elements can be grouped and/or stacked for sequential presentation. Question types can be augmented with sample solutions and explanations, as well as choice-specific feedback.',
            icon: faArrowRight,
          },
          {
            title: 'Customization Options',
            text: 'You have the flexibility to customize quizzes, content, and challenges according to your specific course objectives, ensuring a tailored and targeted learning experience. Gamification can be optionally enabled on a live quiz and/or course-level.',
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
