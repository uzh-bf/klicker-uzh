import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Button, H2, H3, Prose } from '@uzh-bf/design-system'

import { USE_CASES } from '../constants'

function TitleImage() {
  return (
    <div className="bg-white">
      <div className="relative">
        <div className="mx-auto max-w-7xl">
          <div className="relative z-10 pt-14 lg:w-full lg:max-w-2xl">
            <svg
              className="absolute inset-y-0 right-8 hidden h-full w-80 translate-x-1/2 transform fill-white lg:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="0,0 90,0 50,100 0,100" />
            </svg>

            <div className="relative px-6 py-12 sm:py-40 md:py-32 lg:px-8 lg:py-56 lg:pr-0">
              <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl">
                <div className="hidden sm:mb-10 sm:flex">
                  <div className="text-md relative rounded-full px-3 py-1 leading-6 text-gray-500 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
                    KlickerUZH v3.1 has been released with brand new features{' '}
                    <a
                      href="https://community.klicker.uzh.ch/t/klickeruzh-v3-1-release-information/310"
                      className="whitespace-nowrap font-semibold"
                      target="_blank"
                      style={{ marginLeft: '0.75rem' }}
                    >
                      <span className="absolute inset-0" aria-hidden="true" />
                      What's new? <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </div>

                <img className="-ml-2 w-80" src="/img/KlickerLogo.png" />
                <p className="mt-6 text-2xl leading-8 text-gray-600">
                  Enhance your classroom experience.
                </p>
                <div className="mt-10 flex items-center gap-x-6">
                  <a href="https://manage.klicker.uzh.ch" target="_blank">
                    <Button
                      className={{
                        root: 'border-uzh-blue-40 w-full cursor-pointer text-xl md:w-max',
                      }}
                    >
                      Sign Up / Login
                    </Button>
                  </a>
                  <a
                    href="/getting_started/welcome"
                    className="font-semibold leading-6 text-gray-900"
                  >
                    Get started <span aria-hidden="true">→</span>
                  </a>
                </div>
                <div className="mt-4 rounded-md border border-solid border-slate-200 bg-slate-100 px-3 py-2 shadow">
                  We are now regularly offering introductory courses through UZH
                  Central IT. For more details see{' '}
                  <a
                    target="_blank"
                    href="https://community.klicker.uzh.ch/t/2024-01-10-2024-02-08-klickeruzh-v3-0-introduction-and-didactic-use-cases/257"
                  >
                    the following page
                  </a>
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden bg-gray-50 md:block lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <img
            className="aspect-[3/2] object-cover lg:aspect-auto lg:h-full lg:w-full"
            src="/img_v3/hero.jpg"
            alt=""
          />
        </div>
      </div>
    </div>
  )
}

function CTA() {
  return (
    <div className="space-y-4 py-16 text-center sm:py-24 md:space-y-8">
      <H2 className={{ root: 'text-3xl' }}>Be Part of the Journey</H2>
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        <a
          href="https://klicker-uzh.feedbear.com"
          rel="noreferrer noopener"
          target="_blank"
        >
          <Button
            className={{
              root: 'bg-uzh-blue-20 border-uzh-blue-100 cursor-pointer flex-col items-start p-4 text-left text-xl',
            }}
          >
            <div className="font-bold">Roadmap</div>
            <Prose>
              Are you interested in what's next? Check out our current Roadmap!
              We are also very happy about any feedbacks or bug reports. In
              urgent cases, you should contact us through our support channels.
            </Prose>
          </Button>
        </a>
        <a
          href="https://community.klicker.uzh.ch"
          rel="noreferrer noopener"
          target="_blank"
        >
          <Button
            className={{
              root: 'bg-uzh-blue-20 border-uzh-blue-100 cursor-pointer flex-col items-start p-4 text-left text-xl',
            }}
          >
            <div className="font-bold">Community</div>
            <Prose>
              We strive to develop our roadmap and goals based on the needs of
              our users. If you would like to be involved in future
              developments, we welcome you to join our KlickerUZH community.
            </Prose>
          </Button>
        </a>
      </div>
    </div>
  )
}

