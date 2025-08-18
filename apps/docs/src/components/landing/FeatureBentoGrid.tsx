import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface BentoFeature {
  title: string
  text: string
  image: string
  size: 'small' | 'medium' | 'large'
  category: string
  isNew?: boolean
  accent?: string
}

const features: BentoFeature[] = [
  // Hero features (large)
  {
    title: 'Anonymous Gamified Quizzes',
    text: 'Combine the excitement of gamification with anonymous participation. Perfect for sensitive topics where students need to feel safe expressing their views.',
    image: '/img/leaderboard/course_leaderboard.png',
    size: 'large',
    category: 'Engagement',
    isNew: true,
    accent: 'red',
  },
  {
    title: 'Live Quizzes',
    text: 'Launch interactive quizzes during class with real-time results. Students participate using any device, with instant feedback and dynamic visualizations.',
    image: '/img/live_quiz/lq_student_view.png',
    size: 'large',
    category: 'Teaching',
    accent: 'blue',
  },
  
  // Medium features
  {
    title: 'Microlearning',
    text: 'Create bite-sized learning units with scheduled delivery. Combat the forgetting curve with time-restricted content.',
    image: '/img/microlearning/ml_mobile_views.png',
    size: 'medium',
    category: 'Learning',
    accent: 'green',
  },
  {
    title: 'Group Activities',
    text: 'Foster collaboration with team-based challenges. Built-in chat enables real-time communication.',
    image: '/img/group_activity/ga_graded_students.png',
    size: 'medium',
    category: 'Learning',
    accent: 'purple',
  },
  {
    title: 'Batch Operations',
    text: 'Manage multiple activities efficiently with bulk actions. Edit, publish, or archive dozens of items in seconds.',
    image: '/img/elements/library.png',
    size: 'medium',
    category: 'Productivity',
    isNew: true,
    accent: 'orange',
  },
  
  // Small features
  {
    title: 'Anonymous Participation',
    text: 'Allow students to participate without revealing identity, reducing anxiety.',
    image: '/img/live_quiz/lq_student_view.png',
    size: 'small',
    category: 'Teaching',
    isNew: true,
  },
  {
    title: 'Live Q&A & Feedback',
    text: 'Enable real-time questions and feedback with moderation tools.',
    image: '/img/landing/live_qa.png',
    size: 'small',
    category: 'Teaching',
  },
  {
    title: 'Practice Quizzes',
    text: 'Unlimited practice with intelligent question ordering and spaced repetition.',
    image: '/img/practice_quiz/pq_olat_view.png',
    size: 'small',
    category: 'Learning',
  },
  {
    title: 'Points & Leaderboards',
    text: 'Track progress with customizable point systems and rankings.',
    image: '/img/leaderboard/course_leaderboard.png',
    size: 'small',
    category: 'Engagement',
  },
  {
    title: 'Review & Tracking',
    text: 'Mark activities as reviewed and track completion across courses.',
    image: '/img/elements/library.png',
    size: 'small',
    category: 'Productivity',
    isNew: true,
  },
  {
    title: 'Calendar Integration',
    text: 'Visualize your semester with calendar views and scheduling.',
    image: '/img/elements/library.png',
    size: 'small',
    category: 'Productivity',
    isNew: true,
  },
  {
    title: 'Achievements & Rewards',
    text: 'Motivate with badges, milestones, and level progression.',
    image: '/img/group/group_student_view.png',
    size: 'small',
    category: 'Engagement',
  },
]

const sizeClasses = {
  small: 'col-span-1 row-span-1',
  medium: 'col-span-2 row-span-1',
  large: 'col-span-2 row-span-2',
}

const accentColors = {
  red: 'border-red-200 hover:border-red-300 bg-gradient-to-br from-red-50 to-white',
  blue: 'border-blue-200 hover:border-blue-300 bg-gradient-to-br from-blue-50 to-white',
  green: 'border-green-200 hover:border-green-300 bg-gradient-to-br from-green-50 to-white',
  purple: 'border-purple-200 hover:border-purple-300 bg-gradient-to-br from-purple-50 to-white',
  orange: 'border-orange-200 hover:border-orange-300 bg-gradient-to-br from-orange-50 to-white',
}

const categoryColors = {
  Teaching: 'bg-blue-100 text-blue-800',
  Learning: 'bg-green-100 text-green-800',
  Engagement: 'bg-red-100 text-red-800',
  Productivity: 'bg-orange-100 text-orange-800',
}

export function FeatureBentoGrid() {
  return (
    <div className="py-16 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything You Need in One Platform
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            From real-time quizzes to gamified learning experiences, discover how KlickerUZH transforms education
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={twMerge(
                'group relative rounded-2xl border-2 p-6 shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer',
                sizeClasses[feature.size],
                feature.accent ? accentColors[feature.accent] : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              {/* Category Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={twMerge(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  categoryColors[feature.category]
                )}>
                  {feature.category}
                </span>
                {feature.isNew && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    NEW
                  </span>
                )}
              </div>

              {/* Image (for medium and large cards) */}
              {feature.size !== 'small' && (
                <div className="aspect-[4/3] mb-4 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={feature.image}
                    alt={`${feature.title} screenshot`}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 flex flex-col">
                <h3 className={twMerge(
                  'font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors',
                  feature.size === 'large' ? 'text-xl' : feature.size === 'medium' ? 'text-lg' : 'text-base'
                )}>
                  {feature.title}
                </h3>
                
                <p className={twMerge(
                  'text-gray-600 leading-relaxed flex-1',
                  feature.size === 'large' ? 'text-base' : 'text-sm'
                )}>
                  {feature.text}
                </p>

                {/* Learn More Link */}
                <div className="mt-4 flex items-center text-gray-700 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Learn more</span>
                  <FontAwesomeIcon 
                    icon={faArrowRight} 
                    className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">Explore detailed documentation for each feature</p>
          <a 
            href="/docs"
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            <span>View Documentation</span>
            <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default FeatureBentoGrid