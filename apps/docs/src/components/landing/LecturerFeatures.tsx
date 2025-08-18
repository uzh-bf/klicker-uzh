import Link from '@docusaurus/Link'
import {
  faArrowRight,
  faChartLine,
  faUserShield,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface LecturerFeature {
  id: string
  title: string
  problem: string
  solution: string
  benefit: string
  icon: any
  screenshot: string
  stats?: {
    label: string
    value: string
  }
}

const features: LecturerFeature[] = [
  {
    id: 'live-polls',
    title: 'Run Live Polls in Seconds',
    problem: "Can't tell if students understand",
    solution: 'Create questions on-the-fly and see responses instantly',
    benefit: 'Adjust your teaching pace based on real comprehension',
    icon: faChartLine,
    screenshot: '/img/live_quiz/lq_evaluation.png',
    stats: {
      label: 'Average participation',
      value: '85%',
    },
  },
  {
    id: 'anonymous',
    title: 'Anonymous Mode for Honest Feedback',
    problem: 'Shy students never participate',
    solution: 'Let students respond without revealing identity',
    benefit: 'Finally hear from every student, not just the confident ones',
    icon: faUserShield,
    screenshot: '/img/live_quiz/lq_student_view.png',
    stats: {
      label: 'Students prefer anonymous',
      value: '73%',
    },
  },
  {
    id: 'analytics',
    title: 'Automatic Grading & Analytics',
    problem: 'Grading takes too much time',
    solution: 'Automatic scoring with detailed learning analytics',
    benefit: 'Identify struggling students before they fail',
    icon: faChartLine,
    screenshot: '/img/live_quiz/lq_evaluation.png',
    stats: {
      label: 'Time saved per week',
      value: '4 hours',
    },
  },
]

export function LecturerFeatures() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            Three Ways to Transform Your Classroom
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-gray-600">
            Solve your biggest teaching challenges with tools designed
            specifically for educators like you
          </p>
        </div>

        <div className="space-y-20">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className={twMerge(
                'flex flex-col items-center gap-12 lg:flex-row',
                index % 2 === 1 && 'lg:flex-row-reverse'
              )}
            >
              <div className="flex-1">
                <div className="max-w-xl">
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                    <FontAwesomeIcon
                      icon={feature.icon}
                      className="text-xl text-red-600"
                    />
                  </div>

                  <h3 className="mb-4 text-2xl font-bold text-gray-900">
                    {feature.title}
                  </h3>

                  <div className="mb-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 font-semibold text-red-500">
                        Problem:
                      </span>
                      <p className="flex-1 text-gray-600">{feature.problem}</p>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="mt-1 font-semibold text-green-600">
                        Solution:
                      </span>
                      <p className="flex-1 text-gray-700">{feature.solution}</p>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="mt-1 font-semibold text-blue-600">
                        Result:
                      </span>
                      <p className="flex-1 font-medium text-gray-900">
                        {feature.benefit}
                      </p>
                    </div>
                  </div>

                  {feature.stats && (
                    <div className="mb-6 rounded-lg bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {feature.stats.label}
                        </span>
                        <span className="text-2xl font-bold text-gray-900">
                          {feature.stats.value}
                        </span>
                      </div>
                    </div>
                  )}

                  <Link
                    to="/getting_started/welcome"
                    className="inline-flex items-center gap-2 font-medium text-red-600 hover:text-red-700"
                  >
                    Learn how it works
                    <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
                  </Link>
                </div>
              </div>

              <div className="flex-1">
                <div className="relative">
                  <img
                    src={feature.screenshot}
                    alt={feature.title}
                    className="w-full rounded-xl shadow-2xl"
                  />
                  <div className="absolute -bottom-4 -right-4 rounded-lg bg-white px-4 py-2 shadow-lg">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      <span className="text-sm text-gray-600">
                        Live Demo Available
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="mb-6 text-gray-600">
            Plus dozens more features designed with educators in mind
          </p>
          <Link
            to="/use_cases"
            className="inline-flex items-center gap-2 font-medium text-red-600 hover:text-red-700"
          >
            Explore all features
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </div>
    </section>
  )
}
