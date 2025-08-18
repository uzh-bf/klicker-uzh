import {
  faChalkboardTeacher,
  faChevronDown,
  faChevronRight,
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

interface FeatureSection {
  id: string
  title: string
  icon: any
  description: string
  color: string
  features: Feature[]
}

const sections: FeatureSection[] = [
  {
    id: 'teaching',
    title: 'Core Teaching Tools',
    icon: faChalkboardTeacher,
    description:
      'Essential real-time interaction features for engaging classroom experiences',
    color: 'blue',
    features: [
      {
        title: 'Live Quizzes',
        text: 'Launch interactive quizzes during class with real-time results. Students participate using any device, with instant feedback and dynamic visualizations.',
        image: '/img/live_quiz/lq_student_view.png',
      },
      {
        title: 'Live Q&A & Feedback',
        text: 'Enable students to ask questions, upvote topics, and provide real-time feedback. Moderate discussions and respond instantly to maintain engagement.',
        image: '/img/landing/live_qa.png',
      },
      {
        title: 'Anonymous Participation',
        text: 'Allow students to participate anonymously in all activities, reducing anxiety and encouraging honest responses while maintaining engagement.',
        image: '/img/live_quiz/lq_student_view.png',
        isNew: true,
      },
    ],
  },
  {
    id: 'learning',
    title: 'Flexible Learning Activities',
    icon: faUsers,
    description: 'Self-paced and collaborative learning beyond the classroom',
    color: 'green',
    features: [
      {
        title: 'Microlearning',
        text: 'Create bite-sized learning units with scheduled delivery. Combat the forgetting curve with time-restricted content that students complete at their own pace.',
        image: '/img/microlearning/ml_mobile_views.png',
      },
      {
        title: 'Practice Quizzes',
        text: 'Offer unlimited practice opportunities with intelligent question ordering. Use spaced repetition algorithms to optimize learning retention.',
        image: '/img/practice_quiz/pq_olat_view.png',
      },
      {
        title: 'Group Activities',
        text: 'Foster collaboration with team-based challenges. Built-in chat enables real-time communication while solving problems together.',
        image: '/img/group_activity/ga_graded_students.png',
      },
    ],
  },
  {
    id: 'engagement',
    title: 'Enhanced Engagement',
    icon: faGamepad,
    description: 'Gamification features that motivate and reward participation',
    color: 'red',
    features: [
      {
        title: 'Anonymous Gamified Quizzes',
        text: 'Combine gamification with anonymous participation. Students compete for points without revealing their identity, perfect for sensitive topics.',
        image: '/img/leaderboard/course_leaderboard.png',
        isNew: true,
      },
      {
        title: 'Points & Leaderboards',
        text: 'Track progress with individual and group rankings. Customizable point systems reward speed, accuracy, and participation.',
        image: '/img/leaderboard/course_leaderboard.png',
      },
      {
        title: 'Achievements & Rewards',
        text: 'Motivate students with badges, milestones, and level progression. Create custom achievements aligned with learning objectives.',
        image: '/img/group/group_student_view.png',
      },
    ],
  },
  {
    id: 'productivity',
    title: 'Productivity Features',
    icon: faCogs,
    description: 'Save time with powerful management and automation tools',
    color: 'orange',
    features: [
      {
        title: 'Batch Operations',
        text: 'Manage multiple activities efficiently with bulk actions. Edit, publish, or archive dozens of items in seconds.',
        image: '/img/elements/library.png',
        isNew: true,
      },
      {
        title: 'Review & Tracking System',
        text: 'Mark activities as reviewed and track completion status. Never lose sight of your teaching progress across courses.',
        image: '/img/elements/library.png',
        isNew: true,
      },
      {
        title: 'Calendar Integration',
        text: 'Visualize your semester at a glance with calendar views. Schedule activities and manage deadlines effortlessly.',
        image: '/img/elements/library.png',
        isNew: true,
      },
    ],
  },
]

const colorClasses = {
  blue: {
    section:
      'border-blue-200 hover:border-blue-300 bg-gradient-to-r from-blue-50 to-white',
    icon: 'text-blue-600 bg-blue-100',
    content: 'bg-blue-50/50',
  },
  green: {
    section:
      'border-green-200 hover:border-green-300 bg-gradient-to-r from-green-50 to-white',
    icon: 'text-green-600 bg-green-100',
    content: 'bg-green-50/50',
  },
  red: {
    section:
      'border-red-200 hover:border-red-300 bg-gradient-to-r from-red-50 to-white',
    icon: 'text-red-600 bg-red-100',
    content: 'bg-red-50/50',
  },
  orange: {
    section:
      'border-orange-200 hover:border-orange-300 bg-gradient-to-r from-orange-50 to-white',
    icon: 'text-orange-600 bg-orange-100',
    content: 'bg-orange-50/50',
  },
}

export function FeatureAccordion() {
  const [openSections, setOpenSections] = useState<string[]>(['teaching'])

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent, sectionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSection(sectionId)
    }
  }

  return (
    <div className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Explore Features by Category
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Click on any section to explore features in detail
          </p>
        </div>

        <div className="space-y-4">
          {sections.map((section) => {
            const isOpen = openSections.includes(section.id)
            const colors = colorClasses[section.color]

            return (
              <div
                key={section.id}
                className={twMerge(
                  'rounded-xl border-2 transition-all duration-200',
                  colors.section
                )}
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  onKeyDown={(e) => handleKeyDown(e, section.id)}
                  className="flex w-full items-center justify-between rounded-xl p-6 text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-4">
                    <div className={twMerge('rounded-lg p-3', colors.icon)}>
                      <FontAwesomeIcon
                        icon={section.icon}
                        className="h-5 w-5"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {section.title}
                      </h3>
                      <p className="mt-1 text-gray-600">
                        {section.description}
                      </p>
                    </div>
                  </div>
                  <FontAwesomeIcon
                    icon={isOpen ? faChevronDown : faChevronRight}
                    className={twMerge(
                      'h-5 w-5 text-gray-500 transition-transform',
                      isOpen && 'rotate-0'
                    )}
                  />
                </button>

                {/* Section Content */}
                {isOpen && (
                  <div
                    className={twMerge(
                      'border-t border-gray-200',
                      colors.content
                    )}
                  >
                    <div className="space-y-6 p-6">
                      {section.features.map((feature, index) => (
                        <div
                          key={feature.title}
                          className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex flex-col gap-6 lg:flex-row">
                            <div className="flex-1">
                              <div className="mb-3 flex items-center gap-3">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {feature.title}
                                </h4>
                                {feature.isNew && (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed text-gray-600">
                                {feature.text}
                              </p>
                            </div>
                            <div className="flex-shrink-0 lg:w-80">
                              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-gray-50">
                                <img
                                  src={feature.image}
                                  alt={`${feature.title} screenshot`}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-12 text-center">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {sections.map((section, index) => (
              <div key={section.id} className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {section.features.length}
                </div>
                <div className="text-sm text-gray-600">
                  {section.title
                    .replace('Features', '')
                    .replace('Tools', '')
                    .trim()}{' '}
                  Features
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureAccordion
