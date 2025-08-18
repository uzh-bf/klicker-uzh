import Link from '@docusaurus/Link'
import {
  faArrowRight,
  faCheckCircle,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export function LecturerHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              New: Anonymous Participation Mode
            </div>

            <h1 className="mb-6 text-5xl font-bold leading-tight text-gray-900">
              Engage Every Student,
              <span className="block text-red-600">Even the Quiet Ones</span>
            </h1>

            <p className="mb-8 text-xl leading-relaxed text-gray-600">
              Interactive quizzes that work in any classroom. Get instant
              feedback, track understanding, and finally hear from students who
              never raise their hand.
            </p>

            <div className="mb-8 flex items-center gap-4">
              <Link
                to="https://manage.klicker.uzh.ch"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700"
              >
                Start Free
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50">
                <FontAwesomeIcon icon={faPlay} />
                Watch 2-min Demo
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-500"
                />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-500"
                />
                Setup in 5 minutes
              </span>
              <span className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-500"
                />
                Works with existing materials
              </span>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-8">
              <p className="mb-3 text-sm text-gray-500">
                Trusted by educators at
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <span className="font-medium text-gray-400">
                  University of Zurich
                </span>
                <span className="font-medium text-gray-400">ETH Zurich</span>
                <span className="font-medium text-gray-400">
                  University of Basel
                </span>
                <span className="font-medium text-gray-400">+97 more</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative z-10">
              <img
                src="/img/live_quiz/lq_evaluation.png"
                alt="KlickerUZH Live Quiz in Action"
                className="w-full rounded-xl shadow-2xl"
              />

              <div className="absolute -right-4 -top-4 animate-bounce rounded-lg bg-white px-4 py-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-green-600">85%</div>
                  <div className="text-sm text-gray-600">
                    <div className="font-medium">Student Participation</div>
                    <div className="text-xs text-gray-500">
                      vs 30% with hand-raising
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 rounded-lg bg-white px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-500" />
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-green-500" />
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-purple-500" />
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-yellow-500 text-xs font-bold text-white">
                      +47
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">52 students</div>
                    <div className="text-xs text-gray-500">
                      actively participating
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 rotate-3 transform rounded-xl bg-gradient-to-r from-red-500 to-red-600 opacity-10" />
          </div>
        </div>

        <div className="mt-20 border-t border-gray-200 pt-12">
          <div className="mb-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              The Challenge Every Educator Faces
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-red-600">70%</div>
              <p className="text-sm text-gray-600">
                of students never speak up in class
              </p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-red-600">50%</div>
              <p className="text-sm text-gray-600">
                don't understand but won't ask questions
              </p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-red-600">3 min</div>
              <p className="text-sm text-gray-600">
                average attention span in lectures
              </p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-red-600">90%</div>
              <p className="text-sm text-gray-600">
                prefer anonymous participation
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
