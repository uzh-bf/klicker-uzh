import Layout from '@theme/Layout'
import RoadmapTile from '../components/development/RoadmapTile'

const Development = () => {
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
          content: 'Practice Quizzes & Microlearning',
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
          content: 'Gamified Courses, Challenges and Awards',
          href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
          status: 'Released in v3.0 (HS23)',
        },
        {
          content: 'Groups and Group Activities',
          href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
          status: 'Released in v3.0 (HS23)',
        },
        {
          content: 'Synchronous Group Activities',
          status: 'Under Consideration',
        },
      ],
      tags: [{ text: 'Working On', color: 'orange' }],
    },
    {
      title: 'In-Depth Analysis',
      content:
        'Analysis functionalities allow lecturers to evaluate their sessions and questions in terms of different quality dimensions, as well as students to reflect on their learning progress.',
      tags: [
        { text: 'Planned', color: 'gray' },
        { text: 'Fall 23 - Spring 24', color: 'lightgray' },
      ],
    },
  ]

  return (
    <Layout>
      <div className="m-auto max-w-6xl p-8">
        <div className="mb-4 flex h-12 flex-row items-start justify-between">
          <div className="mb-8 text-3xl font-bold md:mb-0">
            Get Involved - P-8 "Digital Skills"
          </div>
          <div className="hidden h-full md:block">
            <img
              src="/img/logo_swissuniversities.png"
              className="mr-8 h-full"
            />
            <img src="/img/logo_uzh.jpeg" className="h-full" />
          </div>
        </div>

        <div className="mb-8">
          As part of a project backed by swissuniversities and the Teaching
          Center at the Dept. of Finance (UZH), the KlickerUZH team will be
          working on several interesting focus areas over the coming years. We
          will be developing best practices and materials, as well as extending
          the KlickerUZH with capabilities that support each of these areas.{' '}
          <br />
          This page and our official documentation will be continuously extended
          with helpful resources. You can help shape the KlickerUZH by joining
          our{' '}
          <a href="https://community.klicker.uzh.ch/" target="_blank">
            community
          </a>
          .
          <div className="mt-4 block md:hidden">
            <img src="/img/logo_swissuniversities.png" className="mr-2 h-12" />
            <img src="/img/logo_uzh.jpeg" className="h-12" />
          </div>
        </div>
        <div className="mb-16 grid w-full grid-cols-1 justify-between gap-4 md:grid-cols-3 lg:gap-4">
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
          <div className="mb-4 text-3xl font-bold">Public Roadmap</div>
          <iframe
            className="overflow-hidden rounded border border-solid border-gray-300"
            src="https://klicker-uzh.feedbear.com/roadmap?embed=true"
            width="100%"
            height="900px"
          ></iframe>
        </div>
      </div>
    </Layout>
  )
}

export default Development
