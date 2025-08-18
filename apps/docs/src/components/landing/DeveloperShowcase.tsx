import { faCode, faApi, faCubes, faRocket, faArrowRight, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { faReact, faNodeJs, faDocker, faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const techStack = [
  { name: 'React', icon: faReact, color: 'text-blue-500', description: 'Modern UI framework' },
  { name: 'Node.js', icon: faNodeJs, color: 'text-green-500', description: 'Server runtime' },
  { name: 'GraphQL', icon: faApi, color: 'text-purple-500', description: 'API layer' },
  { name: 'PostgreSQL', icon: faCode, color: 'text-blue-600', description: 'Database' },
  { name: 'Docker', icon: faDocker, color: 'text-blue-400', description: 'Containerization' },
  { name: 'TypeScript', icon: faCode, color: 'text-blue-700', description: 'Type safety' },
]

const extensionPoints = [
  {
    title: 'Custom Question Types',
    description: 'Extend the platform with your own interactive question formats',
    code: `interface CustomQuestion {
  type: 'my-custom-type'
  options: MyQuestionOptions
  validator: (answer: any) => boolean
}`,
    docs: '/docs/extensions/questions'
  },
  {
    title: 'Plugin System',
    description: 'Create plugins for analytics, integrations, and custom workflows',
    code: `export const myPlugin: KlickerPlugin = {
  name: 'analytics-plus',
  hooks: {
    onQuizComplete: handleResults,
    onStudentJoin: trackParticipant
  }
}`,
    docs: '/docs/extensions/plugins'
  },
  {
    title: 'API Integration',
    description: 'Integrate with your existing systems using our comprehensive GraphQL API',
    code: `query GetCourseAnalytics($courseId: ID!) {
  course(id: $courseId) {
    analytics {
      participantCount
      averageScore
      completionRate
    }
  }
}`,
    docs: '/docs/api/graphql'
  },
]

const developmentFeatures = [
  {
    icon: faRocket,
    title: 'Easy Deployment',
    description: 'Deploy with Docker Compose in minutes',
    highlight: '< 5 min setup'
  },
  {
    icon: faApi,
    title: 'Rich API',
    description: 'GraphQL API with comprehensive documentation',
    highlight: '100+ operations'
  },
  {
    icon: faCubes,
    title: 'Modular Architecture',
    description: 'Well-structured codebase with clear separation',
    highlight: 'Clean code'
  },
]

export function DeveloperShowcase() {
  return (
    <div className="bg-gray-900 text-white py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <FontAwesomeIcon icon={faCode} className="h-4 w-4" />
            <span>For Developers</span>
          </div>
          <h2 className="text-3xl font-bold sm:text-4xl mb-4">
            Built to be Extended
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Modern architecture, comprehensive APIs, and extensible design for developers who want to customize and extend
          </p>
        </div>

        {/* Tech Stack */}
        <div className="mb-16">
          <h3 className="text-2xl font-semibold mb-8 text-center">Modern Technology Stack</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {techStack.map(tech => (
              <div key={tech.name} className="text-center group">
                <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition-colors mb-3">
                  <FontAwesomeIcon 
                    icon={tech.icon} 
                    className={`h-8 w-8 ${tech.color} group-hover:scale-110 transition-transform`} 
                  />
                </div>
                <div className="text-sm font-medium text-gray-200 mb-1">{tech.name}</div>
                <div className="text-xs text-gray-400">{tech.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Development Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {developmentFeatures.map(feature => (
            <div key={feature.title} className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-600 rounded-lg p-3">
                  <FontAwesomeIcon icon={feature.icon} className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">{feature.title}</h4>
                  <div className="text-xs text-red-400 font-medium">{feature.highlight}</div>
                </div>
              </div>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Extension Points */}
        <div className="mb-16">
          <h3 className="text-2xl font-semibold mb-8 text-center">Extension Points</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {extensionPoints.map((point, index) => (
              <div key={point.title} className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="p-6 pb-4">
                  <h4 className="text-lg font-semibold mb-2">{point.title}</h4>
                  <p className="text-gray-300 text-sm mb-4">{point.description}</p>
                  
                  {/* Code Example */}
                  <div className="bg-gray-900 rounded-lg p-4 mb-4">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      <code>{point.code}</code>
                    </pre>
                  </div>
                  
                  <a 
                    href={point.docs}
                    className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    <span>View Documentation</span>
                    <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-gray-800 rounded-2xl p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Get Started in Minutes
              </h3>
              <p className="text-gray-300 mb-6">
                Deploy KlickerUZH locally or in the cloud with our comprehensive setup guides and Docker configurations.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <span className="text-sm text-gray-300">Clone the repository</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <span className="text-sm text-gray-300">Run docker-compose up</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <span className="text-sm text-gray-300">Access at localhost:3000</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4 text-gray-400">
                <FontAwesomeIcon icon={faCode} className="h-4 w-4" />
                <span className="text-sm">Terminal</span>
              </div>
              <pre className="text-sm text-green-400">
                <code>{`git clone https://github.com/uzh-bf/klicker-uzh
cd klicker-uzh
cp .env.example .env
docker-compose up -d

# 🚀 Running on http://localhost:3000`}</code>
              </pre>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
            <a 
              href="https://github.com/uzh-bf/klicker-uzh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
              <span>View on GitHub</span>
            </a>
            <a 
              href="/docs/development/setup"
              className="inline-flex items-center justify-center gap-2 border border-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              <FontAwesomeIcon icon={faCode} className="h-4 w-4" />
              <span>Developer Guide</span>
            </a>
            <a 
              href="/docs/api/graphql"
              className="inline-flex items-center justify-center gap-2 border border-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              <FontAwesomeIcon icon={faApi} className="h-4 w-4" />
              <span>API Reference</span>
            </a>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12 pt-8 border-t border-gray-800">
          <p className="text-gray-400 text-sm">
            Questions about extending KlickerUZH? Check our{' '}
            <a href="/docs/development" className="text-red-400 hover:text-red-300 underline">
              developer documentation
            </a>{' '}
            or{' '}
            <a 
              href="https://github.com/uzh-bf/klicker-uzh/discussions" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 underline"
            >
              start a discussion
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default DeveloperShowcase