import Layout from '@theme/Layout'
import { H1 } from '@uzh-bf/design-system'
import RoadmapTile from '../components/development/RoadmapTile'

const tileContent = [
  {
    title: 'Interaction',
    content:
      'New interaction modalities for virtual and physical classrooms improve interaction between lecturers and participants.',
    useCases: [
      {
        content: 'Live Q&A',
        href: '/use_cases/live_qa',
        status: 'Released in v2.0 (HS21)',
      },
      {
        content: 'Real-Time Feedback',
        href: '/use_cases/real_time_feedback',
        status: 'Released in v2.0 (HS21)',
      },
      {
        content: 'Practice Quizzes and Microlearning',
        href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
        status: 'Released in v3.0 (HS23)',
      },
      {
        content: 'Collaborative Question Creation',
        status: 'Under Consideration',
      },
      { content: 'Poll-Based Experiments', status: 'Under Consideration' },
    ],
    tags: [{ text: 'Working On', color: 'orange' }],
  },
  {
    title: 'Gamification and Engagement',
    content:
      'The incorporation of gamified interactions allows lecturers to increase engagement in their (virtual) classrooms.',
    useCases: [
      {
        content: 'Gamified Live Quizzes',
        href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
        status: 'Released in v3.0 (HS23)',
      },
      {
        content: 'Gamified Courses and Challenges',
        href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
        status: 'Released in v3.0 (HS23)',
      },
      {
        content: 'Groups and Group Activities',
        href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-1-release-information/310/2',
        status: 'Released in v3.0/v3.1 (HS23/FS24)',
      },
      {
        content: 'Randomized Group Formation',
        href: 'https://www.gbl.uzh.ch/quartz/index',
        status: 'Released in v3.2 (HS24)',
      },
      {
        content: 'Synchronous Group Activities',
        status: 'Under Consideration',
      },
    ],
    tags: [{ text: 'Working On', color: 'orange' }],
  },
  {
    title: 'Learning Analytics',
    content:
      'Analysis functionalities allow lecturers to evaluate their quizzes and questions in terms of different quality dimensions, as well as students to reflect on their learning progress.',
    useCases: [
      {
        content: 'Learning Analytics for Lecturers',
        status: 'Work in Progress',
      },
      {
        content: 'Learning Analytics for Students',
        status: 'Work in Progress',
      },
    ],
    tags: [{ text: 'Working On', color: 'orange' }],
  },
  {
    title: 'Integration with AI',
    content:
      'AI integrations will enable lecturers to draft contents faster. Students will be able to interact with AI-based chatbots as well as to get instant feedback on their answers in open-ended questions.',
    useCases: [
      {
        content: 'Content Generation',
        status: 'Work in Progress',
      },
      {
        content: 'Formative Feedback',
        status: 'Work in Progress',
      },
      {
        content: 'Course Chatbots',
        status: 'Work in Progress',
      },
    ],
    tags: [{ text: 'Working On', color: 'orange' }],
  },
]

const Development = () => {
  return (
    <Layout>
      <div className="m-auto max-w-[1300px] p-8">
        <div className="mb-4 flex h-12 flex-row items-end justify-between">
          <H1>Get Involved - P-8 "Digital Skills"</H1>
          <div className="hidden h-full flex-row gap-4 md:flex">
            <img
              src="/img/logos/logo_swissuniversities.png"
              className="mr-8 h-full"
            />
            <img src="/img/logos/logo_uzh.jpeg" className="h-full" />
          </div>
        </div>

        <div className="mb-8">
          As part of a project backed by swissuniversities and the Teaching
          Center at the Dept. of Finance (UZH), the KlickerUZH team will be
          working on several interesting focus areas over the coming years. We
          will be developing best practices and materials, as well as extending
          KlickerUZH with capabilities that support each of these areas. <br />
          This page and our official documentation will be continuously extended
          with helpful resources. You can help shape KlickerUZH by joining our{' '}
          <a href="https://community.klicker.uzh.ch/" target="_blank">
            community
          </a>
          .
          <div className="mt-4 block md:hidden">
            <img
              src="/img/logos/logo_swissuniversities.png"
              className="mr-2 h-12"
            />
            <img src="/img/logos/logo_uzh.jpeg" className="h-12" />
          </div>
        </div>
        <div className="mb-16 grid w-full grid-cols-1 justify-between gap-4 md:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          {tileContent.map((tile: any) => (
            <RoadmapTile
              title={tile.title}
              content={tile.content}
              useCases={tile.useCases}
              tags={tile.tags}
            />
          ))}
        </div>

        <div>
          <div className="mb-4 text-3xl font-bold">Feedback</div>
          <p>
            We welcome ideas, positive experiences, and problems. Share your
            feedback on our{' '}
            <a
              href="https://klicker-uzh.feedback.df-app.ch/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary-600 underline"
            >
              public feedback platform
            </a>
            . Please do not include personal or course data.
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default Development
