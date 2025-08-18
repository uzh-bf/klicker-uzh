import {
  faArrowRight,
  faClock,
  faFilter,
  faPlay,
  faSearch,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMemo, useState } from 'react'

interface JourneyFeature {
  id: string
  title: string
  text: string
  image: string
  category: 'teaching' | 'learning' | 'engagement' | 'productivity'
  userType: 'lecturer' | 'student' | 'both'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  isNew?: boolean
  isPopular?: boolean
  tags: string[]
}

const features: JourneyFeature[] = [
  {
    id: 'live-quiz',
    title: 'Live Quizzes',
    text: 'Launch interactive quizzes during class with real-time results and dynamic visualizations.',
    image: '/img/live_quiz/lq_student_view.png',
    category: 'teaching',
    userType: 'both',
    difficulty: 'beginner',
    isPopular: true,
    tags: ['real-time', 'interactive', 'classroom'],
  },
  {
    id: 'anonymous-gamified',
    title: 'Anonymous Gamified Quizzes',
    text: 'Combine gamification with anonymous participation for sensitive topics.',
    image: '/img/leaderboard/course_leaderboard.png',
    category: 'engagement',
    userType: 'both',
    difficulty: 'intermediate',
    isNew: true,
    isPopular: true,
    tags: ['anonymous', 'gamification', 'competition'],
  },
  {
    id: 'microlearning',
    title: 'Microlearning',
    text: 'Create bite-sized learning units with scheduled delivery and spaced repetition.',
    image: '/img/microlearning/ml_mobile_views.png',
    category: 'learning',
    userType: 'both',
    difficulty: 'intermediate',
    isPopular: true,
    tags: ['spaced-repetition', 'mobile', 'self-paced'],
  },
  {
    id: 'anonymous-participation',
    title: 'Anonymous Participation',
    text: 'Allow students to participate without revealing identity, reducing anxiety.',
    image: '/img/live_quiz/lq_student_view.png',
    category: 'teaching',
    userType: 'student',
    difficulty: 'beginner',
    isNew: true,
    tags: ['anonymous', 'accessibility', 'inclusion'],
  },
  {
    id: 'group-activities',
    title: 'Group Activities',
    text: 'Foster collaboration with team-based challenges and built-in communication.',
    image: '/img/group_activity/ga_graded_students.png',
    category: 'learning',
    userType: 'both',
    difficulty: 'intermediate',
    tags: ['collaboration', 'teamwork', 'communication'],
  },
  {
    id: 'batch-operations',
    title: 'Batch Operations',
    text: 'Manage multiple activities efficiently with bulk edit, publish, or archive actions.',
    image: '/img/elements/library.png',
    category: 'productivity',
    userType: 'lecturer',
    difficulty: 'advanced',
    isNew: true,
    tags: ['efficiency', 'management', 'bulk-actions'],
  },
  {
    id: 'live-qa',
    title: 'Live Q&A & Feedback',
    text: 'Enable real-time questions and feedback with moderation tools.',
    image: '/img/landing/live_qa.png',
    category: 'teaching',
    userType: 'both',
    difficulty: 'beginner',
    tags: ['questions', 'feedback', 'moderation'],
  },
  {
    id: 'practice-quizzes',
    title: 'Practice Quizzes',
    text: 'Unlimited practice with intelligent question ordering and retention algorithms.',
    image: '/img/practice_quiz/pq_olat_view.png',
    category: 'learning',
    userType: 'student',
    difficulty: 'beginner',
    tags: ['practice', 'self-study', 'algorithms'],
  },
  {
    id: 'points-leaderboards',
    title: 'Points & Leaderboards',
    text: 'Track progress with customizable point systems and rankings.',
    image: '/img/leaderboard/course_leaderboard.png',
    category: 'engagement',
    userType: 'both',
    difficulty: 'intermediate',
    tags: ['gamification', 'progress', 'competition'],
  },
]

const categoryLabels = {
  teaching: 'Teaching Tools',
  learning: 'Learning Activities',
  engagement: 'Engagement',
  productivity: 'Productivity',
}

const difficultyLabels = {
  beginner: 'Easy to Start',
  intermediate: 'Some Setup',
  advanced: 'Advanced',
}

