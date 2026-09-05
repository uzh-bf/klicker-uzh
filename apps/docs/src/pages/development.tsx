import Layout from '@theme/Layout'
import { H1 } from '@uzh-bf/design-system'
import RoadmapTile, {
  type RoadmapTileProps,
} from '../components/development/RoadmapTile'

interface RoadmapGroup {
  title: string
  description: string
  tiles: RoadmapTileProps[]
}

const roadmapGroups: RoadmapGroup[] = [
  {
    title: 'Available',
    description:
      'These capabilities are available on the public instance. Some features require Catalyst access or participation in the beta.',
    tiles: [
      {
        title: 'Live interaction',
        content:
          'Interact with participants during class and collect responses as the session runs.',
        useCases: [
          {
            content: 'Live Q&A',
            href: '/use_cases/live_qa',
            status: 'Available',
          },
          {
            content: 'Real-Time Feedback',
            href: '/use_cases/real_time_feedback',
            status: 'Available',
          },
          { content: 'Live Quizzes', status: 'Available' },
        ],
        tags: [{ text: 'Available', color: 'green' }],
      },
      {
        title: 'Asynchronous learning',
        content:
          'Support learning outside class with activities that students can work through at their own pace.',
        useCases: [
          {
            content: 'Practice Quizzes and Microlearning',
            status: 'Available',
          },
        ],
        tags: [{ text: 'Available', color: 'green' }],
      },
      {
        title: 'Groups and gamification',
        content:
          'Use group activities, points, and leaderboards to support participation and engagement.',
        useCases: [
          { content: 'Group Activities', status: 'Available' },
          { content: 'Points and Leaderboards', status: 'Available' },
          {
            content: 'Randomized Group Formation',
            href: 'https://www.gbl.uzh.ch/quartz/index',
            status: 'Available',
          },
        ],
        tags: [{ text: 'Available', color: 'green' }],
      },
      {
        title: 'Question pool and activity management',
        content:
          'Create and manage questions and activities from a central question pool.',
        useCases: [
          {
            content: 'Question Pool and Activity Management',
            status: 'Available',
          },
        ],
        tags: [{ text: 'Available', color: 'green' }],
      },
    ],
  },
  {
    title: 'Upcoming v3.4 preview',
    description:
      'We are preparing this work for the upcoming v3.4 preview. Some features require Catalyst access or participation in the beta. Access also depends on entitlement and publication approval.',
    tiles: [
      {
        title: 'Course chatbots',
        content:
          'We are preparing tools for lecturers to author course chatbots. Publishing a chatbot for students remains subject to approval.',
        useCases: [
          {
            content: 'Lecturer Chatbot Authoring',
            status: 'Upcoming preview',
          },
          { content: 'Beta Enrollment', status: 'Upcoming preview' },
        ],
        tags: [{ text: 'Upcoming preview', color: 'orange' }],
      },
    ],
  },
  {
    title: 'Planned',
    description: 'Planned work may change; no release dates are confirmed.',
    tiles: [
      {
        title: 'Open interaction ideas',
        content: 'New interaction formats remain under consideration.',
        useCases: [
          {
            content: 'Collaborative Question Creation',
            status: 'Under consideration',
          },
          { content: 'Poll-Based Experiments', status: 'Under consideration' },
        ],
        tags: [{ text: 'Planned', color: 'gray' }],
      },
      {
        title: 'Further group activities',
        content:
          'Additional group activity formats remain under consideration.',
        useCases: [
          {
            content: 'Synchronous Group Activities',
            status: 'Under consideration',
          },
        ],
        tags: [{ text: 'Planned', color: 'gray' }],
      },
      {
        title: 'Learning analytics',
        content:
          'Planned work includes analytics that help lecturers and students reflect on learning.',
        useCases: [
          {
            content: 'Learning Analytics for Lecturers',
            status: 'Planned',
          },
          { content: 'Learning Analytics for Students', status: 'Planned' },
        ],
        tags: [{ text: 'Planned', color: 'gray' }],
      },
      {
        title: 'AI support',
        content:
          'Planned work includes AI support for question drafting and formative feedback on open-ended answers.',
        useCases: [
          { content: 'AI Question Generation', status: 'Planned' },
          { content: 'AI Formative Feedback', status: 'Planned' },
        ],
        tags: [{ text: 'Planned', color: 'gray' }],
      },
    ],
  },
]

const Development = () => {
  return (
    <Layout>
      <div className="m-auto max-w-[1300px] p-8">
        <div className="mb-4 flex h-12 flex-row items-end justify-between">
          <H1>KlickerUZH roadmap</H1>
          <div className="hidden h-full flex-row gap-4 md:flex">
            <img
              src="/img/logos/logo_swissuniversities.png"
              className="mr-8 h-full"
              alt="swissuniversities logo"
            />
            <img
              src="/img/logos/logo_uzh.jpeg"
              className="h-full"
              alt="University of Zurich logo"
            />
          </div>
        </div>

        <p className="mb-2 text-sm text-gray-600">Reviewed 5 September 2026.</p>

        <div className="mb-12">
          <p>
            The work that shaped KlickerUZH was backed by swissuniversities and
            the Teaching Center at the Department of Finance at the University
            of Zurich.
          </p>
          <p className="mt-4">
            This roadmap groups the capabilities available today, the upcoming
            v3.4 preview, and planned work. You can help shape KlickerUZH by
            joining our{' '}
            <a
              href="https://community.klicker.uzh.ch/"
              target="_blank"
              rel="noreferrer noopener"
            >
              community
            </a>
            .
          </p>
          <div className="mt-4 block md:hidden">
            <img
              src="/img/logos/logo_swissuniversities.png"
              className="mr-2 h-12"
              alt="swissuniversities logo"
            />
            <img
              src="/img/logos/logo_uzh.jpeg"
              className="h-12"
              alt="University of Zurich logo"
            />
          </div>
        </div>

        {roadmapGroups.map((group) => (
          <section key={group.title} className="mb-16">
            <h2 className="mb-4 text-3xl font-bold">{group.title}</h2>
            <p className="mb-8">{group.description}</p>
            <div className="grid w-full grid-cols-1 justify-between gap-4 md:grid-cols-2 lg:gap-4 xl:grid-cols-4">
              {group.tiles.map((tile) => (
                <RoadmapTile
                  key={tile.title}
                  {...tile}
                  className={
                    group.tiles.length === 1 ? 'md:col-span-2' : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}

        <section aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="mb-4 text-3xl font-bold">
            Share feedback
          </h2>
          <p>
            Have an idea, a positive experience, or a problem to report? Share
            it on our{' '}
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
          <p className="mt-4">
            This channel is for product feedback about KlickerUZH. It is
            separate from real-time feedback in the classroom and from AI
            formative feedback on answers.
          </p>
        </section>
      </div>
    </Layout>
  )
}

export default Development
