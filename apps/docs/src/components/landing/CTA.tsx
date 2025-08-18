import {
  faCheckCircle,
  faMap,
  faRocket,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

export function CTA() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-orange-50 py-20 sm:py-28">
      <div className="bg-grid-gray-200 absolute inset-0 opacity-10"></div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Ready to Transform Your Classroom?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Join thousands of educators who are already engaging their students
            with KlickerUZH. Start free today, no credit card required.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <a href="https://manage.klicker.uzh.ch" target="_blank">
                <Button
                  primary
                  className={{
                    root: 'border-none bg-red-600 px-8 py-4 text-lg shadow-lg transition-all hover:bg-red-700 hover:shadow-xl',
                  }}
                >
                  <FontAwesomeIcon icon={faRocket} className="mr-2" />
                  Start Free Today
                </Button>
              </a>
              <a href="/getting_started/welcome">
                <Button
                  className={{
                    root: 'border-2 border-gray-300 bg-white px-8 py-4 text-lg text-gray-900 hover:border-gray-400 hover:bg-gray-50',
                  }}
                >
                  View Documentation
                </Button>
              </a>
            </div>

            <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-500"
                />
                Free forever
              </span>
              <span className="flex items-center gap-1">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-500"
                />
                No credit card
              </span>
              <span className="flex items-center gap-1">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-500"
                />
                Open source
              </span>
            </div>
          </div>
        </div>

        <div className="mt-20 border-t border-gray-200 pt-12">
          <h3 className="mb-8 text-center text-xl font-semibold text-gray-900">
            Join Our Community
          </h3>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            <a
              href="https://community.klicker.uzh.ch"
              target="_blank"
              rel="noreferrer noopener"
              className="group relative flex items-start rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100">
                <FontAwesomeIcon
                  icon={faUsers}
                  className="h-5 w-5 text-red-600"
                />
              </div>
              <div className="ml-4 flex-1">
                <h4 className="text-lg font-semibold text-gray-900 group-hover:text-red-600">
                  Community Forum
                </h4>
                <p className="mt-2 text-sm text-gray-600">
                  Connect with other educators, share best practices, and get
                  help from the community.
                </p>
                <span className="mt-3 inline-flex items-center text-sm font-medium text-red-600">
                  Join discussion
                  <svg
                    className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </div>
            </a>

            <a
              href="https://klicker-uzh.feedbear.com"
              target="_blank"
              rel="noreferrer noopener"
              className="group relative flex items-start rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100">
                <FontAwesomeIcon
                  icon={faMap}
                  className="h-5 w-5 text-red-600"
                />
              </div>
              <div className="ml-4 flex-1">
                <h4 className="text-lg font-semibold text-gray-900 group-hover:text-red-600">
                  Product Roadmap
                </h4>
                <p className="mt-2 text-sm text-gray-600">
                  See what's coming next and vote on features that matter most
                  to you.
                </p>
                <span className="mt-3 inline-flex items-center text-sm font-medium text-red-600">
                  View roadmap
                  <svg
                    className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CTA