const heroFeatures = ['live-quiz', 'anonymous-gamified', 'microlearning']

export function FeatureJourney() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedUserType, setSelectedUserType] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  const filteredFeatures = useMemo(() => {
    return features.filter((feature) => {
      const matchesSearch =
        feature.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        )

      const matchesCategory =
        selectedCategory === 'all' || feature.category === selectedCategory
      const matchesUserType =
        selectedUserType === 'all' ||
        feature.userType === selectedUserType ||
        feature.userType === 'both'

      return matchesSearch && matchesCategory && matchesUserType
    })
  }, [searchTerm, selectedCategory, selectedUserType])

  const heroFeaturesData = features.filter((f) => heroFeatures.includes(f.id))
  const regularFeatures = filteredFeatures.filter(
    (f) => !heroFeatures.includes(f.id)
  )

  return (
    <div className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Find Your Perfect Teaching Solution
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Explore features tailored to your teaching style and discover new
            ways to engage your students
          </p>
        </div>

        {/* Hero Features */}
        <div className="mb-12">
          <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-gray-900">
            <FontAwesomeIcon
              icon={faStar}
              className="h-5 w-5 text-yellow-500"
            />
            Most Popular Features
          </h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {heroFeaturesData.map((feature) => (
              <div
                key={feature.id}
                className="group relative rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-6 shadow-lg transition-all hover:shadow-xl"
              >
                <div className="absolute right-4 top-4 flex gap-2">
                  {feature.isNew && (
                    <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-medium text-white">
                      NEW
                    </span>
                  )}
                  {feature.isPopular && (
                    <span className="rounded-full bg-yellow-500 px-2 py-1 text-xs font-medium text-white">
                      POPULAR
                    </span>
                  )}
                </div>

                <div className="mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-white/50">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <h4 className="mb-2 text-xl font-semibold text-gray-900">
                  {feature.title}
                </h4>
                <p className="mb-4 text-gray-600">{feature.text}</p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {feature.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-white/70 px-2 py-1 text-xs text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="flex items-center gap-1 font-medium text-red-600 transition-all hover:text-red-700 group-hover:gap-2">
                    <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
                    Try it
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            {/* Search */}
            <div className="relative max-w-md flex-1">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-3 h-4 w-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <FontAwesomeIcon icon={faFilter} className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Categories</option>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    User Type
                  </label>
                  <select
                    value={selectedUserType}
                    onChange={(e) => setSelectedUserType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Users</option>
                    <option value="lecturer">Lecturers</option>
                    <option value="student">Students</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              All Features{' '}
              {filteredFeatures.length < features.length &&
                `(${filteredFeatures.length} of ${features.length})`}
            </h3>
            <div className="text-sm text-gray-600">
              {filteredFeatures.length} feature
              {filteredFeatures.length !== 1 ? 's' : ''} found
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {regularFeatures.map((feature) => (
              <div
                key={feature.id}
                className="group rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-red-200 hover:shadow-lg"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex gap-2">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {categoryLabels[feature.category]}
                    </span>
                    {feature.isNew && (
                      <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-600">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FontAwesomeIcon icon={faClock} className="h-3 w-3" />
                    {difficultyLabels[feature.difficulty]}
                  </div>
                </div>

                <div className="mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-gray-50">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <h4 className="mb-2 font-semibold text-gray-900 transition-colors group-hover:text-red-600">
                  {feature.title}
                </h4>
                <p className="mb-3 text-sm text-gray-600">{feature.text}</p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {feature.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="h-3 w-3 text-gray-400 transition-all group-hover:translate-x-1 group-hover:text-red-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start Wizard */}
        <div className="rounded-2xl bg-gradient-to-r from-gray-50 to-red-50 p-8 text-center">
          <h3 className="mb-4 text-2xl font-bold text-gray-900">
            Not sure where to start?
          </h3>
          <p className="mx-auto mb-6 max-w-2xl text-gray-600">
            Take our quick assessment to get personalized feature
            recommendations based on your teaching style and goals.
          </p>
          <button className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700">
            Start Quick Assessment
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeatureJourney
