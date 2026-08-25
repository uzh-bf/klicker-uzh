import { Button, H2, Prose } from '@uzh-bf/design-system'

export function CTA() {
  const buttons = [
    {
      title: 'Roadmap',
      description:
        "Are you interested in what's next? Check out our current Roadmap! For ideas, positive experiences, or problems, please use our Feedback platform.",
      href: 'https://www.klicker.uzh.ch/development',
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
      <H2 className={{ root: 'text-3xl font-bold' }}>Be Part of the Journey</H2>
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
        {buttons.map((button, index) => (
          <a
            key={index}
            href={button.href}
            rel="noreferrer noopener"
            target="_blank"
            className="group transition-transform duration-300 hover:scale-105"
          >
            <Button
              className={{
                root: 'bg-linear-to-br h-full w-full cursor-pointer flex-col items-start whitespace-normal rounded-xl border-none from-gray-50 to-gray-100 p-6 text-left text-lg shadow-lg transition-all duration-300 hover:from-gray-100 hover:to-gray-200 hover:shadow-xl',
              }}
            >
              <div className="text-primary-600 mb-2 font-bold">
                {button.title}
              </div>
              <Prose
                className={{ root: 'text-gray-700 group-hover:text-gray-900' }}
              >
                {button.description}
              </Prose>
            </Button>
          </a>
        ))}
      </div>
    </div>
  )
}

export default CTA
