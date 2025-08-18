import {
  faChartLine,
  faGraduationCap,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const stats = [
  {
    id: 1,
    name: 'Active Institutions',
    value: '100+',
    icon: faGraduationCap,
    description: 'Universities worldwide',
  },
  {
    id: 2,
    name: 'Students Engaged',
    value: '50K+',
    icon: faUsers,
    description: 'Monthly active learners',
  },
  {
    id: 3,
    name: 'Questions Created',
    value: '500K+',
    icon: faChartLine,
    description: 'Interactive elements',
  },
]

export function SimplifiedSocialProof() {
  return (
    <div className="bg-gradient-to-r from-gray-50 to-white py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Open Source • Trusted Globally
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.id}
              className="flex items-center justify-center gap-4 rounded-lg bg-white px-6 py-4 shadow-sm ring-1 ring-gray-100"
            >
              <div className="rounded-full bg-red-100 p-2">
                <FontAwesomeIcon
                  icon={stat.icon}
                  className="h-4 w-4 text-red-600"
                />
              </div>
              <div>
                <dd className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </dd>
                <dt className="text-sm text-gray-600">{stat.name}</dt>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export default SimplifiedSocialProof
