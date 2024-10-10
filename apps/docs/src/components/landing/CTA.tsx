import { Button, H2, Prose } from '@uzh-bf/design-system'

export function CTA() {
  return (
    <div className="space-y-4 py-16 text-center sm:py-24 md:space-y-8">
      <H2 className={{ root: 'text-3xl' }}>Be Part of the Journey</H2>
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        <a
          href="https://klicker-uzh.feedbear.com"
          rel="noreferrer noopener"
          target="_blank"
        >
          <Button
            className={{
              root: 'bg-uzh-blue-20 border-uzh-blue-100 cursor-pointer flex-col items-start p-4 text-left text-xl',
            }}
          >
            <div className="font-bold">Roadmap</div>
            <Prose>
              Are you interested in what's next? Check out our current Roadmap!
              We are also very happy about any feedbacks or bug reports. In
              urgent cases, you should contact us through our support channels.
            </Prose>
          </Button>
        </a>
        <a
          href="https://community.klicker.uzh.ch"
          rel="noreferrer noopener"
          target="_blank"
        >
          <Button
            className={{
              root: 'bg-uzh-blue-20 border-uzh-blue-100 cursor-pointer flex-col items-start p-4 text-left text-xl',
            }}
          >
            <div className="font-bold">Community</div>
            <Prose>
              We strive to develop our roadmap and goals based on the needs of
              our users. If you would like to be involved in future
              developments, we welcome you to join our KlickerUZH community.
            </Prose>
          </Button>
        </a>
      </div>
    </div>
  )
}
export default CTA;
