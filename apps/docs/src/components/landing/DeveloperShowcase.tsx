import {
  faDocker,
  faGithub,
  faNodeJs,
  faReact,
} from '@fortawesome/free-brands-svg-icons'
import {
  faApi,
  faArrowRight,
  faCode,
  faCubes,
  faRocket,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const techStack = [
  {
    name: 'React',
    icon: faReact,
    color: 'text-blue-500',
    description: 'Modern UI framework',
  },
  {
    name: 'Node.js',
    icon: faNodeJs,
    color: 'text-green-500',
    description: 'Server runtime',
  },
  {
    name: 'GraphQL',
    icon: faApi,
    color: 'text-purple-500',
    description: 'API layer',
  },
  {
    name: 'PostgreSQL',
    icon: faCode,
    color: 'text-blue-600',
    description: 'Database',
  },
  {
    name: 'Docker',
    icon: faDocker,
    color: 'text-blue-400',
    description: 'Containerization',
  },
  {
    name: 'TypeScript',
    icon: faCode,
    color: 'text-blue-700',
    description: 'Type safety',
  },
]

const extensionPoints = [
  {
    title: 'Custom Question Types',
    description:
      'Extend the platform with your own interactive question formats',
    code: `interface CustomQuestion {
  type: 'my-custom-type'
  options: MyQuestionOptions
  validator: (answer: any) => boolean
}`,
    docs: '/docs/extensions/questions',
  },
  {
    title: 'Plugin System',
    description:
      'Create plugins for analytics, integrations, and custom workflows',
    code: `export const myPlugin: KlickerPlugin = {
  name: 'analytics-plus',
  hooks: {
    onQuizComplete: handleResults,
    onStudentJoin: trackParticipant
  }
}`,
    docs: '/docs/extensions/plugins',
  },
  {
    title: 'API Integration',
    description:
      'Integrate with your existing systems using our comprehensive GraphQL API',
    code: `query GetCourseAnalytics($courseId: ID!) {
  course(id: $courseId) {
    analytics {
      participantCount
      averageScore
      completionRate
    }
  }
}`,
    docs: '/docs/api/graphql',
  },
]

const developmentFeatures = [
  {
    icon: faRocket,
    title: 'Easy Deployment',
    description: 'Deploy with Docker Compose in minutes',
    highlight: '< 5 min setup',
  },
  {
    icon: faApi,
    title: 'Rich API',
    description: 'GraphQL API with comprehensive documentation',
    highlight: '100+ operations',
  },
  {
    icon: faCubes,
    title: 'Modular Architecture',
    description: 'Well-structured codebase with clear separation',
    highlight: 'Clean code',
  },
]

export function DeveloperShowcase() {
  return (
    <div className="bg-gray-900 py-16 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium">
            <FontAwesomeIcon icon={faCode} className="h-4 w-4" />
            <span>For Developers</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Built to be Extended
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-gray-300">
            Modern architecture, comprehensive APIs, and extensible design for
            developers who want to customize and extend
          </p>
        </div>

        {/* Tech Stack */}
        <div className="mb-16">
          <h3 className="mb-8 text-center text-2xl font-semibold">
            Modern Technology Stack
          </h3>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
            {techStack.map((tech) => (
              <div key={tech.name} className="group text-center">
                <div className="mb-3 rounded-xl bg-gray-800 p-6 transition-colors hover:bg-gray-700">
                  <FontAwesomeIcon
                    icon={tech.icon}
                    className={`h-8 w-8 ${tech.color} transition-transform group-hover:scale-110`}
                  />
                </div>
                <div className="mb-1 text-sm font-medium text-gray-200">
                  {tech.name}
                </div>
                <div className="text-xs text-gray-400">{tech.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Development Features */}
        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {developmentFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-gray-800 p-6 transition-colors hover:bg-gray-700"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-lg bg-red-600 p-3">
                  <FontAwesomeIcon icon={feature.icon} className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">{feature.title}</h4>
                  <div className="text-xs font-medium text-red-400">
                    {feature.highlight}
                  </div>
                </div>
              </div>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Extension Points */}
        <div className="mb-16">
          <h3 className="mb-8 text-center text-2xl font-semibold">
            Extension Points
          </h3>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {extensionPoints.map((point, index) => (
              <div
                key={point.title}
                className="overflow-hidden rounded-xl bg-gray-800"
              >
                <div className="p-6 pb-4">
                  <h4 className="mb-2 text-lg font-semibold">{point.title}</h4>
                  <p className="mb-4 text-sm text-gray-300">
                    {point.description}
                  </p>

                  {/* Code Example */}
                  <div className="mb-4 rounded-lg bg-gray-900 p-4">
                    <pre className="overflow-x-auto text-xs text-gray-300">
                      <code>{point.code}</code>
                    </pre>
                  </div>

                  <a
                    href={point.docs}
                    className="inline-flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300"
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
        <div className="rounded-2xl bg-gray-800 p-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-semibold">
                Get Started in Minutes
              </h3>
              <p className="mb-6 text-gray-300">
                Deploy KlickerUZH locally or in the cloud with our comprehensive
                setup guides and Docker configurations.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold">
                    1
                  </div>
                  <span className="text-sm text-gray-300">
                    Clone the repository
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold">
                    2
                  </div>
                  <span className="text-sm text-gray-300">
                    Run docker-compose up
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold">
                    3
                  </div>
                  <span className="text-sm text-gray-300">
                    Access at localhost:3000
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 p-6">
              <div className="mb-4 flex items-center gap-2 text-gray-400">
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
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/uzh-bf/klicker-uzh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-100"
            >
              <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
              <span>View on GitHub</span>
            </a>
            <a
              href="/docs/development/setup"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
            >
              <FontAwesomeIcon icon={faCode} className="h-4 w-4" />
              <span>Developer Guide</span>
            </a>
            <a
              href="/docs/api/graphql"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
            >
              <FontAwesomeIcon icon={faApi} className="h-4 w-4" />
              <span>API Reference</span>
            </a>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 border-t border-gray-800 pt-8 text-center">
          <p className="text-sm text-gray-400">
            Questions about extending KlickerUZH? Check our{' '}
            <a
              href="/docs/development"
              className="text-red-400 underline hover:text-red-300"
            >
              developer documentation
            </a>{' '}
            or{' '}
            <a
              href="https://github.com/uzh-bf/klicker-uzh/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 underline hover:text-red-300"
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
