import { H2, Prose } from '@uzh-bf/design-system'

export function CTA() {
  const buttons = [
    {
      title: 'Roadmap',
      description:
        'See what is available, what we are preparing for v3.4, and what is planned.',
      href: '/development/',
    },
    {
      title: 'Feedback',
      description:
        'Have an idea, a positive experience, or a problem to report? Share it on our public feedback platform. Please do not include personal or course data.',
      href: 'https://klicker-uzh.feedback.df-app.ch/',
    },
    {
      title: 'Community',
      description:
        'We strive to develop our roadmap and goals based on the needs of our users. If you would like to be involved in future developments, we welcome you to join our KlickerUZH community.',
      href: 'https://community.klicker.uzh.ch',
    },
  ]

  return (
    <div className="space-y-4 py-16 text-center sm:py-24 md:space-y-8">
      <H2 className={{ root: 'text-3xl font-bold' }}>Help shape KlickerUZH</H2>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {buttons.map((button) => (
          <a
            key={button.title}
            href={button.href}
            rel={
              button.href.startsWith('http') ? 'noreferrer noopener' : undefined
            }
            target={button.href.startsWith('http') ? '_blank' : undefined}
            className="group flex h-full cursor-pointer flex-col items-start rounded-xl bg-linear-to-br from-gray-50 to-gray-100 p-6 text-left text-lg shadow-lg transition-all duration-300 hover:scale-105 hover:from-gray-100 hover:to-gray-200 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
          >
            <div className="text-primary-600 mb-2 font-bold">
              {button.title}
            </div>
            <Prose
              className={{ root: 'text-gray-700 group-hover:text-gray-900' }}
            >
              {button.description}
            </Prose>
          </a>
        ))}
      </div>
    </div>
  )
}

export default CTA
