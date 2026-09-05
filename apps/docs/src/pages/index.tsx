import Layout from '@theme/Layout'
import FeatureSection from '../components/landing/FeatureSection'
import { LandingFooter } from '../components/landing/LandingFooter'
import { ReleaseUpdates } from '../components/landing/ReleaseUpdates'
import { TitleImage } from '../components/landing/TitleImage'

function Home() {
  return (
    <Layout description="Live participation and independent practice for your course. Explore Live Quizzes, Practice Quizzes, reusable teaching content and the v3.4 preview.">
      <TitleImage />
      <FeatureSection />
      <ReleaseUpdates />
      <LandingFooter />
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
    </Layout>
  )
}

export default Home
