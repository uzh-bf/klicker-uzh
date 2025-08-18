import { faChartBar, faEdit, faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface Step {
  number: string
  title: string
  description: string
  icon: any
  duration: string
  visual: string
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Create Your Quiz',
    description:
      'Upload existing questions from PowerPoint or Word, or create new ones on-the-fly. Choose from multiple choice, polls, or open-ended questions.',
    icon: faEdit,
    duration: '< 5 minutes',
    visual: '/img/elements/library.png',
  },
  {
    number: '02',
    title: 'Share the Code',
    description:
      'Students join instantly on any device - no app downloads required. Display the join code or QR code on your screen.',
    icon: faQrcode,
    duration: '< 30 seconds',
    visual: '/img/live_quiz/lq_student_view.png',
  },
  {
    number: '03',
    title: 'See Real-Time Results',
    description:
      'Watch responses flow in live. Discuss results immediately, identify confusion points, and adjust your teaching accordingly.',
    icon: faChartBar,
    duration: 'Instant',
    visual: '/img/live_quiz/lq_evaluation.png',
  },
]

export function HowItWorks() {
  return (
    <section className="bg-gray-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
            <span className="font-bold">Easy Setup</span>
            <span>•</span>
            <span>No IT Required</span>
          </div>

          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            Start Engaging Your Class in 3 Simple Steps
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-gray-600">
            From zero to interactive classroom in under 5 minutes. No technical
            expertise needed.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 hidden h-0.5 -translate-y-1/2 bg-gray-200 lg:block" />

          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                <div className="h-full rounded-xl bg-white p-8 shadow-lg transition-shadow hover:shadow-xl">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-5xl font-bold text-gray-100">
                      {step.number}
                    </span>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                      <FontAwesomeIcon
                        icon={step.icon}
                        className="text-2xl text-red-600"
                      />
                    </div>
                  </div>

                  <h3 className="mb-3 text-xl font-bold text-gray-900">
                    {step.title}
                  </h3>

                  <p className="mb-4 text-gray-600">{step.description}</p>

                  <div className="mb-6 flex items-center gap-2 text-sm font-medium text-green-600">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {step.duration}
                  </div>

                  <div className="group relative cursor-pointer">
                    <img
                      src={step.visual}
                      alt={step.title}
                      className="h-40 w-full rounded-lg border border-gray-200 object-cover object-top transition-colors group-hover:border-red-300"
                    />
                    <div className="absolute inset-0 rounded-lg bg-black bg-opacity-0 transition-opacity group-hover:bg-opacity-10" />
                  </div>
                </div>

                {index < steps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-500 bg-white lg:flex">
                    <svg
                      className="h-4 w-4 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 p-8">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-bold text-gray-900">
                No Technical Skills Required
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-700">
                    Works in any browser - Chrome, Safari, Firefox, Edge
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-700">
                    Students don't need accounts or app downloads
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-700">
                    Import questions from your existing materials
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-700">
                    Free training webinars every month
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-4 flex items-center gap-4">
                <img
                  src="/img/logos/KlickerLogo.png"
                  alt="Support team member"
                  className="h-12 w-12 rounded-full"
                />
                <div>
                  <p className="font-semibold text-gray-900">
                    Need help getting started?
                  </p>
                  <p className="text-sm text-gray-600">
                    Our support team is here for you
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700">
                  Book Free Onboarding
                </button>
                <button className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
                  Watch Tutorial
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
