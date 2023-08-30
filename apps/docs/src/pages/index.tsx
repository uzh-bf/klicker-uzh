import Layout from '@theme/Layout'
import { Button, H1, H2, H3, Prose } from '@uzh-bf/design-system'

import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FEATURES, USE_CASES } from '../constants'

function Separator() {
  // Add a class style which fades from transparent to uzh-grey-20 at 20% and back to transparent from 80%
  return (
    <div className="my-10 w-full h-1.5 bg-gradient-to-r from-transparent via-uzh-grey-40 to-transparent"></div>
  )
}

function TitleImage() {
  return (
    <div className="relative">
      <img className="object-cover md:h-full h-64" src="/img_v3/hero_2.png" />
      <div className="absolute bottom-4 left-0 right-0 md:right-auto md:bottom-[50px] md:left-[50px] bg-slate-100 bg-opacity-80 px-4 py-2 md:rounded">
        <H1 className={{ root: 'text-2xl md:text-6xl m-0' }}>KlickerUZH</H1>
        <H2 className={{ root: 'text-xl md:text-3xl m-0' }}>
          Enhance your classroom experience.
        </H2>
      </div>
      <div className="text-lg md:text-2xl w-2/3"></div>
    </div>
  )
}

function CTA() {
  return (
    <div className="text-center space-y-8">
      <H2 className={{ root: 'text-3xl' }}>Be Part of the Journey</H2>
      <div>
        <a href="https://manage.klicker.uzh.ch">
          <Button
            className={{
              root: 'cursor-pointer text-2xl bg-slate-200 border-slate-300',
            }}
          >
            Sign In
          </Button>
        </a>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
        <a
          href="https://klicker-uzh.feedbear.com"
          rel="noreferrer noopener"
          target="_blank"
        >
          <Button
            className={{
              root: 'cursor-pointer p-4 text-xl flex-col items-start text-left bg-slate-200 border-slate-300',
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
              root: 'cursor-pointer p-4 text-xl flex-col items-start text-left bg-slate-200 border-slate-300',
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

function FeatureOverview() {
  return (
    <div className="space-y-4">
      <H2>Features</H2>
      <div className="grid grid-cols-1 md:grid-cols-3 w-full gap-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="shadow p-4 space-y-2 rounded">
            <H3>{feature.title}</H3>
            <Prose>{feature.text}</Prose>
            {feature.href && (
              <a className="inline-flex gap-2 items-center" href={feature.href}>
                <FontAwesomeIcon icon={faArrowRight} />
                <div>Read more</div>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function UseCaseOverview() {
  return (
    <div className="space-y-4">
      <H2>Use Cases</H2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded">
        {Object.entries(USE_CASES).map(([href, item]) => (
          <div
            key={item.title}
            className="shadow p-4 flex flex-col gap-4 justify-between"
          >
            <div className="flex-1">
              <H3>{item.title}</H3>
              <Prose className={{ root: 'prose-sm' }}>{item.abstract}</Prose>
            </div>
            <div className="flex-none">
              <a
                className="inline-flex gap-2 items-center"
                href={`/use_cases/${href}`}
              >
                <FontAwesomeIcon icon={faArrowRight} />
                <div>More Details</div>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Home() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 p-4">
        <TitleImage />
        <CTA />
        <Separator />
        <FeatureOverview />
        <Separator />
        <UseCaseOverview />
      </div>
    </Layout>
  )
}

export default Home
