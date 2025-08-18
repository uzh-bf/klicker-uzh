import { faSearch, faFilter, faArrowRight, faPlay, faStar, faUsers, faGraduationCap, faClock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

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
    return features.filter(feature => {
      const matchesSearch = feature.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           feature.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           feature.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory
      const matchesUserType = selectedUserType === 'all' || feature.userType === selectedUserType || feature.userType === 'both'
      
      return matchesSearch && matchesCategory && matchesUserType
    })
  }, [searchTerm, selectedCategory, selectedUserType])

  const heroFeaturesData = features.filter(f => heroFeatures.includes(f.id))
  const regularFeatures = filteredFeatures.filter(f => !heroFeatures.includes(f.id))

  return (
    <div className="py-16 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Find Your Perfect Teaching Solution
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Explore features tailored to your teaching style and discover new ways to engage your students
          </p>
        </div>

        {/* Hero Features */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FontAwesomeIcon icon={faStar} className="h-5 w-5 text-yellow-500" />
            Most Popular Features
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {heroFeaturesData.map(feature => (
              <div key={feature.id} className="relative bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border-2 border-red-200 shadow-lg hover:shadow-xl transition-all group">
                <div className="absolute top-4 right-4 flex gap-2">
                  {feature.isNew && (
                    <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">NEW</span>
                  )}
                  {feature.isPopular && (
                    <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">POPULAR</span>
                  )}
                </div>
                
                <div className="aspect-[4/3] mb-4 rounded-lg overflow-hidden bg-white/50">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                <h4 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-gray-600 mb-4">{feature.text}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {feature.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="bg-white/70 px-2 py-1 rounded text-xs text-gray-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="text-red-600 hover:text-red-700 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
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
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
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
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FontAwesomeIcon icon={faFilter} className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Categories</option>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                  <select
                    value={selectedUserType}
                    onChange={(e) => setSelectedUserType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              All Features {filteredFeatures.length < features.length && `(${filteredFeatures.length} of ${features.length})`}
            </h3>
            <div className="text-sm text-gray-600">
              {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''} found
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularFeatures.map(feature => (
              <div key={feature.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-red-200 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-2">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
                      {categoryLabels[feature.category]}
                    </span>
                    {feature.isNew && (
                      <span className="bg-red-100 px-2 py-1 rounded text-xs text-red-600">NEW</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FontAwesomeIcon icon={faClock} className="h-3 w-3" />
                    {difficultyLabels[feature.difficulty]}
                  </div>
                </div>
                
                <div className="aspect-[4/3] mb-3 rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                  {feature.title}
                </h4>
                <p className="text-gray-600 text-sm mb-3">{feature.text}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {feature.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start Wizard */}
        <div className="bg-gradient-to-r from-gray-50 to-red-50 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Not sure where to start?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Take our quick assessment to get personalized feature recommendations based on your teaching style and goals.
          </p>
          <button className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium">
            Start Quick Assessment
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeatureJourney