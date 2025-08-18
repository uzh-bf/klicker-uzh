import {
  faChartLine,
  faGraduationCap,
  faStar,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const stats = [
  {
    id: 1,
    name: 'Active Institutions',
    value: '100+',
    icon: faGraduationCap,
    description: 'Universities and schools',
  },
  {
    id: 2,
    name: 'Students Engaged',
    value: '50,000+',
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
  {
    id: 4,
    name: 'User Satisfaction',
    value: '4.8/5',
    icon: faStar,
    description: 'Average rating',
  },
]

const testimonials = [
  {
    content:
      'KlickerUZH transformed my large lectures. The anonymous participation feature encourages even shy students to engage actively.',
    author: 'Prof. Dr. Sarah Meyer',
    role: 'Computer Science, University of Zurich',
    image: '/img/testimonials/avatar1.jpg',
  },
  {
    content:
      'The gamification features have dramatically increased student participation. My completion rates went from 60% to over 90%.',
    author: 'Dr. Thomas Schmidt',
    role: 'Economics, ETH Zurich',
    image: '/img/testimonials/avatar2.jpg',
  },
  {
    content:
      'Perfect for hybrid teaching. Students love the immediate feedback and I appreciate the detailed analytics.',
    author: 'Prof. Anna Wagner',
    role: 'Medicine, University of Basel',
    image: '/img/testimonials/avatar3.jpg',
  },
]

const institutions = [
  { name: 'University of Zurich', logo: '/img/logos/uzh.png' },
  { name: 'ETH Zurich', logo: '/img/logos/eth.png' },
  { name: 'University of Basel', logo: '/img/logos/basel.png' },
  { name: 'University of Bern', logo: '/img/logos/bern.png' },
  { name: 'EPFL', logo: '/img/logos/epfl.png' },
]

export function SocialProof() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Stats Section */}
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Trusted by Leading Educational Institutions
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Join thousands of educators who are transforming their classrooms
              with KlickerUZH
            </p>
          </div>

          <dl className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="flex flex-col items-center rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 rounded-full bg-red-100 p-3">
                  <FontAwesomeIcon
                    icon={stat.icon}
                    className="h-6 w-6 text-red-600"
                  />
                </div>
                <dt className="text-sm font-medium text-gray-600">
                  {stat.name}
                </dt>
                <dd className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                  {stat.value}
                </dd>
                <dd className="mt-1 text-xs text-gray-500">
                  {stat.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Testimonials */}
        <div className="mx-auto mt-20 max-w-2xl lg:max-w-none">
          <h3 className="mb-12 text-center text-2xl font-bold text-gray-900">
            What Educators Are Saying
          </h3>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="flex flex-col justify-between rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="mb-4 flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <FontAwesomeIcon
                        key={i}
                        icon={faStar}
                        className="h-4 w-4 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="italic leading-relaxed text-gray-700">
                    "{testimonial.content}"
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {testimonial.author}
                    </p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Institution Logos */}
        <div className="mx-auto mt-20 max-w-2xl lg:max-w-none">
          <p className="mb-8 text-center text-sm font-semibold text-gray-600">
            TRUSTED BY INSTITUTIONS WORLDWIDE
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            {institutions.map((institution) => (
              <div
                key={institution.name}
                className="flex h-12 items-center"
                title={institution.name}
              >
                <span className="text-lg font-medium text-gray-600">
                  {institution.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SocialProof
