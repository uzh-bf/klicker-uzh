import {
  faArrowRight,
  faBrain,
  faChalkboardTeacher,
  faGamepad,
  faGraduationCap,
  faLaptopCode,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { USE_CASES } from '../../constants'

const useCaseIcons = {
  live_quiz: faChalkboardTeacher,
  flipped_learning: faGraduationCap,
  group_activities: faUsers,
  microlearning: faBrain,
  instant_feedback: faLaptopCode,
  gamification: faGamepad,
}

const highlightedCases = ['live_quiz', 'microlearning', 'group_activities']

export function UseCaseOverview() {
  return (
    <div className="bg-white py-16">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Real-World Applications
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600">
          Discover how educators are using KlickerUZH to transform their
          teaching across different scenarios
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(USE_CASES)
          .filter(([key]) => highlightedCases.includes(key))
          .map(([href, item]) => (
            <a
              key={item.title}
              href={`/use_cases/${href}`}
              className="group relative flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-red-200 hover:shadow-lg"
            >
              <div className="mb-4">
                <div className="inline-flex items-center justify-center rounded-lg bg-red-50 p-3 transition-colors group-hover:bg-red-100">
                  <FontAwesomeIcon
                    icon={useCaseIcons[href] || faChalkboardTeacher}
                    className="h-6 w-6 text-red-600"
                  />
                </div>
              </div>

              <h3 className="mb-3 text-xl font-semibold text-gray-900 transition-colors group-hover:text-red-600">
                {item.title.replace('(Gamified) ', '')}
              </h3>

              <p className="mb-6 flex-1 leading-relaxed text-gray-600">
                {item.abstract}
              </p>

              {item.tags && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {item.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center font-medium text-red-600 transition-all group-hover:gap-3">
                <span>Learn more</span>
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </div>
            </a>
          ))}
      </div>

      <div className="mt-12 text-center">
        <a
          href="/use_cases"
          className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900 transition-colors hover:text-red-600"
        >
          <span>View all use cases</span>
          <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}

export default UseCaseOverview
