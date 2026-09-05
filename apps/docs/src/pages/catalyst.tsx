import {
  faArrowLeft,
  faCheck,
  faCrown,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Prose } from '@uzh-bf/design-system'

function Catalyst() {
  return (
    <Layout
      title="Catalyst"
      description="Learn about standard and Catalyst access for KlickerUZH."
    >
      <div className="px-8 py-24">
        <div className="flex max-w-7xl flex-col items-center text-center md:mx-auto lg:px-8">
          <h1 className="md:text-5xl! mt-2 flex w-max flex-row gap-4">
            <span>KlickerUZH</span>
            <span className="decoration-[#3353b7]">
              <u>Catalyst</u>
            </span>
          </h1>
          <Prose className={{ root: 'prose w-full max-w-3xl' }}>
            <p>
              The core components of KlickerUZH are free for everyone. Advanced
              functionality is restricted to users at UZH or sponsors
              ("catalysts") of the KlickerUZH open-source project.
            </p>
            <p>
              We offer advanced functionality free to individual lecturers for
              small educational use cases and for piloting KlickerUZH in an
              external organization. Broad use across a larger organization
              requires a sponsorship agreement.
            </p>
            <p>
              You can contribute by self-hosting, collaborating on the codebase,
              or sponsoring the project financially.
            </p>
            <p>
              To request access, sign in to KlickerUZH Manage and open the
              support dialog with the question-mark icon. Send us a direct
              Catalyst access request there.
            </p>
          </Prose>

          <div className="max-w-180 mx-auto mt-12 flow-root">
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
                    <div>Future Developments like AI/Analytics</div>
                  </li>
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Direct Support Channels (best-effort)</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Catalyst
