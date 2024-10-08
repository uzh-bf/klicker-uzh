import {
  faArrowLeft,
  faCheck,
  faCrown,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Prose } from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'
import TextTransition, { presets } from 'react-text-transition'

const TEXTS = ['Standard', 'Catalyst']

function Catalyst() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const intervalId = setInterval(
      () => setIndex((index) => index + 1),
      3000 // every 3 seconds
    )
    return () => clearTimeout(intervalId)
  }, [])

  return (
    <Layout>
      <div className="px-8 py-24">
        <div className="flex max-w-7xl flex-col items-center text-center md:mx-auto lg:px-8">
          <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
            <div>KlickerUZH</div>
            <div className="flex justify-center">
              <TextTransition springConfig={presets.wobbly}>
                <u className="decoration-[#3353b7]">
                  {TEXTS[index % TEXTS.length]}
                </u>
              </TextTransition>
            </div>
          </h1>
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
                  To get access and for other inquiries please fill out the
                  following{' '}
                  <a
                    href="https://forms.office.com/e/4AsWW1uck2"
                    target="_blank"
                  >
                    form
                  </a>
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Catalyst
