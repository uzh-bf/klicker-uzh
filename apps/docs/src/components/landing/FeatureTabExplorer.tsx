import {
  faArrowRight,
  faChalkboardTeacher,
  faCogs,
  faGamepad,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface Feature {
  title: string
  text: string
  image: string
  isNew?: boolean
}

interface FeatureCategory {
  id: string
  name: string
  icon: any
  description: string
  features: Feature[]
}

const categories: FeatureCategory[] = [
  {
    id: 'teaching',
    name: 'Teaching Tools',
    icon: faChalkboardTeacher,
    description:
      'Essential real-time interaction features for engaging classrooms',
    features: [
      {
        title: 'Live Quizzes',
        text: 'Launch interactive quizzes with real-time results and dynamic visualizations.',
        image: '/img/live_quiz/lq_student_view.png',
      },
      {
        title: 'Live Q&A & Feedback',
        text: 'Enable students to ask questions and provide real-time feedback.',
        image: '/img/landing/live_qa.png',
      },
      {
        title: 'Anonymous Participation',
        text: 'Allow students to participate anonymously, reducing anxiety and encouraging honest responses.',
        image: '/img/live_quiz/lq_student_view.png',
        isNew: true,
      },
    ],
  },
  {
    id: 'learning',
    name: 'Learning Activities',
    icon: faUsers,
    description: 'Self-paced and collaborative learning beyond the classroom',
    features: [
      {
        title: 'Microlearning',
        text: 'Create bite-sized learning units with scheduled delivery and spaced repetition.',
        image: '/img/microlearning/ml_mobile_views.png',
      },
      {
        title: 'Practice Quizzes',
        text: 'Offer unlimited practice with intelligent question ordering and retention optimization.',
        image: '/img/practice_quiz/pq_olat_view.png',
      },
      {
        title: 'Group Activities',
        text: 'Foster collaboration with team-based challenges and built-in communication.',
        image: '/img/group_activity/ga_graded_students.png',
      },
    ],
  },
  {
    id: 'engagement',
    name: 'Engagement',
    icon: faGamepad,
    description: 'Gamification features that motivate and reward participation',
    features: [
      {
        title: 'Anonymous Gamified Quizzes',
        text: 'Combine gamification with anonymous participation for sensitive topics.',
        image: '/img/leaderboard/course_leaderboard.png',
        isNew: true,
      },
      {
        title: 'Points & Leaderboards',
        text: 'Track progress with customizable point systems rewarding speed and accuracy.',
        image: '/img/leaderboard/course_leaderboard.png',
      },
      {
        title: 'Achievements & Rewards',
        text: 'Motivate students with badges, milestones, and level progression.',
        image: '/img/group/group_student_view.png',
      },
    ],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    icon: faCogs,
    description: 'Powerful management and automation tools to save time',
    features: [
      {
        title: 'Batch Operations',
        text: 'Manage multiple activities efficiently with bulk edit, publish, or archive actions.',
        image: '/img/elements/library.png',
        isNew: true,
      },
      {
        title: 'Review & Tracking',
        text: 'Mark activities as reviewed and track completion status across courses.',
        image: '/img/elements/library.png',
        isNew: true,
      },
      {
        title: 'Calendar Integration',
        text: 'Visualize your semester with calendar views and effortless scheduling.',
        image: '/img/elements/library.png',
        isNew: true,
      },
    ],
  },
]

export function FeatureTabExplorer() {
  const [activeTab, setActiveTab] = useState('teaching')

  const activeCategory = categories.find((cat) => cat.id === activeTab)!

  return (
    <div className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Comprehensive Feature Suite
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Everything you need for interactive teaching and engaged learning
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200">
          <nav
            className="-mb-px flex justify-center space-x-8"
            aria-label="Tabs"
          >
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveTab(category.id)}
                className={twMerge(
                  'group inline-flex items-center whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium',
                  activeTab === category.id
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
                aria-current={activeTab === category.id ? 'page' : undefined}
              >
                <FontAwesomeIcon
                  icon={category.icon}
                  className={twMerge(
                    'mr-2 h-4 w-4',
                    activeTab === category.id
                      ? 'text-red-500'
                      : 'text-gray-400 group-hover:text-gray-500'
                  )}
                />
                {category.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Active Tab Content */}
        <div className="mb-8">
          <div className="mb-8 text-center">
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              {activeCategory.name}
            </h3>
            <p className="text-gray-600">{activeCategory.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeCategory.features.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-200 hover:shadow-lg"
              >
                {feature.isNew && (
                  <span className="absolute -right-2 -top-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    NEW
                  </span>
                )}

                <div className="mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-gray-50">
                  <img
                    src={feature.image}
                    alt={`${feature.title} screenshot`}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <h4 className="mb-2 text-lg font-semibold text-gray-900 transition-colors group-hover:text-red-600">
                  {feature.title}
                </h4>

                <p className="text-sm leading-relaxed text-gray-600">
                  {feature.text}
                </p>

                <div className="mt-4 flex items-center text-sm font-medium text-red-600 opacity-0 transition-opacity group-hover:opacity-100">
                  <span>Learn more</span>
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="ml-1 h-3 w-3"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureTabExplorer
