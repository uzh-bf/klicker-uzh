import {
  faArrowLeft,
  faBolt,
  faCheck,
  faPiggyBank,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'

function Catalyst() {
  return (
    <Layout>
      <div className="py-24">
        <div className="md:mx-auto max-w-7xl lg:px-8">
          <div className="max-w-4xl mx-auto sm:text-center">
            <h1 className="mt-2 text-5xl">
              <u className="decoration-[#3353b7]">Free</u> for personal use
            </h1>
          </div>
          <div className="max-w-xl mx-auto mt-6 text-2xl leading-tight text-muted sm:text-center">
            <p className="my-3 sm:my-0">
              The core components of KlickerUZH stay free.
            </p>
            <p>
              If you represent a larger institution, consider endorsing
              KlickerUZH as a catalyst and unlock access to its cutting-edge
              features.
            </p>
          </div>
          <div className="mt-20 mx-auto max-w-[45rem] flow-root">
            <div className="grid grid-cols-1 gap-6 -mt-8 cards isolate sm:max-w-sm sm:mx-auto lg:-mx-8 lg:mt-0 md:max-w-none md:grid-cols-2 xl:-mx-4">
              <div className="p-6 rounded-lg sm:rounded-xl sm:p-8 bg-slate-100">
                <h3 className="text-xl font-semibold leading-7">
                  Restricted experience
                </h3>
                <p className="flex items-baseline mt-6 gap-x-1">
                  <span className="text-4xl font-semibold tracking-tight md:text-5xl">
                    <FontAwesomeIcon icon={faPiggyBank} /> Free
                  </span>
                </p>
                <p>Basic functionalities</p>
                <ul className="pl-0 mt-4 mb-2 space-y-2">
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Live Quizzes</div>
                  </li>
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Classroom Interaction</div>
                  </li>
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Latest Improvements and Fixes</div>
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-lg sm:rounded-xl sm:p-8 bg-slate-100">
                <h3 className="text-xl font-semibold leading-7">
                  Full experience
                </h3>
                <p className="flex items-baseline mt-6 gap-x-1">
                  <span className="text-4xl font-semibold tracking-tight md:text-5xl">
                    <FontAwesomeIcon icon={faBolt} /> Catalyst
                  </span>
                </p>
                <p>Additional functionalities</p>
                <ul className="pl-0 mt-4 mb-2 space-y-2">
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faArrowLeft} />
                    </div>
                    <div>Free functionalities</div>
                    <div>
                      <FontAwesomeIcon icon={faPlus} />
                    </div>
                  </li>
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
                    <div>Groups and Group Activities</div>
                  </li>
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Microlearning Sessions</div>
                  </li>
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Learning Elements</div>
                  </li>
                  <li className="flex gap-x-3">
                    <div>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>Courses and Challenge</div>
                  </li>
                  <li className="flex text-sm gap-x-3 opacity-70">
                    To get access and for other inquiries please fill out the
                    following
                    <a
                      href="https://forms.office.com/e/4AsWW1uck2"
                      target="_blank"
                    >
                      form
                    </a>
                    .
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