function FeatureFocusSection({ title, description, features, imgSrc }) {
  return (
    <div className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">{description}</p>
        </div>
      </div>
      <div className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <img
            src={imgSrc}
            alt="App screenshot"
            className="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-gray-900/10"
            // width={2432}
            // height={1442}
          />
          <div className="relative" aria-hidden="true">
            <div className="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-white pt-[7%]" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-20 md:mt-24 lg:px-8">
        <dl className="mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base leading-7 text-gray-600 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {features.map((feature) => (
            <div key={feature.title} className="relative pl-9">
              <dt className="inline font-semibold text-gray-900">
                <FontAwesomeIcon
                  aria-hidden="true"
                  icon={feature.icon}
                  className="text-uzh-red-100 absolute left-1 top-1 h-5 w-5"
                />
                {feature.title}
              </dt>{' '}
              <dd className="inline">{feature.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function FeatureSection({ title, description, features, imgSrc }) {
  return (
    <div className="overflow-hidden bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div className="lg:pr-8 lg:pt-4">
            <div className="lg:max-w-lg">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {title}
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                {description}
              </p>
              <dl className="mt-10 max-w-xl space-y-8 text-base leading-7 text-gray-600 lg:max-w-none">
                {features.map((feature) => (
                  <div key={feature.title} className="relative pl-9">
                    <dt className="inline font-semibold text-gray-900">
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={feature.icon}
                        className="text-uzh-red-100 absolute left-1 top-1 h-5 w-5"
                      />
                      {feature.title}
                    </dt>{' '}
                    <dd className="inline">{feature.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <img
            src={imgSrc}
            alt="Product screenshot"
            className="w-full max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 md:w-[48rem] lg:-ml-0"
            // width={2432}
            // height={1442}
          />
        </div>
      </div>
    </div>
  )
}

function UseCaseOverview() {
  return (
    <div className="space-y-4">
      <H2 className={{ root: 'text-2xl' }}>Use Cases</H2>
      <div className="grid grid-cols-1 gap-4 rounded md:grid-cols-3">
        {Object.entries(USE_CASES).map(([href, item]) => (
          <div
            key={item.title}
            className="flex flex-col justify-between gap-4 p-4 shadow"
          >
            <div className="flex-1">
              <H3>{item.title}</H3>
              <Prose className={{ root: 'prose-sm' }}>{item.abstract}</Prose>
            </div>
            <div className="flex-none">
              <a
                className="inline-flex items-center gap-2"
                href={`/use_cases/${href}`}
              >
                <FontAwesomeIcon icon={faArrowRight} />
                <div>More Details</div>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Home() {
  return (
    <Layout>
      <TitleImage />
      <FeatureSection
        title="Synchronous Interaction"
        description="Interact your students during class and drive engagement with
          your materials."
        imgSrc="/img_v3/sync_interaction.png"
        features={[
          {
            title: 'Live Quizzes',
            icon: faArrowRight,
            text: 'You can prepare Live Quizzes and launch them during class. Students can answer questions using their mobile devices or laptops. The results are displayed in real-time.',
          },
          {
            title: 'Live Q&A',
            icon: faArrowRight,
            text: 'You can enable Live Q&A as part of a Live Quiz and use it during class. Students can ask questions anonymously and upvote questions from other students.',
          },
        ]}
      />
      <FeatureSection
        title="Asynchronous Interaction"
        description="Foster engagement and interaction with your contents outside of class."
        imgSrc="/img_v3/microlearning.png"
        features={[
          {
            title: 'Microlearning',
            icon: faArrowRight,
            text: 'You can prepare short Microlearning units that students can work through at their own pace. The units are time-restricted and can be used to combat the forgetting curve.',
          },
          {
            title: 'Practice Quizzes',
            icon: faArrowRight,
            text: 'You can create Practice Quizzes that students can repeat as often as they want. Questions can be ordered by sequence or by the date of the last response, allowing for a simple way of spaced repetition.',
          },
          {
            title: 'Group Activities',
            icon: faArrowRight,
            text: 'You can create Group Activities to encourage collaboration on a task. Questions and clues that are distributed within each group and the group needs to communicate to find the solutions.',
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
