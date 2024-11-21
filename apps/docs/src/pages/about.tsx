import {
  faArrowLeft,
  faCheck,
  faCrown,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Prose } from '@uzh-bf/design-system'
import TextTransition, { presets } from 'react-text-transition'

const people = [
  {
    name: 'Leslie Alexander',
    role: 'Co-Founder / CEO',
    imageUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
  // More people...
]

const KPIs = () => {
  const metrics = [
    {
      value: '1894',
      label: 'Lecturers',
      description: 'use KlickerUZH',
    },
    {
      value: '26134',
      label: 'Elements',
      description: 'have been created',
    },
    {
      value: '7203',
      label: 'Live Quizzes',
      description: 'were conducted',
    },
  ]

  return (
    <>
      <h1 className="mt-2 flex w-max flex-row gap-4 text-xl md:text-3xl">
        KlickerUZH in numbers
      </h1>
      <div className="mx-auto mt-12 max-w-[45rem] gap-8 sm:grid sm:grid-cols-3">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-uzh-blue-80 flex flex-col items-center justify-center rounded-lg p-6 text-center text-white"
          >
            <div className="text-3xl font-bold">{metric.value}</div>
            <div className="mt-2 text-xl font-semibold">{metric.label}</div>
            <div className="mt-1 text-sm">{metric.description}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function Models() {
  return (
    <div className="mx-auto mt-12 flow-root max-w-[45rem]">
      <div className="cards isolate -mt-8 grid grid-cols-1 gap-6 sm:mx-auto sm:max-w-sm md:max-w-none md:grid-cols-2 lg:-mx-8 lg:mt-0 xl:-mx-4">
        <div className="space-y-4 rounded-lg bg-slate-100 p-6 sm:rounded-xl sm:p-8">
          <div className="text-4xl font-semibold tracking-tight md:text-5xl">
            Standard
          </div>
          <ul className="mb-2 mt-8 space-y-2 pl-0">
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Gamified Live Quizzes</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Live Q&A and Real-Time Feedback</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Courses and Leaderboards</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Participant Accounts and Groups</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Community Support (best-effort)</div>
            </li>
          </ul>
        </div>

        <div className="space-y-4 rounded-lg bg-slate-100 p-6 sm:rounded-xl sm:p-8">
          <div className="text-4xl font-semibold tracking-tight md:text-5xl">
            <FontAwesomeIcon icon={faCrown} /> Catalyst
          </div>
          <ul className="mb-2 mt-8 space-y-2 pl-0">
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faArrowLeft} />
              </div>
              <div>Standard Functionalities</div>
              <div>
                <FontAwesomeIcon icon={faPlus} />
              </div>
            </li>

            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Microlearning</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Practice Quizzes</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Group Activities</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Future Developments like AI/Analytics</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Direct Support Channels (best-effort)</div>
            </li>
          </ul>

          <div>
            To get access and for other inquiries please fill out the following{' '}
            <a href="https://forms.office.com/e/4AsWW1uck2" target="_blank">
              form
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

const Purpose = (
  <>
    <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
      <div> Purpose of KlickerUZH</div>
      <div className="flex justify-center"></div>
    </h1>
    <p className="text-center">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
    </p>
  </>
)

function Catalyst() {
  return (
    <Layout>
      <div className="flex max-w-7xl flex-col items-center text-center md:mx-auto lg:px-8">
        <div className="px-8 py-24">
          {Purpose}
          <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
            <div>Team</div>
            <div className="flex justify-center"></div>
          </h1>
          <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
            <div>KlickerUZH</div>
            <div className="flex justify-center">
              <TextTransition springConfig={presets.wobbly}>
                <u className="decoration-[#3353b7]">Models</u>
              </TextTransition>
            </div>
          </h1>
          {Models()}
          <Prose className={{ root: 'prose-xl w-full max-w-3xl' }}>
            <p>
              The core components of our KlickerUZH instance are free to use for
              everyone. Advanced functionalities are restricted to users at UZH
              or sponsors ("catalysts") of the KlickerUZH open-source project.
            </p>
            <p>
              We offer the advanced functionalities for free to individual
              lecturers in small educational use cases or for piloting
              KlickerUZH in an external organization. For broad use across a
              larger organization, a sponsorship agreement is required.
            </p>
            <p>
              You can contribute to the project in various ways, e.g., by
              self-hosting and collaborating on the code base, or by sponsoring
              the project financially.
            </p>
            <p>
              To get access and for other inquiries please fill out the
              following{' '}
              <a href="https://forms.office.com/e/4AsWW1uck2" target="_blank">
                form
              </a>
              .
            </p>
          </Prose>
          {KPIs()}
        </div>

        <div className="bg-white py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-20 px-6 lg:px-8 xl:grid-cols-3">
            <div className="max-w-xl">
              <h2 className="text-pretty text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Meet our leadership
              </h2>
              <p className="mt-6 text-lg/8 text-gray-600">
                We’re a dynamic group of individuals who are passionate about
                what we do and dedicated to delivering the best results for our
                clients.
              </p>
            </div>
            <ul
              role="list"
              className="grid list-none gap-x-8 gap-y-12 sm:grid-cols-2 sm:gap-y-16 xl:col-span-2"
            >
              {people.map((person) => (
                <li key={person.name}>
                  <div className="flex items-center gap-x-6">
                    <img
                      alt=""
                      src={person.imageUrl}
                      className="size-16 rounded-full"
                    />
                    <div>
                      <h3 className="text-base/7 font-semibold tracking-tight text-gray-900">
                        {person.name}
                      </h3>
                      <p className="text-sm/6 font-semibold text-indigo-600">
                        {person.role}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Catalyst
