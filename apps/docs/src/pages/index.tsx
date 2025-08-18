import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import Layout from '@theme/Layout'

import { CTA } from '../components/landing/CTA'
import { FeatureFocusSection } from '../components/landing/FeatureFocusSection'
import FeatureSection from '../components/landing/FeatureSection'
import { SocialProof } from '../components/landing/SocialProof'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'

function Home() {
  return (
    <Layout>
      <TitleImage />
      <FeatureSection
        title="Core Teaching Tools"
        description="Essential real-time interaction features for engaging classroom experiences"
        features={[
          {
            title: 'Live Quizzes',
            icon: faArrowRight,
            text: 'Launch interactive quizzes during class with real-time results. Students participate using any device, with instant feedback and dynamic visualizations.',
            hoverImage: '/img/live_quiz/lq_student_view.png',
          },
          {
            title: 'Live Q&A & Feedback',
            icon: faArrowRight,
            text: 'Enable students to ask questions, upvote topics, and provide real-time feedback. Moderate discussions and respond instantly to maintain engagement.',
            hoverImage: '/img/landing/live_qa.png',
          },
          {
            title: 'Anonymous Participation',
            icon: faArrowRight,
            text: 'NEW: Allow students to participate anonymously in all activities, reducing anxiety and encouraging honest responses while maintaining engagement.',
            hoverImage: '/img/live_quiz/lq_student_view.png',
          },
        ]}
      />

      <SocialProof />

      <FeatureSection
        title="Flexible Learning Activities"
        description="Self-paced and collaborative learning beyond the classroom"
        features={[
          {
            title: 'Microlearning',
            icon: faArrowRight,
            text: 'Create bite-sized learning units with scheduled delivery. Combat the forgetting curve with time-restricted content that students complete at their own pace.',
            hoverImage: '/img/microlearning/ml_mobile_views.png',
          },
          {
            title: 'Practice Quizzes',
            icon: faArrowRight,
            text: 'Offer unlimited practice opportunities with intelligent question ordering. Use spaced repetition algorithms to optimize learning retention.',
            hoverImage: '/img/practice_quiz/pq_olat_view.png',
          },
          {
            title: 'Group Activities',
            icon: faArrowRight,
            text: 'Foster collaboration with team-based challenges. Built-in chat enables real-time communication while solving problems together.',
            hoverImage: '/img/group_activity/ga_graded_students.png',
          },
        ]}
      />

      <FeatureSection
        title="Enhanced Engagement"
        description="Gamification features that motivate and reward participation"
        features={[
          {
            title: 'Anonymous Gamified Quizzes',
            icon: faArrowRight,
            text: 'NEW: Combine gamification with anonymous participation. Students compete for points without revealing their identity, perfect for sensitive topics.',
            hoverImage: '/img/leaderboard/course_leaderboard.png',
            shadow: false,
          },
          {
            title: 'Points & Leaderboards',
            icon: faArrowRight,
            text: 'Track progress with individual and group rankings. Customizable point systems reward speed, accuracy, and participation.',
            hoverImage: '/img/leaderboard/course_leaderboard.png',
            shadow: false,
          },
          {
            title: 'Achievements & Rewards',
            icon: faArrowRight,
            text: 'Motivate students with badges, milestones, and level progression. Create custom achievements aligned with learning objectives.',
            hoverImage: '/img/group/group_student_view.png',
          },
        ]}
      />

      <FeatureSection
        title="Productivity Features"
        description="Save time with powerful management and automation tools"
        features={[
          {
            title: 'Batch Operations',
            icon: faArrowRight,
            text: 'NEW: Manage multiple activities efficiently with bulk actions. Edit, publish, or archive dozens of items in seconds.',
            hoverImage: '/img/elements/library.png',
          },
          {
            title: 'Review & Tracking System',
            icon: faArrowRight,
            text: 'NEW: Mark activities as reviewed and track completion status. Never lose sight of your teaching progress across courses.',
            hoverImage: '/img/elements/library.png',
          },
          {
            title: 'Calendar Integration',
            icon: faArrowRight,
            text: 'NEW: Visualize your semester at a glance with calendar views. Schedule activities and manage deadlines effortlessly.',
            hoverImage: '/img/elements/library.png',
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
