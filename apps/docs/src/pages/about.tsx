import {
  faArrowLeft,
  faCheck,
  faCrown,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import TextTransition, { presets } from 'react-text-transition'

const people = [
  {
    name: 'Roland Schläfli',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/teaching-center/rschl%C3%A4fli/photo/Schl%C3%A4fli-Roland.jpg.jpg',
    githubUrl: 'https://github.com/rschlaefli',
  },
  {
    name: 'Julius Schlapbach',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/student-assistants/jschlapbach/photo/20220504_Schlapbach-Julius-019.jpg.jpg',
    githubUrl: 'https://github.com/sjschlapbach',
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
    </h1>
    <p className="text-left">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
    </p>
  </>
)

function Team() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-20 px-6 lg:px-8 xl:grid-cols-3">
        <div className="max-w-xl">
          <h2 className="text-pretty text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Team
          </h2>
          <p className="mt-6 text-lg/8 text-gray-600">
            We're a dynamic group of individuals who are passionate about what
            we do and dedicated to delivering the best results for our clients.
          </p>
        </div>
        <ul
          role="list"
          className="grid list-none gap-x-8 gap-y-12 sm:grid-cols-2 sm:gap-y-16 xl:col-span-2"
        >
          {people.map((person) => (
            <li key={person.name}>
              <div className="flex items-center gap-x-6">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full">
                  <img
                    alt=""
                    src={person.imageUrl}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-base/7 font-semibold tracking-tight text-gray-900">
                    {person.name}
                  </h3>
                  <div className="flex items-center gap-x-2">
                    <a
                      href={person.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function About() {
  return (
    <Layout>
      <div className="flex max-w-7xl flex-col items-center text-center md:mx-auto lg:px-8">
        <div className="px-8 py-24">
          {Purpose}
          {Team()}
          <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
            <div>KlickerUZH</div>
            <div className="flex justify-center">
              <TextTransition springConfig={presets.wobbly}>
                <u className="decoration-[#3353b7]">Models</u>
              </TextTransition>
            </div>
          </h1>
          {KPIs()}
        </div>
      </div>
    </Layout>
  )
}

export default About
