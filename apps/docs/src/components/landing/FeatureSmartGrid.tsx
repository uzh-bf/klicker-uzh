import { faSearch, faFilter, faArrowRight, faStar, faPlay, faGithub, faCode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface SmartFeature {
  id: string
  title: string
  description: string
  image: string
  category: 'teaching' | 'learning' | 'engagement' | 'productivity'
  userType: 'lecturer' | 'student' | 'both'
  difficulty: 'easy' | 'medium' | 'advanced'
  isHero?: boolean
  isNew?: boolean
  isPopular?: boolean
  tags: string[]
}

const features: SmartFeature[] = [
  // Hero Features
  {
    id: 'anonymous-gamified',
    title: 'Anonymous Gamified Quizzes',
    description: 'Revolutionary approach combining competition with privacy. Students compete for points without revealing identity, perfect for sensitive topics and inclusive learning.',
    image: '/img/leaderboard/course_leaderboard.png',
    category: 'engagement',
    userType: 'both',
    difficulty: 'medium',
    isHero: true,
    isNew: true,
    isPopular: true,
    tags: ['gamification', 'privacy', 'inclusion', 'competition'],
  },
  {
    id: 'live-quiz',
    title: 'Live Interactive Quizzes',
    description: 'Real-time classroom engagement with instant feedback, dynamic visualizations, and multi-device support. Transform passive lectures into active learning experiences.',
    image: '/img/live_quiz/lq_student_view.png',
    category: 'teaching',
    userType: 'both',
    difficulty: 'easy',
    isHero: true,
    isPopular: true,
    tags: ['real-time', 'interactive', 'classroom', 'engagement'],
  },
  {
    id: 'microlearning',
    title: 'Smart Microlearning',
    description: 'Bite-sized learning units with intelligent scheduling. Combat the forgetting curve with spaced repetition algorithms and mobile-optimized delivery.',
    image: '/img/microlearning/ml_mobile_views.png',
    category: 'learning',
    userType: 'student',
    difficulty: 'medium',
    isHero: true,
    isPopular: true,
    tags: ['spaced-repetition', 'mobile', 'algorithms', 'retention'],
  },

  // Core Features
  {
    id: 'anonymous-participation',
    title: 'Anonymous Participation',
    description: 'Reduce anxiety and encourage honest responses with identity protection.',
    image: '/img/live_quiz/lq_student_view.png',
    category: 'teaching',
    userType: 'student',
    difficulty: 'easy',
    isNew: true,
    tags: ['privacy', 'accessibility', 'inclusion'],
  },
  {
    id: 'batch-operations',
    title: 'Bulk Activity Management',
    description: 'Edit, publish, or archive dozens of activities in seconds with powerful batch operations.',
    image: '/img/elements/library.png',
    category: 'productivity',
    userType: 'lecturer',
    difficulty: 'advanced',
    isNew: true,
    tags: ['efficiency', 'management', 'automation'],
  },
  {
    id: 'group-activities',
    title: 'Collaborative Group Work',
    description: 'Team-based challenges with built-in communication and progress tracking.',
    image: '/img/group_activity/ga_graded_students.png',
    category: 'learning',
    userType: 'both',
    difficulty: 'medium',
    tags: ['collaboration', 'teamwork', 'communication'],
  },
  {
    id: 'live-qa',
    title: 'Live Q&A & Feedback',
    description: 'Real-time questions, upvoting, and moderated discussions.',
    image: '/img/landing/live_qa.png',
    category: 'teaching',
    userType: 'both',
    difficulty: 'easy',
    tags: ['questions', 'feedback', 'moderation'],
  },
  {
    id: 'practice-quizzes',
    title: 'Adaptive Practice Quizzes',
    description: 'Unlimited practice with intelligent question ordering and learning analytics.',
    image: '/img/practice_quiz/pq_olat_view.png',
    category: 'learning',
    userType: 'student',
    difficulty: 'easy',
    tags: ['practice', 'adaptive', 'analytics'],
  },
  {
    id: 'points-leaderboards',
    title: 'Gamified Progress Tracking',
    description: 'Customizable point systems, achievements, and friendly competition.',
    image: '/img/leaderboard/course_leaderboard.png',
    category: 'engagement',
    userType: 'both',
    difficulty: 'medium',
    tags: ['gamification', 'progress', 'achievements'],
  },
]

const categoryConfig = {
  teaching: { label: 'Teaching Tools', color: 'blue', icon: '🎓' },
  learning: { label: 'Learning Activities', color: 'green', icon: '📚' },
  engagement: { label: 'Engagement', color: 'red', icon: '🎯' },
  productivity: { label: 'Productivity', color: 'orange', icon: '⚡' },
}

const difficultyConfig = {
  easy: { label: 'Easy Start', color: 'green', icon: '🟢' },
  medium: { label: 'Some Setup', color: 'yellow', icon: '🟡' },
  advanced: { label: 'Advanced', color: 'red', icon: '🔴' },
}

const userTypeConfig = {
  lecturer: { label: 'For Lecturers', icon: '👨‍🏫' },
  student: { label: 'For Students', icon: '👨‍🎓' },
  both: { label: 'Everyone', icon: '👥' },
}

export function FeatureSmartGrid() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [compactView, setCompactView] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const heroFeatures = features.filter(f => f.isHero)
  const regularFeatures = features.filter(f => !f.isHero)

  const filteredFeatures = useMemo(() => {
    return regularFeatures.filter(feature => {
      const matchesSearch = searchTerm === '' || 
        feature.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = activeCategory === 'all' || feature.category === activeCategory
      
      return matchesSearch && matchesCategory
    })
  }, [searchTerm, activeCategory])

  return (
    <div className="py-16 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
            Complete Feature Suite
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-6">
            Discover powerful tools for every aspect of modern education
          </p>
          
          {/* View Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setCompactView(!compactView)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FontAwesomeIcon icon={compactView ? faFilter : faSearch} className="h-4 w-4" />
              {compactView ? 'Detailed View' : 'Compact View'}
            </button>
          </div>
        </div>

        {/* Hero Features */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faStar} className="h-6 w-6 text-yellow-500" />
              <h3 className="text-2xl font-semibold text-gray-900">Flagship Features</h3>
            </div>
            <div className="text-sm text-gray-500">
              {heroFeatures.length} key capabilities
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {heroFeatures.map((feature, index) => (
              <div
                key={feature.id}
                className={twMerge(
                  'group relative rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border-2',
                  index === 0 && 'bg-gradient-to-br from-red-50 via-orange-50 to-white border-red-200',
                  index === 1 && 'bg-gradient-to-br from-blue-50 via-indigo-50 to-white border-blue-200',
                  index === 2 && 'bg-gradient-to-br from-green-50 via-emerald-50 to-white border-green-200'
                )}
              >
                {/* Badges */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {feature.isNew && (
                    <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      NEW
                    </span>
                  )}
                  {feature.isPopular && (
                    <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <FontAwesomeIcon icon={faStar} className="h-3 w-3" />
                      TOP
                    </span>
                  )}
                </div>

                {/* Image */}
                <div className="aspect-[4/3] mb-6 rounded-xl overflow-hidden bg-white/50 shadow-sm">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Content */}
                <h4 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h4>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Feature DNA */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className={twMerge(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    `bg-${categoryConfig[feature.category].color}-100 text-${categoryConfig[feature.category].color}-700`
                  )}>
                    {categoryConfig[feature.category].icon} {categoryConfig[feature.category].label}
                  </span>
                  <span className={twMerge(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    `bg-${difficultyConfig[feature.difficulty].color}-100`
                  )}>
                    {difficultyConfig[feature.difficulty].icon} {difficultyConfig[feature.difficulty].label}
                  </span>
                </div>

                {/* CTA */}
                <button className="w-full bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 px-4 py-3 rounded-lg font-medium text-gray-900 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
                  <span>Try {feature.title}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={twMerge(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  activeCategory === 'all' 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                )}
              >
                All Features
              </button>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={twMerge(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1',
                    activeCategory === key 
                      ? `bg-${config.color}-600 text-white` 
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                  )}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results Summary */}
          <div className="text-sm text-gray-600 mb-6">
            Showing {filteredFeatures.length} of {regularFeatures.length} features
            {searchTerm && ` for "${searchTerm}"`}
            {activeCategory !== 'all' && ` in ${categoryConfig[activeCategory].label}`}
          </div>
        </div>

        {/* Feature Grid */}
        <div className={twMerge(
          'grid gap-6',
          compactView 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        )}>
          {filteredFeatures.map(feature => (
            <div
              key={feature.id}
              className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-red-200 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  <span className={twMerge(
                    'px-2 py-1 rounded text-xs font-medium',
                    `bg-${categoryConfig[feature.category].color}-100 text-${categoryConfig[feature.category].color}-700`
                  )}>
                    {categoryConfig[feature.category].icon}
                  </span>
                  {feature.isNew && (
                    <span className="bg-red-100 px-2 py-1 rounded text-xs text-red-600 font-medium">
                      NEW
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {difficultyConfig[feature.difficulty].icon}
                  {difficultyConfig[feature.difficulty].label}
                </span>
              </div>

              {/* Image */}
              {!compactView && (
                <div className="aspect-[4/3] mb-3 rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Content */}
              <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                {feature.title}
              </h4>
              <p className={twMerge(
                'text-gray-600 leading-relaxed mb-4',
                compactView ? 'text-sm' : 'text-sm'
              )}>
                {feature.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {feature.tags.slice(0, compactView ? 2 : 3).map(tag => (
                  <span key={tag} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>

              {/* User Type */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {userTypeConfig[feature.userType].icon}
                  {userTypeConfig[feature.userType].label}
                </span>
                <FontAwesomeIcon 
                  icon={faArrowRight} 
                  className="h-3 w-3 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" 
                />
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredFeatures.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No features found matching your criteria</p>
            <button
              onClick={() => {
                setSearchTerm('')
                setActiveCategory('all')
              }}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">
              Ready to Get Started?
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Try KlickerUZH free today. No credit card required, no complex setup.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
                Start Free Trial
              </button>
              <button className="border border-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
                View on GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureSmartGrid