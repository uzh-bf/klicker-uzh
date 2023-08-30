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
      <div className="py-24 px-8">
        <div className="md:mx-auto max-w-7xl lg:px-8 text-center items-center flex flex-col">
          <h1 className="mt-2 md:text-5xl flex flex-row gap-4 w-max">
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
              everyone. Advanced functionalities are restricted to sponsors
              ("catalysts") of the KlickerUZH open-source project.
            </p>
            <p>
              You can contribute to the project in various ways, e.g., by
              self-hosting and collaborating on the code base, or by sponsoring
              the project financially.
            </p>
            <p>
              We offer the advanced functionalities for free to individual
              lecturers in small educational use cases or for piloting
              KlickerUZH in an organization. For broad use across a larger
              organization, a sponsorship agreement is required.
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

          <div className="mt-12 mx-auto max-w-[45rem] flow-root">
            <div className="grid grid-cols-1 gap-6 -mt-8 cards isolate sm:max-w-sm sm:mx-auto lg:-mx-8 lg:mt-0 md:max-w-none md:grid-cols-2 xl:-mx-4">
              <div className="p-6 rounded-lg sm:rounded-xl sm:p-8 bg-slate-100 space-y-4">
                <div className="text-4xl font-semibold tracking-tight md:text-5xl">
                  Standard
                </div>
                <ul className="pl-0 mt-8 mb-2 space-y-2">
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

              <div className="p-6 rounded-lg sm:rounded-xl sm:p-8 bg-slate-100 space-y-4">
                <div className="text-4xl font-semibold tracking-tight md:text-5xl">
                  <FontAwesomeIcon icon={faCrown} /> Catalyst
                </div>
                <ul className="pl-0 mt-8 mb-2 space-y-2">
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
