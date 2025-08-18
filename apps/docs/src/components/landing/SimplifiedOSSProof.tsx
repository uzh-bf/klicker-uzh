import { faGithub } from '@fortawesome/free-brands-svg-icons'
import {
  faBookOpen,
  faCode,
  faCogs,
  faDownload,
  faHeart,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const benefits = [
  {
    icon: faCode,
    title: 'Open Source',
    description: 'MIT licensed, free forever',
    highlight: 'MIT License',
  },
  {
    icon: faCogs,
    title: 'Self-Hosted',
    description: 'Full control over your data',
    highlight: 'Your Data, Your Server',
  },
  {
    icon: faBookOpen,
    title: 'Extensible',
    description: 'Customize and extend as needed',
    highlight: 'API + Plugins',
  },
]

const features = [
  {
    icon: '🔒',
    text: 'Privacy-first design',
  },
  {
    icon: '🌍',
    text: 'Community-driven development',
  },
  {
    icon: '📱',
    text: 'Modern web technologies',
  },
  {
    icon: '🚀',
    text: 'Active development',
  },
  {
    icon: '📚',
    text: 'Comprehensive documentation',
  },
  {
    icon: '🔧',
    text: 'Easy deployment',
  },
]

export function SimplifiedOSSProof() {
  return (
    <div className="bg-gradient-to-b from-white via-gray-50 to-white py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-3 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
            <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
            <span>Open Source Education Platform</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Built for Education, By Educators
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-gray-600">
            KlickerUZH is developed openly, prioritizing transparency, privacy,
            and community collaboration
          </p>
        </div>

        {/* Main Benefits */}
        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div key={benefit.title} className="group text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 transition-colors group-hover:bg-red-50">
                <FontAwesomeIcon
                  icon={benefit.icon}
                  className="h-8 w-8 text-gray-600 transition-colors group-hover:text-red-600"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                {benefit.title}
              </h3>
              <p className="mb-3 text-gray-600">{benefit.description}</p>
              <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {benefit.highlight}
              </div>
            </div>
          ))}
        </div>

        {/* Feature Grid */}
        <div className="mb-12 rounded-2xl border border-gray-200 bg-white p-8">
          <h3 className="mb-8 text-center text-xl font-semibold text-gray-900">
            Why Choose Open Source?
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-2xl">{feature.icon}</span>
                <span className="text-gray-700">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-center">
          <h3 className="mb-4 text-2xl font-bold text-white">
            Join the Open Source Movement
          </h3>
          <p className="mx-auto mb-8 max-w-2xl text-gray-300">
            Contribute to the future of education technology. Every contribution
            helps make learning more accessible worldwide.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/uzh-bf/klicker-uzh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-100"
            >
              <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
              <span>View Source Code</span>
            </a>
            <a
              href="/getting_started/welcome"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
            >
              <FontAwesomeIcon icon={faBookOpen} className="h-4 w-4" />
              <span>Documentation</span>
            </a>
            <a
              href="https://github.com/uzh-bf/klicker-uzh/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
            >
              <FontAwesomeIcon icon={faDownload} className="h-4 w-4" />
              <span>Download</span>
            </a>
          </div>

          {/* Contribution Note */}
          <div className="mt-8 border-t border-gray-700 pt-6">
            <p className="mb-4 text-sm text-gray-400">
              Made with{' '}
              <FontAwesomeIcon
                icon={faHeart}
                className="mx-1 h-4 w-4 text-red-500"
              />{' '}
              by the{' '}
              <a
                href="https://www.df.uzh.ch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 underline hover:text-white"
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
                className="text-gray-400 underline hover:text-white"
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
