import { faGithub, faGitAlt } from '@fortawesome/free-brands-svg-icons'
import { faCode, faUsers, faHeart, faDownload, faBookOpen, faCogs } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const benefits = [
  {
    icon: faCode,
    title: 'Open Source',
    description: 'MIT licensed, free forever',
    highlight: 'MIT License'
  },
  {
    icon: faCogs,
    title: 'Self-Hosted',
    description: 'Full control over your data',
    highlight: 'Your Data, Your Server'
  },
  {
    icon: faBookOpen,
    title: 'Extensible',
    description: 'Customize and extend as needed',
    highlight: 'API + Plugins'
  },
]

const features = [
  {
    icon: '🔒',
    text: 'Privacy-first design'
  },
  {
    icon: '🌍',
    text: 'Community-driven development'
  },
  {
    icon: '📱',
    text: 'Modern web technologies'
  },
  {
    icon: '🚀',
    text: 'Active development'
  },
  {
    icon: '📚',
    text: 'Comprehensive documentation'
  },
  {
    icon: '🔧',
    text: 'Easy deployment'
  },
]

export function SimplifiedOSSProof() {
  return (
    <div className="bg-gradient-to-b from-white via-gray-50 to-white py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-full text-sm font-medium text-gray-700 mb-4">
            <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
            <span>Open Source Education Platform</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
            Built for Education, By Educators
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            KlickerUZH is developed openly, prioritizing transparency, privacy, and community collaboration
          </p>
        </div>

        {/* Main Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div key={benefit.title} className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-6 group-hover:bg-red-50 transition-colors">
                <FontAwesomeIcon icon={benefit.icon} className="h-8 w-8 text-gray-600 group-hover:text-red-600 transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {benefit.title}
              </h3>
              <p className="text-gray-600 mb-3">
                {benefit.description}
              </p>
              <div className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                {benefit.highlight}
              </div>
            </div>
          ))}
        </div>

        {/* Feature Grid */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-12">
          <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center">
            Why Choose Open Source?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-2xl">{feature.icon}</span>
                <span className="text-gray-700">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            Join the Open Source Movement
          </h3>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Contribute to the future of education technology. Every contribution helps make learning more accessible worldwide.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://github.com/uzh-bf/klicker-uzh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
              <span>View Source Code</span>
            </a>
            <a 
              href="/getting_started/welcome"
              className="inline-flex items-center justify-center gap-2 border border-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              <FontAwesomeIcon icon={faBookOpen} className="h-4 w-4" />
              <span>Documentation</span>
            </a>
            <a 
              href="https://github.com/uzh-bf/klicker-uzh/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              <FontAwesomeIcon icon={faDownload} className="h-4 w-4" />
              <span>Download</span>
            </a>
          </div>

          {/* Contribution Note */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-4">
              Made with <FontAwesomeIcon icon={faHeart} className="h-4 w-4 text-red-500 mx-1" /> by the{' '}
              <a 
                href="https://www.df.uzh.ch" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white underline"
              >
                Department of Finance, University of Zurich
              </a>
            </p>
            <div className="text-xs text-gray-500">
              <span>Want to contribute? </span>
              <a 
                href="https://github.com/uzh-bf/klicker-uzh/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white underline"
              >
                Read our contribution guide
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimplifiedOSSProof